"""
LLM inference engine — Ollama backend, streaming + non-streaming.
Builds RAG prompts with retrieved context and source citations.
"""
import json
import logging
from typing import List, Dict, Any, AsyncGenerator, Optional
import httpx

from backend.core.config import settings

logger = logging.getLogger(__name__)

RAG_SYSTEM_PROMPT = """You are RAGNAROK, an expert research assistant with access to a private knowledge base.

INSTRUCTIONS:
- Answer questions using ONLY the provided context passages below.
- For every claim you make, cite the source using [Source N] notation.
- If the answer cannot be found in the context, say: "I couldn't find relevant information in the knowledge base."
- Be precise, thorough, and structured. Use markdown formatting.
- Do not hallucinate or use external knowledge beyond what's given.
- At the end, list all sources used.
"""


def build_rag_prompt(query: str, context_chunks: List[Dict[str, Any]]) -> str:
    context_str = ""
    for i, chunk in enumerate(context_chunks):
        meta = chunk.get("metadata", {})
        filename = meta.get("filename", "Unknown")
        page = meta.get("page", "")
        page_str = f" (page {page})" if page else ""
        context_str += f"\n---\n[Source {i+1}] {filename}{page_str}\n{chunk['text']}\n"

    return f"""CONTEXT:
{context_str}

---

QUESTION: {query}

Please answer based on the context above. Cite sources as [Source N]."""


async def query_ollama(
    prompt: str,
    model: str = None,
    system: str = None,
    stream: bool = False,
    temperature: float = None,
    max_tokens: int = None,
) -> str:
    model = model or settings.DEFAULT_LLM_MODEL
    temperature = temperature if temperature is not None else settings.LLM_TEMPERATURE
    max_tokens = max_tokens or settings.LLM_MAX_TOKENS

    payload = {
        "model": model,
        "prompt": prompt,
        "system": system or RAG_SYSTEM_PROMPT,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")


async def stream_ollama(
    prompt: str,
    model: str = None,
    system: str = None,
    temperature: float = None,
    max_tokens: int = None,
) -> AsyncGenerator[str, None]:
    model = model or settings.DEFAULT_LLM_MODEL
    temperature = temperature if temperature is not None else settings.LLM_TEMPERATURE
    max_tokens = max_tokens or settings.LLM_MAX_TOKENS

    payload = {
        "model": model,
        "prompt": prompt,
        "system": system or RAG_SYSTEM_PROMPT,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        async with client.stream(
            "POST",
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json=payload,
        ) as response:
            async for line in response.aiter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        token = data.get("response", "")
                        if token:
                            yield token
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue


async def run_rag_query(
    query: str,
    context_chunks: List[Dict[str, Any]],
    model: str = None,
    stream: bool = False,
) -> Dict[str, Any]:
    """
    Full RAG inference: build prompt from chunks, call LLM, return answer + sources.
    """
    prompt = build_rag_prompt(query, context_chunks)

    if stream:
        # Caller handles streaming
        return {"stream_prompt": prompt, "model": model}

    answer = await query_ollama(prompt, model=model)

    # Build source citations
    sources = []
    for i, chunk in enumerate(context_chunks):
        meta = chunk.get("metadata", {})
        sources.append({
            "index": i + 1,
            "doc_id": meta.get("doc_id", ""),
            "filename": meta.get("filename", ""),
            "page": meta.get("page", 0),
            "chunk_text": chunk["text"][:300] + "..." if len(chunk["text"]) > 300 else chunk["text"],
            "relevance_score": chunk.get("rerank_score", chunk.get("score", 0.0)),
        })

    return {
        "answer": answer,
        "sources": sources,
        "model": model or settings.DEFAULT_LLM_MODEL,
        "context_used": len(context_chunks),
    }
