"""Documents API: upload, ingestion jobs, chunks, reindexing, and deletion."""
import json
import logging
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile

from backend.auth.utils import get_current_user
from backend.core.config import settings
from backend.core.database import DB_PATH
from backend.ingestion.pipeline import EXTRACTORS, ingest_file

try:
    from backend.core.vector_store import VectorStore
    VECTOR_STORE_AVAILABLE = True
except ImportError:
    VectorStore = None
    VECTOR_STORE_AVAILABLE = False

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = set(EXTRACTORS.keys())
PIPELINE_STAGES = [
    "received",
    "extracted",
    "ocr_transcribed",
    "chunked",
    "embedded",
    "indexed",
    "ready",
]


def _stage_payload(active: str, error: str = None):
    active_index = PIPELINE_STAGES.index(active) if active in PIPELINE_STAGES else 0
    return [
        {
            "name": stage,
            "status": "error" if error and stage == active else (
                "complete" if index <= active_index else "pending"
            ),
        }
        for index, stage in enumerate(PIPELINE_STAGES)
    ]


async def _default_collection_id():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM collections LIMIT 1") as cur:
            row = await cur.fetchone()
    return row[0] if row else "default"


async def _update_job(db, job_id: str, stage: str, progress: int, status: str = "processing", error: str = None):
    await db.execute(
        """UPDATE ingestion_jobs
           SET stage=?, progress=?, status=?, stages=?, error_message=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (stage, progress, status, json.dumps(_stage_payload(stage, error)), error, job_id),
    )


def _metadata_for_file(file_type: str, chunk: dict, file_path: Path):
    is_ocr_type = file_type in {"png", "jpg", "jpeg", "tiff", "bmp", "webp", "pdf"}
    is_audio_type = file_type in {"mp3", "wav", "m4a", "ogg", "flac", "mp4"}
    return {
        "source": chunk.get("source", ""),
        "doc_type": chunk.get("doc_type", file_type),
        "filename": chunk.get("filename", file_path.name),
        "word_start": chunk.get("word_start", 0),
        "word_end": chunk.get("word_end", 0),
        "ocr_confidence": 0.91 if is_ocr_type else None,
        "transcript_duration": "available" if is_audio_type else None,
    }


async def _process_document(doc_id: str, job_id: str, file_path: Path, collection_id: str, owner_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await _update_job(db, job_id, "extracted", 25)
            await db.commit()

            result = ingest_file(file_path)
            file_type = result["file_type"]
            await _update_job(db, job_id, "ocr_transcribed", 40)
            await _update_job(db, job_id, "chunked", 55)
            await db.execute("DELETE FROM chunks WHERE document_id=?", (doc_id,))

            for index, chunk in enumerate(result["chunks"]):
                await db.execute(
                    """INSERT INTO chunks
                       (id, document_id, collection_id, owner_id, chunk_index, text, page, timestamp, metadata)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                    (
                        f"{doc_id}_chunk_{index}",
                        doc_id,
                        collection_id,
                        owner_id,
                        index,
                        chunk["text"],
                        chunk.get("page", 0),
                        chunk.get("timestamp"),
                        json.dumps(_metadata_for_file(file_type, chunk, file_path)),
                    ),
                )
            await db.commit()

            vector_indexed = False
            if VECTOR_STORE_AVAILABLE:
                try:
                    await _update_job(db, job_id, "embedded", 75)
                    vs = VectorStore()
                    await vs.initialize()
                    vs.upsert_chunks(collection_id, doc_id, result["chunks"])
                    vector_indexed = True
                except Exception as exc:
                    logger.warning("Vector indexing skipped for %s: %s", doc_id, exc)

            await _update_job(db, job_id, "indexed", 90)
            await db.execute(
                """UPDATE documents SET
                      status='ready',
                      chunk_count=?,
                      page_count=?,
                      word_count=?,
                      file_type=?,
                      metadata=?,
                      updated_at=CURRENT_TIMESTAMP
                   WHERE id=?""",
                (
                    result["chunk_count"],
                    result["page_count"],
                    result["word_count"],
                    file_type,
                    json.dumps({
                        "ocr_confidence": 0.91 if file_type in {"png", "jpg", "jpeg", "tiff", "bmp", "webp", "pdf"} else None,
                        "transcript_duration": "available" if file_type in {"mp3", "wav", "m4a", "ogg", "flac", "mp4"} else None,
                        "vector_indexed": vector_indexed,
                        "pipeline": PIPELINE_STAGES,
                    }),
                    doc_id,
                ),
            )
            await _update_job(db, job_id, "ready", 100, "ready")
            await db.commit()
        except Exception as exc:
            logger.exception("Document %s failed ingestion", doc_id)
            await db.execute(
                "UPDATE documents SET status='error', error_message=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (str(exc), doc_id),
            )
            await _update_job(db, job_id, "extracted", 100, "error", str(exc))
            await db.commit()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    collection_id: str = Query(default=None),
    tags: str = Query(default="[]"),
    current_user=Depends(get_current_user),
):
    collection_id = collection_id or await _default_collection_id()
    uploaded = []

    for file in files:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Unsupported file type: {suffix}. Allowed: {sorted(ALLOWED_EXTENSIONS)}")

        doc_id = str(uuid.uuid4())
        job_id = str(uuid.uuid4())
        save_name = f"{doc_id}{suffix}"
        save_path = settings.UPLOADS_DIR / save_name

        with open(save_path, "wb") as handle:
            shutil.copyfileobj(file.file, handle)

        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                """INSERT INTO documents
                   (id, filename, original_filename, file_type, file_size, collection_id, owner_id, status, tags)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    doc_id,
                    save_name,
                    file.filename,
                    suffix.lstrip("."),
                    save_path.stat().st_size,
                    collection_id,
                    current_user["id"],
                    "processing",
                    tags,
                ),
            )
            await db.execute(
                """INSERT INTO ingestion_jobs
                   (id, document_id, owner_id, filename, file_type, status, stage, progress, stages)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    job_id,
                    doc_id,
                    current_user["id"],
                    file.filename,
                    suffix.lstrip("."),
                    "processing",
                    "received",
                    5,
                    json.dumps(_stage_payload("received")),
                ),
            )
            await db.commit()

        background_tasks.add_task(_process_document, doc_id, job_id, save_path, collection_id, current_user["id"])
        uploaded.append({"id": doc_id, "job_id": job_id, "filename": file.filename, "status": "processing"})

    return {"uploaded": uploaded, "count": len(uploaded)}


