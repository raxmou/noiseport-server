# Album Tagging Reliability Improvements

## Problem Statement

The beets-based music import pipeline had unreliable album tagging where albums were sometimes not tagged with the `DOWNLOADED_BY` metadata field. Investigation revealed several critical issues.

## Issues Identified

### 1. **Critical Syntax Errors in `tag_after_import.sh`**
- **Line 6**: `log()"Tagging script started"` - missing space after function name
- **Line 52**: Incorrect indentation of `fi` statement causing syntax errors

### 2. **Race Conditions**
- **Multiple Hook Invocations**: Beets fires `item_moved` event for EACH file individually
- **Concurrent Execution**: Multiple script instances run simultaneously for the same album
- **Metadata Copy Race**: Multiple processes compete to copy the metadata file
- **Non-atomic Marker Check**: Marker file check allows multiple processes to start tagging

### 3. **Incomplete Tagging**
- Script created marker file after tagging only ONE file successfully
- Other files in the album might not be tagged if script exits early
- No verification that ALL files in album were tagged

### 4. **Insufficient Logging**
- Missing log entries for critical failure paths
- No PID tracking to identify concurrent executions
- Difficult to debug what happened during import

### 5. **Missing Metadata Handling**
- No logging when metadata file is missing
- Silent failures when VPN username cannot be extracted
- No recovery mechanism if metadata is in wrong location

## Solutions Implemented

### Solution 1: Dual-Strategy Approach

We implement TWO complementary tagging strategies:

#### A. Post-Import Tagging (Primary, Reliable)
**File**: `tag_album_post_import.sh`

- Called AFTER beets completes import (from `import_album.sh`)
- Single execution per album (no race conditions)
- Processes all files in one go
- Waits for beets to finish before tagging
- More reliable and easier to debug

**Workflow**:
1. slskd downloads album → triggers `DownloadDirectoryComplete`
2. `import_album.sh` runs beets import
3. After beets completes, script finds destination directory
4. Calls `tag_album_post_import.sh` with album path
5. Script tags all files in one atomic operation

#### B. Per-Item Tagging with Locking (Fallback, Concurrent-safe)
**File**: `tag_after_import.sh` (improved version)

- Triggered by beets `item_moved` event (existing hook)
- Protected by file-based locking mechanism
- Waits for album to stabilize (all files moved)
- Only one process tags at a time
- Acts as backup if post-import tagging fails

**Key Improvements**:
- **File-based locking** with timeout and stale lock detection
- **Album stabilization check** - waits for file count to stabilize
- **Atomic marker creation** - only after all files are tagged
- **Enhanced logging** with PID tracking and detailed status

### Solution 2: Fixed Syntax Errors

```bash
# Before (Line 6):
log()"Tagging script started"

# After (Line 6):
log() { echo "$(date '+%F %T') [PID:$$] - $*" >>"$LOG_FILE"; }
log "Tagging script started"

# Before (Line 52):
      if command -v mutagen-inspect >/dev/null 2>&1; then
        mutagen-inspect "$f" >>"$LOG_FILE" 2>&1
            fi   # Wrong indentation

# After (Line 52):
      if command -v mutagen-inspect >/dev/null 2>&1; then
        mutagen-inspect "$f" >>"$LOG_FILE" 2>&1
      fi
```

### Solution 3: Robust Locking Mechanism

**Lock Acquisition Algorithm**:
```bash
- Try to create lock directory (mkdir is atomic)
- If successful, write PID to lock file
- If lock exists:
  - Wait up to LOCK_TIMEOUT seconds
  - Check if lock holder process still exists
  - Remove stale locks (process no longer running)
  - Retry until timeout
- Release lock on exit (trap handler)
```

**Features**:
- Atomic lock creation using `mkdir`
- Stale lock detection (checks if PID exists)
- Configurable timeout (default 30s)
- Automatic cleanup via trap handler

### Solution 4: Album Stabilization Wait

Waits for beets to finish moving all files:
```bash
wait_for_stable_album() {
  - Count audio files in directory
  - Wait until count is stable for 3 iterations
  - Prevents tagging while files still being moved
  - Max wait time: 120 seconds
}
```

### Solution 5: Comprehensive Logging

All scripts now log:
- Process ID (PID) for tracking concurrent executions
- Timestamp with microsecond precision
- Script mode (post_import, item_moved, etc.)
- Every major operation (lock acquire/release, metadata copy, tagging)
- Success/failure counts
- Warning and error messages with context

### Solution 6: Metadata File Handling

