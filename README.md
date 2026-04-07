# RAGNAROK

> Fully offline. Multimodal. Production-grade. No cloud required.

RAGNAROK is a self-contained Retrieval-Augmented Generation system designed for complete air-gap operation. It ingests documents, images, and audio — extracts meaning from all of them — and exposes a conversational interface backed by local LLMs, local embeddings, and a local vector store. Every component runs on your hardware. Nothing leaves your machine.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                    │
│              (Vite + Framer Motion + JWT)            │
└──────────────────────┬──────────────────────────────┘
                       │ REST
┌──────────────────────▼──────────────────────────────┐
│                  FastAPI Backend                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │  Ingest  │  │  Query   │  │   Auth (JWT)     │  │
│   │ Pipeline │  │ Pipeline │  │   Local Only     │  │
│   └────┬─────┘  └────┬─────┘  └──────────────────┘  │
│        │             │                               │
│   ┌────▼─────────────▼──────────────────────────┐   │
│   │              Core Services                  │   │
│   │  OCR · Speech-to-Text · Embeddings          │   │
│   │  Reranker · Document Parsing                │   │
│   └────────────────────┬────────────────────────┘   │
│                        │                             │
│        ┌───────────────▼───────────────┐            │
│        │   ChromaDB  (Vector Store)    │            │
│        └───────────────┬───────────────┘            │
│                        │                             │
│        ┌───────────────▼───────────────┐            │
│        │   Ollama  (Local LLM Runtime) │            │
│        │   llama3 · mistral · phi3     │            │
│        └───────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11 |
| LLM Runtime | Ollama (`llama3`, `mistral`, `phi3`) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` |
| Vector Store | ChromaDB (local persistence) |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| OCR | Tesseract + pytesseract |
| Speech-to-Text | OpenAI Whisper (local inference) |
| Frontend | React, Vite, Framer Motion |
| Auth | JWT (local, no external IdP) |
| Testing | Playwright |
| Containerization | Docker + Docker Compose |

---

## Features

- **Fully offline** — zero external API calls at runtime; all inference, embedding, and retrieval runs on local hardware
- **Multimodal ingestion** — ingest PDFs, images via Tesseract OCR, and audio files via local Whisper transcription
- **Semantic retrieval** — dense vector search over ChromaDB with cross-encoder reranking for high-precision results
- **Swappable LLMs** — switch between `llama3`, `mistral`, `phi3`, or any Ollama-compatible model via a single env variable
- **Local JWT auth** — authentication with no dependency on external identity providers
- **Docker-first** — single-command containerized deployment
- **E2E test coverage** — Playwright test suite ships with the repo

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) installed and running locally
- Tesseract OCR (`brew install tesseract` on macOS / `apt install tesseract-ocr` on Debian/Ubuntu)
- Docker + Docker Compose (optional, for containerized deployment)
- 8 GB RAM minimum; 16 GB+ recommended for larger models

---

## Quick Start

### Linux / macOS

```bash
git clone https://github.com/0xSris/ragnarok.git
cd ragnarok

cp .env.example .env
# Edit .env to configure your model, paths, and secrets

./scripts/setup.sh   # Install all dependencies, pull Ollama model
./scripts/start.sh   # Start backend + frontend
```

### Windows

```bat
setup.bat
start.bat
```

### Docker

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up --build
```

---

## Configuration

All runtime configuration is handled through `.env`. Copy `.env.example` and adjust values:

```env
# LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Vector Store
CHROMA_PERSIST_DIR=./data/chroma

# Auth
JWT_SECRET=your-secret-here
JWT_EXPIRY_HOURS=24

# Whisper model size: tiny | base | small | medium | large
WHISPER_MODEL=base

# OCR
TESSERACT_CMD=/usr/bin/tesseract
```

---

## Project Structure

```
ragnarok/
├── backend/          # FastAPI app — routes, services, models, ingestion logic
├── frontend/         # React + Vite UI
├── docker/           # Docker Compose and container configs
├── scripts/          # setup.sh and start.sh automation
├── tests/            # Playwright E2E test suite
├── .env.example      # Environment variable template
├── pytest.ini        # Pytest configuration
├── setup.bat         # Windows setup script
└── start.bat         # Windows start script
```

---

## Pulling LLM Models

RAGNAROK delegates all LLM inference to Ollama. Pull your target model before starting:

```bash
ollama pull llama3
ollama pull mistral
ollama pull phi3
```

Set the active model via `OLLAMA_MODEL` in `.env`. No code changes required to switch models.

---

## Running Tests

```bash
# Backend unit tests
pytest

# E2E tests (requires all services running)
npx playwright test
```

---

## Roadmap

- [ ] Multi-collection support with namespace isolation per project
- [ ] Streaming response UI (token-by-token output)
- [ ] Document versioning and re-ingestion deduplication
- [ ] Role-based access control (RBAC)
- [ ] Headless CLI for ingestion pipelines
- [ ] GPU acceleration flags for Whisper and embedding inference

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Author

Built by [0xSris](https://github.com/0xSris).
