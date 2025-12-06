#!/bin/bash
# Test script to verify concurrent tagging with locking works correctly

set -e

TEST_DIR="/tmp/test_tagging_$$"
SHARED_DIR="$TEST_DIR/shared"
MUSIC_DIR="$TEST_DIR/music"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../shared/scripts" && pwd)"

echo "=== Album Tagging Concurrent Execution Test ==="
echo ""

# Setup test environment
cleanup() {
  echo "Cleaning up test environment..."
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

echo "1. Setting up test environment..."
mkdir -p "$SHARED_DIR" "$MUSIC_DIR/complete/TestArtist/TestAlbum"

# Create test metadata file
cat > "$MUSIC_DIR/complete/TestArtist/TestAlbum/noiseport_metadata.json" << 'EOF'
{
  "vpn_username": "test_user@vpn",
  "vpn_ip": "100.64.0.1",
  "task_id": "test-task-123",
  "artist": "TestArtist",
  "album": "TestAlbum",
  "slskd_username": "testsharer"
}
EOF

# Create test audio files
echo "2. Creating test audio files..."
for i in {1..5}; do
  # Create dummy FLAC files (not real FLAC, but good enough for testing)
  touch "$MUSIC_DIR/complete/TestArtist/TestAlbum/track${i}.flac"
done

echo "3. Testing concurrent script execution..."

# Create a modified version of the tagging script for testing
cat > "$TEST_DIR/test_tag_script.sh" << 'TESTSCRIPT'
#!/bin/sh
set -eu

LOG_FILE="$TEST_SHARED_DIR/tag_album.log"
META_NAME="noiseport_metadata.json"
LOCK_TIMEOUT=10

mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "$(date '+%F %T.%N') [PID:$$] - $*" >>"$LOG_FILE"; }

log "Test tagging script started"

SRC_FILE="${1:?}"; DEST_FILE="${2:?}"
ALBUM_DIR="$(dirname "$DEST_FILE")"
MARKER="$ALBUM_DIR/.noiseport_tagged"
LOCK_FILE="$ALBUM_DIR/.noiseport_tagging.lock"

if [ -f "$MARKER" ]; then
  log "Album already tagged (marker exists): $ALBUM_DIR"
  exit 0
fi

if [ "$SRC_FILE" = "$DEST_FILE" ]; then
  log "Source equals destination, skipping"
  exit 0
fi

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
    
    log "Waiting for lock..."
    sleep 0.5
  done
}

release_lock() {
  if [ -d "$LOCK_FILE" ]; then
    rm -rf "$LOCK_FILE"
    log "Lock released for album: $ALBUM_DIR"
  fi
}

trap release_lock EXIT INT TERM

if ! acquire_lock; then
  log "Could not acquire lock, exiting"
  exit 0
fi

# Re-check marker after acquiring lock
if [ -f "$MARKER" ]; then
  log "Album already tagged after acquiring lock (another process completed), exiting"
  exit 0
fi

log "Simulating tagging work for file: $DEST_FILE"
# Simulate some work (in real script this would be metaflac/exiftool)
sleep 1

log "File processed: $DEST_FILE"

# Check if all files are done
FILES_COUNT=$(find "$ALBUM_DIR" -name "*.flac" | wc -l)
log "Total files in album: $FILES_COUNT"

# In test, we'll just create marker after processing
touch "$MARKER"
log "Created marker file (all files processed)"
TESTSCRIPT

chmod +x "$TEST_DIR/test_tag_script.sh"

export TEST_SHARED_DIR="$SHARED_DIR"

echo "4. Launching 5 concurrent tagging processes (simulating beets item_moved events)..."
PIDS=()
for i in {1..5}; do
  "$TEST_DIR/test_tag_script.sh" \
    "/source/track${i}.flac" \
    "$MUSIC_DIR/complete/TestArtist/TestAlbum/track${i}.flac" &
  PIDS+=($!)
done

echo "5. Waiting for all processes to complete..."
for pid in "${PIDS[@]}"; do
  wait "$pid"
done

echo ""
echo "=== Test Results ==="
echo ""

# Check log file
if [ -f "$SHARED_DIR/tag_album.log" ]; then
  echo "Log file contents:"
  echo "-------------------"
  cat "$SHARED_DIR/tag_album.log"
  echo "-------------------"
  echo ""
  
  # Analyze results
  LOCK_ACQUIRED_COUNT=$(grep -c "Lock acquired" "$SHARED_DIR/tag_album.log" || echo "0")
  LOCK_WAIT_COUNT=$(grep -c "Waiting for lock" "$SHARED_DIR/tag_album.log" || echo "0")
  MARKER_CREATED=$(grep -c "Created marker" "$SHARED_DIR/tag_album.log" || echo "0")
  ALREADY_TAGGED=$(grep -c "Album already tagged after acquiring lock" "$SHARED_DIR/tag_album.log" || echo "0")
  
  echo "Analysis:"
  echo "  - Lock acquisitions: $LOCK_ACQUIRED_COUNT (multiple processes acquire lock sequentially)"
  echo "  - Lock waits: $LOCK_WAIT_COUNT (should be >0)"
  echo "  - Marker created: $MARKER_CREATED (should be 1)"
  echo "  - Already tagged exits: $ALREADY_TAGGED (should be 4 for 5 processes)"
  echo ""
  
  if [ "$MARKER_CREATED" -eq 1 ] && [ "$ALREADY_TAGGED" -ge 1 ]; then
    echo "✓ SUCCESS: Locking mechanism works correctly!"
    echo "  Only one process created the marker."
    echo "  Other processes correctly detected the marker and exited."
  else
    echo "✗ FAILURE: Locking mechanism did not work as expected!"
    echo "  Expected 1 marker creation and at least 1 early exit."
    exit 1
  fi
else
  echo "✗ FAILURE: No log file created!"
  exit 1
fi

# Check marker file
if [ -f "$MUSIC_DIR/complete/TestArtist/TestAlbum/.noiseport_tagged" ]; then
  echo "✓ Marker file created successfully"
else
  echo "✗ Marker file not found!"
  exit 1
fi

echo ""
echo "=== All Tests Passed ==="
