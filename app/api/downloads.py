"""Download endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status

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

logger = get_logger(__name__)
router = APIRouter()


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
    request: DownloadRequest, background_tasks: BackgroundTasks, req: Request
) -> DownloadResponse:
    """
    Download an album.

    This endpoint initiates a background download task for the specified artist and album.
    The download process includes:
    1. Searching for the album on the SLSKD network
    2. Finding the best quality match (320kbps MP3 or FLAC preferred)
    3. Enqueuing the files for download

    User information is tracked via Headscale VPN headers.

    Returns immediately with a task ID for tracking.
    """
    task_id = str(uuid.uuid4())

    # Extract user info from Headscale VPN headers
    # Headscale typically uses X-Forwarded-For or similar headers
    # We'll try multiple common headers
    vpn_ip = (
        req.headers.get("X-Forwarded-For", "")
        or req.headers.get("X-Real-IP", "")
        or req.client.host
        if req.client
        else "unknown"
    )

    # Extract username from Headscale - typically in X-Headscale-User or custom header
    username = (
        req.headers.get("X-Headscale-User", "")
        or req.headers.get("X-User", "")
        or vpn_ip
    )

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
def get_download_history(
    limit: int = 100, offset: int = 0
) -> DownloadHistoryResponse:
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
                    completed_at=req.completed_at.isoformat() if req.completed_at else None,
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


@router.get("/history/user/{username}", response_model=DownloadHistoryResponse, tags=["Downloads"])
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
                    completed_at=req.completed_at.isoformat() if req.completed_at else None,
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


@router.get("/history/ip/{vpn_ip}", response_model=DownloadHistoryResponse, tags=["Downloads"])
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

        # Count is computed from the results
        count = len(requests) if offset == 0 else DownloadRequestService.get_request_count()

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
                    completed_at=req.completed_at.isoformat() if req.completed_at else None,
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


@router.get("/request/{task_id}", response_model=DownloadRequestResponse, tags=["Downloads"])
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
            completed_at=request.completed_at.isoformat() if request.completed_at else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get download request: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve download request",
        )
