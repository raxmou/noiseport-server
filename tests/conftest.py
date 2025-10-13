"""Test configuration and fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.core import app


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def sample_download_request():
    """Sample download request data."""
    return {"artist": "Test Artist", "album": "Test Album"}


@pytest.fixture
def sample_file_info():
    """Sample file info data."""
    return {
        "filename": "test_song.mp3",
        "size": 5000000,
        "bit_rate": 320,
        "extension": "mp3",
    }
