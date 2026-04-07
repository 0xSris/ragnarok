"""
Unit tests for RAGNAROK backend — ingestion, chunking, vector store, LLM inference.
Run with: pytest tests/test_backend.py -v
"""
import asyncio
import json
import os
import sys
import tempfile
import uuid
from pathlib import Path

import pytest

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Chunking ──────────────────────────────────────────────────────────────

def test_chunk_text_basic():
    from backend.ingestion.pipeline import chunk_text
    text = " ".join([f"word{i}" for i in range(1000)])
    chunks = chunk_text(text, chunk_size=50, overlap=10)
    assert len(chunks) > 1
    for c in chunks:
        assert "text" in c
        assert len(c["text"]) > 0


def test_chunk_text_overlap():
    from backend.ingestion.pipeline import chunk_text
    words = [f"w{i}" for i in range(100)]
    text = " ".join(words)
    chunks = chunk_text(text, chunk_size=20, overlap=5)
    # Verify overlap: last words of chunk N appear at start of chunk N+1
    if len(chunks) >= 2:
        last_words_c0 = chunks[0]["text"].split()[-5:]
        first_words_c1 = chunks[1]["text"].split()[:5]
        common = set(last_words_c0) & set(first_words_c1)
        assert len(common) > 0, "Overlap not working"


def test_chunk_empty_text():
    from backend.ingestion.pipeline import chunk_text
    chunks = chunk_text("", chunk_size=100, overlap=10)
    assert chunks == []


def test_chunk_short_text():
    from backend.ingestion.pipeline import chunk_text
    text = "This is a very short document."
    chunks = chunk_text(text, chunk_size=512, overlap=64)
    assert len(chunks) == 1
    assert chunks[0]["text"] == text.strip()


def test_chunk_metadata():
    from backend.ingestion.pipeline import chunk_text
    chunks = chunk_text(
        "word " * 200,
        chunk_size=50, overlap=5,
        source="/path/to/file.pdf",
        doc_type="pdf",
        filename="file.pdf",
        page=3,
    )
    for c in chunks:
        assert c["source"] == "/path/to/file.pdf"
        assert c["doc_type"] == "pdf"
        assert c["filename"] == "file.pdf"
        assert c["page"] == 3


# ── TXT Extraction ────────────────────────────────────────────────────────

def test_extract_txt():
    from backend.ingestion.pipeline import extract_txt
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False) as f:
        f.write("Hello world. " * 200)
        path = Path(f.name)
    try:
        chunks, pages, words = extract_txt(path)
        assert len(chunks) > 0
        assert pages == 1
        assert words > 0
    finally:
        path.unlink()


def test_ingest_txt_dispatch():
    from backend.ingestion.pipeline import ingest_file
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False) as f:
        f.write("Test ingestion pipeline dispatch. " * 100)
        path = Path(f.name)
    try:
        result = ingest_file(path)
        assert result["chunk_count"] > 0
        assert result["file_type"] == "txt"
        assert len(result["chunks"]) == result["chunk_count"]
    finally:
        path.unlink()


def test_ingest_unsupported_type():
    from backend.ingestion.pipeline import ingest_file
    with pytest.raises(ValueError, match="Unsupported"):
        ingest_file(Path("file.xyz"))


# ── Vector Store ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def vs():
    """Initialize vector store once per module."""
    import asyncio
    from backend.core.vector_store import VectorStore
    store = VectorStore()
    asyncio.get_event_loop().run_until_complete(store.initialize())
    return store


def test_embed_texts(vs):
    embeddings = vs.embed_texts(["Hello world", "Test document"])
    assert len(embeddings) == 2
    assert len(embeddings[0]) > 0
    assert isinstance(embeddings[0][0], float)


def test_upsert_and_search(vs):
    col_id = f"test_{uuid.uuid4().hex[:8]}"
    doc_id = str(uuid.uuid4())
    chunks = [
        {"text": "The quick brown fox jumps over the lazy dog.", "page": 1,
         "source": "test.txt", "doc_type": "txt", "filename": "test.txt"},
        {"text": "Machine learning is a subset of artificial intelligence.", "page": 1,
         "source": "test.txt", "doc_type": "txt", "filename": "test.txt"},
        {"text": "Python is a popular programming language.", "page": 2,
         "source": "test.txt", "doc_type": "txt", "filename": "test.txt"},
    ]
    vs.upsert_chunks(col_id, doc_id, chunks)

    # Search for relevant content
    results = vs.search(col_id, "machine learning AI", top_k=3, rerank=False)
    assert len(results) > 0
    # The ML chunk should be in top results
    texts = [r["text"] for r in results]
    assert any("machine learning" in t.lower() or "artificial intelligence" in t.lower() for t in texts)


