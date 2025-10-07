# To run: uvicorn api:app --reload
# Make sure to install fastapi and uvicorn: pip install fastapi uvicorn pydantic

from typing import List, Dict, Any, TypedDict, Optional
from fastapi import FastAPI, Query, BackgroundTasks
from pydantic import BaseModel
import os
import time
from slskd_api import SlskdClient
from slskd_api.apis.searches import SearchesApi
from slskd_api.apis.transfers import TransfersApi
from fastapi.middleware.cors import CORSMiddleware
import logging

app = FastAPI()

# Allow CORS from all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


# --- Types ---
class FileDict(TypedDict, total=False):
    code: int
    extension: str
    filename: str
    size: int
    isLocked: bool
    bitRate: int
    isVariableBitRate: bool
    length: int


class UserResponse(TypedDict):
    username: str
    files: List[FileDict]


class DownloadRequest(BaseModel):
    artist: str
    album: str


# --- Helper functions ---
def group_files_by_album(files: List[FileDict]) -> Dict[str, List[FileDict]]:
    albums: Dict[str, List[FileDict]] = {}
    for file in files:
        fname = file.get("filename", "")
        album_key = os.path.dirname(fname)
        albums.setdefault(album_key, []).append(file)
    return albums


# Filter album files by priority: 1) 320kbps mp3, 2) flac


def filter_album_files_priority(files: List[FileDict]) -> Optional[List[FileDict]]:
    # 1. All mp3 files with bitRate 320
    mp3_320 = [
        f
        for f in files
        if f.get("filename", "").lower().endswith(".mp3") and f.get("bitRate") == 320
    ]
    if mp3_320:
        return mp3_320
    # 2. All flac files
    flac = [f for f in files if f.get("filename", "").lower().endswith(".flac")]
    if flac:
        return flac
    # 3. None found
    return None


# --- Background download logic ---
def background_download_album(artist: str, album: str):
    logger.info(f"[BG] Download request: artist='{artist}', album='{album}'")
    client = SlskdClient("http://slskd:5030", username="slskd", password="slskd")
    searches: SearchesApi = client.searches
    transfers: TransfersApi = client.transfers
    search_text = f"{artist} - {album}"
    logger.info(f"[BG] Starting search: {search_text}")
    resp = searches.search_text(
        searchText=search_text,
        fileLimit=1000,
        filterResponses=True,
        responseLimit=50,
        searchTimeout=15000,
    )
    search_id = resp.get("id")
    if not search_id:
        logger.error("[BG] No search ID returned from slskd API")
        return
    start = time.time()
    responses = []
    while time.time() - start < 30:
        state = searches.state(search_id, includeResponses=True)
        status = state.get("status")
        responses = state.get("responses", [])
        logger.info(f"[BG] Search status: {status}, responses so far: {len(responses)}")
        if status == "Completed":
            break
        time.sleep(1)
    searches.stop(search_id)
    if not responses:
        logger.warning("[BG] No results found for search")
        return
    for user_resp in responses:
        username = user_resp.get("username")
        files = user_resp.get("files", [])
        if not files:
            continue
        albums = group_files_by_album(files)
        matching_album_key = None
        for album_key in albums:
            if (
                artist.lower() in album_key.lower()
                and album.lower() in album_key.lower()
            ):
                matching_album_key = album_key
                break
        if matching_album_key:
            album_files = albums[matching_album_key]
        else:
            album_files = max(
                albums.values(),
                key=lambda flist: sum(f.get("size", 0) for f in flist),
                default=None,
            )
        if album_files:
            filtered_files = filter_album_files_priority(album_files)
            if not filtered_files:
                logger.info(
                    f"[BG] No 320kbps mp3 or flac files found in album for user {username}."
                )
                continue
            logger.info(
                f"[BG] Enqueuing album from user {username} (album folder: {matching_album_key or 'best match'}) with {len(filtered_files)} files."
            )
            success = transfers.enqueue(username, filtered_files)
            logger.info(f"[BG] Enqueue success: {success}")
            return
    logger.warning("[BG] No album found to download.")


# --- API Endpoint ---
@app.post("/download_album/")
def download_album(req: DownloadRequest, background_tasks: BackgroundTasks):
    logger.info(
        f"Received download request: artist='{req.artist}', album='{req.album}' (backgrounded)"
    )
    background_tasks.add_task(background_download_album, req.artist, req.album)
    return {"success": True, "message": "Download started in background."}
