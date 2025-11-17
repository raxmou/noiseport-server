#!/bin/sh
set -eu

LOG_FILE="/shared/tag_album.log"
META_NAME="noiseport_metadata.json"
LOCK_TIMEOUT=30
MAX_WAIT=120

# Initialize logging first
mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "$(date '+%F %T') [PID:$$] - $*" >>"$LOG_FILE"; }

log "Tagging script started"

SRC_FILE="${1:?}"; DEST_FILE="${2:?}"
ALBUM_DIR="$(dirname "$DEST_FILE")"
MARKER="$ALBUM_DIR/.noiseport_tagged"
LOCK_FILE="$ALBUM_DIR/.noiseport_tagging.lock"

# Exit if already tagged OR if source==dest (beets rewrite)
if [ -f "$MARKER" ]; then
  log "Album already tagged (marker exists): $ALBUM_DIR"
  exit 0
fi

if [ "$SRC_FILE" = "$DEST_FILE" ]; then
  log "Source equals destination (beets rewrite), skipping: $SRC_FILE"
  exit 0
fi

# Acquire lock with timeout to prevent concurrent processing
acquire_lock() {
  local start_time=$(date +%s)
  local lock_acquired=0
  
  while [ $lock_acquired -eq 0 ]; do
    if mkdir "$LOCK_FILE" 2>/dev/null; then
      echo "$$" > "$LOCK_FILE/pid"
      log "Lock acquired for album: $ALBUM_DIR"
      lock_acquired=1
      return 0
    fi
    
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    
    if [ $elapsed -ge $LOCK_TIMEOUT ]; then
      # Check if lock is stale
      if [ -f "$LOCK_FILE/pid" ]; then
        local lock_pid=$(cat "$LOCK_FILE/pid" 2>/dev/null || echo "")
        if [ -n "$lock_pid" ] && ! kill -0 "$lock_pid" 2>/dev/null; then
          log "Removing stale lock (PID $lock_pid no longer exists)"
          rm -rf "$LOCK_FILE"
          continue
        fi
      fi
      log "Failed to acquire lock after ${LOCK_TIMEOUT}s, giving up"
      return 1
    fi
    
    sleep 0.5
  done
}

release_lock() {
  if [ -d "$LOCK_FILE" ]; then
    rm -rf "$LOCK_FILE"
    log "Lock released for album: $ALBUM_DIR"
  fi
}

# Set up trap to release lock on exit
trap release_lock EXIT INT TERM

# Try to acquire lock
if ! acquire_lock; then
  log "Could not acquire lock, exiting"
  exit 0
fi

# Re-check marker after acquiring lock (another process might have completed tagging)
if [ -f "$MARKER" ]; then
  log "Album already tagged after acquiring lock (another process completed), exiting"
  exit 0
fi

# Copy metadata on first file move (now protected by lock)
SRC_META="$(dirname "$SRC_FILE")/$META_NAME"
DEST_META="$ALBUM_DIR/$META_NAME"

if [ ! -f "$DEST_META" ]; then
  if [ -f "$SRC_META" ]; then
    log "Copying metadata from $SRC_META to $DEST_META"
    cp -f "$SRC_META" "$DEST_META"
  else
    log "WARNING: Source metadata file not found: $SRC_META"
  fi
fi

# Wait a bit for all files to be moved (beets may still be copying)
# Check if more files are being added to the album
wait_for_stable_album() {
  local prev_count=0
  local stable_iterations=0
  local start_time=$(date +%s)
  
  while [ $stable_iterations -lt 3 ]; do
    local current_count=$(find "$ALBUM_DIR" -type f \( -name "*.flac" -o -name "*.mp3" -o -name "*.m4a" -o -name "*.ogg" -o -name "*.opus" \) 2>/dev/null | wc -l)
    
    if [ "$current_count" -eq "$prev_count" ] && [ "$current_count" -gt 0 ]; then
      stable_iterations=$((stable_iterations + 1))
    else
      stable_iterations=0
    fi
    
    prev_count=$current_count
    
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    if [ $elapsed -ge $MAX_WAIT ]; then
      log "Max wait time reached, proceeding with $current_count files"
      break
    fi
    
    [ $stable_iterations -lt 3 ] && sleep 1
  done
  
  log "Album appears stable with $prev_count files"
}

wait_for_stable_album

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
  log "WARNING: Destination metadata file not found: $DEST_META"
fi

if [ -z "$VPN" ]; then
  log "No VPN username found, skipping tagging"
  exit 0
fi

# Tag all audio files in album directory
tagged_count=0
failed_count=0
for f in "$ALBUM_DIR"/*.flac "$ALBUM_DIR"/*.mp3 "$ALBUM_DIR"/*.m4a "$ALBUM_DIR"/*.ogg "$ALBUM_DIR"/*.opus; do
  [ -f "$f" ] || continue

  ext="${f##*.}"
  ext="$(printf '%s' "$ext" | tr 'A-Z' 'a-z')"

  if [ "$ext" = "flac" ] && command -v metaflac >/dev/null 2>&1; then
    log "Tagging FLAC: $f with DOWNLOADED_BY=$VPN"
    if metaflac --remove-tag=DOWNLOADED_BY --set-tag="DOWNLOADED_BY=$VPN" "$f" 2>>"$LOG_FILE"; then
      tagged_count=$((tagged_count + 1))
      if command -v mutagen-inspect >/dev/null 2>&1; then
        mutagen-inspect "$f" >>"$LOG_FILE" 2>&1
      fi
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

# Create marker only after attempting to tag all files
if [ "$tagged_count" -gt 0 ]; then
  touch "$MARKER"
  log "Successfully tagged $tagged_count files in album: $ALBUM_DIR (failed: $failed_count)"
else
  log "WARNING: No files were tagged in album: $ALBUM_DIR (failed: $failed_count)"
fi