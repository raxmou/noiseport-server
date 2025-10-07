"""SLSKD service for handling music downloads."""

import time

from slskd_api import SlskdClient
from slskd_api.apis.searches import SearchesApi
from slskd_api.apis.transfers import TransfersApi

from app.core.exceptions import DownloadError, SearchTimeoutError, SlskdConnectionError
from app.core.logging import get_logger
from app.models.schemas import FileInfo, SearchResult, UserFilesResponse
from config import settings

logger = get_logger(__name__)


class SlskdService:
    """Service for interacting with SLSKD API."""

    def __init__(self) -> None:
        """Initialize SLSKD service."""
        self._client: SlskdClient | None = None

    @property
    def client(self) -> SlskdClient:
        """Get SLSKD client instance."""
        if self._client is None:
            try:
                self._client = SlskdClient(
                    settings.slskd_host,
                    username=settings.slskd_username,
                    password=settings.slskd_password,
                )
                logger.info(f"Connected to SLSKD at {settings.slskd_host}")
            except Exception as e:
                logger.error(f"Failed to connect to SLSKD: {e}")
                raise SlskdConnectionError(f"Failed to connect to SLSKD: {e}")
        return self._client

    def search_album(
        self,
        artist: str,
        album: str,
        file_limit: int = 1000,
        response_limit: int = 50,
        timeout: int = 30,
    ) -> SearchResult:
        """Search for an album on SLSKD."""
        search_text = f"{artist} - {album}"
        logger.info(f"Starting search: {search_text}")

        try:
            searches: SearchesApi = self.client.searches
            resp = searches.search_text(
                searchText=search_text,
                fileLimit=file_limit,
                filterResponses=True,
                responseLimit=response_limit,
                searchTimeout=15000,
            )

            search_id = resp.get("id")
            if not search_id:
                raise DownloadError("No search ID returned from SLSKD API")

            # Wait for search completion
            responses = self._wait_for_search_completion(search_id, timeout)

            # Convert responses to our schema
            users = []
            for user_resp in responses:
                username = user_resp.get("username", "")
                files = user_resp.get("files", [])

                file_infos = [
                    FileInfo(
                        code=file.get("code"),
                        extension=file.get("extension"),
                        filename=file.get("filename", ""),
                        size=file.get("size"),
                        is_locked=file.get("isLocked"),
                        bit_rate=file.get("bitRate"),
                        is_variable_bit_rate=file.get("isVariableBitRate"),
                        length=file.get("length"),
                    )
                    for file in files
                ]

                users.append(
                    UserFilesResponse(username=username, files=file_infos)
                )

            return SearchResult(
                search_id=search_id,
                status="completed",
                response_count=len(responses),
                users=users,
            )

        except Exception as e:
            logger.error(f"Search failed: {e}")
            if isinstance(e, (SlskdConnectionError, DownloadError, SearchTimeoutError)):
                raise
            raise DownloadError(f"Search operation failed: {e}")

    def _wait_for_search_completion(
        self, search_id: str, timeout: int
    ) -> list[dict]:
        """Wait for search to complete and return responses."""
        searches: SearchesApi = self.client.searches
        start_time = time.time()
        responses = []

        while time.time() - start_time < timeout:
            try:
                state = searches.state(search_id, includeResponses=True)
                status = state.get("status")
                responses = state.get("responses", [])

                logger.debug(
                    f"Search status: {status}, responses: {len(responses)}"
                )

                if status == "Completed":
                    break

                time.sleep(1)
            except Exception as e:
                logger.warning(f"Error checking search state: {e}")
                time.sleep(1)

        # Clean up search
        try:
            searches.stop(search_id)
        except Exception as e:
            logger.warning(f"Failed to stop search {search_id}: {e}")

        if time.time() - start_time >= timeout:
            raise SearchTimeoutError(f"Search timed out after {timeout} seconds")

        return responses

    def group_files_by_album(self, files: list[FileInfo]) -> dict[str, list[FileInfo]]:
        """Group files by album directory."""
        albums: dict[str, list[FileInfo]] = {}
        for file in files:
            import os
            album_key = os.path.dirname(file.filename)
            albums.setdefault(album_key, []).append(file)
        return albums

    def filter_album_files_priority(
        self, files: list[FileInfo]
    ) -> list[FileInfo] | None:
        """Filter album files by priority: 1) 320kbps mp3, 2) flac."""
        # 1. All mp3 files with bitRate 320
        mp3_320 = [
            f
            for f in files
            if f.filename.lower().endswith(".mp3") and f.bit_rate == 320
        ]
        if mp3_320:
            return mp3_320

        # 2. All flac files
        flac = [f for f in files if f.filename.lower().endswith(".flac")]
        if flac:
            return flac

        # 3. None found
        return None

    def enqueue_download(
        self, username: str, files: list[FileInfo]
    ) -> bool:
        """Enqueue files for download."""
        try:
            transfers: TransfersApi = self.client.transfers

            # Convert FileInfo back to dict format expected by API
            file_dicts = []
            for file in files:
                file_dict = {
                    "filename": file.filename,
                }
                if file.code is not None:
                    file_dict["code"] = file.code
                if file.size is not None:
                    file_dict["size"] = file.size
                file_dicts.append(file_dict)

            result = transfers.enqueue(username, file_dicts)
            logger.info(f"Enqueue result: {result}")
            return True

        except Exception as e:
            logger.error(f"Failed to enqueue download: {e}")
            raise DownloadError(f"Failed to enqueue download: {e}")

    def find_best_album_match(
        self, users: list[UserFilesResponse], artist: str, album: str
    ) -> tuple[str, list[FileInfo]] | None:
        """Find the best album match from search responses."""
        for user_resp in users:
            username = user_resp.username
            files = user_resp.files

            if not files:
                continue

            albums = self.group_files_by_album(files)

            # Try to find matching album by name
            matching_album_key = None
            for album_key in albums:
                if (
                    artist.lower() in album_key.lower()
                    and album.lower() in album_key.lower()
                ):
                    matching_album_key = album_key
                    break

            # If no exact match, use the album with most files
            if matching_album_key:
                album_files = albums[matching_album_key]
            else:
                album_files = max(
                    albums.values(),
                    key=lambda flist: sum(f.size or 0 for f in flist),
                    default=None,
                )

            if album_files:
                filtered_files = self.filter_album_files_priority(album_files)
                if filtered_files:
                    logger.info(
                        f"Found album from user {username} with {len(filtered_files)} files"
                    )
                    return username, filtered_files

        return None


# Global service instance
slskd_service = SlskdService()
