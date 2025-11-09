"""Core application initialization."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import Counter, Histogram
from pydantic import ValidationError

from app.api import api_router
from app.core.error_handlers import (
    downloader_exception_handler,
    general_exception_handler,
    validation_exception_handler,
)
from app.core.exceptions import DownloaderException
from app.core.logging import get_logger, setup_logging
from config import settings

# Setup logging first
setup_logging()
logger = get_logger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    "http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"]
)
REQUEST_DURATION = Histogram("http_request_duration_seconds", "HTTP request duration")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    logger.info("Initializing FastAPI application")

    # Initialize database
    from app.database import init_db

    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)

    # Create FastAPI app
    app = FastAPI(
        title=settings.app_name,
        description=settings.app_description,
        version=settings.app_version,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    # Add middleware
    _add_middleware(app)

    # Add exception handlers
    _add_exception_handlers(app)

    # Include API routers
    app.include_router(api_router)

    # Serve static files for the React frontend
    frontend_dist_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist"
    )

    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(frontend_dist_path, "assets")),
        name="assets",
    )

    # Serve the React app for wizard routes
    @app.get("/wizard")
    @app.get("/setup")
    async def serve_wizard():
        """Serve the setup wizard React app."""
        index_path = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {
            "message": "Setup wizard not available. Please build the frontend first."
        }

    # Add root endpoint
    @app.get("/", tags=["Root"])
    async def root():
        """Root endpoint."""
        return {
            "message": f"Welcome to {settings.app_name}",
            "version": settings.app_version,
            "docs": "/docs",
            "wizard": "/wizard",
        }

    logger.info("FastAPI application initialized successfully")
    return app


def _add_middleware(app: FastAPI) -> None:
    """Add middleware to the application."""
    logger.info("Adding middleware")

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=settings.allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Trusted host middleware for production
    if settings.is_production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"],  # Configure this properly in production
        )

    logger.info("Middleware added successfully")


def _add_exception_handlers(app: FastAPI) -> None:
    """Add exception handlers to the application."""
    logger.info("Adding exception handlers")

    app.add_exception_handler(DownloaderException, downloader_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)

    logger.info("Exception handlers added successfully")


# Create the app instance
app = create_app()
