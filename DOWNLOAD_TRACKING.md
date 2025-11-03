# Download Request Tracking

This document describes the download request tracking system that monitors which users requested which album downloads via the Headscale VPN.

## Database Schema

### `download_requests` Table

The main table for tracking download requests.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `task_id` | TEXT | Unique task identifier (UUID) |
| `artist` | TEXT | Artist name |
| `album` | TEXT | Album name |
| `username` | TEXT | Username from Headscale VPN (extracted from headers) |
| `vpn_ip` | TEXT | VPN IP address of the requester |
| `status` | TEXT | Download status (see Status Values below) |
| `timestamp` | TIMESTAMP | When the request was made |
| `slskd_username` | TEXT | Username on SLSKD who shared the album |
| `file_count` | INTEGER | Number of files in the album |
| `completed_files` | INTEGER | Number of completed files |
| `total_size` | INTEGER | Total size in bytes |
| `album_directory` | TEXT | Directory where album files are stored (after beet processing) |
| `completed_at` | TIMESTAMP | When the download was completed |

#### Status Values

- `pending`: Request created, download not yet started
- `downloading`: Currently downloading from SLSKD
- `enqueued`: Files enqueued in SLSKD for download
- `completed`: Download completed successfully
- `failed`: Download failed
- `no_results`: No search results found
- `no_match`: No suitable album match found
- `connection_error`: SLSKD connection error
- `timeout`: Search timed out
- `error`: Generic error

#### Indexes

- `idx_download_requests_username` on `username`
- `idx_download_requests_vpn_ip` on `vpn_ip`
- `idx_download_requests_status` on `status`
- `idx_download_requests_timestamp` on `timestamp`

## API Endpoints

### Download with Tracking

**POST** `/api/v1/downloads/download`

Initiates a download and creates a tracking record.

**Request Headers** (automatically captured):
- `X-Headscale-User` or `X-User`: Username from Headscale VPN
- `X-Forwarded-For` or `X-Real-IP`: VPN IP address

**Request Body**:
```json
{
  "artist": "Artist Name",
  "album": "Album Name"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Download started for Artist Name - Album Name",
  "task_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Get Download History

**GET** `/api/v1/downloads/history?limit=100&offset=0`

Returns all download requests with pagination.

**Query Parameters**:
- `limit` (optional, default: 100): Maximum number of results
- `offset` (optional, default: 0): Offset for pagination

**Response**:
```json
{
  "count": 150,
  "requests": [
    {
      "id": 1,
      "task_id": "550e8400-e29b-41d4-a716-446655440000",
      "artist": "Artist Name",
      "album": "Album Name",
      "username": "user@headscale",
      "vpn_ip": "100.64.0.5",
      "status": "completed",
      "timestamp": "2025-11-03T12:00:00",
      "slskd_username": "shareuser123",
      "file_count": 12,
      "completed_files": 12,
      "total_size": 104857600,
      "album_directory": "/music/Artist Name/Album Name",
      "completed_at": "2025-11-03T12:15:00"
    }
  ]
}
```

### Get User Download History

**GET** `/api/v1/downloads/history/user/{username}?limit=100&offset=0`

Returns download requests for a specific user.

**Path Parameters**:
- `username`: Username to filter by

**Query Parameters**:
- `limit` (optional, default: 100): Maximum number of results
- `offset` (optional, default: 0): Offset for pagination

**Response**: Same as `/history` endpoint

### Get IP Download History

**GET** `/api/v1/downloads/history/ip/{vpn_ip}?limit=100&offset=0`

Returns download requests from a specific VPN IP address.

**Path Parameters**:
- `vpn_ip`: VPN IP address to filter by

**Query Parameters**:
- `limit` (optional, default: 100): Maximum number of results
- `offset` (optional, default: 0): Offset for pagination

**Response**: Same as `/history` endpoint

### Get Download Request Details

**GET** `/api/v1/downloads/request/{task_id}`

Returns details for a specific download request.

**Path Parameters**:
- `task_id`: Task ID of the download request

**Response**:
```json
{
  "id": 1,
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "artist": "Artist Name",
  "album": "Album Name",
  "username": "user@headscale",
  "vpn_ip": "100.64.0.5",
  "status": "completed",
  "timestamp": "2025-11-03T12:00:00",
  "slskd_username": "shareuser123",
  "file_count": 12,
  "completed_files": 12,
  "total_size": 104857600,
  "album_directory": "/music/Artist Name/Album Name",
  "completed_at": "2025-11-03T12:15:00"
}
```

## User Identification via Headscale VPN

The system extracts user information from HTTP headers set by the Headscale VPN:

1. **Username**: Extracted from `X-Headscale-User` or `X-User` header
2. **VPN IP**: Extracted from `X-Forwarded-For` or `X-Real-IP` header

If these headers are not present, the system falls back to the client IP address.

## Docker Configuration

The SQLite database is persisted via a Docker volume:

```yaml
volumes:
  - ./data:/app/data
environment:
  - DATABASE_URL=sqlite:////app/data/noiseport.db
```

This ensures the database persists across container restarts.

## Future Enhancements

Potential future enhancements to the tracking system:

1. **Beet Integration**: Update `album_directory` when beet finishes processing
2. **Download Progress**: Track real-time download progress
3. **Statistics Dashboard**: Aggregate statistics by user, time period, etc.
4. **Export Functionality**: Export download history to CSV/JSON
5. **Webhooks**: Notify external services when downloads complete
