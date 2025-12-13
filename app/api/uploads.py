"""Album upload endpoints."""

import json
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from mutagen import File as MutagenFile
from mutagen.id3 import ID3NoHeaderError

from app.core.logging import get_logger
from app.models.schemas import AlbumMetadata, UploadAlbumResponse
from config import settings

logger = get_logger(__name__)
router = APIRouter()

# File size limits
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB per file
MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024  # 2GB total per album

# Allowed audio extensions
ALLOWED_EXTENSIONS = {
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


def validate_file_extension(filename: str) -> bool:
    """Validate file has an allowed audio extension."""
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal attacks."""
    # Remove path components
    filename = Path(filename).name
    # Remove or replace dangerous characters
    dangerous_chars = ["../", "..\\", "~", "$", "`", "|", ";", "&"]
    for char in dangerous_chars:
        filename = filename.replace(char, "_")
    return filename


def extract_metadata_from_file(file: UploadFile) -> tuple[str | None, str | None]:
    """
    Extract artist and album from audio file metadata.
    
    Tries multiple tag formats:
    - albumartist/album (preferred for compilations)
    - artist/album
    - TPE2/TALB (ID3)
    
    Args:
        file: Uploaded audio file
        
    Returns:
        Tuple of (artist, album) or (None, None) if extraction fails
    """
    try:
        # Save to temp file since mutagen needs file path
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        # Reset file pointer for later use
        file.file.seek(0)
        
        try:
            audio = MutagenFile(tmp_path, easy=True)
            if audio is None:
                return None, None
            
            # Try albumartist first (better for compilations)
            artist = None
            if hasattr(audio, 'tags') and audio.tags:
                artist = (
                    audio.tags.get('albumartist', [None])[0] or
                    audio.tags.get('artist', [None])[0]
                )
                album = audio.tags.get('album', [None])[0]
            else:
                return None, None
            
            # Clean up extracted values
            if isinstance(artist, str):
                artist = artist.strip()
            if isinstance(album, str):
                album = album.strip()
            
            return artist, album
            
        finally:
            # Clean up temp file
            Path(tmp_path).unlink(missing_ok=True)
            
    except Exception as e:
        logger.warning(f"Failed to extract metadata from {file.filename}: {e}")
        return None, None


@router.post("/upload", response_model=UploadAlbumResponse)
async def upload_album(
    files: Annotated[list[UploadFile], File(description="Album audio files")],
    vpn_ip: Annotated[str, Form(description="VPN IP address for tagging")],
    artist: Annotated[str | None, Form(description="Artist name (auto-detected from tags if not provided)")] = None,
    album: Annotated[str | None, Form(description="Album name (auto-detected from tags if not provided)")] = None,
    username: Annotated[str | None, Form(description="Username (optional)")] = None,
) -> UploadAlbumResponse:
    """
    Upload an album and process it through beets import workflow.
    
    This endpoint:
    1. Validates uploaded files (type, size)
    2. Extracts artist/album from audio file tags (or uses provided values)
    3. Saves files to a temporary staging directory
    4. Creates metadata JSON (same as Soulseek downloads)
    5. Runs beets import on the album directory
    6. Tags the album with VPN username via post-import script
    
    Args:
        files: List of audio files (drag & drop)
        vpn_ip: VPN IP address for tagging the album
        artist: Artist name (optional, auto-detected from file tags)
        album: Album name (optional, auto-detected from file tags)
        username: Optional username, derived from VPN IP if not provided
        
    Returns:
        UploadAlbumResponse with success status and details
        
    Raises:
        HTTPException: For validation errors or processing failures
    """
    task_id = str(uuid.uuid4())
    logger.info(
        f"[Task {task_id}] Album upload started - "
        f"VPN IP: {vpn_ip}, Files: {len(files)}"
    )

    # Validation: Check we have files
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files uploaded",
        )

    # Extract metadata from first file if not provided
    detected_artist = artist
    detected_album = album
    metadata_source = "user_provided" if (artist and album) else "tags"
    
    if not artist or not album:
        logger.info(f"[Task {task_id}] Extracting metadata from first file: {files[0].filename}")
        extracted_artist, extracted_album = extract_metadata_from_file(files[0])
        
        if not artist:
            detected_artist = extracted_artist
        if not album:
            detected_album = extracted_album
        
        logger.info(
            f"[Task {task_id}] Detected metadata - Artist: {detected_artist}, Album: {detected_album}"
        )
    
    # Validation: Ensure we have artist and album (either provided or detected)
    if not detected_artist or not detected_album:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Could not determine artist and album. "
                "Please ensure your files have proper ID3 tags (artist/album) "
                "or provide artist and album manually."
            ),
        )
    
    # Use detected values
    artist = detected_artist.strip()
    album = detected_album.strip()
    
    logger.info(f"[Task {task_id}] Using metadata - Artist: {artist}, Album: {album}")

    # Validation: Check total size and file types
    total_size = 0
    for file in files:
        # Validate extension
        if not validate_file_extension(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type: {file.filename}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        # Check file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File {file.filename} exceeds maximum size of {MAX_FILE_SIZE / (1024 * 1024)}MB",
            )

        total_size += file_size

    if total_size > MAX_TOTAL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Total upload size exceeds maximum of {MAX_TOTAL_SIZE / (1024 * 1024 * 1024)}GB",
        )

    logger.info(f"[Task {task_id}] Validation passed. Total size: {total_size / (1024 * 1024):.2f}MB")

    # Create staging directory in downloads path
    # Use a sanitized album folder name
    album_folder = f"{artist.strip()} - {album.strip()}"
    # Sanitize for filesystem
    album_folder = "".join(
        c if c.isalnum() or c in (" ", "-", "_") else "_" for c in album_folder
    )

    staging_path = Path(settings.download_path) / album_folder
    staging_path.mkdir(parents=True, exist_ok=True)

    logger.info(f"[Task {task_id}] Created staging directory: {staging_path}")

    try:
        # Save uploaded files
        saved_files = []
        for file in files:
            # Sanitize filename
            safe_filename = sanitize_filename(file.filename)

            file_path = staging_path / safe_filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)

            saved_files.append(file_path)
            logger.info(f"[Task {task_id}] Saved file: {safe_filename}")

        # Create metadata JSON (same format as Soulseek downloads)
        metadata = {
            "vpn_username": username or vpn_ip,
            "vpn_ip": vpn_ip,
            "task_id": task_id,
            "artist": artist.strip(),
            "album": album.strip(),
            "slskd_username": "manual_upload",  # Indicate this was manually uploaded
            "upload_source": "desktop_app",
        }

        metadata_file = staging_path / "noiseport_metadata.json"
        with open(metadata_file, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"[Task {task_id}] Created metadata file: {metadata_file}")

        # Run beets import on the staging directory
        logger.info(f"[Task {task_id}] Starting beets import for: {staging_path}")

        beets_config = "/shared/beet_config_album.yaml"
        beets_cmd = [
            "beet",
            "-c",
            beets_config,
            "import",
            "-q",  # Quiet mode
            str(staging_path),
        ]

        # Execute beets import
        result = subprocess.run(
            beets_cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )

        if result.returncode != 0:
            logger.error(
                f"[Task {task_id}] Beets import failed. "
                f"Exit code: {result.returncode}, "
                f"Stdout: {result.stdout}, "
                f"Stderr: {result.stderr}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Beets import failed: {result.stderr or result.stdout}",
            )

        logger.info(f"[Task {task_id}] Beets import completed successfully")

        # Post-import tagging
        # Find where beets moved the album
        complete_path = Path("/music/complete")
        metadata_files = list(complete_path.glob("**/noiseport_metadata.json"))

        # Find the most recently modified metadata file (should be ours)
        recent_metadata = None
        if metadata_files:
            recent_metadata = max(metadata_files, key=lambda p: p.stat().st_mtime)
            album_dir = recent_metadata.parent

            logger.info(f"[Task {task_id}] Found imported album at: {album_dir}")

            # Run post-import tagging script
            tagging_script = "/shared/scripts/tag_album_post_import.sh"
            if Path(tagging_script).exists():
                logger.info(f"[Task {task_id}] Running post-import tagging")
                tag_result = subprocess.run(
                    [tagging_script, str(album_dir)],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )

                if tag_result.returncode != 0:
                    logger.warning(
                        f"[Task {task_id}] Post-import tagging had issues: {tag_result.stderr}"
                    )
                else:
                    logger.info(f"[Task {task_id}] Post-import tagging completed")
            else:
                logger.warning(f"[Task {task_id}] Tagging script not found: {tagging_script}")

        return UploadAlbumResponse(
            success=True,
            message=f"Album '{album}' by {artist} uploaded and imported successfully",
            task_id=task_id,
            files_processed=len(saved_files),
            album_path=str(recent_metadata.parent) if recent_metadata else None,
            detected_metadata={
                "artist": artist,
                "album": album,
                "source": metadata_source,
            },
        )

    except subprocess.TimeoutExpired:
        logger.error(f"[Task {task_id}] Beets import timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Import process timed out. The album may be too large or there was an issue with beets.",
        )
    except Exception as e:
        logger.error(f"[Task {task_id}] Upload processing failed: {e}", exc_info=True)
        # Clean up staging directory on error
        if staging_path.exists():
            shutil.rmtree(staging_path, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process upload: {str(e)}",
        )
