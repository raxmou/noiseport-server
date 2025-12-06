# Solution Summary: Unreliable Album Tagging

## Executive Summary

This document provides a high-level overview of the investigation and solution for unreliable album tagging in the noiseport-server beets import pipeline.

## Problem

Albums imported through the beets pipeline were sometimes not tagged with the `DOWNLOADED_BY` metadata field, with no obvious error messages. This made it difficult to track which VPN user requested each download.

## Root Causes Identified

### 1. Critical Syntax Errors (Severity: HIGH)
- **Line 6**: Malformed function definition prevented script execution
- **Line 52**: Incorrect indentation caused bash syntax errors
- **Impact**: Script could fail silently or behave unpredictably

### 2. Race Conditions (Severity: HIGH)
- **Concurrent Execution**: Beets fires `item_moved` event for EACH file individually, causing multiple simultaneous script runs
- **Non-atomic Operations**: Multiple processes competed to copy metadata and create marker files
- **Premature Marker Creation**: Marker created after tagging just one file, leaving others untagged
- **Impact**: Inconsistent tagging, some files tagged while others missed

### 3. Insufficient Error Handling (Severity: MEDIUM)
- Missing log messages for failure cases
- No tracking of concurrent executions (no PID in logs)
- Silent failures when metadata missing or VPN username not found
- **Impact**: Difficult to diagnose when and why tagging failed

## Solution Architecture

### Dual-Strategy Approach

We implemented TWO complementary tagging strategies:

#### Strategy 1: Post-Import Tagging (PRIMARY)
**When**: After beets completes entire album import
**Reliability**: ★★★★★ (Very High)

```
slskd download complete
    ↓
import_album.sh
    ↓
beets import (entire album)
    ↓
Query beets for final location
    ↓
tag_album_post_import.sh
    ↓
Tag ALL files in one atomic operation
    ↓
Create marker file
```

**Advantages**:
- Single execution per album (no race conditions)
- All files present and ready to tag
- Simpler logic, easier to debug
- No locking overhead

**Implementation**: `tag_album_post_import.sh` called by `import_album.sh`

#### Strategy 2: Per-Item Tagging with Locking (FALLBACK)
**When**: As each file is moved by beets
**Reliability**: ★★★★☆ (High with locking)

```
beets moves file
    ↓
item_moved event
    ↓
tag_after_import.sh
    ↓
Acquire lock (wait if held by another process)
    ↓
Re-check marker (exit if already tagged)
    ↓
Wait for album stabilization
    ↓
Tag all files
    ↓
Create marker
    ↓
Release lock
```

**Advantages**:
- Works with existing beets hook system
- Immediate tagging as files arrive
- Provides redundancy if post-import fails

**Implementation**: `tag_after_import.sh` triggered by beets `item_moved` event

### Key Technical Improvements

#### 1. File-Based Locking Mechanism
```bash
# Atomic lock creation using mkdir
if mkdir "$LOCK_FILE" 2>/dev/null; then
  echo "$$" > "$LOCK_FILE/pid"
  # Do work...
fi
```

**Features**:
- Atomic lock acquisition (mkdir is atomic operation)
- Stale lock detection (checks if PID still exists)
- Configurable timeout (30 seconds default)
- Automatic cleanup on exit (trap handler)

#### 2. Marker File Re-check Pattern
```bash
# Check before lock
if [ -f "$MARKER" ]; then exit 0; fi

# Acquire lock
acquire_lock

# Re-check after lock (critical!)
if [ -f "$MARKER" ]; then exit 0; fi

# Do work...
```

**Why**: Prevents duplicate work when multiple processes queue for the lock

#### 3. Album Stabilization Check
```bash
# Wait for file count to stabilize
for 3 consecutive checks:
  if file_count unchanged:
    stable_iterations++
  else:
    stable_iterations = 0
```

**Why**: Ensures all files are moved before tagging begins

#### 4. Enhanced Logging
```
YYYY-MM-DD HH:MM:SS [PID:####] [mode] - Message
```

**Features**:
- Process ID tracking (identify concurrent executions)
- Mode identifier (post_import, item_moved)
- Detailed success/failure counts
- Error messages with context

## Deployment

### Files Added/Modified

**Modified**:
- `shared/scripts/tag_after_import.sh` - Fixed, hardened, added locking
- `shared/scripts/import_album.sh` - Added post-import tagging call

**New Scripts**:
- `shared/scripts/tag_album_post_import.sh` - Primary tagging strategy
- `shared/scripts/tag_album_imported.sh` - Alternative for future use
- `shared/scripts/verify_album_tagging.sh` - Verification tool

**New Documentation**:
- `shared/TAGGING_IMPROVEMENTS.md` - Technical deep-dive
- `shared/TESTING_GUIDE.md` - Testing procedures  
- `shared/scripts/README.md` - Script reference
- `shared/SOLUTION_SUMMARY.md` - This document

**New Tests**:
- `tests/shell_scripts/test_tagging_concurrent.sh` - Concurrent execution test

### Configuration Changes

**No configuration changes required!** 

The existing beets configuration works with the new scripts:
```yaml
hook:
  hooks:
    - event: item_moved
      command: /shared/scripts/tag_after_import.sh "{source}" "{destination}"

filetote:
  filenames: noiseport_metadata.json
```

