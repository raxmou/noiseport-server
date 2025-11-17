#!/bin/sh
set -eu

LOG_FILE="/shared/tag_album.log"
META_NAME="noiseport_metadata.json"
log()"Tagging script started"
mkdir -p "$(dirname "$LOG_FILE")"; touch "$LOG_FILE"
log(){ echo "$(date '+%F %T') - $*" >>"$LOG_FILE"; }

SRC_FILE="${1:?}"; DEST_FILE="${2:?}"
ALBUM_DIR="$(dirname "$DEST_FILE")"
MARKER="$ALBUM_DIR/.noiseport_tagged"

# Exit if already tagged OR if source==dest (beets rewrite)
if [ -f "$MARKER" ] || [ "$SRC_FILE" = "$DEST_FILE" ]; then
  exit 0
fi

# Copy metadata on first file move
SRC_META="$(dirname "$SRC_FILE")/$META_NAME"
DEST_META="$ALBUM_DIR/$META_NAME"
if [ -f "$SRC_META" ] && [ ! -f "$DEST_META" ]; then
  cp -f "$SRC_META" "$DEST_META"
fi

# Extract VPN username
VPN=""
if [ -f "$DEST_META" ]; then
  if command -v jq >/dev/null 2>&1; then
    VPN="$(jq -r '.vpn_username // empty' "$DEST_META" 2>/dev/null || true)"
  else
    VPN="$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("vpn_username",""))' "$DEST_META" 2>/dev/null || true)"
  fi
fi

[ -n "$VPN" ] || exit 0  # Skip if no VPN user

# Tag all audio files in album directory
tagged=0
for f in "$ALBUM_DIR"/*.flac "$ALBUM_DIR"/*.mp3 "$ALBUM_DIR"/*.m4a "$ALBUM_DIR"/*.ogg "$ALBUM_DIR"/*.opus; do
  [ -f "$f" ] || continue

  ext="${f##*.}"
  ext="$(printf '%s' "$ext" | tr 'A-Z' 'a-z')"

  if [ "$ext" = "flac" ] && command -v metaflac >/dev/null 2>&1; then
    log "Tagging $f with DOWNLOADED_BY=$VPN"
    if metaflac --remove-tag=DOWNLOADED_BY --set-tag="DOWNLOADED_BY=$VPN" "$f"; then
      tagged=1
      if command -v mutagen-inspect >/dev/null 2>&1; then
        mutagen-inspect "$f" >>"$LOG_FILE" 2>&1
            fi
    fi
  elif command -v exiftool >/dev/null 2>&1; then
    # Note: this generic key may fail on some containers; per-format keys are safest.
    if exiftool -overwrite_original -P -m -q -DOWNLOADED_BY="$VPN" "$f"; then
      tagged=1
    fi
  fi
done

# Create marker only after successful tagging
if [ "$tagged" -eq 1 ]; then
  touch "$MARKER"
  log "Tagged album $ALBUM_DIR with DOWNLOADED_BY=$VPN"
fi