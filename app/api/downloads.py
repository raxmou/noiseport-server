"""Download endpoints."""

import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from app.core.exceptions import DownloadError, SearchTimeoutError, SlskdConnectionError
from app.core.logging import get_logger
from app.models.schemas import (
    DownloadHistoryResponse,
    DownloadRequest,
    DownloadRequestResponse,
    DownloadResponse,
)
from app.services import slskd_service
from app.services.download_request_service import DownloadRequestService
from app.services.headscale_service import headscale_client
from config import settings

logger = get_logger(__name__)
router = APIRouter()


def create_download_metadata(
    artist: str,
    album: str,
    slskd_username: str,
    vpn_username: str,
    vpn_ip: str,
    task_id: str,
) -> None:
    """
    Create a metadata JSON file for the download.

    The file is created in the expected download directory structure:
    /music/downloads/{slskd_username}/{artist}/{album}/.noiseport_metadata.json
    """
    try:
        # Construct the expected download path
        # SLSKD downloads to /music/downloads/{slskd_username}/{path from file}
        # The file paths typically include artist/album structure
        base_path = Path(settings.host_music_path) / "downloads" / slskd_username

        # Sanitize artist and album names for filesystem
        safe_artist = "".join(
            c if c.isalnum() or c in (" ", "-", "_") else "_" for c in artist
        )
        safe_album = "".join(
            c if c.isalnum() or c in (" ", "-", "_") else "_" for c in album
        )

        # Create the expected directory path
        download_dir = base_path / safe_artist / safe_album

        # Ensure the directory exists
        download_dir.mkdir(parents=True, exist_ok=True)

        # Create metadata file
        metadata = {
            "vpn_username": vpn_username,
            "vpn_ip": vpn_ip,
            "task_id": task_id,
            "artist": artist,
            "album": album,
            "slskd_username": slskd_username,
        }

        metadata_file = download_dir / ".noiseport_metadata.json"
        with open(metadata_file, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"[Task {task_id}] Created metadata file: {metadata_file}")

    except Exception as e:
        # Log error but don't fail the download
        logger.error(
            f"[Task {task_id}] Failed to create metadata file: {e}",
            exc_info=True,
        )


def background_download_album(
    artist: str, album: str, task_id: str, username: str, vpn_ip: str
) -> None:
    """Background task for downloading album."""
    logger.info(f"[Task {task_id}] Starting download: {artist} - {album}")

    try:
        # Search for the album
        search_result = slskd_service.search_album(artist, album)

        if not search_result.users:
            logger.warning(f"[Task {task_id}] No search results found")
            DownloadRequestService.update_request_status(task_id, "no_results")
            return

        # Find the best album match
        best_match = slskd_service.find_best_album_match(
            search_result.users, artist, album
        )

        if not best_match:
            logger.warning(f"[Task {task_id}] No suitable album found")
            DownloadRequestService.update_request_status(task_id, "no_match")
            return

        slskd_username, files = best_match

        # Update request with SLSKD username and file info
        DownloadRequestService.update_request_status(
            task_id,
            "downloading",
            slskd_username=slskd_username,
            file_count=len(files),
            total_size=sum(f.size or 0 for f in files),
        )

        # Create metadata JSON file with VPN user info
        create_download_metadata(
            artist=artist,
            album=album,
            slskd_username=slskd_username,
            vpn_username=username,
            vpn_ip=vpn_ip,
            task_id=task_id,
        )

        # Enqueue download
        success = slskd_service.enqueue_download(slskd_username, files)

        if success:
            logger.info(
                f"[Task {task_id}] Successfully enqueued {len(files)} files "
                f"from user {slskd_username}"
            )
            DownloadRequestService.update_request_status(task_id, "enqueued")
        else:
            logger.error(f"[Task {task_id}] Failed to enqueue download")
            DownloadRequestService.update_request_status(task_id, "failed")

    except SlskdConnectionError:
        logger.error(f"[Task {task_id}] SLSKD connection failed")
        DownloadRequestService.update_request_status(task_id, "connection_error")
    except SearchTimeoutError:
        logger.error(f"[Task {task_id}] Search timed out")
        DownloadRequestService.update_request_status(task_id, "timeout")
    except DownloadError as e:
        logger.error(f"[Task {task_id}] Download error: {e.message}")
        DownloadRequestService.update_request_status(task_id, "error")
    except Exception as e:
        logger.error(f"[Task {task_id}] Unexpected error: {e}", exc_info=True)
        DownloadRequestService.update_request_status(task_id, "error")


