# Noiseport Scripts

This directory contains scripts used by the noiseport-server for music import and tagging workflows.

## Import and Tagging Scripts

### `import_album.sh`

**Purpose**: Main import script triggered by slskd's `DownloadDirectoryComplete` event.

**Workflow**:
1. Receives album directory path from slskd via `SLSKD_SCRIPT_DATA` environment variable
2. Runs beets import on the downloaded album
3. After successful import, locates the imported album using two strategies:
   - **Strategy 1**: Find `noiseport_metadata.json` file moved by filetote plugin (most reliable)
   - **Strategy 2**: Query beets for recently added items (last 5 minutes)
4. Calls post-import tagging script if album location found
5. Falls back to `item_moved` hook strategy if location cannot be determined
6. Logs all operations to `/shared/import_album.log`

**Environment Variables**:
- `SLSKD_SCRIPT_DATA`: JSON data from slskd containing album information

**Called by**: slskd (configured in `slskd.yml`)

---

### `tag_album_post_import.sh`

**Purpose**: Primary tagging strategy - tags all files in an album after beets completes import.

**Features**:
- Single execution per album (no race conditions)
- Processes all audio files in one operation
- Searches for metadata file recursively if not in root
- Comprehensive error handling and logging
- Creates marker file after successful tagging

**Called by**: `import_album.sh` (after beets completes)

**Arguments**:
- `$1`: Album directory path (e.g., `/music/complete/Artist Name/Album Name`)

**Logs to**: `/shared/tag_album.log` with prefix `[post_import]`

---

### `tag_after_import.sh`

**Purpose**: Fallback tagging strategy - triggered by beets `item_moved` event for each file.

**Features**:
- File-based locking to prevent concurrent execution conflicts
- Album stabilization check (waits for all files to be moved)
- Marker file re-check after lock acquisition (prevents duplicate work)
- Stale lock detection and cleanup
- Configurable timeouts

**Called by**: beets hook plugin (configured in `beet_config_album.yaml`)

**Arguments**:
- `$1`: Source file path (where file was before beets moved it)
- `$2`: Destination file path (where beets moved the file)

**Locks**: Uses `.noiseport_tagging.lock` directory in album folder

**Logs to**: `/shared/tag_album.log` with PID tracking

**Configuration**:
- `LOCK_TIMEOUT`: 30 seconds (time to wait for lock before giving up)
- `MAX_WAIT`: 120 seconds (max time to wait for album to stabilize)

---

### `tag_album_imported.sh`

**Purpose**: Alternative script for beets `album_imported` event (currently not used).

**Note**: This script is prepared for future use if switching from `item_moved` to `album_imported` event. The `album_imported` event fires once per album instead of once per file, eliminating the need for locking.

**Arguments**:
- `$1`: Album directory path

---

### `verify_album_tagging.sh`

**Purpose**: Verification script to check if albums are properly tagged.

**Features**:
- Scans all albums in music library
- Checks for DOWNLOADED_BY tag in all audio files
- Verifies metadata and marker files exist
- Generates detailed report
- Provides summary statistics

**Usage**:
```bash
# Scan default music directory
./verify_album_tagging.sh

# Scan specific directory
./verify_album_tagging.sh /path/to/music

# View report
cat /shared/tagging_verification_*.txt
```

**Output**:
- Console: Summary and problems found
- File: `/shared/tagging_verification_YYYYMMDD_HHMMSS.txt`

**Exit codes**:
- `0`: All albums properly tagged
- `1`: Some albums have issues

---

## Workflow Diagrams

### Primary Workflow (Post-Import Tagging)

```
slskd downloads album
    ↓
DownloadDirectoryComplete event
    ↓
import_album.sh triggered
    ↓
beets import (moves files to /music/complete/)
    ↓
Query beets for destination directory
    ↓
tag_album_post_import.sh called
    ↓
All files tagged in one operation
    ↓
Marker file created
```

### Fallback Workflow (Per-Item Tagging)

```
beets moves file #1
    ↓
item_moved event → tag_after_import.sh (PID:1234)
    ↓
Acquire lock ✓
    ↓
Wait for album stabilization
    ↓
Tag all files
    ↓
Create marker
    ↓
Release lock
    
Meanwhile...

beets moves file #2
    ↓
item_moved event → tag_after_import.sh (PID:1235)
    ↓
Try to acquire lock (waiting...)
    ↓
Lock acquired after PID:1234 releases
    ↓
Check marker → exists!
    ↓
Exit (no work needed)
```

## File Formats and Metadata

### Metadata File: `noiseport_metadata.json`

Location: `{album_directory}/noiseport_metadata.json`

Structure:
```json
{
  "vpn_username": "user@vpn",
  "vpn_ip": "100.64.0.1",
  "task_id": "uuid-task-id",
  "artist": "Artist Name",
  "album": "Album Name",
  "slskd_username": "soulseek_user"
}
```

This file is:
- Created by noiseport-server when download starts
- Placed in download directory alongside audio files
- Moved by beets `filetote` plugin to final album location
- Read by tagging scripts to extract VPN username

### Marker File: `.noiseport_tagged`

Location: `{album_directory}/.noiseport_tagged`

Purpose: Indicates album has been successfully tagged with DOWNLOADED_BY metadata

Created by: Tagging scripts after successful tagging

Checked by: Scripts to prevent duplicate tagging

### Lock File: `.noiseport_tagging.lock/`

Location: `{album_directory}/.noiseport_tagging.lock/` (directory)

