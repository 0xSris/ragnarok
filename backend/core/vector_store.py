"""Vector store with ChromaDB support and a deterministic local fallback."""
import hashlib
import logging
import math
from collections import defaultdict
from typing import Any, Dict, List, Optional

from backend.core.config import settings

logger = logging.getLogger(__name__)


class VectorStore:
    _instance = None
    _fallback_collections = defaultdict(dict)

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
            cls._instance._fallback = False
        return cls._instance

    async def initialize(self):
        if self._initialized:
            return
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
            from sentence_transformers import CrossEncoder, SentenceTransformer

            self.embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
            self.reranker = CrossEncoder(settings.RERANKER_MODEL)
            self.client = chromadb.PersistentClient(
                path=str(settings.CHROMA_DIR),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._fallback = False
            logger.info("VectorStore ready with ChromaDB")
        except Exception as exc:
            logger.warning("Using deterministic vector fallback: %s", exc)
            self.embedder = None
            self.reranker = None
            self.client = None
            self._fallback = True
        self._initialized = True

    def _ensure_initialized_sync(self):
        if not self._initialized:
            try:
                import asyncio
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    self._fallback = True
                    self._initialized = True
                else:
                    loop.run_until_complete(self.initialize())
            except Exception:
                self._fallback = True
                self._initialized = True

    def _get_or_create_collection(self, collection_id: str):
        name = f"col_{collection_id.replace('-', '_')}"
        return self.client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})

    def _fallback_embedding(self, text: str) -> List[float]:
        vector = [0.0] * 64
        for token in text.lower().split():
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = digest[0] % len(vector)
            vector[index] += 1.0
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        self._ensure_initialized_sync()
        if not self._fallback and self.embedder is not None:
            return self.embedder.encode(texts, batch_size=32, show_progress_bar=False).tolist()
        return [self._fallback_embedding(text) for text in texts]

    def upsert_chunks(self, collection_id: str, doc_id: str, chunks: List[Dict[str, Any]]):
        self._ensure_initialized_sync()
        texts = [chunk["text"] for chunk in chunks]
        embeddings = self.embed_texts(texts)
        ids = [f"{doc_id}_chunk_{index}" for index in range(len(chunks))]
        metadatas = [
            {
                "doc_id": doc_id,
                "chunk_index": index,
                "page": chunk.get("page", 0),
                "source": chunk.get("source", ""),
                "doc_type": chunk.get("doc_type", ""),
                "filename": chunk.get("filename", ""),
            }
            for index, chunk in enumerate(chunks)
        ]
        if self._fallback:
            collection = self._fallback_collections[collection_id]
            for item_id, text, embedding, metadata in zip(ids, texts, embeddings, metadatas):
                collection[item_id] = {"text": text, "embedding": embedding, "metadata": metadata}
            return
        col = self._get_or_create_collection(collection_id)
        col.upsert(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)

    def _cosine(self, left: List[float], right: List[float]) -> float:
        return float(sum(a * b for a, b in zip(left, right)))

    def search(
        self,
        collection_id: str,
        query: str,
        top_k: int = None,
        doc_filter: Optional[List[str]] = None,
        rerank: bool = True,
    ) -> List[Dict[str, Any]]:
        self._ensure_initialized_sync()
        top_k = top_k or settings.TOP_K
        query_embedding = self.embed_texts([query])[0]

        if self._fallback:
            candidates = []
            for item in self._fallback_collections[collection_id].values():
                if doc_filter and item["metadata"].get("doc_id") not in doc_filter:
                    continue
                candidates.append({
                    "text": item["text"],
                    "metadata": item["metadata"],
                    "score": self._cosine(query_embedding, item["embedding"]),
                })
            candidates.sort(key=lambda chunk: chunk["score"], reverse=True)
        else:
            col = self._get_or_create_collection(collection_id)
            where = {"doc_id": {"$in": doc_filter}} if doc_filter else None
            results = col.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, col.count() or 1),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
            candidates = []
            if results["documents"] and results["documents"][0]:
                for text, meta, dist in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
                    candidates.append({"text": text, "metadata": meta, "score": float(1 - dist)})

        if rerank and len(candidates) > 1:
            if not self._fallback and self.reranker is not None:
                rerank_scores = self.reranker.predict([[query, candidate["text"]] for candidate in candidates])
                for index, candidate in enumerate(candidates):
                    candidate["rerank_score"] = float(rerank_scores[index])
            else:
                query_terms = set(query.lower().split())
                for candidate in candidates:
                    overlap = len(query_terms & set(candidate["text"].lower().split()))
                    candidate["rerank_score"] = float(candidate["score"] + overlap * 0.05)
            candidates.sort(key=lambda chunk: chunk.get("rerank_score", chunk["score"]), reverse=True)
        return candidates[:top_k if not rerank else settings.RERANK_TOP_N]

    def delete_document(self, collection_id: str, doc_id: str):
        self._ensure_initialized_sync()
        if self._fallback:
            collection = self._fallback_collections[collection_id]
            for item_id in [key for key, item in collection.items() if item["metadata"].get("doc_id") == doc_id]:
                del collection[item_id]
            return
        col = self._get_or_create_collection(collection_id)
        existing = col.get(where={"doc_id": doc_id})
        if existing["ids"]:
            col.delete(ids=existing["ids"])

    def collection_stats(self, collection_id: str) -> Dict[str, Any]:
        self._ensure_initialized_sync()
        if self._fallback:
            return {"total_chunks": len(self._fallback_collections[collection_id])}
        return {"total_chunks": self._get_or_create_collection(collection_id).count()}
