"""Service for managing download requests in the database."""

from datetime import UTC, datetime

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
                (
                    task_id,
                    artist,
                    album,
                    username,
                    vpn_ip,
                    "pending",
                    datetime.now(UTC).isoformat(),
                ),
            )
            request_id = cursor.lastrowid

            cursor.execute(
                "SELECT * FROM download_requests WHERE id = ?", (request_id,)
            )
            row = cursor.fetchone()

            if row:
                return DownloadRequest.from_row(tuple(row))

            raise ValueError("Failed to create download request")

    @staticmethod
    def get_request_by_task_id(task_id: str) -> DownloadRequest | None:
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
        slskd_username: str | None = None,
        file_count: int | None = None,
        total_size: int | None = None,
    ) -> bool:
        """Update the status of a download request."""
        with get_db() as conn:
            cursor = conn.cursor()

            # Build update query safely with predefined field names
            update_fields = {"status": status}

            if slskd_username is not None:
                update_fields["slskd_username"] = slskd_username

            if file_count is not None:
                update_fields["file_count"] = file_count

            if total_size is not None:
                update_fields["total_size"] = total_size

            # Create SET clause with safe field names
            set_clause = ", ".join(f"{field} = ?" for field in update_fields.keys())
            params = list(update_fields.values())
            params.append(task_id)

            cursor.execute(
                f"UPDATE download_requests SET {set_clause} WHERE task_id = ?",
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
                (
                    "completed",
                    completed_files,
                    album_directory,
                    datetime.now(UTC).isoformat(),
                    task_id,
                ),
            )

            return cursor.rowcount > 0

    @staticmethod
    def get_all_requests(limit: int = 100, offset: int = 0) -> list[DownloadRequest]:
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
    ) -> list[DownloadRequest]:
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
    ) -> list[DownloadRequest]:
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

    @staticmethod
    def get_vpn_ip_request_count(vpn_ip: str) -> int:
        """Get count of download requests for a specific VPN IP."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM download_requests WHERE vpn_ip = ?", (vpn_ip,)
            )
            result = cursor.fetchone()
            return result[0] if result else 0
