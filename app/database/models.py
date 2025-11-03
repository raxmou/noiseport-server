"""Database models for tracking download requests."""

from datetime import datetime
from typing import Optional


class DownloadRequest:
    """Model for a download request."""

    def __init__(
        self,
        id: Optional[int] = None,
        task_id: str = "",
        artist: str = "",
        album: str = "",
        username: str = "",
        vpn_ip: str = "",
        status: str = "pending",
        timestamp: Optional[datetime] = None,
        slskd_username: Optional[str] = None,
        file_count: int = 0,
        completed_files: int = 0,
        total_size: int = 0,
        album_directory: Optional[str] = None,
        completed_at: Optional[datetime] = None,
    ):
        """Initialize a download request."""
        self.id = id
        self.task_id = task_id
        self.artist = artist
        self.album = album
        self.username = username
        self.vpn_ip = vpn_ip
        self.status = status
        self.timestamp = timestamp or datetime.utcnow()
        self.slskd_username = slskd_username
        self.file_count = file_count
        self.completed_files = completed_files
        self.total_size = total_size
        self.album_directory = album_directory
        self.completed_at = completed_at

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "task_id": self.task_id,
            "artist": self.artist,
            "album": self.album,
            "username": self.username,
            "vpn_ip": self.vpn_ip,
            "status": self.status,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "slskd_username": self.slskd_username,
            "file_count": self.file_count,
            "completed_files": self.completed_files,
            "total_size": self.total_size,
            "album_directory": self.album_directory,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

    @classmethod
    def from_row(cls, row: tuple) -> "DownloadRequest":
        """Create instance from database row."""
        return cls(
            id=row[0],
            task_id=row[1],
            artist=row[2],
            album=row[3],
            username=row[4],
            vpn_ip=row[5],
            status=row[6],
            timestamp=datetime.fromisoformat(row[7]) if row[7] else None,
            slskd_username=row[8],
            file_count=row[9] or 0,
            completed_files=row[10] or 0,
            total_size=row[11] or 0,
            album_directory=row[12],
            completed_at=datetime.fromisoformat(row[13]) if row[13] else None,
        )
