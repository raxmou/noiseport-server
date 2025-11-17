#!/bin/sh
set -eu

LOG_FILE="/shared/tag_album.log"
META_NAME="noiseport_metadata.json"

# Initialize logging
mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "$(date '+%F %T') [PID:$$] [album_imported] - $*" >>"$LOG_FILE"; }

log "Album imported event triggered"

# For album_imported event, beets doesn't pass file paths as arguments
# We need to extract the album directory from the beets library database
# Since we can't easily do that in a shell script, we'll use a different approach

# Get the album directory from beets by looking at the most recently imported items
# The album path should be passed as an environment variable or argument
ALBUM_DIR="${1:-}"

if [ -z "$ALBUM_DIR" ]; then
  log "ERROR: No album directory provided"
  exit 1
fi

if [ ! -d "$ALBUM_DIR" ]; then
  log "ERROR: Album directory does not exist: $ALBUM_DIR"
  exit 1
fi

log "Processing album directory: $ALBUM_DIR"

MARKER="$ALBUM_DIR/.noiseport_tagged"

# Exit if already tagged
if [ -f "$MARKER" ]; then
  log "Album already tagged (marker exists): $ALBUM_DIR"
  exit 0
fi

# Find metadata file
DEST_META="$ALBUM_DIR/$META_NAME"

if [ ! -f "$DEST_META" ]; then
  log "WARNING: Metadata file not found: $DEST_META"
  log "Searching for metadata in subdirectories..."
  DEST_META=$(find "$ALBUM_DIR" -name "$META_NAME" -type f 2>/dev/null | head -1)
  if [ -z "$DEST_META" ]; then
    log "ERROR: No metadata file found in album directory tree"
    exit 0
  fi
  log "Found metadata at: $DEST_META"
fi

# Extract VPN username
VPN=""
if [ -f "$DEST_META" ]; then
  if command -v jq >/dev/null 2>&1; then
    VPN="$(jq -r '.vpn_username // empty' "$DEST_META" 2>/dev/null || true)"
  else
    VPN="$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("vpn_username",""))' "$DEST_META" 2>/dev/null || true)"
  fi
  log "Extracted VPN username: ${VPN:-<empty>}"
else
  log "WARNING: Metadata file not accessible: $DEST_META"
fi

if [ -z "$VPN" ]; then
  log "No VPN username found, skipping tagging"
  exit 0
fi

# Tag all audio files in album directory (including subdirectories for multi-disc albums)
tagged_count=0
failed_count=0

find "$ALBUM_DIR" -type f \( -iname "*.flac" -o -iname "*.mp3" -o -iname "*.m4a" -o -iname "*.ogg" -o -iname "*.opus" \) | while IFS= read -r f; do
  ext="${f##*.}"
  ext="$(printf '%s' "$ext" | tr 'A-Z' 'a-z')"

  if [ "$ext" = "flac" ] && command -v metaflac >/dev/null 2>&1; then
    log "Tagging FLAC: $f with DOWNLOADED_BY=$VPN"
    if metaflac --remove-tag=DOWNLOADED_BY --set-tag="DOWNLOADED_BY=$VPN" "$f" 2>>"$LOG_FILE"; then
      tagged_count=$((tagged_count + 1))
    else
      log "ERROR: Failed to tag FLAC file: $f"
      failed_count=$((failed_count + 1))
    fi
  elif command -v exiftool >/dev/null 2>&1; then
    log "Tagging with exiftool: $f with DOWNLOADED_BY=$VPN"
    if exiftool -overwrite_original -P -m -q -DOWNLOADED_BY="$VPN" "$f" 2>>"$LOG_FILE"; then
      tagged_count=$((tagged_count + 1))
    else
      log "ERROR: Failed to tag file with exiftool: $f"
      failed_count=$((failed_count + 1))
    fi
  else
    log "WARNING: No tagging tool available for: $f"
    failed_count=$((failed_count + 1))
  fi
done

# Create marker after tagging
touch "$MARKER"
log "Album tagging completed for: $ALBUM_DIR (tagged: $tagged_count, failed: $failed_count)"
