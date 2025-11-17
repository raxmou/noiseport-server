# Testing Guide for Album Tagging Improvements

This guide explains how to test and validate the album tagging improvements in a real environment.

## Prerequisites

- Running noiseport-server with slskd configured
- Access to log files: `/shared/import_album.log` and `/shared/tag_album.log`
- A test album to download
- Tools: `metaflac` (for FLAC files) or `exiftool` (for other formats)

## Quick Validation Test

### 1. Monitor Logs During Import

Open two terminal windows to watch both log files in real-time:

```bash
# Terminal 1: Watch import log
tail -f /shared/import_album.log

# Terminal 2: Watch tagging log
tail -f /shared/tag_album.log
```

### 2. Download a Test Album

Use the noiseport API or web interface to download a test album. For example:

```bash
# Using curl
curl -X POST http://localhost:8000/api/v1/downloads/download \
  -H "Content-Type: application/json" \
  -d '{
    "artist": "Test Artist",
    "album": "Test Album",
    "vpn_ip": "100.64.0.1",
    "username": "testuser@vpn"
  }'
```

### 3. Watch the Logs

You should see entries like:

**In import_album.log:**
```
2025-11-17 19:00:00 - Starting import_album.sh script
2025-11-17 19:00:00 - ALBUM_DIR: /music/downloads/user123/Test Artist/Test Album
2025-11-17 19:00:00 - Running beets import for /music/downloads/user123/Test Artist/Test Album
2025-11-17 19:00:05 - Beets import completed successfully
2025-11-17 19:00:05 - Starting post-import tagging...
2025-11-17 19:00:05 - Found imported album at: /music/complete/Test Artist/Test Album
2025-11-17 19:00:05 - Calling post-import tagging script
2025-11-17 19:00:06 - import_album.sh script completed
```

**In tag_album.log:**
```
2025-11-17 19:00:05 [PID:1234] [post_import] - Post-import tagging script started
2025-11-17 19:00:05 [PID:1234] [post_import] - Processing album directory: /music/complete/Test Artist/Test Album
2025-11-17 19:00:05 [PID:1234] [post_import] - Found metadata at: /music/complete/Test Artist/Test Album/noiseport_metadata.json
2025-11-17 19:00:05 [PID:1234] [post_import] - Extracted VPN username: testuser@vpn
2025-11-17 19:00:05 [PID:1234] [post_import] - Tagging FLAC: /music/complete/Test Artist/Test Album/01 Track 1.flac with DOWNLOADED_BY=testuser@vpn
2025-11-17 19:00:05 [PID:1234] [post_import] - Tagging FLAC: /music/complete/Test Artist/Test Album/02 Track 2.flac with DOWNLOADED_BY=testuser@vpn
...
2025-11-17 19:00:06 [PID:1234] [post_import] - Successfully tagged 12 of 12 files in album: /music/complete/Test Artist/Test Album
```

### 4. Verify Tagged Files

Check that the DOWNLOADED_BY tag was added to all files:

```bash
# For FLAC files
metaflac --list /music/complete/Test\ Artist/Test\ Album/*.flac | grep DOWNLOADED_BY

# Expected output:
# comment[0]: DOWNLOADED_BY=testuser@vpn
```

Or use exiftool:

```bash
exiftool -DOWNLOADED_BY /music/complete/Test\ Artist/Test\ Album/*.flac
```

### 5. Verify Marker File

Check that the marker file was created:

```bash
ls -la /music/complete/Test\ Artist/Test\ Album/.noiseport_tagged

# Should show the marker file with timestamp
```

## Advanced Testing: Concurrent Execution

To test that the locking mechanism works correctly with concurrent imports:

### 1. Download Multiple Albums Simultaneously

```bash
# Start 3 downloads at the same time
for i in {1..3}; do
  curl -X POST http://localhost:8000/api/v1/downloads/download \
    -H "Content-Type: application/json" \
    -d "{
      \"artist\": \"Test Artist $i\",
      \"album\": \"Test Album $i\",
      \"vpn_ip\": \"100.64.0.1\",
      \"username\": \"testuser@vpn\"
    }" &
done
wait
```

### 2. Monitor for Lock Contention

Watch the logs for lock-related messages:

```bash
# Look for lock acquisitions and waits
grep -E "(Lock acquired|Waiting for lock|Lock released)" /shared/tag_album.log
```

You should see evidence of proper lock coordination.

### 3. Verify All Albums Tagged

Check that all downloaded albums have the marker file:

```bash
find /music/complete -name ".noiseport_tagged" -type f
```

Each album directory should have exactly one marker file.

## Testing the Fallback Strategy

The per-item tagging with locking (fallback strategy) is triggered by beets' `item_moved` event. To test it:

### 1. Manually Trigger Per-Item Tagging

