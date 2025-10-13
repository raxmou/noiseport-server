"""Custom exceptions for the application."""



class DownloaderException(Exception):
    """Base exception for downloader application."""

    def __init__(
        self,
        message: str,
        detail: str | None = None,
        status_code: int = 500,
    ) -> None:
        self.message = message
        self.detail = detail
        self.status_code = status_code
        super().__init__(self.message)


class ValidationError(DownloaderException):
    """Validation error exception."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message, detail, status_code=422)


class NotFoundError(DownloaderException):
    """Resource not found exception."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message, detail, status_code=404)


class ServiceUnavailableError(DownloaderException):
    """Service unavailable exception."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message, detail, status_code=503)


class SlskdConnectionError(ServiceUnavailableError):
    """SLSKD connection error exception."""

    def __init__(self, message: str = "Unable to connect to SLSKD service") -> None:
        super().__init__(message)


class SearchTimeoutError(DownloaderException):
    """Search timeout exception."""

    def __init__(self, message: str = "Search operation timed out") -> None:
        super().__init__(message, status_code=408)


class DownloadError(DownloaderException):
    """Download operation error exception."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message, detail, status_code=500)


class ConfigurationError(DownloaderException):
    """Configuration error exception."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message, detail, status_code=500)
