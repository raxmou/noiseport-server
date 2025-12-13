# Album Upload Frontend Implementation Guide

## API Endpoint

**URL:** `POST /api/v1/uploads/upload`

**Content-Type:** `multipart/form-data`

## Request Parameters

### Form Fields (required)
- `vpn_ip` (string): VPN IP address for tagging the album

### Form Fields (optional - auto-detected from audio tags)
- `artist` (string, optional): Artist name - **automatically extracted from file tags if not provided**
- `album` (string, optional): Album name - **automatically extracted from file tags if not provided**
- `username` (string, optional): Username (derived from VPN IP if not provided)

### Files (required)
- `files`: Array of audio files (multiple files allowed)

### Metadata Auto-Detection
The endpoint will automatically read ID3 tags (or equivalent) from the first uploaded file to extract:
- `artist` or `albumartist` tag
- `album` tag

If tags are missing or unreadable, you can provide `artist` and `album` manually as fallback.

### Constraints
- **Max file size:** 500MB per file
- **Max total upload:** 2GB per album
- **Allowed formats:** `.mp3`, `.flac`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.wav`, `.wma`, `.alac`

## Response Format

### Success (200)
```json
{
  "success": true,
  "message": "Album 'Dark Side of the Moon' by Pink Floyd uploaded and imported successfully",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "files_processed": 12,
  "album_path": "/music/complete/Pink Floyd/Dark Side of the Moon",
  "detected_metadata": {
    "artist": "Pink Floyd",
    "album": "Dark Side of the Moon",
    "source": "tags"  // or "user_provided" if manually specified
  }
}
```

### Error (400/413/500/504)
```json
{
  "detail": "Error message here"
}
```

## Frontend Implementation

### React/TypeScript Example

```typescript
// types.ts
interface UploadAlbumRequest {
  files: File[];
  vpnIp: string;
  artist?: string;  // Optional - auto-detected from tags
  album?: string;   // Optional - auto-detected from tags
  username?: string;
}

interface AlbumMetadata {
  artist: string;
  album: string;
  source: 'tags' | 'user_provided';
}

interface UploadAlbumResponse {
  success: boolean;
  message: string;
  task_id: string;
  files_processed: number;
  album_path: string | null;
  detected_metadata: AlbumMetadata | null;
}

// api.ts
async function uploadAlbum(request: UploadAlbumRequest): Promise<UploadAlbumResponse> {
  const formData = new FormData();
  
  // Add files
  request.files.forEach(file => {
    formData.append('files', file);
  });
  
  // Add required metadata
  formData.append('vpn_ip', request.vpnIp);
  
  // Add optional metadata (only if provided - otherwise auto-detect from tags)
  if (request.artist) {
    formData.append('artist', request.artist);
  }
  if (request.album) {
    formData.append('album', request.album);
  }
  if (request.username) {
    formData.append('username', request.username);
  }
  
  const response = await fetch('http://localhost:8000/api/v1/uploads/upload', {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header - browser will set it with boundary
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Upload failed');
  }
  
  return response.json();
}

// Component example with drag & drop
import { useCallback, useState } from 'react';

function AlbumUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    // Filter audio files only
    const audioFiles = droppedFiles.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['mp3', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wav', 'wma', 'alac'].includes(ext || '');
    });
    
    setFiles(audioFiles);
    
    // Try to extract artist/album from folder structure or filenames
    // Example: "Artist - Album/01 - Song.mp3"
    if (audioFiles.length > 0) {
      const firstFile = audioFiles[0];
      // You might use webkitRelativePath if available
      const path = (firstFile as any).webkitRelativePath || firstFile.name;
      const match = path.match(/(.+?)\s*-\s*(.+?)\//);
      if (match) {
        setArtist(match[1].trim());
        setAlbum(match[2].trim());
      }
    }
  }, []);
  
  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select files to upload');
      return;
    }
    
    setUploading(true);
    setProgress(0);
    
    try {
      // Create progress tracking with XMLHttpRequest
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(percentComplete);
        }
      });
      
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('vpn_ip', '100.64.0.2'); // Get from your app context
      
      // Only add artist/album if user manually provided them
      // Otherwise, they will be auto-detected from file tags
      if (artist) formData.append('artist', artist);
      if (album) formData.append('album', album);
      
      await new Promise<void>((resolve, reject) => {
        xhr.open('POST', 'http://localhost:8000/api/v1/uploads/upload');
        
        xhr.onload = () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            console.log('Upload successful:', result);
            const meta = result.detected_metadata;
            alert(
              `Album uploaded successfully!\n` +
              `Artist: ${meta.artist} (${meta.source})\n` +
              `Album: ${meta.album}\n` +
              `Files: ${result.files_processed}`
            );
            resolve();
          } else {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.detail || 'Upload failed'));
          }
        };
        
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });
      
      // Reset form
      setFiles([]);
      setArtist('');
      setAlbum('');
      setProgress(0);
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="album-uploader">
      <div 
        className="dropzone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          border: '2px dashed #ccc',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer'
        }}
      >
        {files.length === 0 ? (
          <p>Drag and drop album files here</p>
        ) : (
          <p>{files.length} files selected</p>
        )}
      </div>
      
      <div className="metadata-form" style={{ marginTop: '20px' }}>
        <input
          type="text"
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          disabled={uploading}
        />
        <input
          type="text"
          placeholder="Album"
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
          disabled={uploading}
        />
      </div>
      
      <button 
        onClick={handleUpload}
        disabled={uploading || files.length === 0}
        style={{ marginTop: '20px' }}
      >
        {uploading ? `Uploading... ${progress.toFixed(0)}%` : 'Upload Album'}
      </button>
      
      {uploading && (
        <div className="progress-bar" style={{ marginTop: '10px' }}>
          <div style={{
            width: `${progress}%`,
            height: '20px',
            backgroundColor: '#4CAF50',
            transition: 'width 0.3s'
          }} />
        </div>
      )}
    </div>
  );
}

