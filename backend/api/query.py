"""
Query API — semantic search + LLM answering, SSE streaming, feedback.
"""
import json
import time
import uuid
import logging
import tempfile
import os
from typing import Optional, List

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
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
    logger.warning("Vector store not available - semantic search disabled")

from backend.inference.llm import run_rag_query, stream_ollama, build_rag_prompt, RAG_SYSTEM_PROMPT

router = APIRouter()
logger = logging.getLogger(__name__)


class QueryRequest(BaseModel):
    query: str
    collection_id: Optional[str] = None
    model: Optional[str] = None
    top_k: Optional[int] = None
    doc_filter: Optional[List[str]] = None
    stream: bool = False
    temperature: Optional[float] = None


class FeedbackRequest(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None


@router.post("/")
async def query(req: QueryRequest, current_user=Depends(get_current_user)):
    start = time.time()

    # Resolve collection
    collection_id = req.collection_id
    if not collection_id:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT id FROM collections LIMIT 1") as cur:
                row = await cur.fetchone()
                collection_id = row[0] if row else "default"

    if not VECTOR_STORE_AVAILABLE:
        answer = "Vector store is not available. Please check server configuration."
        sources = []
        model_used = req.model or settings.DEFAULT_LLM_MODEL
        chunks = []
    else:
        vs = VectorStore()
        chunks = vs.search(
            collection_id=collection_id,
            query=req.query,
            top_k=req.top_k or settings.TOP_K,
            doc_filter=req.doc_filter,
            rerank=True,
        )

        if not chunks:
            answer = "No relevant documents found in the knowledge base for your query."
            sources = []
            model_used = req.model or settings.DEFAULT_LLM_MODEL
        else:
            result = await run_rag_query(
                query=req.query,
                context_chunks=chunks,
                model=req.model,
                stream=False,
            )
            answer = result["answer"]
            sources = result["sources"]
            model_used = result["model"]
        sources = result["sources"]
        model_used = result["model"]

    latency_ms = int((time.time() - start) * 1000)

    # Save to history
    query_id = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO query_history
                (id, user_id, query, answer, model_used, collection_id, sources, latency_ms)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            query_id, current_user["id"], req.query, answer,
            model_used, collection_id, json.dumps(sources), latency_ms,
        ))
        await db.commit()

    return {
        "id": query_id,
        "query": req.query,
        "answer": answer,
        "sources": sources,
        "model": model_used,
        "latency_ms": latency_ms,
        "chunks_retrieved": len(chunks),
    }


@router.post("/stream")
async def query_stream(req: QueryRequest, current_user=Depends(get_current_user)):
    """SSE streaming response."""
    collection_id = req.collection_id
    if not collection_id:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT id FROM collections LIMIT 1") as cur:
                row = await cur.fetchone()
                collection_id = row[0] if row else "default"

    vs = VectorStore()
    chunks = vs.search(
        collection_id=collection_id,
        query=req.query,
        top_k=req.top_k or settings.TOP_K,
        doc_filter=req.doc_filter,
        rerank=True,
    )

    sources = []
    for i, chunk in enumerate(chunks):
        meta = chunk.get("metadata", {})
        sources.append({
            "index": i + 1,
            "doc_id": meta.get("doc_id", ""),
            "filename": meta.get("filename", ""),
            "page": meta.get("page", 0),
            "chunk_text": chunk["text"][:300],
            "relevance_score": chunk.get("rerank_score", chunk.get("score", 0.0)),
        })

    async def event_generator():
        # Send sources first
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        if not chunks:
            yield f"data: {json.dumps({'type': 'token', 'token': 'No relevant documents found.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        prompt = build_rag_prompt(req.query, chunks)
        full_answer = ""

        async for token in stream_ollama(
            prompt=prompt,
            model=req.model,
            system=RAG_SYSTEM_PROMPT,
            temperature=req.temperature,
        ):
            full_answer += token
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        # Save to history
        query_id = str(uuid.uuid4())
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("""
                INSERT INTO query_history
                    (id, user_id, query, answer, model_used, collection_id, sources)
                VALUES (?,?,?,?,?,?,?)
            """, (
                query_id, current_user["id"], req.query, full_answer,
                req.model or settings.DEFAULT_LLM_MODEL,
                collection_id, json.dumps(sources),
            ))
            await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'query_id': query_id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{query_id}/feedback")
async def submit_feedback(
    query_id: str,
    req: FeedbackRequest,
    current_user=Depends(get_current_user),
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE query_history SET feedback=?, feedback_comment=? WHERE id=?",
            (req.rating, req.comment, query_id),
        )
        await db.commit()
    return {"query_id": query_id, "feedback": req.rating}


@router.get("/similar/{query_id}")
async def similar_queries(
    query_id: str,
    current_user=Depends(get_current_user),
):
    """Find semantically similar past queries."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT query FROM query_history WHERE id=?", (query_id,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404)

        query_text = row["query"]
        async with db.execute(
            """SELECT id, query, answer, created_at FROM query_history
               WHERE id != ? AND user_id=? ORDER BY created_at DESC LIMIT 50""",
            (query_id, current_user["id"]),
        ) as cur:
            history = [dict(r) for r in await cur.fetchall()]

    if not history:
        return {"similar": []}

    vs = VectorStore()
    query_emb = vs.embed_texts([query_text])[0]
    history_embs = vs.embed_texts([h["query"] for h in history])

    import numpy as np
    q = np.array(query_emb)
    scores = []
    for i, emb in enumerate(history_embs):
        h = np.array(emb)
        sim = float(np.dot(q, h) / (np.linalg.norm(q) * np.linalg.norm(h) + 1e-8))
        scores.append((sim, history[i]))

    scores.sort(key=lambda x: x[0], reverse=True)
    return {"similar": [{"score": s, **h} for s, h in scores[:5]]}


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    """Transcribe audio file to text using Whisper."""
    if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac', '.ogg')):
        raise HTTPException(400, "Unsupported audio format. Use WAV, MP3, M4A, FLAC, or OGG.")

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        import whisper
        model = whisper.load_model(settings.WHISPER_MODEL)
        result = model.transcribe(tmp_path)
        text = result["text"].strip()
        return {"text": text}
    except ImportError:
        raise HTTPException(500, "Whisper not available")
    finally:
        os.unlink(tmp_path)
