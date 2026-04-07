#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# RAGNAROK — Full Setup Script
# Run once: ./scripts/setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[RAGNAROK]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

log "Setting up RAGNAROK..."

# ── 1. Python environment ──────────────────────────────────────────────────
log "Checking Python 3.10+..."
python3 --version >/dev/null 2>&1 || fail "Python 3 not found. Install Python 3.10+"
PYVER=$(python3 -c "import sys; print(sys.version_info.minor)")
[ "$PYVER" -ge 10 ] || fail "Python 3.10+ required"
ok "Python OK"

log "Creating virtual environment..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip -q
ok "venv ready"

log "Installing Python dependencies..."
pip install -r backend/requirements.txt -q
ok "Backend deps installed"

# ── 2. Tesseract ──────────────────────────────────────────────────────────
log "Checking Tesseract OCR..."
if ! command -v tesseract &>/dev/null; then
  warn "Tesseract not found. Installing..."
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo apt-get install -y tesseract-ocr poppler-utils libmagic1 2>/dev/null || warn "apt install failed — install Tesseract manually"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install tesseract poppler libmagic 2>/dev/null || warn "brew install failed — install Tesseract manually"
  fi
else
  ok "Tesseract found: $(tesseract --version 2>&1 | head -1)"
fi

# ── 3. Ollama ─────────────────────────────────────────────────────────────
log "Checking Ollama..."
if ! command -v ollama &>/dev/null; then
  warn "Ollama not found. Installing..."
  curl -fsSL https://ollama.ai/install.sh | sh || warn "Ollama install failed — visit https://ollama.ai"
else
  ok "Ollama found: $(ollama --version 2>&1)"
fi

log "Pulling default LLM (llama3 — ~4GB, may take a while)..."
ollama pull llama3 2>/dev/null || warn "Could not pull llama3. Run: ollama pull llama3"

log "Pulling optional smaller model (phi3 ~2GB)..."
ollama pull phi3 2>/dev/null || warn "Could not pull phi3. Optional — skip if low on disk"

# ── 4. Node / Frontend ───────────────────────────────────────────────────
log "Checking Node.js..."
node --version >/dev/null 2>&1 || fail "Node.js not found. Install Node.js 18+"
ok "Node: $(node --version)"

log "Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..
ok "Frontend deps installed"

# ── 5. Database init ─────────────────────────────────────────────────────
log "Initializing database..."
source .venv/bin/activate
python3 -c "
import asyncio
from backend.core.database import init_db
asyncio.run(init_db())
print('Database initialized')
"
ok "Database ready"

# ── 6. Playwright ─────────────────────────────────────────────────────────
log "Setting up Playwright (E2E tests)..."
cd tests
npm install --silent 2>/dev/null || true
npx playwright install chromium --with-deps 2>/dev/null || warn "Playwright install failed — tests will be skipped"
cd ..
ok "Playwright ready"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         RAGNAROK Setup Complete! 🎉                  ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Start:  ./scripts/start.sh                          ║${NC}"
echo -e "${GREEN}║  Login:  admin / admin123                             ║${NC}"
echo -e "${GREEN}║  UI:     http://localhost:5173                        ║${NC}"
echo -e "${GREEN}║  API:    http://localhost:8000/docs                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
