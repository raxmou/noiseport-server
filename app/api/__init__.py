"""API router configuration."""

from fastapi import APIRouter

from .downloads import router as downloads_router
from .stats import router as stats_router
from .system import router as system_router

# Create the main API router
api_router = APIRouter(prefix="/api/v1")

# Include all sub-routers
api_router.include_router(system_router, prefix="/system")
api_router.include_router(downloads_router, prefix="/downloads")
api_router.include_router(stats_router, prefix="/stats")

__all__ = ["api_router"]
