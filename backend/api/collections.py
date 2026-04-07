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
            SELECT c.*, COUNT(d.id) as doc_count
            FROM collections c
            LEFT JOIN documents d ON d.collection_id = c.id
            WHERE c.owner_id = ? OR c.is_public = 1
            GROUP BY c.id ORDER BY c.created_at DESC
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
