#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# RAGNAROK — Start all services concurrently
# ─────────────────────────────────────────────────────────────────────────────

set -e
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Activate venv if present
[ -f ".venv/bin/activate" ] && source .venv/bin/activate

cleanup() {
  echo -e "\n${YELLOW}Shutting down RAGNAROK...${NC}"
  kill 0 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "${CYAN}"
cat << 'EOF'
  ██████╗  █████╗  ██████╗ ███╗   ██╗ █████╗ ██████╗  ██████╗ ██╗  ██╗
  ██╔══██╗██╔══██╗██╔════╝ ████╗  ██║██╔══██╗██╔══██╗██╔═══██╗██║ ██╔╝
  ██████╔╝███████║██║  ███╗██╔██╗ ██║███████║██████╔╝██║   ██║█████╔╝
  ██╔══██╗██╔══██║██║   ██║██║╚██╗██║██╔══██║██╔══██╗██║   ██║██╔═██╗
  ██║  ██║██║  ██║╚██████╔╝██║ ╚████║██║  ██║██║  ██║╚██████╔╝██║  ██╗
  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
  Offline Multimodal RAG System
EOF
echo -e "${NC}"

# ── Start Ollama ──────────────────────────────────────────────────────────
echo -e "${GREEN}[1/3]${NC} Starting Ollama..."
ollama serve &>/tmp/ragnarok_ollama.log &
OLLAMA_PID=$!
sleep 2
echo -e "      Ollama PID: $OLLAMA_PID"

# ── Start FastAPI backend ─────────────────────────────────────────────────
echo -e "${GREEN}[2/3]${NC} Starting FastAPI backend on :8000..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload \
  --log-level info 2>&1 | sed 's/^/  [API] /' &
API_PID=$!
echo -e "      API PID: $API_PID"
sleep 2

# ── Start Vite frontend ───────────────────────────────────────────────────
echo -e "${GREEN}[3/3]${NC} Starting Vite frontend on :5173..."
cd frontend
npm run dev 2>&1 | sed 's/^/  [UI] /' &
UI_PID=$!
cd ..

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🚀 RAGNAROK is running!                             ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Frontend:  http://localhost:5173                    ║${NC}"
echo -e "${GREEN}║  API Docs:  http://localhost:8000/docs               ║${NC}"
echo -e "${GREEN}║  Ollama:    http://localhost:11434                   ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Login: admin / admin123                             ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop all services                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

wait
