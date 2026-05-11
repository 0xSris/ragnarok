# RAGNAROK

RAGNAROK is a private offline AI knowledge command center: a local multimodal RAG system for ingesting documents, scans, images, audio, and transcripts, indexing them locally, querying them with Ollama, and inspecting every citation, retrieved chunk, score, and pipeline decision.

It is intentionally not a generic upload-and-chat app. The product surface is built to prove the local pipeline: model status, embedding status, ChromaDB health, OCR and Whisper availability, ingestion stages, retrieval scores, reranker output, citations, source chunks, query history, and evaluation metrics.

## Offline Guarantee

- No cloud API calls are required by the app.
- Ollama models run on the local machine.
- Embeddings use `sentence-transformers/all-MiniLM-L6-v2` locally when installed.
- Vectors are stored in local ChromaDB when available, with a deterministic SQLite-backed fallback for demos and tests.
- Uploaded files are saved under the local backend data directory.
- OCR and transcription are local through Tesseract and Whisper when installed.
- Auth uses local JWT with no external identity provider.

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python |
| Frontend | React, Vite, Framer Motion, Tailwind |
| Auth | JWT, local only |
| LLM Runtime | Ollama (`llama3`, `mistral`, `phi3`, custom local models) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` |
| Vector Store | ChromaDB local persistence, SQLite fallback |
| OCR | Tesseract + `pytesseract` |
| Speech-to-Text | Local Whisper |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| Storage | SQLite metadata and local file storage |
| Testing | Pytest and Playwright |
| Containerization | Docker + Docker Compose |

## Core Routes

- `/auth` local login/register
- `/dashboard` offline system overview
- `/ingest` multimodal upload and processing queue
- `/library` indexed document dashboard
- `/chat` RAG chat with citations and retrieval inspector
- `/documents/:id` source viewer and chunk explorer
- `/collections` workspace manager
- `/settings` model and retrieval controls
- `/evals` quality and query dashboard

## API Surface

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/system/status`
- `POST /api/ingest/upload`
- `GET /api/ingest/jobs`
- `GET /api/documents`
- `GET /api/documents/{id}`
- `GET /api/documents/{id}/chunks`
- `DELETE /api/documents/{id}`
- `POST /api/documents/{id}/reindex`
- `GET /api/collections`
- `POST /api/collections`
- `POST /api/chat/query`
- `GET /api/chat/history`
- `GET /api/settings/models`
- `PUT /api/settings/retrieval`
- `GET /api/evals/summary`

## Local Setup

```bash
git clone https://github.com/0xSris/ragnarok.git
cd ragnarok
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\activate
pip install -r backend\requirements.txt
cd frontend
npm install
```

Linux / macOS:

```bash
source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend
npm install
```

Start the backend:

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Default local admin:

- username: `admin`
- password: `admin123`

## Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Ollama Setup

Install Ollama, then pull at least one local model:

```bash
ollama pull llama3
ollama pull mistral
ollama pull phi3
ollama serve
```

The app checks `http://localhost:11434` through `/api/system/status`.

## Tesseract Setup

Install Tesseract locally and ensure the `tesseract` binary is on PATH. If it is not present, image and scanned-PDF ingestion reports a clear missing capability instead of calling the cloud.

## Whisper Setup

Install the Python requirements and ensure FFmpeg is available for audio formats. Whisper runs locally through the configured `WHISPER_MODEL`.

## Architecture

Backend modules:

- `backend/api`: auth, documents, collections, query, history, eval, and command-center system routes
- `backend/ingestion/pipeline.py`: file type detection, text extraction, OCR, transcription, and chunking
- `backend/core/vector_store.py`: ChromaDB + sentence-transformers, with a local deterministic fallback
- `backend/inference/llm.py`: Ollama prompt construction and answer generation
- `backend/core/database.py`: SQLite metadata, documents, ingestion jobs, chunks, settings, history, eval runs

Frontend modules:

- `frontend/src/pages`: dashboard, ingest, library, chat, source viewer, collections, settings, evals
- `frontend/src/components/Layout.jsx`: persistent command-center shell and local runtime status
- `frontend/src/components/CursorCompanion.jsx`: lightweight animated UI companion
- `frontend/src/utils/api.js`: API helpers for auth, ingestion, retrieval, settings, and evals

## Ingestion Pipeline

1. Save uploaded file locally.
2. Detect file type.
3. Extract text from PDF, TXT, Markdown, DOCX, image OCR, scanned PDF OCR, audio, or video transcript.
4. Create chunks with document/page/timestamp metadata.
5. Generate embeddings locally when ML dependencies are available.
6. Store vectors in ChromaDB or fallback chunks in SQLite.
7. Mark the ingestion job ready and expose its timeline in `/ingest`.

## RAG Pipeline

1. Authenticate the local user.
2. Receive query, collection, query mode, top-k, temperature, and reranker settings.
3. Retrieve candidate chunks from the local index.
4. Rerank candidates when the cross-encoder is available.
5. Build a citation-grounded context.
6. Send the prompt to a local Ollama model.
7. Return answer, citations, page/timestamp refs, similarity scores, reranker scores, chunk previews, and latency breakdown.

## Testing

Backend:

```bash
python -m pytest tests/test_backend.py -q
```

Frontend build:

```bash
cd frontend
npm run build
```

Playwright demo flow covers login, upload, indexing, querying, citation verification, and source inspection.

## Troubleshooting

- Ollama unavailable: start `ollama serve` and pull a model.
- Missing OCR: install Tesseract and add it to PATH.
- Missing Whisper: install requirements and FFmpeg.
- Heavy ML packages unavailable: RAGNAROK uses local fallback retrieval so the UI and tests still run.
- No citations: upload a document, wait until the ingestion job reaches `ready`, then query again.

## Release Checklist

- Backend tests pass.
- Frontend production build passes.
- Ollama model status is visible in `/dashboard`.
- Upload, reindex, delete, and source viewer flows work.
- Chat answers include citations and retrieval scores.
- `/evals` shows latency, query history, indexed docs, and ingestion failures.

## Roadmap

- Multi-collection namespace isolation per project
- Streaming response UI
- Document versioning and re-ingestion deduplication
- Role-based access control
- Headless CLI for ingestion pipelines
- GPU acceleration flags for Whisper and embedding inference

## Sample Commit Messages

- `feat: add offline command center dashboard`
- `feat: expose ingestion jobs and source chunk provenance`
- `feat: add retrieval inspector with reranker scores`
- `test: add portable local vector fallback`

## License

MIT

## Author

Built by [0xSris](https://github.com/0xSris).
