"""Query history API."""
import json
from typing import Optional
import aiosqlite
from fastapi import APIRouter, Depends, Query
from backend.auth.utils import get_current_user
from backend.core.database import DB_PATH

router = APIRouter()


@router.get("/")
async def get_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    collection_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    offset = (page - 1) * page_size
    conditions = ["user_id = ?"]
    params = [current_user["id"]]

    if collection_id:
        conditions.append("collection_id = ?")
        params.append(collection_id)
    if search:
        conditions.append("(query LIKE ? OR answer LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    where = " AND ".join(conditions)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"SELECT COUNT(*) FROM query_history WHERE {where}", params
        ) as cur:
            total = (await cur.fetchone())[0]

        async with db.execute(
            f"""SELECT id, query, answer, model_used, latency_ms, feedback,
                created_at, collection_id FROM query_history
                WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            params + [page_size, offset],
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

    return {"history": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/{query_id}")
async def get_history_item(query_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM query_history WHERE id=?", (query_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    result = dict(row)
    result["sources"] = json.loads(result.get("sources") or "[]")
    return result


@router.delete("/{query_id}")
async def delete_history_item(query_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM query_history WHERE id=? AND user_id=?",
                         (query_id, current_user["id"]))
        await db.commit()
    return {"deleted": query_id}


@router.delete("/")
async def clear_history(current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM query_history WHERE user_id=?", (current_user["id"],))
        await db.commit()
    return {"cleared": True}