Structure:
```
.noiseport_tagging.lock/
  └── pid    # File containing PID of process holding lock
```

Purpose: Prevents concurrent tagging of the same album

Lifetime: Created when lock acquired, removed when lock released

Stale lock handling: Automatically removed if process no longer exists

## Logging

### Log Files

- **Import Log**: `/shared/import_album.log`
  - Records beets import operations
  - Shows when post-import tagging is triggered
  
- **Tagging Log**: `/shared/tag_album.log`
  - Records all tagging operations
  - Includes PID for tracking concurrent executions
  - Shows lock acquisitions and releases
  - Records success/failure for each file

### Log Format

```
YYYY-MM-DD HH:MM:SS [PID:####] [mode] - Message
```

Examples:
```
2025-11-17 19:00:05 [PID:1234] [post_import] - Tagging FLAC: /music/complete/Artist/Album/01.flac with DOWNLOADED_BY=user@vpn
2025-11-17 19:00:05 [PID:1235] - Lock acquired for album: /music/complete/Artist/Album
2025-11-17 19:00:06 [PID:1236] - Album already tagged after acquiring lock (another process completed), exiting
```

## Troubleshooting

### Problem: Albums not being tagged

**Check**:
1. Metadata file exists: `find /music -name "noiseport_metadata.json"`
2. VPN username in metadata: `jq -r .vpn_username /music/complete/Artist/Album/noiseport_metadata.json`
3. Tagging tools installed: `which metaflac exiftool`
4. Log files for errors: `grep -i error /shared/tag_album.log`

### Problem: Stuck lock file

**Symptoms**:
- New downloads not being tagged
- Log shows "Waiting for lock..." messages
- Lock timeout errors

**Fix**:
```bash
# Find stuck locks
find /music/complete -name ".noiseport_tagging.lock" -type d

# Check if process exists
cat /music/complete/Artist/Album/.noiseport_tagging.lock/pid
ps aux | grep <PID>

# Remove if process is dead
rm -rf /music/complete/Artist/Album/.noiseport_tagging.lock
```

### Problem: Duplicate tagging attempts

**Symptoms**:
- Multiple "Lock acquired" messages for same album
- Multiple processes logging tagging operations

**Expected behavior**: This is normal! Multiple processes will acquire locks sequentially, but only the first one will do the actual tagging work. Other processes will check the marker file and exit cleanly.

## Testing

### Unit Test

Run the concurrent execution test:
```bash
bash /path/to/tests/shell_scripts/test_tagging_concurrent.sh
```

### Integration Test

1. Download a test album
2. Monitor logs: `tail -f /shared/import_album.log /shared/tag_album.log`
3. Verify tagging: `metaflac --list /music/complete/Artist/Album/*.flac | grep DOWNLOADED_BY`
4. Check marker: `ls /music/complete/Artist/Album/.noiseport_tagged`

### System Verification

Run the verification script:
```bash
./verify_album_tagging.sh
```

## Dependencies

### Required Tools

- `bash` or `sh`: Shell interpreter
- `python3`: For JSON parsing (fallback if jq not available)
- `beet` (beets): Music library management
- `metaflac`: For tagging FLAC files
- `exiftool`: For tagging other formats (MP3, M4A, OGG, etc.)

### Optional Tools

- `jq`: Faster JSON parsing (falls back to Python if not available)
- `mutagen-inspect`: For detailed metadata inspection (logged if available)

### Installation

Most tools are included in the noiseport-server Docker image. If running locally:

```bash
# Ubuntu/Debian
apt-get install python3-beets flac exiftool jq python3-mutagen

# macOS
brew install beets flac exiftool jq
```

## Configuration

### Beets Configuration

File: `/shared/beet_config_album.yaml`

Relevant sections:
```yaml
plugins: fetchart lastgenre lyrics scrub zero hook filetote

filetote:
  filenames: noiseport_metadata.json

hook:
  hooks:
    - event: item_moved
      command: /shared/scripts/tag_after_import.sh "{source}" "{destination}"

types:
  DOWNLOADED_BY: str
```

### slskd Configuration

File: `/path/to/slskd.yml`

Relevant section:
```yaml
integration:
  scripts:
    import_with_beets:
      on:
      - DownloadDirectoryComplete
      run:
        command: /shared/scripts/import_album.sh
```

## Performance

### Resource Usage

- CPU: Low (tagging is I/O bound)
- Memory: ~10-50 MB per script instance
- Disk I/O: Moderate (reading/writing metadata tags)

### Timing

Typical times for a 12-track album:
- Beets import: 5-15 seconds
- Post-import tagging: 1-3 seconds
- Total: 6-18 seconds

### Concurrency

- Lock timeout: 30 seconds
- Max concurrent tagging: 1 per album (enforced by locks)
- Multiple albums can be tagged simultaneously (each has own lock)

## Future Improvements

Potential enhancements:

1. **Beets Plugin**: Replace shell scripts with native beets plugin
2. **Retry Logic**: Automatically retry failed tagging operations
3. **Metrics**: Export tagging success rate to Prometheus
4. **Batch Tagging**: Add script to tag existing untagged albums
5. **Database Integration**: Store tagging status in noiseport database

## Support

For issues or questions:
- Check logs: `/shared/import_album.log` and `/shared/tag_album.log`
- Run verification: `./verify_album_tagging.sh`
- See documentation: `TAGGING_IMPROVEMENTS.md` and `TESTING_GUIDE.md`
- Create GitHub issue with logs and album details
