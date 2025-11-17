#!/bin/sh
set -eu

LOG_FILE="/shared/import_album.log"
mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"; }

log "Starting import_album.sh script"
log "SLSKD_SCRIPT_DATA: ${SLSKD_SCRIPT_DATA:-<empty>}"

DATA="${SLSKD_SCRIPT_DATA:-}"
[ -n "$DATA" ] || { log "No SLSKD_SCRIPT_DATA; exit"; exit 0; }

# 1) Extract album dir (supports camelCase/PascalCase)
if command -v jq >/dev/null 2>&1; then
  ALBUM_DIR=$(printf '%s' "$DATA" | jq -r '.localDirectoryName // .LocalDirectoryName // empty')
else
  ALBUM_DIR=$(python3 - <<'PY'
import json, os
d=json.loads(os.environ.get("SLSKD_SCRIPT_DATA","") or "{}")
print((d.get("localDirectoryName") or d.get("LocalDirectoryName") or "").strip())
PY
)
fi
[ -n "${ALBUM_DIR:-}" ] || { log "ALBUM_DIR empty; exit"; exit 0; }
log "ALBUM_DIR: $ALBUM_DIR"


# 4) Import ONLY this album (not whole downloads)
log "Running beets import for $ALBUM_DIR"
beet -c /shared/beet_config_album.yaml import -q "$ALBUM_DIR"
BEETS_EXIT_CODE=$?

if [ $BEETS_EXIT_CODE -eq 0 ]; then
  log "Beets import completed successfully"
  
  # Post-import tagging: Find where beets moved the album and tag it
  # The album should now be in /music/complete/{artist}/{album}/
  log "Starting post-import tagging..."
  
  # Use beets to query the library for the most recently imported album
  # This is more reliable than trying to guess the path
  DEST_DIR=$(beet -c /shared/beet_config_album.yaml ls -p "$(basename "$ALBUM_DIR")" 2>/dev/null | head -1 | xargs dirname 2>/dev/null || true)
  
  if [ -n "$DEST_DIR" ] && [ -d "$DEST_DIR" ]; then
    log "Found imported album at: $DEST_DIR"
    
    # Call post-import tagging script
    if [ -x /shared/scripts/tag_album_post_import.sh ]; then
      log "Calling post-import tagging script"
      /shared/scripts/tag_album_post_import.sh "$DEST_DIR" || log "WARNING: Post-import tagging failed"
    else
      log "WARNING: Post-import tagging script not found or not executable"
    fi
  else
    log "WARNING: Could not determine destination directory for imported album"
  fi
else
  log "ERROR: Beets import failed with exit code $BEETS_EXIT_CODE"
fi

log "import_album.sh script completed"
