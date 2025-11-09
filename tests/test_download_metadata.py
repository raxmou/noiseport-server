"""Tests for download metadata file creation."""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from app.api.downloads import create_download_metadata


@pytest.mark.unit
def test_create_download_metadata():
    """Test creating download metadata file."""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Mock settings to use temp directory
        with patch("app.api.downloads.settings") as mock_settings:
            mock_settings.host_music_path = temp_dir

            # Create metadata
            create_download_metadata(
                artist="Pink Floyd",
                album="The Wall",
                slskd_username="testuser",
                vpn_username="alice@headscale.local",
                vpn_ip="100.64.0.50",
                task_id="test-task-123",
            )

            # Check that the file was created
            expected_path = (
                Path(temp_dir)
                / "downloads"
                / "testuser"
                / "Pink Floyd"
                / "The Wall"
                / ".noiseport_metadata.json"
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
def test_create_download_metadata_sanitizes_filenames():
    """Test that artist/album names with special characters are sanitized."""
    with tempfile.TemporaryDirectory() as temp_dir:
        with patch("app.api.downloads.settings") as mock_settings:
            mock_settings.host_music_path = temp_dir

            # Create metadata with special characters
            create_download_metadata(
                artist="AC/DC",
                album="Back in Black: Deluxe",
                slskd_username="testuser",
                vpn_username="bob@headscale.local",
                vpn_ip="100.64.0.51",
                task_id="test-task-456",
            )

            # Check that directory was created with sanitized names
            download_dir = (
                Path(temp_dir)
                / "downloads"
                / "testuser"
                / "AC_DC"
                / "Back in Black_ Deluxe"
            )

            metadata_file = download_dir / ".noiseport_metadata.json"
            assert metadata_file.exists()

            # Check that original names are preserved in metadata
            with open(metadata_file) as f:
                metadata = json.load(f)

            assert metadata["artist"] == "AC/DC"
            assert metadata["album"] == "Back in Black: Deluxe"


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
            )

            # Verify error was logged
            mock_logger.error.assert_called_once()
            assert "Failed to create metadata file" in str(mock_logger.error.call_args)
