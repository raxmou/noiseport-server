"""Upload endpoints."""

import json
import re
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.logging import get_logger
from app.models.schemas import UploadAlbumResponse
from config import settings

logger = get_logger(__name__)
router = APIRouter()

# Constants
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB per file
MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024  # 2GB total
ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".flac",
    ".m4a",
    ".aac",
    ".ogg",
    ".opus",
    ".wav",
    ".wma",
    ".alac",
}
ALLOWED_MIME_TYPES = {
    "audio/mpeg",
    "audio/flac",
    "audio/x-flac",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "audio/opus",
    "audio/wav",
    "audio/x-wav",
    "audio/x-ms-wma",
}
BEETS_CONFIG_PATH = "/shared/beet_config_album.yaml"
TAGGING_SCRIPT_PATH = "/shared/scripts/tag_album_post_import.sh"
BEETS_TIMEOUT = 300  # 5 minutes


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename to prevent path traversal and other issues."""
    # Remove any path separators
    filename = filename.replace("/", "_").replace("\\", "_")
    # Remove any null bytes
    filename = filename.replace("\x00", "")
    # Remove any control characters
    filename = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", filename)
    # Remove leading/trailing dots and spaces
    filename = filename.strip(". ")
    # If empty after sanitization, use a default
    if not filename:
        filename = "unnamed_file"
    return filename


def sanitize_path_component(component: str) -> str:
    """Sanitize a path component (artist/album name) for use in filesystem."""
    # Replace problematic characters
    sanitized = component.replace("/", "_").replace("\\", "_")
    sanitized = sanitized.replace(":", "_").replace("*", "_")
    sanitized = sanitized.replace("?", "_").replace('"', "_")
    sanitized = sanitized.replace("<", "_").replace(">", "_")
    sanitized = sanitized.replace("|", "_")
    # Remove control characters
    sanitized = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", sanitized)
    # Remove leading/trailing dots and spaces
    sanitized = sanitized.strip(". ")
    # If empty after sanitization, use a default
    if not sanitized:
        sanitized = "unknown"
    return sanitized


def validate_audio_file(file: UploadFile) -> tuple[bool, str]:
    """Validate that a file is an audio file."""
    # Check extension
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
        return False, f"Invalid file extension: {file_ext}"

    # Check MIME type if available
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        return False, f"Invalid content type: {file.content_type}"

    return True, "OK"


def create_upload_metadata(
    artist: str,
    album: str,
    vpn_username: str,
    vpn_ip: str,
    task_id: str,
    upload_path: Path,
) -> None:
    """Create a metadata JSON file for the upload."""
    try:
        metadata = {
            "vpn_username": vpn_username,
            "vpn_ip": vpn_ip,
            "task_id": task_id,
            "artist": artist,
            "album": album,
            "upload_timestamp": datetime.utcnow().isoformat(),
            "source": "upload",
        }

        metadata_file = upload_path / "noiseport_metadata.json"
        with open(metadata_file, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"[Task {task_id}] Created upload metadata: {metadata_file}")

    except Exception as e:
        logger.error(f"[Task {task_id}] Failed to create metadata: {e}")
        raise


def run_beets_import(staging_dir: Path, task_id: str) -> tuple[bool, str, str]:
    """Run beets import on the staging directory."""
    try:
        logger.info(f"[Task {task_id}] Running beets import on: {staging_dir}")

        # Run beets import with quiet mode
        cmd = [
            "beet",
            "-c",
            BEETS_CONFIG_PATH,
            "import",
            "-q",  # Quiet mode (non-interactive)
            str(staging_dir),
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=BEETS_TIMEOUT,
        )

        stdout = result.stdout
        stderr = result.stderr

        if result.returncode == 0:
            logger.info(f"[Task {task_id}] Beets import successful")
            return True, stdout, stderr
        else:
            logger.error(
                f"[Task {task_id}] Beets import failed: {stderr}"
            )
            return False, stdout, stderr

    except subprocess.TimeoutExpired:
        logger.error(f"[Task {task_id}] Beets import timed out")
        return False, "", "Import timed out after 5 minutes"
    except Exception as e:
        logger.error(f"[Task {task_id}] Beets import error: {e}")
        return False, "", str(e)


def run_post_import_tagging(album_dir: Path, task_id: str) -> tuple[bool, str]:
    """Run post-import tagging script on the album directory."""
    try:
        logger.info(f"[Task {task_id}] Running post-import tagging on: {album_dir}")

        # Check if script exists
        if not Path(TAGGING_SCRIPT_PATH).exists():
            logger.warning(
                f"[Task {task_id}] Tagging script not found: {TAGGING_SCRIPT_PATH}"
            )
            return True, "Tagging script not found (skipped)"

        # Run tagging script
        cmd = [TAGGING_SCRIPT_PATH, str(album_dir)]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,  # 1 minute timeout
        )

        if result.returncode == 0:
            logger.info(f"[Task {task_id}] Post-import tagging successful")
            return True, result.stdout
        else:
            logger.error(
                f"[Task {task_id}] Post-import tagging failed: {result.stderr}"
            )
            return False, result.stderr

    except subprocess.TimeoutExpired:
        logger.error(f"[Task {task_id}] Post-import tagging timed out")
        return False, "Tagging timed out"
    except Exception as e:
        logger.error(f"[Task {task_id}] Post-import tagging error: {e}")
        return False, str(e)


def find_imported_album(artist: str, album: str, task_id: str) -> Path | None:
    """Find the imported album in the complete directory."""
    try:
        complete_path = Path(settings.host_music_path) / "complete"
        
        # Sanitize artist/album for searching
        artist_sanitized = sanitize_path_component(artist)
        
        # Look for artist directory
        artist_dirs = list(complete_path.glob(f"*{artist_sanitized}*"))
        
        if not artist_dirs:
            logger.warning(f"[Task {task_id}] Could not find artist directory for: {artist}")
            return None
        
        # Search for album in artist directories
        for artist_dir in artist_dirs:
            album_dirs = list(artist_dir.glob(f"*{album}*"))
            if album_dirs:
                logger.info(f"[Task {task_id}] Found imported album at: {album_dirs[0]}")
                return album_dirs[0]
        
        logger.warning(f"[Task {task_id}] Could not find album directory for: {album}")
        return None
        
    except Exception as e:
        logger.error(f"[Task {task_id}] Error finding imported album: {e}")
        return None


@router.get("/health")
async def uploads_health():
    """Health check endpoint for uploads module."""
    return {"status": "ok", "module": "uploads"}


@router.post("/upload", response_model=UploadAlbumResponse)
async def upload_album(
    files: Annotated[list[UploadFile], File(description="Audio files to upload")],
    artist: Annotated[str, Form(description="Artist name")],
    album: Annotated[str, Form(description="Album name")],
    vpn_ip: Annotated[str, Form(description="VPN IP address")] = "unknown",
    username: Annotated[str, Form(description="Username")] = "anonymous",
):
    """
    Upload an album for processing.

    Files will be:
    1. Validated (type, size)
    2. Saved to staging directory
    3. Imported via beets
    4. Tagged via post-import script
    5. Moved to final location

    Args:
        files: List of audio files
        artist: Artist name
        album: Album name
        vpn_ip: User's VPN IP (optional)
        username: Username (optional)

    Returns:
        UploadAlbumResponse with task details

    Raises:
        HTTPException: For validation or processing errors
    """
    task_id = str(uuid.uuid4())
    logger.info(f"[Task {task_id}] Upload started by {username} ({vpn_ip})")
    logger.info(f"[Task {task_id}] Artist: {artist}, Album: {album}")
    logger.info(f"[Task {task_id}] Files: {len(files)}")

    # Validation
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided",
        )

    if not artist or not album:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Artist and album are required",
        )

    # Validate files and calculate total size
    total_size = 0
    for file in files:
        # Validate file type
        is_valid, error_msg = validate_audio_file(file)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file {file.filename}: {error_msg}",
            )

        # Check individual file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File {file.filename} exceeds maximum size of {MAX_FILE_SIZE / 1024 / 1024}MB",
            )

        total_size += file_size

    # Check total size
    if total_size > MAX_TOTAL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Total upload size exceeds maximum of {MAX_TOTAL_SIZE / 1024 / 1024 / 1024}GB",
        )

    # Create staging directory
    artist_sanitized = sanitize_path_component(artist)
    album_sanitized = sanitize_path_component(album)
    staging_dir_name = f"{artist_sanitized} - {album_sanitized}"
    staging_dir = Path(settings.host_music_path) / "downloads" / staging_dir_name

    try:
        staging_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"[Task {task_id}] Created staging directory: {staging_dir}")
    except Exception as e:
        logger.error(f"[Task {task_id}] Failed to create staging directory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create upload directory: {str(e)}",
        )

    # Save files
    files_processed = 0
    try:
        for file in files:
            # Sanitize filename
            safe_filename = sanitize_filename(file.filename or "unknown.mp3")
            file_path = staging_dir / safe_filename

            # Save file
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)

            files_processed += 1
            logger.info(f"[Task {task_id}] Saved file: {safe_filename}")

        logger.info(f"[Task {task_id}] All files saved ({files_processed} files)")

    except Exception as e:
        logger.error(f"[Task {task_id}] Failed to save files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save files: {str(e)}",
        )

    # Create metadata file
    try:
        create_upload_metadata(
            artist=artist,
            album=album,
            vpn_username=username,
            vpn_ip=vpn_ip,
            task_id=task_id,
            upload_path=staging_dir,
        )
    except Exception as e:
        logger.error(f"[Task {task_id}] Failed to create metadata: {e}")
        # Continue anyway, metadata is not critical

    # Run beets import
    try:
        success, stdout, stderr = run_beets_import(staging_dir, task_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Beets import failed: {stderr}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Task {task_id}] Beets import error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Beets import failed: {str(e)}",
        )

    # Find imported album path
    album_path = find_imported_album(artist, album, task_id)

    # Run post-import tagging if album was found
    if album_path:
        try:
            success, output = run_post_import_tagging(album_path, task_id)
            if not success:
                logger.warning(
                    f"[Task {task_id}] Post-import tagging failed: {output}"
                )
                # Don't fail the request, tagging is optional
        except Exception as e:
            logger.error(f"[Task {task_id}] Post-import tagging error: {e}")
            # Continue anyway, tagging is not critical

    logger.info(f"[Task {task_id}] Upload completed successfully")

    return UploadAlbumResponse(
        success=True,
        message=f"Album uploaded and imported successfully ({files_processed} files)",
        task_id=task_id,
        files_processed=files_processed,
        album_path=str(album_path) if album_path else None,
    )