@router.post("/download", response_model=DownloadResponse, tags=["Downloads"])
def download_album(
    request: DownloadRequest, background_tasks: BackgroundTasks
) -> DownloadResponse:
    """
    Download an album.

    This endpoint initiates a background download task for the specified artist and album.
    The download process includes:
    1. Searching for the album on the SLSKD network
    2. Finding the best quality match (320kbps MP3 or FLAC preferred)
    3. Enqueuing the files for download

    User information is tracked via VPN IP provided in the request body.
    Username is resolved from Headscale if not provided.

    Returns immediately with a task ID for tracking.
    """
    task_id = str(uuid.uuid4())

    # Get VPN IP from request body
    vpn_ip = request.vpn_ip

    # Resolve username: use provided username, or resolve from Headscale, or fall back to VPN IP
    username = request.username
    if not username:
        # Try to resolve from Headscale
        resolved_username = headscale_client.resolve_username(vpn_ip)
        username = resolved_username if resolved_username else vpn_ip
        logger.info(f"Resolved username for IP {vpn_ip}: {username}")

    logger.info(
        f"Received download request: {request.artist} - {request.album} "
        f"(Task ID: {task_id}, User: {username}, VPN IP: {vpn_ip})"
    )

    try:
        # Store download request in database
        DownloadRequestService.create_request(
            task_id=task_id,
            artist=request.artist,
            album=request.album,
            username=username,
            vpn_ip=vpn_ip,
        )

        # Start background download task
        background_tasks.add_task(
            background_download_album,
            request.artist,
            request.album,
            task_id,
            username,
            vpn_ip,
        )

        return DownloadResponse(
            success=True,
            message=f"Download started for {request.artist} - {request.album}",
            task_id=task_id,
        )

    except Exception as e:
        logger.error(f"Failed to start download task: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start download task",
        )


@router.get("/search/{artist}/{album}", tags=["Downloads"])
async def search_album(artist: str, album: str) -> dict[str, Any]:
    """
    Search for an album without downloading.

    This endpoint searches for the specified artist and album and returns
    the available files without initiating a download.
    """
    logger.info(f"Search request: {artist} - {album}")

    try:
        search_result = slskd_service.search_album(artist, album)

        return {
            "artist": artist,
            "album": album,
            "search_id": search_result.search_id,
            "status": search_result.status,
            "response_count": search_result.response_count,
            "users": [
                {
                    "username": user.username,
                    "file_count": len(user.files),
                    "total_size": sum(f.size or 0 for f in user.files),
                    "files": [
                        {
                            "filename": f.filename,
                            "size": f.size,
                            "bit_rate": f.bit_rate,
                            "extension": f.extension,
                        }
                        for f in user.files[:10]  # Limit to first 10 files
                    ],
                }
                for user in search_result.users[:5]  # Limit to first 5 users
            ],
        }

    except SlskdConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SLSKD service is not available",
        )
    except SearchTimeoutError:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Search request timed out",
        )
    except DownloadError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.message,
        )


@router.get("/history", response_model=DownloadHistoryResponse, tags=["Downloads"])
def get_download_history(limit: int = 100, offset: int = 0) -> DownloadHistoryResponse:
    """
    Get download history for all users.

    Returns a paginated list of all download requests with their status and metadata.
    """
    try:
        requests = DownloadRequestService.get_all_requests(limit=limit, offset=offset)
        total_count = DownloadRequestService.get_request_count()

        return DownloadHistoryResponse(
            count=total_count,
            requests=[
                DownloadRequestResponse(
                    id=req.id or 0,
                    task_id=req.task_id,
                    artist=req.artist,
                    album=req.album,
                    username=req.username,
                    vpn_ip=req.vpn_ip,
                    status=req.status,
                    timestamp=req.timestamp.isoformat() if req.timestamp else "",
                    slskd_username=req.slskd_username,
                    file_count=req.file_count,
                    completed_files=req.completed_files,
                    total_size=req.total_size,
                    album_directory=req.album_directory,
                    completed_at=req.completed_at.isoformat()
                    if req.completed_at
                    else None,
                )
                for req in requests
            ],
        )

    except Exception as e:
        logger.error(f"Failed to get download history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve download history",
        )


