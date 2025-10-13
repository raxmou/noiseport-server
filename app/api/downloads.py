"""Download endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from app.core.exceptions import DownloadError, SearchTimeoutError, SlskdConnectionError
from app.core.logging import get_logger
from app.models.schemas import DownloadRequest, DownloadResponse
from app.services import slskd_service

logger = get_logger(__name__)
router = APIRouter()


def background_download_album(artist: str, album: str, task_id: str) -> None:
    """Background task for downloading album."""
    logger.info(f"[Task {task_id}] Starting download: {artist} - {album}")

    try:
        # Search for the album
        search_result = slskd_service.search_album(artist, album)

        if not search_result.users:
            logger.warning(f"[Task {task_id}] No search results found")
            return

        # Find the best album match
        best_match = slskd_service.find_best_album_match(
            search_result.users, artist, album
        )

        if not best_match:
            logger.warning(f"[Task {task_id}] No suitable album found")
            return

        username, files = best_match

        # Enqueue download
        success = slskd_service.enqueue_download(username, files)

        if success:
            logger.info(
                f"[Task {task_id}] Successfully enqueued {len(files)} files "
                f"from user {username}"
            )
        else:
            logger.error(f"[Task {task_id}] Failed to enqueue download")

    except SlskdConnectionError:
        logger.error(f"[Task {task_id}] SLSKD connection failed")
    except SearchTimeoutError:
        logger.error(f"[Task {task_id}] Search timed out")
    except DownloadError as e:
        logger.error(f"[Task {task_id}] Download error: {e.message}")
    except Exception as e:
        logger.error(f"[Task {task_id}] Unexpected error: {e}", exc_info=True)


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

    Returns immediately with a task ID for tracking.
    """
    task_id = str(uuid.uuid4())

    logger.info(
        f"Received download request: {request.artist} - {request.album} "
        f"(Task ID: {task_id})"
    )

    try:
        background_tasks.add_task(
            background_download_album, request.artist, request.album, task_id
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
