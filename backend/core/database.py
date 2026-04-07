"""
SQLite database — documents metadata, query history, users, eval records.
Uses aiosqlite for async access.
"""
import aiosqlite
import logging
from backend.core.config import settings

logger = logging.getLogger(__name__)
DB_PATH = str(settings.DB_PATH)


async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;

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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER,
                collection_id TEXT,
                owner_id TEXT,
                status TEXT DEFAULT 'processing',
                chunk_count INTEGER DEFAULT 0,
                page_count INTEGER DEFAULT 0,
                word_count INTEGER DEFAULT 0,
                language TEXT DEFAULT 'en',
                tags TEXT DEFAULT '[]',
                metadata TEXT DEFAULT '{}',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (collection_id) REFERENCES collections(id),
                FOREIGN KEY (owner_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS query_history (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                query TEXT NOT NULL,
                answer TEXT,
                model_used TEXT,
                collection_id TEXT,
                sources TEXT DEFAULT '[]',
                latency_ms INTEGER,
                token_count INTEGER,
                feedback INTEGER,
                feedback_comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS eval_runs (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                collection_id TEXT,
                name TEXT,
                config TEXT DEFAULT '{}',
                results TEXT DEFAULT '{}',
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_docs_owner ON documents(owner_id);
            CREATE INDEX IF NOT EXISTS idx_docs_collection ON documents(collection_id);
            CREATE INDEX IF NOT EXISTS idx_history_user ON query_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_history_created ON query_history(created_at);
        """)
        await db.commit()

        # Create default admin user if not exists
        import uuid
        from backend.auth.utils import hash_password
        admin_id = str(uuid.uuid4())
        try:
            hashed = hash_password("admin123")
        except Exception as e:
            logger.warning(f"Password hashing failed: {e}, using plain text")
            hashed = "admin123"  # Plain text fallback
        await db.execute("""
            INSERT OR IGNORE INTO users (id, username, email, hashed_password, role)
            VALUES (?, 'admin', 'admin@ragnarok.local', ?, 'admin')
        """, (admin_id, hashed))

        # Create default collection
        col_id = str(uuid.uuid4())
        await db.execute("""
            INSERT OR IGNORE INTO collections (id, name, description, is_public)
            VALUES (?, 'Default', 'Default document collection', 1)
        """, (col_id,))
        await db.commit()

        logger.info("✅ Database initialized")
