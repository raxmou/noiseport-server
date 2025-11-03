"""Pydantic models for API schemas."""

from pydantic import BaseModel, Field, field_validator


class DownloadRequest(BaseModel):
    """Request model for album download."""

    artist: str = Field(..., min_length=1, max_length=255, description="Artist name")
    album: str = Field(..., min_length=1, max_length=255, description="Album name")

    @field_validator("artist", "album")
    @classmethod
    def validate_non_empty_string(cls, v: str) -> str:
        """Validate that strings are not empty or whitespace only."""
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()


class DownloadResponse(BaseModel):
    """Response model for download operations."""

    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Human-readable message")
    task_id: str | None = Field(None, description="Background task ID")


class FileInfo(BaseModel):
    """Model for file information."""

    code: int | None = Field(None, description="File code")
    extension: str | None = Field(None, description="File extension")
    filename: str = Field(..., description="File name")
    size: int | None = Field(None, ge=0, description="File size in bytes")
    is_locked: bool | None = Field(None, alias="isLocked", description="Is file locked")
    bit_rate: int | None = Field(None, alias="bitRate", ge=0, description="Bit rate")
    is_variable_bit_rate: bool | None = Field(
        None, alias="isVariableBitRate", description="Is variable bit rate"
    )
    length: int | None = Field(None, ge=0, description="Length in seconds")


class UserFilesResponse(BaseModel):
    """Response model for user files."""

    username: str = Field(..., description="Username")
    files: list[FileInfo] = Field(..., description="List of files")


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Application version")
    timestamp: str = Field(..., description="Current timestamp")
    uptime: float = Field(..., description="Uptime in seconds")


class ErrorResponse(BaseModel):
    """Response model for errors."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    detail: str | None = Field(None, description="Additional error details")


class MetricsResponse(BaseModel):
    """Response model for metrics."""

    total_downloads: int = Field(..., ge=0, description="Total number of downloads")
    active_downloads: int = Field(..., ge=0, description="Number of active downloads")
    completed_downloads: int = Field(
        ..., ge=0, description="Number of completed downloads"
    )
    failed_downloads: int = Field(..., ge=0, description="Number of failed downloads")


class SearchResult(BaseModel):
    """Model for search results."""

    search_id: str = Field(..., description="Search ID")
    status: str = Field(..., description="Search status")
    response_count: int = Field(..., ge=0, description="Number of responses")
    users: list[UserFilesResponse] = Field(..., description="User responses")


class APIInfo(BaseModel):
    """Model for API information."""

    name: str = Field(..., description="API name")
    version: str = Field(..., description="API version")
    description: str = Field(..., description="API description")
    docs_url: str = Field(..., description="Documentation URL")
    openapi_url: str = Field(..., description="OpenAPI schema URL")


class SearchWithoutResults(BaseModel):
    """Model for searches that returned no results."""

    artist: str = Field(..., description="Artist name")
    title: str = Field(..., description="Song/album title")
    search_text: str = Field(..., description="Original search text")


class NoResultsStatsResponse(BaseModel):
    """Response model for searches with no results statistics."""

    count: int = Field(..., ge=0, description="Number of searches with no results")
    searches: list[SearchWithoutResults] = Field(
        ..., description="List of searches with no results"
    )


class TrackStats(BaseModel):
    """Model for track statistics."""

    completed: int = Field(..., ge=0, description="Number of completed tracks")
    errored: int = Field(..., ge=0, description="Number of errored tracks")
    queued: int = Field(..., ge=0, description="Number of queued tracks")
    tried: int = Field(..., ge=0, description="Total number of tracks attempted")


class AlbumStats(BaseModel):
    """Model for album statistics."""

    tried: int = Field(..., ge=0, description="Number of albums attempted for download")


class DownloadStatsResponse(BaseModel):
    """Response model for download statistics."""

    albums: AlbumStats = Field(..., description="Album download statistics")
    tracks: TrackStats = Field(..., description="Track download statistics")


class DownloadedAlbum(BaseModel):
    """Model for a downloaded album."""

    artist: str = Field(..., description="Artist name")
    album: str = Field(..., description="Album name")
    username: str = Field(..., description="Username who shared the album")
    track_count: int = Field(..., ge=0, description="Number of tracks in the album")
    completed_tracks: int = Field(..., ge=0, description="Number of completed tracks")
    total_size: int = Field(..., ge=0, description="Total size in bytes")


class DownloadedAlbumsResponse(BaseModel):
    """Response model for downloaded albums list."""

    count: int = Field(..., ge=0, description="Total number of downloaded albums")
    albums: list[DownloadedAlbum] = Field(..., description="List of downloaded albums")


class DownloadRequestResponse(BaseModel):
    """Response model for a download request record."""

    id: int = Field(..., description="Request ID")
    task_id: str = Field(..., description="Task ID")
    artist: str = Field(..., description="Artist name")
    album: str = Field(..., description="Album name")
    username: str = Field(..., description="Username from Headscale VPN")
    vpn_ip: str = Field(..., description="VPN IP address")
    status: str = Field(..., description="Download status")
    timestamp: str = Field(..., description="Request timestamp")
    slskd_username: str | None = Field(
        None, description="SLSKD username who shared the album"
    )
    file_count: int = Field(default=0, description="Number of files in download")
    completed_files: int = Field(default=0, description="Number of completed files")
    total_size: int = Field(default=0, description="Total size in bytes")
    album_directory: str | None = Field(
        None, description="Directory where album is stored"
    )
    completed_at: str | None = Field(None, description="Completion timestamp")


class DownloadHistoryResponse(BaseModel):
    """Response model for download history."""

    count: int = Field(..., ge=0, description="Total number of requests")
    requests: list[DownloadRequestResponse] = Field(
        ..., description="List of download requests"
    )
