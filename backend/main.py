"""
RAGNAROK — Offline Multimodal RAG System
Main FastAPI Application Entry Point
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.documents import router as docs_router
from backend.api.query import router as query_router
from backend.api.auth import router as auth_router
from backend.api.history import router as history_router
from backend.api.eval import router as eval_router
from backend.api.export import router as export_router
from backend.api.collections import router as collections_router
from backend.core.config import settings
from backend.core.database import init_db
from backend.core.vector_store import VectorStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ragnarok")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 RAGNAROK starting up...")
    await init_db()
    # Try to initialize vector store, but don't fail if it's not available
    # try:
    #     vs = VectorStore()
    #     await vs.initialize()
    #     app.state.vector_store = vs
    #     logger.info("✅ Vector store initialized")
    # except Exception as e:
    #     logger.warning(f"⚠️ Vector store not available: {e}")
    #     logger.info("ℹ️ Running without vector store (limited functionality)")
    app.state.vector_store = None
    yield
    logger.info("🛑 RAGNAROK shutting down...")


app = FastAPI(
    title="RAGNAROK API",
    description="Offline Multimodal RAG System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(docs_router, prefix="/api/documents", tags=["documents"])
app.include_router(query_router, prefix="/api/query", tags=["query"])
app.include_router(history_router, prefix="/api/history", tags=["history"])
app.include_router(eval_router, prefix="/api/eval", tags=["evaluation"])
app.include_router(export_router, prefix="/api/export", tags=["export"])
app.include_router(collections_router, prefix="/api/collections", tags=["collections"])


@app.get("/api/health")
async def health():
    return {"status": "operational", "system": "RAGNAROK", "version": "1.0.0"}


@app.get("/api/models")
async def list_models():
    """List available Ollama models."""
    import ollama
    try:
        models = ollama.list()
        return {"models": [m["name"] for m in models.get("models", [])]}
    except Exception as e:
        return {"models": [], "error": str(e)}