@router.get(
    "/history/user/{username}",
    response_model=DownloadHistoryResponse,
    tags=["Downloads"],
)
def get_user_download_history(
    username: str, limit: int = 100, offset: int = 0
) -> DownloadHistoryResponse:
    """
    Get download history for a specific user.

    Returns a paginated list of download requests made by the specified user.
    """
    try:
        requests = DownloadRequestService.get_requests_by_user(
            username=username, limit=limit, offset=offset
        )
        total_count = DownloadRequestService.get_user_request_count(username)

        return DownloadHistoryResponse(
            count=total_count,
            requests=[
                DownloadRequestResponse(
                    id=req.id or 0,
                    task_id=req.task_id,
                    artist=req.artist,
                    album=req.album,
                    username=req.username,
                    vpn_ip=req.vpn_ip,
                    status=req.status,
                    timestamp=req.timestamp.isoformat() if req.timestamp else "",
                    slskd_username=req.slskd_username,
                    file_count=req.file_count,
                    completed_files=req.completed_files,
                    total_size=req.total_size,
                    album_directory=req.album_directory,
                    completed_at=req.completed_at.isoformat()
                    if req.completed_at
                    else None,
                )
                for req in requests
            ],
        )

    except Exception as e:
        logger.error(f"Failed to get user download history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user download history",
        )


@router.get(
    "/history/ip/{vpn_ip}", response_model=DownloadHistoryResponse, tags=["Downloads"]
)
def get_ip_download_history(
    vpn_ip: str, limit: int = 100, offset: int = 0
) -> DownloadHistoryResponse:
    """
    Get download history for a specific VPN IP address.

    Returns a paginated list of download requests made from the specified IP.
    """
    try:
        requests = DownloadRequestService.get_requests_by_vpn_ip(
            vpn_ip=vpn_ip, limit=limit, offset=offset
        )

        # Get proper count for this VPN IP
        count = DownloadRequestService.get_vpn_ip_request_count(vpn_ip)

        return DownloadHistoryResponse(
            count=count,
            requests=[
                DownloadRequestResponse(
                    id=req.id or 0,
                    task_id=req.task_id,
                    artist=req.artist,
                    album=req.album,
                    username=req.username,
                    vpn_ip=req.vpn_ip,
                    status=req.status,
                    timestamp=req.timestamp.isoformat() if req.timestamp else "",
                    slskd_username=req.slskd_username,
                    file_count=req.file_count,
                    completed_files=req.completed_files,
                    total_size=req.total_size,
                    album_directory=req.album_directory,
                    completed_at=req.completed_at.isoformat()
                    if req.completed_at
                    else None,
                )
                for req in requests
            ],
        )

    except Exception as e:
        logger.error(f"Failed to get IP download history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve IP download history",
        )


@router.get(
    "/request/{task_id}", response_model=DownloadRequestResponse, tags=["Downloads"]
)
def get_download_request(task_id: str) -> DownloadRequestResponse:
    """
    Get details of a specific download request by task ID.

    Returns the full details of the download request including current status.
    """
    try:
        request = DownloadRequestService.get_request_by_task_id(task_id)

        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Download request with task_id {task_id} not found",
            )

        return DownloadRequestResponse(
            id=request.id or 0,
            task_id=request.task_id,
            artist=request.artist,
            album=request.album,
            username=request.username,
            vpn_ip=request.vpn_ip,
            status=request.status,
            timestamp=request.timestamp.isoformat() if request.timestamp else "",
            slskd_username=request.slskd_username,
            file_count=request.file_count,
            completed_files=request.completed_files,
            total_size=request.total_size,
            album_directory=request.album_directory,
            completed_at=request.completed_at.isoformat()
            if request.completed_at
            else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get download request: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve download request",
        )
