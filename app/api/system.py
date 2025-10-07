"""Health and system endpoints."""

import time
from datetime import datetime

from fastapi import APIRouter
from prometheus_client import generate_latest

from app.core.logging import get_logger
from app.models.schemas import APIInfo, HealthResponse
from config import settings

logger = get_logger(__name__)
router = APIRouter()

# Application start time for uptime calculation
start_time = time.time()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    uptime = time.time() - start_time

    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        timestamp=datetime.utcnow().isoformat(),
        uptime=uptime,
    )


@router.get("/info", response_model=APIInfo, tags=["System"])
async def api_info() -> APIInfo:
    """Get API information."""
    return APIInfo(
        name=settings.app_name,
        version=settings.app_version,
        description=settings.app_description,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )


@router.get("/metrics", tags=["System"])
async def get_metrics():
    """Prometheus metrics endpoint."""
    if not settings.enable_metrics:
        return {"error": "Metrics are disabled"}

    return generate_latest().decode("utf-8")
