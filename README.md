# 🧠 RAGNAROK — Offline Multimodal RAG System

> Fully offline. Multimodal. Production-grade. No cloud required.

## Stack
- **Backend**: FastAPI + Python 3.11
- **LLM**: Ollama (llama3 / mistral / phi3)
- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2)
- **Vector DB**: ChromaDB (local)
- **OCR**: Tesseract + pytesseract
- **Speech-to-Text**: OpenAI Whisper (local)
- **Reranker**: cross-encoder/ms-marco-MiniLM-L-6-v2
- **Frontend**: React + Vite + Framer Motion
- **Auth**: JWT (local)
- **Testing**: Playwright

## Quick Start
```bash
./scripts/setup.sh
./scripts/start.sh
```
