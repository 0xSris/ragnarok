"""
Central configuration — all settings via environment variables with sane defaults.
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # App
    APP_NAME: str = "RAGNAROK"
    DEBUG: bool = False
    SECRET_KEY: str = "ragnarok-secret-change-in-production-please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h

    # Paths
    BASE_DIR: Path = Path(__file__).parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    UPLOADS_DIR: Path = DATA_DIR / "uploads"
    CHROMA_DIR: Path = DATA_DIR / "chroma"
    DB_PATH: Path = DATA_DIR / "ragnarok.db"
    EXPORTS_DIR: Path = DATA_DIR / "exports"

    # Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64
    TOP_K: int = 10
    RERANK_TOP_N: int = 5

    # LLM
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_LLM_MODEL: str = "llama3"
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_TOKENS: int = 2048

    # Whisper
    WHISPER_MODEL: str = "base"  # tiny, base, small, medium, large

    # OCR
    TESSERACT_LANG: str = "eng"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Ensure directories exist
        for d in [self.DATA_DIR, self.UPLOADS_DIR, self.CHROMA_DIR, self.EXPORTS_DIR]:
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