You can simulate beets calling the tagging script:

```bash
# Assuming you have an album at /music/complete/Artist/Album
cd /music/complete/Artist/Album

# Manually call the script (simulating beets)
/shared/scripts/tag_after_import.sh \
  "/music/downloads/user/Artist/Album/01.flac" \
  "/music/complete/Artist/Album/01.flac"
```

### 2. Test Concurrent Calls

Simulate multiple concurrent calls (like beets moving multiple files):

```bash
cd /music/complete/Test\ Artist/Test\ Album

# Launch 5 concurrent tagging processes
for i in {01..05}; do
  /shared/scripts/tag_after_import.sh \
    "/music/downloads/user/Test Artist/Test Album/${i}.flac" \
    "/music/complete/Test Artist/Test Album/${i}.flac" &
done
wait

# Check logs for proper coordination
tail -100 /shared/tag_album.log | grep -E "(Lock|marker)"
```

Expected behavior:
- First process acquires lock and tags all files
- Subsequent processes acquire lock, see marker, and exit cleanly
- Only one "Created marker" log entry

## Troubleshooting Failed Tests

### Issue: No tagging occurs

**Check:**
1. Verify metadata file exists:
   ```bash
   find /music -name "noiseport_metadata.json"
   ```

2. Check metadata content:
   ```bash
   cat /music/complete/Artist/Album/noiseport_metadata.json
   jq . /music/complete/Artist/Album/noiseport_metadata.json
   ```

3. Verify VPN username is present:
   ```bash
   jq -r '.vpn_username' /music/complete/Artist/Album/noiseport_metadata.json
   ```

4. Check if tagging tools are installed:
   ```bash
   which metaflac
   which exiftool
   ```

### Issue: Stuck lock file

**Check for stale locks:**
```bash
# Find lock files
find /music/complete -name ".noiseport_tagging.lock" -type d

# Check if process is still running
cat /music/complete/Artist/Album/.noiseport_tagging.lock/pid
ps aux | grep <PID>

# Remove stale lock if process is dead
rm -rf /music/complete/Artist/Album/.noiseport_tagging.lock
```

### Issue: Incomplete tagging

**Verify all files were tagged:**
```bash
# Count files in album
find /music/complete/Artist/Album -type f \( -name "*.flac" -o -name "*.mp3" \) | wc -l

# Count files with DOWNLOADED_BY tag
metaflac --list /music/complete/Artist/Album/*.flac | grep -c DOWNLOADED_BY

# These numbers should match (assuming all FLAC)
```

**Check logs for errors:**
```bash
grep -i error /shared/tag_album.log
grep -i failed /shared/tag_album.log
```

## Validation Checklist

After running tests, verify:

- [ ] Import log shows "Beets import completed successfully"
- [ ] Tagging log shows "Post-import tagging script started"
- [ ] Tagging log shows "Successfully tagged X of X files"
- [ ] All audio files have DOWNLOADED_BY tag
- [ ] Marker file exists: `.noiseport_tagged`
- [ ] No error messages in logs
- [ ] No stuck lock files remain
- [ ] Concurrent imports work without conflicts

## Performance Monitoring

Monitor system performance during imports:

```bash
# Watch for high CPU/memory usage
top -p $(pgrep -f "beet|tag_after_import")

# Check I/O wait
iostat -x 1

# Monitor log file sizes
watch -n 1 'du -h /shared/*.log'
```

## Automated Testing

Run the included test suite:

```bash
# Run concurrent execution test
bash /home/runner/work/noiseport-server/noiseport-server/tests/shell_scripts/test_tagging_concurrent.sh
```

Expected output: All tests pass with green checkmarks.

## Reporting Issues

If you encounter problems:

1. Collect relevant log sections:
   ```bash
   tail -200 /shared/import_album.log > import_debug.log
   tail -200 /shared/tag_album.log > tagging_debug.log
   ```

2. Note the album that failed:
   - Artist name
   - Album name
   - File count
   - Whether metadata file exists

3. Check for system issues:
   - Disk space: `df -h`
   - Memory: `free -h`
   - Load: `uptime`

4. Create an issue with:
   - Description of the problem
   - Log excerpts
   - Album details
   - System state

## Success Criteria

The improvements are working correctly if:

1. ✅ All albums are tagged after import
2. ✅ Concurrent imports work without conflicts
3. ✅ Logs show clear progression from download → import → tagging
4. ✅ No error messages in logs
5. ✅ No stale lock files remain
6. ✅ Marker files prevent duplicate tagging
7. ✅ System performance is acceptable

## Next Steps After Validation

Once testing is successful:

1. Enable monitoring alerts for tagging failures
2. Set up periodic verification of tagged albums
3. Consider adding metrics/telemetry
4. Document any environment-specific considerations
5. Train team on troubleshooting procedures