def test_reranking(vs):
    col_id = f"test_rerank_{uuid.uuid4().hex[:8]}"
    doc_id = str(uuid.uuid4())
    chunks = [
        {"text": "Python is a programming language.", "page": 1,
         "source": "s.txt", "doc_type": "txt", "filename": "s.txt"},
        {"text": "Deep learning uses neural networks for AI.", "page": 1,
         "source": "s.txt", "doc_type": "txt", "filename": "s.txt"},
        {"text": "The weather today is sunny and warm.", "page": 1,
         "source": "s.txt", "doc_type": "txt", "filename": "s.txt"},
        {"text": "Transformers revolutionized natural language processing.", "page": 1,
         "source": "s.txt", "doc_type": "txt", "filename": "s.txt"},
    ]
    vs.upsert_chunks(col_id, doc_id, chunks)
    results = vs.search(col_id, "neural networks deep learning", top_k=4, rerank=True)
    assert len(results) > 0
    # Top result should be relevant to deep learning
    top_text = results[0]["text"].lower()
    assert "deep learning" in top_text or "neural" in top_text or "transformers" in top_text


def test_delete_document(vs):
    col_id = f"test_del_{uuid.uuid4().hex[:8]}"
    doc_id = str(uuid.uuid4())
    vs.upsert_chunks(col_id, doc_id, [
        {"text": "To be deleted.", "page": 1, "source": "d.txt", "doc_type": "txt", "filename": "d.txt"}
    ])
    stats_before = vs.collection_stats(col_id)
    assert stats_before["total_chunks"] == 1

    vs.delete_document(col_id, doc_id)
    stats_after = vs.collection_stats(col_id)
    assert stats_after["total_chunks"] == 0


# ── Database ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_db_init():
    from backend.core.database import init_db
    # Should not raise
    await init_db()


@pytest.mark.asyncio
async def test_default_admin_exists():
    import aiosqlite
    from backend.core.config import settings
    async with aiosqlite.connect(str(settings.DB_PATH)) as db:
        async with db.execute(
            "SELECT username, role FROM users WHERE username='admin'"
        ) as cur:
            row = await cur.fetchone()
    assert row is not None
    assert row[1] == "admin"


# ── Auth ──────────────────────────────────────────────────────────────────

def test_password_hashing():
    from backend.auth.utils import hash_password, verify_password
    pw = "supersecret123"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_jwt_token():
    from backend.auth.utils import create_access_token
    from jose import jwt
    from backend.core.config import settings
    token = create_access_token({"sub": "test-id", "username": "testuser"})
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "test-id"
    assert payload["username"] == "testuser"


# ── RAG prompt builder ────────────────────────────────────────────────────

def test_rag_prompt_construction():
    from backend.inference.llm import build_rag_prompt
    chunks = [
        {"text": "AI is transforming industries.", "metadata": {"filename": "doc1.pdf", "page": 1}},
        {"text": "Machine learning models need training data.", "metadata": {"filename": "doc2.txt", "page": 0}},
    ]
    prompt = build_rag_prompt("What is AI?", chunks)
    assert "[Source 1]" in prompt
    assert "[Source 2]" in prompt
    assert "doc1.pdf" in prompt
    assert "AI is transforming" in prompt
    assert "What is AI?" in prompt


def test_rag_prompt_empty_chunks():
    from backend.inference.llm import build_rag_prompt
    prompt = build_rag_prompt("test query", [])
    assert "test query" in prompt
    assert "CONTEXT" in prompt


# ── Config ────────────────────────────────────────────────────────────────

def test_config_defaults():
    from backend.core.config import settings
    assert settings.CHUNK_SIZE == 512
    assert settings.TOP_K == 10
    assert settings.RERANK_TOP_N == 5
    assert settings.ALGORITHM == "HS256"
    assert settings.EMBEDDING_MODEL == "all-MiniLM-L6-v2"


def test_data_dirs_created():
    from backend.core.config import settings
    assert settings.UPLOADS_DIR.exists()
    assert settings.CHROMA_DIR.exists()
    assert settings.EXPORTS_DIR.exists()
