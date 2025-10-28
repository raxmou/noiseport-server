"""Main application entry point."""

import uvicorn

from app.core.app import app  # noqa: F401
from config import settings


def main() -> None:
    """Main function to run the application."""
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers,
        log_level=settings.log_level.lower(),
        reload=settings.debug,
        access_log=True,
    )


if __name__ == "__main__":
    main()
