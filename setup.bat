@echo off
REM RAGNAROK — Full Setup Script (Windows version)
REM ─────────────────────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo   ██████╗  █████╗  ██████╗ ███╗   ██╗ █████╗ ██████╗  ██████╗ ██╗  ██╗
echo   ██╔══██╗██╔══██╗██╔════╝ ████╗  ██║██╔══██╗██╔══██╗██╔═══██╗██║ ██╔╝
echo   ██████╔╝███████║██║  ███╗██╔██╗ ██║███████║██████╔╝██║   ██║█████╔╝
echo   ██╔══██╗██╔══██║██║   ██║██║╚██╗██║██╔══██║██╔══██╗██║   ██║██╔═██╗
echo   ██║  ██║██║  ██║╚██████╔╝██║ ╚████║██║  ██║██║  ██║╚██████╔╝██║  ██╗
echo   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
echo   Offline Multimodal RAG System Setup
echo.

echo [1/4] Checking Python virtual environment...
if not exist .venv (
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
) else (
    echo Virtual environment already exists, skipping creation...
)

echo [2/4] Installing Python dependencies...
.venv\Scripts\activate && pip install --upgrade pip
.venv\Scripts\activate && pip install fastapi uvicorn pydantic pydantic-settings python-multipart aiofiles httpx passlib bcrypt python-jose tqdm numpy pandas scikit-learn aiosqlite ollama
if errorlevel 1 (
    echo WARNING: Some Python packages failed to install
)

echo [3/4] Installing Node.js dependencies...
cd frontend
npm install
if errorlevel 1 (
    echo ERROR: Failed to install Node.js dependencies
    cd ..
    pause
    exit /b 1
)
cd ..

echo [4/4] Initializing database...
.venv\Scripts\activate && python -c "
import asyncio
import aiosqlite
import logging
from pathlib import Path

DB_PATH = Path('data/ragnarok.db')
DB_PATH.parent.mkdir(exist_ok=True)

async def init_db():
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                hashed_password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                owner_id TEXT,
                is_public INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        await db.commit()
        
        import uuid
        admin_id = str(uuid.uuid4())
        hashed = 'admin123'  # Plain text for now
        await db.execute('''
            INSERT OR IGNORE INTO users (id, username, email, hashed_password, role)
            VALUES (?, 'admin', 'admin@ragnarok.local', ?, 'admin')
        ''', (admin_id, hashed))

        col_id = str(uuid.uuid4())
        await db.execute('''
            INSERT OR IGNORE INTO collections (id, name, description, is_public)
            VALUES (?, 'Default', 'Default document collection', 1)
        ''', (col_id,))
        await db.commit()
        print('Database initialized successfully')

asyncio.run(init_db())
"

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║         RAGNAROK Setup Complete! 🎉                  ║
echo ╠══════════════════════════════════════════════════════╣
echo ║  Start:  .\start.bat                                 ║
echo ║  Login:  admin / admin123                             ║
echo ║  UI:     http://localhost:5173                        ║
echo ║  API:    http://localhost:8000/docs                   ║
echo ╚══════════════════════════════════════════════════════╝
echo.

pause