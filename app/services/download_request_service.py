"""Service for managing download requests in the database."""

from datetime import datetime
from typing import List, Optional

from app.core.logging import get_logger
from app.database.connection import get_db
from app.database.models import DownloadRequest

logger = get_logger(__name__)


class DownloadRequestService:
    """Service for managing download requests."""

    @staticmethod
    def create_request(
        task_id: str,
        artist: str,
        album: str,
        username: str,
        vpn_ip: str,
    ) -> DownloadRequest:
        """Create a new download request."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO download_requests 
                (task_id, artist, album, username, vpn_ip, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (task_id, artist, album, username, vpn_ip, "pending", datetime.utcnow().isoformat()),
            )
            request_id = cursor.lastrowid

            cursor.execute("SELECT * FROM download_requests WHERE id = ?", (request_id,))
            row = cursor.fetchone()

            if row:
                return DownloadRequest.from_row(tuple(row))

            raise ValueError("Failed to create download request")

    @staticmethod
    def get_request_by_task_id(task_id: str) -> Optional[DownloadRequest]:
        """Get a download request by task ID."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM download_requests WHERE task_id = ?", (task_id,)
            )
            row = cursor.fetchone()

            if row:
                return DownloadRequest.from_row(tuple(row))

            return None

    @staticmethod
    def update_request_status(
        task_id: str,
        status: str,
        slskd_username: Optional[str] = None,
        file_count: Optional[int] = None,
        total_size: Optional[int] = None,
    ) -> bool:
        """Update the status of a download request."""
        with get_db() as conn:
            cursor = conn.cursor()

            updates = ["status = ?"]
            params = [status]

            if slskd_username is not None:
                updates.append("slskd_username = ?")
                params.append(slskd_username)

            if file_count is not None:
                updates.append("file_count = ?")
                params.append(file_count)

            if total_size is not None:
                updates.append("total_size = ?")
                params.append(total_size)

            params.append(task_id)

            cursor.execute(
                f"UPDATE download_requests SET {', '.join(updates)} WHERE task_id = ?",
                params,
            )

            return cursor.rowcount > 0

    @staticmethod
    def complete_request(
        task_id: str,
        album_directory: str,
        completed_files: int,
    ) -> bool:
        """Mark a download request as completed."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE download_requests 
                SET status = ?, completed_files = ?, album_directory = ?, completed_at = ?
                WHERE task_id = ?
            """,
                ("completed", completed_files, album_directory, datetime.utcnow().isoformat(), task_id),
            )

            return cursor.rowcount > 0

    @staticmethod
    def get_all_requests(
        limit: int = 100, offset: int = 0
    ) -> List[DownloadRequest]:
        """Get all download requests with pagination."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM download_requests 
                ORDER BY timestamp DESC 
                LIMIT ? OFFSET ?
            """,
                (limit, offset),
            )
            rows = cursor.fetchall()

            return [DownloadRequest.from_row(tuple(row)) for row in rows]

    @staticmethod
    def get_requests_by_user(
        username: str, limit: int = 100, offset: int = 0
    ) -> List[DownloadRequest]:
        """Get download requests for a specific user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM download_requests 
                WHERE username = ? 
                ORDER BY timestamp DESC 
                LIMIT ? OFFSET ?
            """,
                (username, limit, offset),
            )
            rows = cursor.fetchall()

            return [DownloadRequest.from_row(tuple(row)) for row in rows]

    @staticmethod
    def get_requests_by_vpn_ip(
        vpn_ip: str, limit: int = 100, offset: int = 0
    ) -> List[DownloadRequest]:
        """Get download requests for a specific VPN IP."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM download_requests 
                WHERE vpn_ip = ? 
                ORDER BY timestamp DESC 
                LIMIT ? OFFSET ?
            """,
                (vpn_ip, limit, offset),
            )
            rows = cursor.fetchall()

            return [DownloadRequest.from_row(tuple(row)) for row in rows]

    @staticmethod
    def get_request_count() -> int:
        """Get total count of download requests."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM download_requests")
            result = cursor.fetchone()
            return result[0] if result else 0

    @staticmethod
    def get_user_request_count(username: str) -> int:
        """Get count of download requests for a specific user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM download_requests WHERE username = ?", (username,)
            )
            result = cursor.fetchone()
            return result[0] if result else 0
