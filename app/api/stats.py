"""Statistics endpoints for SLSKD data."""

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import DownloadError, SlskdConnectionError
from app.core.logging import get_logger
from app.models.schemas import (
    DownloadedAlbumsResponse,
    DownloadStatsResponse,
    NoResultsStatsResponse,
)
from app.services import slskd_service

logger = get_logger(__name__)
router = APIRouter()


@router.get("/searches/no-results", response_model=NoResultsStatsResponse, tags=["Statistics"])
async def get_searches_without_results() -> NoResultsStatsResponse:
    """
    Get statistics for searches that returned no results.

    Returns a list of all searches that didn't find any files, along with
    the total count. Useful for identifying content that might not be
    available on the network.
    """
    logger.info("Fetching searches without results")

    try:
        return slskd_service.get_searches_without_results()
    except SlskdConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SLSKD service is not available",
        )
    except DownloadError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.message,
        )


@router.get("/downloads/stats", response_model=DownloadStatsResponse, tags=["Statistics"])
async def get_download_statistics() -> DownloadStatsResponse:
    """
    Get comprehensive download statistics.

    Returns statistics about album and track downloads including:
    - Number of albums attempted
    - Track completion, error, and queue counts
    - Overall download success metrics
    """
    logger.info("Fetching download statistics")

    try:
        return slskd_service.get_download_stats()
    except SlskdConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SLSKD service is not available",
        )
    except DownloadError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.message,
        )


@router.get("/downloads/albums", response_model=DownloadedAlbumsResponse, tags=["Statistics"])
async def get_downloaded_albums() -> DownloadedAlbumsResponse:
    """
    Get list of all downloaded albums.

    Returns a comprehensive list of all albums that have been downloaded,
    including metadata such as:
    - Artist and album names
    - Source username
    - Track counts and completion status
    - Total file sizes
    """
    logger.info("Fetching downloaded albums list")

    try:
        return slskd_service.get_downloaded_albums()
    except SlskdConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SLSKD service is not available",
        )
    except DownloadError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.message,
        )