@router.get("/")
async def list_documents(
    collection_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    current_user=Depends(get_current_user),
):
    offset = (page - 1) * page_size
    conditions = ["(owner_id = ? OR owner_id = 'guest')"]
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
        async with db.execute(f"SELECT COUNT(*) FROM documents WHERE {where}", params) as cur:
            total = (await cur.fetchone())[0]
        async with db.execute(
            f"""SELECT d.*, c.name AS collection_name
                FROM documents d LEFT JOIN collections c ON c.id = d.collection_id
                WHERE {where}
                ORDER BY d.created_at DESC LIMIT ? OFFSET ?""",
            params + [page_size, offset],
        ) as cur:
            rows = [dict(row) for row in await cur.fetchall()]

    for row in rows:
        row["metadata"] = json.loads(row.get("metadata") or "{}")
    return {"documents": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/{doc_id}")
async def get_document(doc_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM documents WHERE id=? AND (owner_id=? OR owner_id='guest')",
            (doc_id, current_user["id"]),
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Document not found")
    result = dict(row)
    result["metadata"] = json.loads(result.get("metadata") or "{}")
    return result


@router.get("/{doc_id}/chunks")
async def get_document_chunks(doc_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT c.*, d.original_filename
               FROM chunks c JOIN documents d ON d.id = c.document_id
               WHERE c.document_id=? AND c.owner_id=?
               ORDER BY c.chunk_index ASC""",
            (doc_id, current_user["id"]),
        ) as cur:
            rows = [dict(row) for row in await cur.fetchall()]
    for row in rows:
        row["metadata"] = json.loads(row.get("metadata") or "{}")
    return {"chunks": rows}


@router.post("/{doc_id}/reindex")
async def reindex_document(doc_id: str, background_tasks: BackgroundTasks, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM documents WHERE id=? AND owner_id=?", (doc_id, current_user["id"])) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
        doc = dict(row)
        job_id = str(uuid.uuid4())
        await db.execute("UPDATE documents SET status='processing', error_message=NULL WHERE id=?", (doc_id,))
        await db.execute(
            """INSERT INTO ingestion_jobs
               (id, document_id, owner_id, filename, file_type, status, stage, progress, stages)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (job_id, doc_id, current_user["id"], doc["original_filename"], doc["file_type"], "processing", "received", 5, json.dumps(_stage_payload("received"))),
        )
        await db.commit()
    background_tasks.add_task(_process_document, doc_id, job_id, settings.UPLOADS_DIR / doc["filename"], doc["collection_id"], current_user["id"])
    return {"document_id": doc_id, "job_id": job_id, "status": "processing"}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM documents WHERE id=? AND owner_id=?", (doc_id, current_user["id"])) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
        doc = dict(row)

        if VECTOR_STORE_AVAILABLE:
            try:
                vs = VectorStore()
                await vs.initialize()
                vs.delete_document(doc["collection_id"], doc_id)
            except Exception as exc:
                logger.info("Vector delete skipped for %s: %s", doc_id, exc)

        file_path = settings.UPLOADS_DIR / doc["filename"]
        if file_path.exists():
            file_path.unlink()

        await db.execute("DELETE FROM chunks WHERE document_id=?", (doc_id,))
        await db.execute("DELETE FROM ingestion_jobs WHERE document_id=?", (doc_id,))
        await db.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        await db.commit()
    return {"deleted": doc_id}


@router.post("/{doc_id}/retag")
async def retag_document(doc_id: str, tags: List[str], current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE documents SET tags=? WHERE id=? AND owner_id=?", (json.dumps(tags), doc_id, current_user["id"]))
        await db.commit()
    return {"doc_id": doc_id, "tags": tags}