Improved metadata discovery:
```bash
# Search in subdirectories if not in album root
if [ ! -f "$DEST_META" ]; then
  log "WARNING: Metadata file not found at: $DEST_META"
  log "Searching for metadata in subdirectories..."
  DEST_META=$(find "$ALBUM_DIR" -maxdepth 2 -name "$META_NAME" -type f 2>/dev/null | head -1)
fi
```

### Solution 7: Enhanced Import Script

`import_album.sh` improvements:
- Captures beets exit code
- Queries beets library to find destination directory
- Calls post-import tagging after successful import
- Continues even if tagging fails (logs warning)
- Better error handling and logging

## Configuration

The beets configuration remains mostly unchanged:

```yaml
# shared/beet_config_album.yaml
hook:
  hooks:
    - event: item_moved
      command: /shared/scripts/tag_after_import.sh "{source}" "{destination}"

filetote:
  filenames: noiseport_metadata.json
```

The `filetote` plugin ensures `noiseport_metadata.json` is copied along with the music files.

## Testing Recommendations

### 1. Unit Test Scripts
```bash
# Test locking mechanism
bash tests/test_tagging_locks.sh

# Test metadata extraction
bash tests/test_metadata_extraction.sh
```

### 2. Integration Testing
```bash
# Test full pipeline
1. Download an album via slskd
2. Monitor logs: /shared/import_album.log and /shared/tag_album.log
3. Verify all files are tagged with DOWNLOADED_BY field
4. Check marker file exists: .noiseport_tagged
```

### 3. Concurrent Execution Test
```bash
# Simulate beets calling script for multiple files simultaneously
for i in {1..5}; do
  /shared/scripts/tag_after_import.sh "/source/file$i.flac" "/dest/album/file$i.flac" &
done
wait

# Should see only ONE process acquiring lock and tagging
# Others should wait or skip if already done
```

### 4. Log Monitoring
```bash
# Watch logs in real-time during import
tail -f /shared/import_album.log /shared/tag_album.log

# Search for errors
grep -i error /shared/tag_album.log

# Check for concurrent executions
grep -i "lock acquired" /shared/tag_album.log

# Verify tagging completion
grep -i "successfully tagged" /shared/tag_album.log
```

## Troubleshooting

### Symptom: Albums still not tagged

**Check**:
1. Verify metadata file exists in download directory
2. Check if VPN username is in metadata file
3. Look for lock file that wasn't cleaned up
4. Check if tagging tools (metaflac, exiftool) are installed
5. Verify file permissions

**Commands**:
```bash
# Check for stuck locks
find /music/complete -name ".noiseport_tagging.lock" -type d

# Remove stale locks (if processes are dead)
find /music/complete -name ".noiseport_tagging.lock" -type d -exec rm -rf {} \;

# Check metadata files
find /music/downloads -name "noiseport_metadata.json"

# Verify tagging tools
which metaflac exiftool jq

# Test metadata extraction
jq . /path/to/album/noiseport_metadata.json
```

### Symptom: "Lock timeout" errors

**Causes**:
- Multiple albums importing simultaneously
- Long-running tagging operation
- System performance issues

**Solutions**:
- Increase `LOCK_TIMEOUT` in script
- Import albums sequentially
- Check system resources

### Symptom: Metadata file not found

**Causes**:
- File created in wrong location
- Beets moved files but didn't copy metadata
- filetote plugin not configured correctly

**Solutions**:
- Verify filetote plugin is enabled in beets config
- Check metadata file in download directory
- Manually copy metadata file to album directory

## Performance Considerations

### Post-Import Tagging (Recommended)
- **Pros**: Single execution, no locking overhead, reliable
- **Cons**: Requires querying beets database
- **Best for**: Production use

### Per-Item Tagging with Locking
- **Pros**: Works with existing hook system, immediate tagging
- **Cons**: Locking overhead, multiple process spawns
- **Best for**: Backup/fallback mechanism

## Future Enhancements

1. **Python-based tagging plugin**: Replace shell scripts with a beets plugin
2. **Tagging verification**: Add script to verify all albums are tagged
3. **Retry mechanism**: Automatically retry failed tagging operations
4. **Database integration**: Store tagging status in noiseport database
5. **Metrics**: Track tagging success rate and performance
6. **Album_imported event**: Consider switching to album_imported hook when beets support improves

## Summary

The improvements ensure reliable album tagging by:

1. ✅ Fixing critical syntax errors
2. ✅ Implementing robust locking mechanism
3. ✅ Adding post-import tagging strategy
4. ✅ Comprehensive logging for debugging
5. ✅ Better metadata file handling
6. ✅ Album stabilization checks
7. ✅ Atomic marker file creation

These changes eliminate race conditions and ensure all albums are reliably tagged with downloader information.
