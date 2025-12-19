"""Test script for album upload endpoint."""

import io
import requests
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:8000/api/v1"
UPLOAD_ENDPOINT = f"{API_BASE_URL}/uploads/upload"


def create_fake_audio_file(filename: str, size_kb: int = 100) -> io.BytesIO:
    """Create a fake audio file for testing."""
    # Create fake MP3 data (just random bytes with MP3 header)
    mp3_header = b"\xff\xfb"  # MP3 sync word
    fake_data = mp3_header + b"\x00" * (size_kb * 1024 - len(mp3_header))

    file_obj = io.BytesIO(fake_data)
    file_obj.name = filename
    return file_obj


def test_upload_album():
    """Test uploading an album."""

    # Create test files with fake MP3 headers
    files = [
        (
            "files",
            (
                "01 - Test Song 1.mp3",
                create_fake_audio_file("01 - Test Song 1.mp3"),
                "audio/mpeg",
            ),
        ),
        (
            "files",
            (
                "02 - Test Song 2.mp3",
                create_fake_audio_file("02 - Test Song 2.mp3"),
                "audio/mpeg",
            ),
        ),
        (
            "files",
            (
                "03 - Test Song 3.mp3",
                create_fake_audio_file("03 - Test Song 3.mp3"),
                "audio/mpeg",
            ),
        ),
    ]

    # Form data - artist and album are now optional (extracted from tags)
    data = {
        "vpn_ip": "100.64.0.2",
        "username": "test_user",
        # Note: In real use, artist/album would be extracted from file tags
        # For this test, we'll provide them since our fake files don't have real tags
        "artist": "Test Artist",
        "album": "Test Album",
    }

    print("📤 Uploading test album...")
    print(f"   VPN IP: {data['vpn_ip']}")
    print(f"   Files: {len(files)}")
    print(f"   Note: In production, artist/album would be auto-detected from file tags")

    try:
        response = requests.post(
            UPLOAD_ENDPOINT,
            files=files,
            data=data,
            timeout=120,  # 2 minute timeout for beets processing
        )

        print(f"\n📥 Response Status: {response.status_code}")
        print(f"   Response Body: {response.json()}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ Upload successful!")
            print(f"   Task ID: {result.get('task_id')}")
            print(f"   Files Processed: {result.get('files_processed')}")
            print(f"   Album Path: {result.get('album_path')}")
        else:
            print(f"\n❌ Upload failed: {response.text}")

    except requests.exceptions.ConnectionError:
        print("\n❌ Connection failed. Is the server running?")
        print("   Start server with: python -m app.main")
    except Exception as e:
        print(f"\n❌ Error: {e}")


def test_invalid_file_type():
    """Test uploading invalid file type."""
    files = [
        ("files", ("test.txt", io.BytesIO(b"not an audio file"), "text/plain")),
    ]

    data = {
        "artist": "Test Artist",
        "album": "Test Album",
        "vpn_ip": "100.64.0.2",
    }

    print("\n🧪 Testing invalid file type...")

    try:
        response = requests.post(UPLOAD_ENDPOINT, files=files, data=data)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")

        if response.status_code == 400:
            print("   ✅ Correctly rejected invalid file type")
        else:
            print("   ❌ Should have rejected invalid file type")
    except Exception as e:
        print(f"   ❌ Error: {e}")


def test_missing_metadata():
    """Test uploading without required metadata (should fail if tags also missing)."""
    files = [
        ("files", ("test.mp3", create_fake_audio_file("test.mp3"), "audio/mpeg")),
    ]

    # Only VPN IP, no artist/album (and fake file has no tags)
    data = {"vpn_ip": "100.64.0.2"}

    print("\n🧪 Testing missing metadata (no tags, no manual input)...")

    try:
        response = requests.post(UPLOAD_ENDPOINT, files=files, data=data)
        print(f"   Status: {response.status_code}")

        if response.status_code == 400:
            print("   ✅ Correctly rejected (no tags and no manual metadata)")
        else:
            print("   ❌ Should have rejected missing metadata")
    except Exception as e:
        print(f"   ❌ Error: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("Album Upload Endpoint Tests")
    print("=" * 60)

    test_upload_album()
    test_invalid_file_type()
    test_missing_metadata()

    print("\n" + "=" * 60)
    print("Tests completed")
    print("=" * 60)
