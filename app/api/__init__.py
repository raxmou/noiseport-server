"""API router configuration."""

from fastapi import APIRouter

from .config import router as config_router
from .downloads import router as downloads_router
from .stats import router as stats_router
from .system import router as system_router
from .uploads import router as uploads_router

# Create the main API router
api_router = APIRouter(prefix="/api/v1")

# Include all sub-routers
api_router.include_router(system_router, prefix="/system")
api_router.include_router(downloads_router, prefix="/downloads")
api_router.include_router(uploads_router, prefix="/uploads")
api_router.include_router(stats_router, prefix="/stats")
api_router.include_router(config_router, prefix="")

__all__ = ["api_router"]
