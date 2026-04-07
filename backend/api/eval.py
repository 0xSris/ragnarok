"""
Evaluation API — retrieval accuracy, answer quality metrics.
Runs RAGAS-style evaluation over a test set.
"""
import json
import uuid
import logging
import asyncio
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel

from backend.auth.utils import get_current_user
from backend.core.database import DB_PATH

# Try to import vector store, but don't fail if not available
try:
    from backend.core.vector_store import VectorStore
    VECTOR_STORE_AVAILABLE = True
except ImportError:
    VECTOR_STORE_AVAILABLE = False
    logger.warning("Vector store not available - evaluation disabled")

from backend.inference.llm import run_rag_query

router = APIRouter()
logger = logging.getLogger(__name__)


class EvalQuestion(BaseModel):
    question: str
    expected_answer: Optional[str] = None
    expected_doc_ids: Optional[List[str]] = None


class EvalRequest(BaseModel):
    name: str
    collection_id: str
    questions: List[EvalQuestion]
    model: Optional[str] = None


async def _run_eval(eval_id: str, req_dict: dict, user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            vs = VectorStore()
            results = []
            questions = req_dict["questions"]
            collection_id = req_dict["collection_id"]

            for q in questions:
                chunks = vs.search(collection_id=collection_id, query=q["question"])
                retrieved_ids = [
                    c["metadata"].get("doc_id", "") for c in chunks
                ]

                # Retrieval hit@k
                expected_ids = q.get("expected_doc_ids") or []
                hit = any(d in retrieved_ids for d in expected_ids) if expected_ids else None

                result = await run_rag_query(
                    query=q["question"],
                    context_chunks=chunks,
                    model=req_dict.get("model"),
                )

                # Simple faithfulness: check if expected answer keywords appear
                faithfulness = None
                if q.get("expected_answer"):
                    expected_words = set(q["expected_answer"].lower().split())
                    answer_words = set(result["answer"].lower().split())
                    overlap = len(expected_words & answer_words)
                    faithfulness = overlap / (len(expected_words) + 1e-8)

                results.append({
                    "question": q["question"],
                    "answer": result["answer"],
                    "sources_count": len(result["sources"]),
                    "hit_at_k": hit,
                    "faithfulness": faithfulness,
                })

            # Aggregate
            hits = [r["hit_at_k"] for r in results if r["hit_at_k"] is not None]
            faithfulness_scores = [r["faithfulness"] for r in results if r["faithfulness"] is not None]

            summary = {
                "total_questions": len(results),
                "hit_at_k": sum(hits) / len(hits) if hits else None,
                "avg_faithfulness": sum(faithfulness_scores) / len(faithfulness_scores) if faithfulness_scores else None,
                "avg_sources_per_query": sum(r["sources_count"] for r in results) / len(results),
                "individual": results,
            }

            await db.execute("""
                UPDATE eval_runs SET status='done', results=? WHERE id=?
            """, (json.dumps(summary), eval_id))
            await db.commit()
            logger.info(f"✅ Eval {eval_id} complete")

        except Exception as e:
            logger.error(f"Eval {eval_id} failed: {e}")
            await db.execute(
                "UPDATE eval_runs SET status='error', results=? WHERE id=?",
                (json.dumps({"error": str(e)}), eval_id),
            )
            await db.commit()


@router.post("/")
async def create_eval(
    req: EvalRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    eval_id = str(uuid.uuid4())
    req_dict = req.model_dump()

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO eval_runs (id, user_id, collection_id, name, config, status)
            VALUES (?,?,?,?,?,?)
        """, (eval_id, current_user["id"], req.collection_id, req.name,
              json.dumps(req_dict), "running"))
        await db.commit()

    background_tasks.add_task(_run_eval, eval_id, req_dict, current_user["id"])
    return {"eval_id": eval_id, "status": "running"}


@router.get("/")
async def list_evals(current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, name, status, created_at FROM eval_runs WHERE user_id=? ORDER BY created_at DESC",
            (current_user["id"],),
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
    return {"evals": rows}


@router.get("/{eval_id}")
async def get_eval(eval_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM eval_runs WHERE id=?", (eval_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    result = dict(row)
    result["results"] = json.loads(result.get("results") or "{}")
    return result


@router.get("/dashboard/stats")
async def eval_dashboard(current_user=Depends(get_current_user)):
    """Aggregate retrieval stats for dashboard."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT COUNT(*) as total, AVG(latency_ms) as avg_latency,
                   AVG(feedback) as avg_rating,
                   COUNT(CASE WHEN feedback >= 4 THEN 1 END) as positive_feedback
            FROM query_history WHERE user_id=?
        """, (current_user["id"],)) as cur:
            stats = dict(await cur.fetchone())

        async with db.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM query_history WHERE user_id=?
            GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30
        """, (current_user["id"],)) as cur:
            daily = [dict(r) for r in await cur.fetchall()]

        async with db.execute("""
            SELECT model_used, COUNT(*) as count, AVG(latency_ms) as avg_latency
            FROM query_history WHERE user_id=?
            GROUP BY model_used
        """, (current_user["id"],)) as cur:
            by_model = [dict(r) for r in await cur.fetchall()]

    return {"stats": stats, "daily_queries": daily, "by_model": by_model}
