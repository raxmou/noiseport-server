"""Database connection and initialization."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from app.core.logging import get_logger
from config import settings

logger = get_logger(__name__)

# Default database path
DB_PATH = Path(settings.database_url.replace("sqlite:///", ""))


def get_db_path() -> Path:
    """Get the current database path."""
    return DB_PATH


def get_db_connection() -> sqlite3.Connection:
    """Get a database connection."""
    db_path = get_db_path()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for database connections."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize the database with required tables."""
    db_path = get_db_path()
    logger.info(f"Initializing database at {db_path}")

    # Ensure the database directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        cursor = conn.cursor()

        # Create download_requests table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS download_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL UNIQUE,
                artist TEXT NOT NULL,
                album TEXT NOT NULL,
                username TEXT NOT NULL,
                vpn_ip TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                slskd_username TEXT,
                file_count INTEGER DEFAULT 0,
                completed_files INTEGER DEFAULT 0,
                total_size INTEGER DEFAULT 0,
                album_directory TEXT,
                completed_at TIMESTAMP
            )
        """
        )

        # Create indexes for common queries
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_download_requests_username 
            ON download_requests(username)
        """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_download_requests_vpn_ip 
            ON download_requests(vpn_ip)
        """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_download_requests_status 
            ON download_requests(status)
        """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_download_requests_timestamp 
            ON download_requests(timestamp)
        """
        )

        conn.commit()
        logger.info("Database initialized successfully")
