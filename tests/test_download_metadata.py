"""Tests for download metadata file creation."""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from app.api.downloads import create_download_metadata, sanitize_path_for_slskd


@pytest.mark.unit
def test_sanitize_path_for_slskd():
    """Test path sanitization to match slskd's behavior."""
    # Test parentheses replacement
    assert sanitize_path_for_slskd("album (2024)") == "album _2024_"
    assert (
        sanitize_path_for_slskd("Great Grandpa - Patience, Moonbeam (2025) - WEB")
        == "Great Grandpa - Patience, Moonbeam _2025_ - WEB"
    )
    
    # Test multiple parentheses
    assert (
        sanitize_path_for_slskd("Test (Deluxe Edition) (2024)")
        == "Test _Deluxe Edition_ _2024_"
    )
    
    # Test path without special characters
    assert sanitize_path_for_slskd("WeirdOs") == "WeirdOs"
    
    # Test with slashes (should not be changed)
    assert sanitize_path_for_slskd("artist/album (2024)") == "artist/album _2024_"


@pytest.mark.unit
def test_create_download_metadata():
    """Test creating download metadata file."""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Mock settings to use temp directory
        with patch("app.api.downloads.settings") as mock_settings:
            mock_settings.host_music_path = temp_dir

            # Create metadata with slskd_file_path
            create_download_metadata(
                artist="Pink Floyd",
                album="The Wall",
                slskd_username="testuser",
                vpn_username="alice@headscale.local",
                vpn_ip="100.64.0.50",
                task_id="test-task-123",
                slskd_file_path="testuser/Pink Floyd/The Wall/track01.mp3",
            )

            # Check that the file was created
            expected_path = (
                Path(temp_dir)
                / "downloads"
                / "The Wall"
                / "noiseport_metadata.json"
            )

            assert expected_path.exists()

            # Check file contents
            with open(expected_path) as f:
                metadata = json.load(f)

            assert metadata["vpn_username"] == "alice@headscale.local"
            assert metadata["vpn_ip"] == "100.64.0.50"
            assert metadata["task_id"] == "test-task-123"
            assert metadata["artist"] == "Pink Floyd"
            assert metadata["album"] == "The Wall"
            assert metadata["slskd_username"] == "testuser"


@pytest.mark.unit
def test_create_download_metadata_with_parentheses():
    """Test that folder names with parentheses are sanitized to match slskd behavior."""
    with tempfile.TemporaryDirectory() as temp_dir:
        with patch("app.api.downloads.settings") as mock_settings:
            mock_settings.host_music_path = temp_dir

            # Create metadata with parentheses in the path
            # Remote path has parentheses, but slskd will save with underscores
            create_download_metadata(
                artist="Great Grandpa",
                album="Patience, Moonbeam",
                slskd_username="testuser",
                vpn_username="bob@headscale.local",
                vpn_ip="100.64.0.51",
                task_id="test-task-456",
                slskd_file_path="testuser/Great Grandpa/Patience, Moonbeam (2025) - WEB/track01.flac",
            )

            # The folder should be sanitized (parentheses replaced with underscores)
            download_dir = (
                Path(temp_dir)
                / "downloads"
                / "Patience, Moonbeam _2025_ - WEB"
            )

            metadata_file = download_dir / "noiseport_metadata.json"
            assert metadata_file.exists()

            # Check that original names are preserved in metadata
            with open(metadata_file) as f:
                metadata = json.load(f)

            assert metadata["artist"] == "Great Grandpa"
            assert metadata["album"] == "Patience, Moonbeam"


@pytest.mark.unit
def test_create_download_metadata_handles_errors():
    """Test that metadata creation errors are logged but don't fail."""
    with patch("app.api.downloads.settings") as mock_settings:
        # Use invalid path to trigger error
        mock_settings.host_music_path = "/invalid/path/that/does/not/exist"

        # Mock logger to verify error is logged
        with patch("app.api.downloads.logger") as mock_logger:
            # Should not raise exception
            create_download_metadata(
                artist="Test Artist",
                album="Test Album",
                slskd_username="testuser",
                vpn_username="test@headscale.local",
                vpn_ip="100.64.0.1",
                task_id="test-task-789",
                slskd_file_path="testuser/Test Artist/Test Album/track.mp3",
            )

            # Verify error was logged
            mock_logger.error.assert_called_once()
            assert "Failed to create metadata file" in str(mock_logger.error.call_args)
