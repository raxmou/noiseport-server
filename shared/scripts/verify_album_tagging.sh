#!/bin/bash
# Script to verify that albums are properly tagged with DOWNLOADED_BY metadata

set -e

MUSIC_DIR="${1:-/music/complete}"
REPORT_FILE="/shared/tagging_verification_$(date +%Y%m%d_%H%M%S).txt"

log() {
  echo "$*" | tee -a "$REPORT_FILE"
}

log "=== Album Tagging Verification Report ==="
log "Date: $(date)"
log "Music Directory: $MUSIC_DIR"
log ""

if [ ! -d "$MUSIC_DIR" ]; then
  log "ERROR: Music directory does not exist: $MUSIC_DIR"
  exit 1
fi

# Check if required tools are available
TOOLS_OK=1
if ! command -v metaflac >/dev/null 2>&1; then
  log "WARNING: metaflac not found (needed for FLAC files)"
  TOOLS_OK=0
fi
if ! command -v exiftool >/dev/null 2>&1; then
  log "WARNING: exiftool not found (needed for MP3/M4A/OGG files)"
  TOOLS_OK=0
fi

log "=== Scanning Albums ==="
log ""

total_albums=0
properly_tagged=0
improperly_tagged=0
no_metadata=0
no_marker=0

# Find all album directories (those with music files)
while IFS= read -r album_dir; do
  total_albums=$((total_albums + 1))
  
  album_name=$(basename "$album_dir")
  artist_name=$(basename "$(dirname "$album_dir")")
  
  # Check for marker file
  marker_file="$album_dir/.noiseport_tagged"
  metadata_file="$album_dir/noiseport_metadata.json"
  
  has_marker=0
  has_metadata=0
  all_files_tagged=1
  tagged_count=0
  total_files=0
  
  [ -f "$marker_file" ] && has_marker=1
  [ -f "$metadata_file" ] && has_metadata=1
  
  # Count audio files
  total_files=$(find "$album_dir" -maxdepth 1 -type f \( -iname "*.flac" -o -iname "*.mp3" -o -iname "*.m4a" -o -iname "*.ogg" -o -iname "*.opus" \) 2>/dev/null | wc -l)
  
  if [ "$total_files" -eq 0 ]; then
    continue  # Skip empty directories
  fi
  
  # Check if files are tagged
  for audio_file in "$album_dir"/*.flac "$album_dir"/*.mp3 "$album_dir"/*.m4a "$album_dir"/*.ogg "$album_dir"/*.opus; do
    [ -f "$audio_file" ] || continue
    
    ext="${audio_file##*.}"
    ext="$(printf '%s' "$ext" | tr 'A-Z' 'a-z')"
    
    has_tag=0
    if [ "$ext" = "flac" ] && command -v metaflac >/dev/null 2>&1; then
      if metaflac --show-tag=DOWNLOADED_BY "$audio_file" 2>/dev/null | grep -q "DOWNLOADED_BY="; then
        has_tag=1
        tagged_count=$((tagged_count + 1))
      fi
    elif command -v exiftool >/dev/null 2>&1; then
      if exiftool -DOWNLOADED_BY "$audio_file" 2>/dev/null | grep -q "Downloaded By"; then
        has_tag=1
        tagged_count=$((tagged_count + 1))
      fi
    fi
    
    [ "$has_tag" -eq 0 ] && all_files_tagged=0
  done
  
  # Categorize album
  status="OK"
  if [ "$has_metadata" -eq 0 ]; then
    status="NO_METADATA"
    no_metadata=$((no_metadata + 1))
  elif [ "$has_marker" -eq 0 ]; then
    status="NO_MARKER"
    no_marker=$((no_marker + 1))
  elif [ "$all_files_tagged" -eq 1 ] && [ "$tagged_count" -eq "$total_files" ]; then
    properly_tagged=$((properly_tagged + 1))
  else
    status="INCOMPLETE"
    improperly_tagged=$((improperly_tagged + 1))
  fi
  
  if [ "$status" != "OK" ]; then
    log "[$status] $artist_name - $album_name"
    log "  Files: $tagged_count/$total_files tagged"
    log "  Metadata: $([ $has_metadata -eq 1 ] && echo "YES" || echo "NO")"
    log "  Marker: $([ $has_marker -eq 1 ] && echo "YES" || echo "NO")"
    log ""
  fi
  
done < <(find "$MUSIC_DIR" -type f \( -iname "*.flac" -o -iname "*.mp3" -o -iname "*.m4a" -o -iname "*.ogg" -o -iname "*.opus" \) -exec dirname {} \; | sort -u)

log ""
log "=== Summary ==="
log "Total albums scanned: $total_albums"
log "Properly tagged: $properly_tagged ($([ $total_albums -gt 0 ] && echo "scale=1; $properly_tagged * 100 / $total_albums" | bc || echo 0)%)"
log "Incomplete tagging: $improperly_tagged"
log "No metadata file: $no_metadata"
log "No marker file: $no_marker"
log ""

if [ "$total_albums" -eq 0 ]; then
  log "WARNING: No albums found in $MUSIC_DIR"
elif [ "$properly_tagged" -eq "$total_albums" ]; then
  log "✓ SUCCESS: All albums are properly tagged!"
  exit 0
else
  log "✗ WARNING: Some albums are not properly tagged"
  log "See report above for details"
  exit 1
fi

log ""
log "Report saved to: $REPORT_FILE"