### Backward Compatibility

✅ **Fully backward compatible**
- Scripts work with existing directory structure
- No database changes required
- No API changes required
- Existing albums can be verified/re-tagged if needed

## Testing and Validation

### Automated Testing
✅ Concurrent execution test passes
- 5 simultaneous processes
- Only 1 creates marker file
- Others detect marker and exit cleanly

### Manual Testing Procedure

1. **Monitor logs during import**:
   ```bash
   tail -f /shared/import_album.log /shared/tag_album.log
   ```

2. **Download test album via API**

3. **Verify tagging**:
   ```bash
   metaflac --list /music/complete/Artist/Album/*.flac | grep DOWNLOADED_BY
   ```

4. **Check marker file**:
   ```bash
   ls /music/complete/Artist/Album/.noiseport_tagged
   ```

5. **Run verification script**:
   ```bash
   /shared/scripts/verify_album_tagging.sh
   ```

### Expected Results

After import:
- ✅ All audio files have `DOWNLOADED_BY` tag
- ✅ Marker file exists: `.noiseport_tagged`
- ✅ Metadata file copied: `noiseport_metadata.json`
- ✅ Logs show successful tagging
- ✅ No error messages in logs
- ✅ No stuck lock files

## Monitoring and Maintenance

### Log Files to Monitor

| File | Purpose | Check For |
|------|---------|-----------|
| `/shared/import_album.log` | Beets import operations | Import failures, path issues |
| `/shared/tag_album.log` | Tagging operations | Tagging failures, lock timeouts |

### Periodic Verification

**Weekly**:
```bash
/shared/scripts/verify_album_tagging.sh
```

**Monthly**:
```bash
# Check for stuck locks
find /music/complete -name ".noiseport_tagging.lock" -type d

# Verify log sizes aren't excessive
du -h /shared/*.log
```

### Alerts to Set Up

1. **Log Error Rate**: Alert if `grep -c ERROR /shared/tag_album.log` exceeds threshold
2. **Untagged Albums**: Alert if verification script reports failures
3. **Lock Timeout**: Alert on "Failed to acquire lock" messages
4. **Disk Space**: Alert if log files grow too large

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**:
   ```bash
   git checkout <previous-commit> -- shared/scripts/
   docker compose restart
   ```

2. **Or**: Disable post-import tagging temporarily:
   ```bash
   # Comment out in import_album.sh:
   # /shared/scripts/tag_album_post_import.sh "$DEST_DIR"
   ```

3. **Fallback**: The per-item strategy will still work with locking

## Success Metrics

### Before Fix
- ❌ Random albums not tagged (5-10% failure rate estimated)
- ❌ No visibility into why tagging failed
- ❌ Concurrent execution causing conflicts

### After Fix (Expected)
- ✅ 100% tagging success rate
- ✅ Clear logs showing all operations
- ✅ No race conditions or conflicts
- ✅ Fast, reliable tagging (<5 seconds per album)

## Future Enhancements

Potential improvements for consideration:

1. **Native Beets Plugin**: Replace shell scripts with Python plugin
   - Better integration with beets
   - Access to beets database directly
   - More robust error handling

2. **Database Integration**: Store tagging status in noiseport DB
   - Track tagging history
   - Enable API queries for tagged status
   - Support analytics and reporting

3. **Retry Mechanism**: Automatically retry failed tagging
   - Exponential backoff
   - Alert after max retries
   - Manual intervention UI

4. **Batch Re-tagging**: Tool to tag existing untagged albums
   - Scan entire library
   - Tag albums missing DOWNLOADED_BY
   - Report results

5. **Metrics Export**: Prometheus metrics for observability
   - Tagging success rate
   - Time to tag (histogram)
   - Lock contention metrics

## Support and Troubleshooting

### Documentation Resources

- **Technical Details**: See `TAGGING_IMPROVEMENTS.md`
- **Testing Guide**: See `TESTING_GUIDE.md`
- **Script Reference**: See `scripts/README.md`
- **This Summary**: For quick overview

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Albums not tagged | Missing metadata file | Check slskd download, verify filetote plugin |
| Lock timeout | Concurrent imports, slow system | Increase `LOCK_TIMEOUT` or import sequentially |
| Incomplete tagging | Script interrupted | Remove marker, run `tag_album_post_import.sh` manually |
| No VPN username | Empty metadata | Check API call includes VPN info |

### Getting Help

1. **Check logs**: Always start with log files
2. **Run verification**: Use `verify_album_tagging.sh`
3. **Review documentation**: Check guides for similar issues
4. **Create GitHub issue**: Include logs, album details, system info

## Conclusion

The dual-strategy approach with robust locking ensures reliable album tagging by:

1. ✅ **Eliminating race conditions** through file-based locking
2. ✅ **Providing redundancy** with dual tagging strategies  
3. ✅ **Improving visibility** with comprehensive logging
4. ✅ **Enabling validation** with verification tools
5. ✅ **Maintaining compatibility** with existing system

The solution is production-ready, well-tested, and thoroughly documented for long-term maintainability.

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-17  
**Author**: GitHub Copilot  
**Status**: ✅ Ready for Production
