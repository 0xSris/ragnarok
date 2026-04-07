"""
Vector store — ChromaDB + sentence-transformers embeddings.
Handles all collection CRUD, upsert, and semantic search.
"""
import logging
import uuid
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

from backend.core.config import settings

# ML dependencies will be imported only when needed
ML_AVAILABLE = False

logger = logging.getLogger(__name__)


class VectorStore:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    async def initialize(self):
        global ML_AVAILABLE
        if self._initialized:
            return
        
        # Import ML dependencies here
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
            from sentence_transformers import SentenceTransformer, CrossEncoder
            import numpy as np
            ML_AVAILABLE = True
        except ImportError as e:
            logger.warning(f"ML dependencies not available: {e}")
            ML_AVAILABLE = False
            raise ImportError("ML dependencies not available")
            
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        self.embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info(f"Loading reranker: {settings.RERANKER_MODEL}")
        self.reranker = CrossEncoder(settings.RERANKER_MODEL)
        self.client = chromadb.PersistentClient(
            path=str(settings.CHROMA_DIR),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._initialized = True
        logger.info("✅ VectorStore ready")

    def _get_or_create_collection(self, collection_id: str):
        name = f"col_{collection_id.replace('-', '_')}"
        return self.client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        embeddings = self.embedder.encode(texts, batch_size=32, show_progress_bar=False)
        return embeddings.tolist()

    def upsert_chunks(
        self,
        collection_id: str,
        doc_id: str,
        chunks: List[Dict[str, Any]],
    ):
        col = self._get_or_create_collection(collection_id)
        texts = [c["text"] for c in chunks]
        embeddings = self.embed_texts(texts)
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "doc_id": doc_id,
                "chunk_index": i,
                "page": c.get("page", 0),
                "source": c.get("source", ""),
                "doc_type": c.get("doc_type", ""),
                "filename": c.get("filename", ""),
            }
            for i, c in enumerate(chunks)
        ]
        col.upsert(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
        logger.info(f"Upserted {len(chunks)} chunks for doc {doc_id}")

    def search(
        self,
        collection_id: str,
        query: str,
        top_k: int = None,
        doc_filter: Optional[List[str]] = None,
        rerank: bool = True,
    ) -> List[Dict[str, Any]]:
        top_k = top_k or settings.TOP_K
        col = self._get_or_create_collection(collection_id)

        query_embedding = self.embed_texts([query])[0]

        where = None
        if doc_filter:
            where = {"doc_id": {"$in": doc_filter}}

        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count() or 1),
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        candidates = []
        if results["documents"] and results["documents"][0]:
            for text, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                candidates.append({
                    "text": text,
                    "metadata": meta,
                    "score": float(1 - dist),
                })

        if rerank and len(candidates) > 1:
            pairs = [[query, c["text"]] for c in candidates]
            rerank_scores = self.reranker.predict(pairs)
            for i, c in enumerate(candidates):
                c["rerank_score"] = float(rerank_scores[i])
            candidates = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
            candidates = candidates[: settings.RERANK_TOP_N]

        return candidates

    def delete_document(self, collection_id: str, doc_id: str):
        col = self._get_or_create_collection(collection_id)
        existing = col.get(where={"doc_id": doc_id})
        if existing["ids"]:
            col.delete(ids=existing["ids"])
            logger.info(f"Deleted {len(existing['ids'])} chunks for doc {doc_id}")

    def collection_stats(self, collection_id: str) -> Dict[str, Any]:
        col = self._get_or_create_collection(collection_id)
        return {"total_chunks": col.count()}