export default AlbumUploader;
```

### Vanilla JavaScript Example

```javascript
// Simple drag and drop uploader
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const uploadBtn = document.getElementById('uploadBtn');

let selectedFiles = [];

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  
  selectedFiles = Array.from(e.dataTransfer.files);
  fileList.innerHTML = `${selectedFiles.length} files selected`;
});

uploadBtn.addEventListener('click', async () => {
  const artist = document.getElementById('artist').value;
  const album = document.getElementById('album').value;
  const vpnIp = '100.64.0.2'; // Get from your app
  
  if (selectedFiles.length === 0) {
    alert('Please select files');
    return;
  }
  
  const formData = new FormData();
  selectedFiles.forEach(file => formData.append('files', file));
  formData.append('vpn_ip', vpnIp);
  
  // Only add if user provided (otherwise auto-detect from tags)
  if (artist) formData.append('artist', artist);
  if (album) formData.append('album', album);
  
  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    
    const response = await fetch('http://localhost:8000/api/v1/uploads/upload', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      alert(`Success! Files processed: ${result.files_processed}`);
    } else {
      const error = await response.json();
      alert(`Error: ${error.detail}`);
    }
  } catch (error) {
    alert(`Upload failed: ${error.message}`);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload';
  }
});
```

## Critical Implementation Notes

### 1. **File Validation on Client-Side**
Always validate files BEFORE uploading to save bandwidth and time:

```typescript
function validateFiles(files: File[]): { valid: boolean; error?: string } {
  const allowedExtensions = ['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.wma', '.alac'];
  const maxFileSize = 500 * 1024 * 1024; // 500MB
  const maxTotalSize = 2 * 1024 * 1024 * 1024; // 2GB
  
  let totalSize = 0;
  
  for (const file of files) {
    // Check extension
    const ext = '.' + file.name.toLowerCase().split('.').pop();
    if (!allowedExtensions.includes(ext)) {
      return { valid: false, error: `Invalid file type: ${file.name}` };
    }
    
    // Check individual file size
    if (file.size > maxFileSize) {
      return { valid: false, error: `File too large: ${file.name}` };
    }
    
    totalSize += file.size;
  }
  
  // Check total size
  if (totalSize > maxTotalSize) {
    return { valid: false, error: 'Total upload size exceeds 2GB' };
  }
  
  return { valid: true };
}
```

### 2. **Progress Tracking**
The upload can take minutes. Use XMLHttpRequest for progress tracking:

```typescript
function uploadWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        onProgress(percent);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText));
      }
    });
    
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')));
    
    xhr.timeout = 300000; // 5 minute timeout
    xhr.open('POST', 'http://localhost:8000/api/v1/uploads/upload');
    xhr.send(formData);
  });
}
```

### 3. **Error Handling**
Handle all error cases explicitly:

```typescript
try {
  const result = await uploadAlbum(request);
  // Success
} catch (error) {
  if (error.message.includes('timeout')) {
    // Show retry option
  } else if (error.message.includes('413')) {
    // Files too large
  } else if (error.message.includes('400')) {
    // Validation error
  } else if (error.message.includes('500')) {
    // Server error - might be beets import failure
  }
}
```

### 4. **Folder Structure Detection**
If user drags a folder, you can preserve the structure:

```html
<input type="file" webkitdirectory directory multiple />
```

```typescript
// Extract artist/album from folder structure
function extractMetadataFromPath(file: File): { artist?: string; album?: string } {
  const path = (file as any).webkitRelativePath || '';
  // Pattern: "Artist - Album/track.mp3" or "Artist/Album/track.mp3"
  
  const match1 = path.match(/^(.+?)\s*-\s*(.+?)\//);
  if (match1) {
    return { artist: match1[1].trim(), album: match1[2].trim() };
  }
  
  const match2 = path.match(/^(.+?)\/(.+?)\//);
  if (match2) {
    return { artist: match2[1].trim(), album: match2[2].trim() };
  }
  
  return {};
}
```

## Testing

1. **Start the server:**
   ```bash
   python -m app.main
   ```

2. **Run test script:**
   ```bash
   python tests/test_upload_endpoint.py
   ```

3. **Manual testing with curl:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/uploads/upload \
     -F "files=@/path/to/song1.mp3" \
     -F "files=@/path/to/song2.mp3" \
     -F "artist=Test Artist" \
     -F "album=Test Album" \
     -F "vpn_ip=100.64.0.2"
   ```

## What You're Still Ignoring

1. **User feedback during beets import** - The import can take 30-60 seconds. Your frontend will appear frozen. You need websockets or polling to show "Importing... please wait"

2. **Retry logic** - What if the network drops mid-upload? You're losing 1GB of data with no way to resume.

3. **Concurrent uploads** - What if user uploads 2 albums at once? Your backend isn't handling queue management.

4. **Beets import failures** - When beets can't match the album, it fails silently. User has no idea what happened.

5. **Storage limits** - You're accepting 2GB uploads with no check if you have disk space.

6. **Authentication** - Anyone can spam your endpoint. No rate limiting. No auth.

7. **Album already exists** - What if they upload the same album twice? Duplicate detection?

Now go build the frontend. And fix those blind spots before you ship this to real users.
