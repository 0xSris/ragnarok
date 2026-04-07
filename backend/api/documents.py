"""
Documents API — upload, list, delete, status.
Runs ingestion pipeline in background task.
"""
import json
import uuid
import shutil
import logging
from pathlib import Path
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, File, UploadFile, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.auth.utils import get_current_user
from backend.core.config import settings
from backend.core.database import DB_PATH

# Try to import vector store, but don't fail if not available
try:
    from backend.core.vector_store import VectorStore
    VECTOR_STORE_AVAILABLE = True
except ImportError:
    VECTOR_STORE_AVAILABLE = False
    logger.warning("Vector store not available - document indexing disabled")

from backend.ingestion.pipeline import ingest_file, EXTRACTORS

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = set(EXTRACTORS.keys())


async def _process_document(doc_id: str, file_path: Path, collection_id: str):
    """Background task: ingest file and index chunks."""
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            result = ingest_file(file_path)
            
            # Only index in vector store if available
            if VECTOR_STORE_AVAILABLE:
                vs = VectorStore()
                vs.upsert_chunks(collection_id, doc_id, result["chunks"])
                logger.info(f"✅ Document {doc_id} indexed in vector store")
            else:
                logger.info(f"ℹ️ Document {doc_id} processed (vector store disabled)")

            await db.execute("""
                UPDATE documents SET
                    status='ready', chunk_count=?, page_count=?, word_count=?,
                    file_type=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (
                result["chunk_count"], result["page_count"],
                result["word_count"], result["file_type"], doc_id,
            ))
            await db.commit()
            logger.info(f"✅ Document {doc_id} processed successfully")
        except Exception as e:
            logger.error(f"❌ Document {doc_id} failed: {e}")
            await db.execute("""
                UPDATE documents SET status='error', error_message=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (str(e), doc_id))
            await db.commit()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    collection_id: str = Query(default=None),
    tags: str = Query(default="[]"),
    current_user=Depends(get_current_user),
):
    if not collection_id:
        # Use default collection
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT id FROM collections LIMIT 1") as cur:
                row = await cur.fetchone()
                collection_id = row[0] if row else str(uuid.uuid4())

    uploaded = []
    for file in files:
        suffix = Path(file.filename).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {suffix}. Allowed: {list(ALLOWED_EXTENSIONS)}",
            )

        doc_id = str(uuid.uuid4())
        save_name = f"{doc_id}{suffix}"
        save_path = settings.UPLOADS_DIR / save_name

        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        file_size = save_path.stat().st_size

        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("""
                INSERT INTO documents
                    (id, filename, original_filename, file_type, file_size,
                     collection_id, owner_id, status, tags)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (
                doc_id, save_name, file.filename, suffix.lstrip("."),
                file_size, collection_id, current_user["id"], "processing", tags,
            ))
            await db.commit()

        background_tasks.add_task(_process_document, doc_id, save_path, collection_id)
        uploaded.append({"id": doc_id, "filename": file.filename, "status": "processing"})

    return {"uploaded": uploaded, "count": len(uploaded)}


@router.get("/")
async def list_documents(
    collection_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    offset = (page - 1) * page_size
    conditions = ["owner_id = ? OR owner_id = 'guest'"]
    params = [current_user["id"]]

    if collection_id:
        conditions.append("collection_id = ?")
        params.append(collection_id)
    if status:
        conditions.append("status = ?")
        params.append(status)

    where = " AND ".join(conditions)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"SELECT COUNT(*) FROM documents WHERE {where}", params
        ) as cur:
            total = (await cur.fetchone())[0]

        async with db.execute(
            f"""SELECT * FROM documents WHERE {where}
                ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            params + [page_size, offset],
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

    return {"documents": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/{doc_id}")
async def get_document(doc_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM documents WHERE id=?", (doc_id,)) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return dict(row)


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM documents WHERE id=?", (doc_id,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        doc = dict(row)
        # Remove from vector store
        vs = VectorStore()
        vs.delete_document(doc["collection_id"], doc_id)

        # Remove file
        file_path = settings.UPLOADS_DIR / doc["filename"]
        if file_path.exists():
            file_path.unlink()

        await db.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        await db.commit()

    return {"deleted": doc_id}


@router.post("/{doc_id}/retag")
async def retag_document(
    doc_id: str,
    tags: List[str],
    current_user=Depends(get_current_user),
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE documents SET tags=? WHERE id=?", (json.dumps(tags), doc_id)
        )
        await db.commit()
    return {"doc_id": doc_id, "tags": tags}
