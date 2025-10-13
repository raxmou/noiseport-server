"""Unit tests for models and schemas."""

import pytest
from pydantic import ValidationError

from app.models.schemas import DownloadRequest, FileInfo, HealthResponse


@pytest.mark.unit
def test_download_request_validation():
    """Test download request validation."""
    # Valid request
    request = DownloadRequest(artist="Test Artist", album="Test Album")
    assert request.artist == "Test Artist"
    assert request.album == "Test Album"

    # Test trimming whitespace
    request = DownloadRequest(artist="  Test Artist  ", album="  Test Album  ")
    assert request.artist == "Test Artist"
    assert request.album == "Test Album"

    # Test empty strings
    with pytest.raises(ValidationError):
        DownloadRequest(artist="", album="Test Album")

    with pytest.raises(ValidationError):
        DownloadRequest(artist="Test Artist", album="")

    # Test whitespace only
    with pytest.raises(ValidationError):
        DownloadRequest(artist="   ", album="Test Album")

    # Test missing fields
    with pytest.raises(ValidationError):
        DownloadRequest(artist="Test Artist")


@pytest.mark.unit
def test_file_info_model():
    """Test FileInfo model."""
    # Valid file info with API field names
    file_info = FileInfo(
        filename="test.mp3",
        size=5000000,
        bitRate=320,  # Use API field name
        extension="mp3",
    )
    assert file_info.filename == "test.mp3"
    assert file_info.size == 5000000
    assert file_info.bit_rate == 320  # Access via Python field name
    assert file_info.extension == "mp3"

    # Test with minimal data
    file_info = FileInfo(filename="test.mp3")
    assert file_info.filename == "test.mp3"
    assert file_info.size is None

    # Test negative size (should fail)
    with pytest.raises(ValidationError):
        FileInfo(filename="test.mp3", size=-1)


@pytest.mark.unit
def test_health_response_model():
    """Test HealthResponse model."""
    health = HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp="2023-01-01T00:00:00",
        uptime=3600.0,
    )
    assert health.status == "healthy"
    assert health.version == "1.0.0"
    assert health.uptime == 3600.0
