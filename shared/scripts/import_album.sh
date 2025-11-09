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
log "import_album.sh script completed"
