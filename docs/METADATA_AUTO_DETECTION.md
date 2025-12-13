# Metadata Auto-Detection Update

## What Changed

**Previously:** Users had to manually type artist and album names when uploading.

**Now:** Artist and album are **automatically extracted from audio file tags** (ID3, FLAC, etc.)

## How It Works

1. User drags and drops audio files (no typing needed!)
2. Backend reads the first file's metadata tags:
   - Tries `albumartist` tag (best for compilations)
   - Falls back to `artist` tag
   - Reads `album` tag
3. If tags are missing/unreadable, user can still provide them manually as fallback
4. Response includes `detected_metadata` showing what was detected and the source

## Implementation

### Backend Changes
- Added `mutagen` library for reading audio metadata
- Made `artist` and `album` optional parameters
- New function: `extract_metadata_from_file()` - reads tags from any audio format
- Validates files have tags OR manual input before processing

### API Changes

**Old Request:**
```bash
curl -F "files=@song.mp3" \
     -F "artist=Pink Floyd" \  # Required
     -F "album=Dark Side" \     # Required
     -F "vpn_ip=100.64.0.2"
```

**New Request:**
```bash
curl -F "files=@song.mp3" \
     -F "vpn_ip=100.64.0.2"  # Only this is required!
     # artist/album auto-detected from tags
```

**New Response:**
```json
{
  "success": true,
  "message": "Album 'Dark Side of the Moon' by Pink Floyd uploaded successfully",
  "task_id": "...",
  "files_processed": 10,
  "album_path": "/music/complete/Pink Floyd/Dark Side of the Moon",
  "detected_metadata": {
    "artist": "Pink Floyd",
    "album": "Dark Side of the Moon",
    "source": "tags"  // or "user_provided"
  }
}
```

## Frontend Impact

### Before
```typescript
// Had to collect this from user
formData.append('artist', userTypedArtist);  // ❌ Manual input
formData.append('album', userTypedAlbum);    // ❌ Manual input
```

### After
```typescript
// Just upload files!
formData.append('vpn_ip', vpnIp);
// artist/album auto-detected ✅
```

### Optional Override
```typescript
// User can still override if tags are wrong
if (userWantsToOverride) {
  formData.append('artist', customArtist);
  formData.append('album', customAlbum);
}
```

## Supported Tag Formats

Mutagen supports virtually all audio formats:
- **MP3:** ID3v2 tags (TPE1, TPE2, TALB)
- **FLAC:** Vorbis comments
- **M4A/AAC:** iTunes-style atoms
- **OGG:** Vorbis comments
- **WMA:** ASF tags
- **WAV:** ID3 or INFO chunks

## Error Handling

**Case 1: No tags + no manual input**
```
400 Bad Request
"Could not determine artist and album. 
Please ensure your files have proper ID3 tags or provide manually."
```

**Case 2: Tags found**
```
200 OK
{ "detected_metadata": { "source": "tags", ... } }
```

**Case 3: User provided**
```
200 OK
{ "detected_metadata": { "source": "user_provided", ... } }
```

## Testing

1. **Install mutagen:**
   ```bash
   pip install mutagen
   ```

2. **Test with real MP3:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/uploads/upload \
     -F "files=@/path/to/album/track1.mp3" \
     -F "files=@/path/to/album/track2.mp3" \
     -F "vpn_ip=100.64.0.2"
   ```

3. **Open HTML test page:**
   ```bash
   open docs/upload_test.html
   # Drag real MP3 files with tags - no typing needed!
   ```

## Migration Notes

**Existing API clients:** Still work! You can keep sending artist/album manually.

**New clients:** Can skip artist/album fields entirely.

**Best practice:** Let users drag files, show detected metadata for confirmation, allow editing before upload.

## The Truth

This is how it SHOULD have been from the start. Making users type what's already in the file metadata was lazy design.

**But you're still missing:**
- Showing detected metadata to user BEFORE upload for confirmation
- Handling multi-disc albums (disc number in tags)
- Handling various artists compilations properly
- Album art extraction and preview
- Track listing preview with durations

These should be in your frontend. Extract metadata on the client-side BEFORE uploading (use `jsmediatags` or similar), show it to the user, let them confirm/edit, THEN upload.

Right now you're doing blind uploads and hoping the tags are correct. That's better than manual typing, but still not great UX.
