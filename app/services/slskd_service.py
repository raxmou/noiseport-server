"""SLSKD service for handling music downloads."""

import time

from slskd_api import SlskdClient
from slskd_api.apis.searches import SearchesApi
from slskd_api.apis.transfers import TransfersApi

from app.core.exceptions import DownloadError, SearchTimeoutError, SlskdConnectionError
from app.core.logging import get_logger
from app.models.schemas import (
    AlbumStats,
    DownloadedAlbum,
    DownloadedAlbumsResponse,
    DownloadStatsResponse,
    FileInfo,
    NoResultsStatsResponse,
    SearchResult,
    SearchWithoutResults,
    TrackStats,
    UserFilesResponse,
)
from config import settings

logger = get_logger(__name__)


class SlskdService:
    """Service for interacting with SLSKD API."""

    def __init__(self, host: str = None, username: str = None, password: str = None) -> None:
        """Initialize SLSKD service with optional host, username, and password."""
        self._host = host
        self._username = username
        self._password = password
        self._client: SlskdClient | None = None

    @property
    def client(self) -> SlskdClient:
        """Get SLSKD client instance."""
        if self._client is None:
            try:
                host = self._host if self._host is not None else settings.slskd_host
                username = self._username if self._username is not None else settings.slskd_username
                password = self._password if self._password is not None else settings.slskd_password
                self._client = SlskdClient(
                    host,
                    username=username,
                    password=password,
                )
                logger.info(f"Connected to SLSKD at {host}")
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
            pass

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

    def get_searches_without_results(self) -> NoResultsStatsResponse:
        """Get statistics for searches that returned no results."""
        try:
            searches_api: SearchesApi = self.client.searches
            all_searches = searches_api.get_all()

            no_result_searches = []
            for search in all_searches:
                if search.get('responseCount', 0) == 0:
                    search_text = search.get('searchText', '')
                    # Try to parse "artist - title" format
                    if ' - ' in search_text:
                        parts = search_text.split(' - ', 1)
                        artist = parts[0].strip()
                        title = parts[1].strip()
                    else:
                        # If no delimiter, treat as artist
                        artist = search_text.strip()
                        title = ""

                    no_result_searches.append(
                        SearchWithoutResults(
                            artist=artist,
                            title=title,
                            search_text=search_text
                        )
                    )

            return NoResultsStatsResponse(
                count=len(no_result_searches),
                searches=no_result_searches
            )

        except Exception as e:
            logger.error(f"Failed to get searches without results: {e}")
            raise DownloadError(f"Failed to get searches without results: {e}")

    def get_download_stats(self) -> DownloadStatsResponse:
        """Get download statistics from SLSKD."""
        try:
            transfers_api: TransfersApi = self.client.transfers
            transfers = transfers_api.get_all_downloads(includeRemoved=True)

            # Initialize stats
            album_stats = AlbumStats(tried=len(transfers))
            track_stats = TrackStats(completed=0, errored=0, queued=0, tried=0)

            # Process each transfer
            for transfer in transfers:
                for directory in transfer.get("directories", []):
                    for file in directory.get("files", []):
                        state = file.get("state", "")
                        track_stats.tried += 1

                        if state == "Completed, Succeeded":
                            track_stats.completed += 1
                        elif state == "Completed, Errored":
                            track_stats.errored += 1
                        elif state == "Queued, Remotely":
                            track_stats.queued += 1

            return DownloadStatsResponse(
                albums=album_stats,
                tracks=track_stats
            )

        except Exception as e:
            logger.error(f"Failed to get download stats: {e}")
            raise DownloadError(f"Failed to get download stats: {e}")

    def get_downloaded_albums(self) -> DownloadedAlbumsResponse:
        """Get list of downloaded albums."""
        try:
            transfers_api: TransfersApi = self.client.transfers
            transfers = transfers_api.get_all_downloads(includeRemoved=True)

            downloaded_albums = []

            for transfer in transfers:
                # Extract album info from transfer
                username = transfer.get("username", "")
                directories = transfer.get("directories", [])

                for directory in directories:
                    dir_name = directory.get("directory", "")
                    files = directory.get("files", [])

                    if not files:
                        continue

                    # Try to parse artist and album from directory path
                    # Common formats: "Artist/Album" or "Artist - Album"
                    album_name = ""
                    artist_name = ""

                    if "/" in dir_name:
                        parts = dir_name.split("/")
                        if len(parts) >= 2:
                            artist_name = parts[-2]
                            album_name = parts[-1]
                        else:
                            album_name = parts[-1]
                    elif " - " in dir_name:
                        parts = dir_name.split(" - ", 1)
                        artist_name = parts[0]
                        album_name = parts[1] if len(parts) > 1 else ""
                    else:
                        album_name = dir_name

                    # Count completed tracks and calculate total size
                    completed_tracks = 0
                    total_size = 0

                    for file in files:
                        if file.get("state") == "Completed, Succeeded":
                            completed_tracks += 1
                        file_size = file.get("size", 0)
                        if isinstance(file_size, int):
                            total_size += file_size

                    downloaded_albums.append(
                        DownloadedAlbum(
                            artist=artist_name or "Unknown",
                            album=album_name or "Unknown",
                            username=username,
                            track_count=len(files),
                            completed_tracks=completed_tracks,
                            total_size=total_size
                        )
                    )

            return DownloadedAlbumsResponse(
                count=len(downloaded_albums),
                albums=downloaded_albums
            )

        except Exception as e:
            logger.error(f"Failed to get downloaded albums: {e}")
            raise DownloadError(f"Failed to get downloaded albums: {e}")


# Global service instance
slskd_service = SlskdService()
