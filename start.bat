@echo off
REM RAGNAROK — Start all services concurrently (Windows version)
REM ─────────────────────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo   ██████╗  █████╗  ██████╗ ███╗   ██╗ █████╗ ██████╗  ██████╗ ██╗  ██╗
echo   ██╔══██╗██╔══██╗██╔════╝ ████╗  ██║██╔══██╗██╔══██╗██╔═══██╗██║ ██╔╝
echo   ██████╔╝███████║██║  ███╗██╔██╗ ██║███████║██████╔╝██║   ██║█████╔╝
echo   ██╔══██╗██╔══██║██║   ██║██║╚██╗██║██╔══██║██╔══██╗██║   ██║██╔═██╗
echo   ██║  ██║██║  ██║╚██████╔╝██║ ╚████║██║  ██║██║  ██║╚██████╔╝██║  ██╗
echo   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
echo   Offline Multimodal RAG System
echo.

echo [1/3] Checking Python virtual environment...
if not exist .venv (
    echo ERROR: Virtual environment not found. Run setup first.
    pause
    exit /b 1
)

echo [2/3] Starting FastAPI backend on :8000...
start "RAGNAROK API" cmd /c ".venv\Scripts\activate && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak > nul

echo [3/3] Starting Vite frontend on :5173...
cd frontend
start "RAGNAROK UI" cmd /c "npm run dev"
cd ..

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  🚀 RAGNAROK is starting!                            ║
echo ╠══════════════════════════════════════════════════════╣
echo ║  Frontend:  http://localhost:5173                    ║
echo ║  API Docs:  http://localhost:8000/docs               ║
echo ║  Login: admin / admin123                             ║
echo ║  Press Ctrl+C in each terminal to stop services     ║
echo ╚══════════════════════════════════════════════════════╝
echo.
echo Services are starting in background terminals...
echo Check the opened command windows for any errors.

pause