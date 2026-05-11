"""Collections management API."""
import uuid
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.auth.utils import get_current_user
from backend.core.database import DB_PATH

router = APIRouter()


class CreateCollectionRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    is_public: bool = False


@router.get("/")
async def list_collections(current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            WITH visible AS (
                SELECT c.*
                FROM collections c
                WHERE c.owner_id = ? OR c.is_public = 1
            ),
            deduped AS (
                SELECT *
                FROM visible v
                WHERE v.id = (
                    SELECT v2.id
                    FROM visible v2
                    WHERE LOWER(v2.name) = LOWER(v.name)
                      AND COALESCE(v2.owner_id, 'public') = COALESCE(v.owner_id, 'public')
                    ORDER BY v2.created_at ASC, v2.id ASC
                    LIMIT 1
                )
            )
            SELECT d.*, COUNT(doc.id) as doc_count
            FROM deduped d
            LEFT JOIN documents doc ON doc.collection_id = d.id
            GROUP BY d.id
            ORDER BY d.created_at DESC
        """, (current_user["id"],)) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
    return {"collections": rows}


@router.post("/")
async def create_collection(
    req: CreateCollectionRequest,
    current_user=Depends(get_current_user),
):
    col_id = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO collections (id, name, description, owner_id, is_public)
            VALUES (?,?,?,?,?)
        """, (col_id, req.name, req.description, current_user["id"], int(req.is_public)))
        await db.commit()
    return {"id": col_id, "name": req.name}


@router.delete("/{col_id}")
async def delete_collection(col_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM collections WHERE id=? AND owner_id=?",
            (col_id, current_user["id"])
        )
        await db.commit()
    return {"deleted": col_id}
