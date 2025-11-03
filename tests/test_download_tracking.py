"""Tests for download request tracking functionality."""

import os
import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from app.database import connection
from app.database.connection import get_db, init_db
from app.database.models import DownloadRequest
from app.services.download_request_service import DownloadRequestService


@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch):
    """Set up a temporary test database for each test."""
    # Create a temporary database file
    temp_db_fd, temp_db_path = tempfile.mkstemp(suffix=".db")
    os.close(temp_db_fd)

    # Monkey patch DB_PATH
    monkeypatch.setattr("app.database.connection.DB_PATH", Path(temp_db_path))

    # Initialize the database
    init_db()

    yield

    # Clean up
    if os.path.exists(temp_db_path):
        os.unlink(temp_db_path)


@pytest.mark.unit
def test_database_initialization():
    """Test that database initializes correctly."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Check if the table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='download_requests'"
        )
        table = cursor.fetchone()
        assert table is not None

        # Check if indexes exist
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_download_requests_%'"
        )
        indexes = cursor.fetchall()
        assert len(indexes) >= 4  # Should have at least 4 indexes


@pytest.mark.unit
def test_create_download_request():
    """Test creating a download request."""
    request = DownloadRequestService.create_request(
        task_id="test-task-123",
        artist="Test Artist",
        album="Test Album",
        username="testuser",
        vpn_ip="100.64.0.1",
    )

    assert request.id is not None
    assert request.task_id == "test-task-123"
    assert request.artist == "Test Artist"
    assert request.album == "Test Album"
    assert request.username == "testuser"
    assert request.vpn_ip == "100.64.0.1"
    assert request.status == "pending"
    assert request.timestamp is not None


@pytest.mark.unit
def test_get_request_by_task_id():
    """Test retrieving a request by task ID."""
    # Create a request
    created = DownloadRequestService.create_request(
        task_id="test-task-456",
        artist="Artist 2",
        album="Album 2",
        username="user2",
        vpn_ip="100.64.0.2",
    )

    # Retrieve it
    retrieved = DownloadRequestService.get_request_by_task_id("test-task-456")

    assert retrieved is not None
    assert retrieved.task_id == created.task_id
    assert retrieved.artist == created.artist
    assert retrieved.album == created.album


@pytest.mark.unit
def test_update_request_status():
    """Test updating request status."""
    # Create a request
    DownloadRequestService.create_request(
        task_id="test-task-789",
        artist="Artist 3",
        album="Album 3",
        username="user3",
        vpn_ip="100.64.0.3",
    )

    # Update status
    success = DownloadRequestService.update_request_status(
        task_id="test-task-789",
        status="downloading",
        slskd_username="sharer123",
        file_count=12,
        total_size=1024000,
    )

    assert success is True

    # Verify update
    request = DownloadRequestService.get_request_by_task_id("test-task-789")
    assert request.status == "downloading"
    assert request.slskd_username == "sharer123"
    assert request.file_count == 12
    assert request.total_size == 1024000


@pytest.mark.unit
def test_complete_request():
    """Test completing a request."""
    # Create a request
    DownloadRequestService.create_request(
        task_id="test-task-complete",
        artist="Artist 4",
        album="Album 4",
        username="user4",
        vpn_ip="100.64.0.4",
    )

    # Complete it
    success = DownloadRequestService.complete_request(
        task_id="test-task-complete",
        album_directory="/music/Artist 4/Album 4",
        completed_files=10,
    )

    assert success is True

    # Verify completion
    request = DownloadRequestService.get_request_by_task_id("test-task-complete")
    assert request.status == "completed"
    assert request.album_directory == "/music/Artist 4/Album 4"
    assert request.completed_files == 10
    assert request.completed_at is not None


@pytest.mark.unit
def test_get_all_requests():
    """Test retrieving all requests with pagination."""
    # Create multiple requests
    for i in range(5):
        DownloadRequestService.create_request(
            task_id=f"task-{i}",
            artist=f"Artist {i}",
            album=f"Album {i}",
            username=f"user{i}",
            vpn_ip=f"100.64.0.{i}",
        )

    # Get all requests
    requests = DownloadRequestService.get_all_requests(limit=10)
    assert len(requests) == 5

    # Test pagination
    page1 = DownloadRequestService.get_all_requests(limit=2, offset=0)
    assert len(page1) == 2

    page2 = DownloadRequestService.get_all_requests(limit=2, offset=2)
    assert len(page2) == 2


@pytest.mark.unit
def test_get_requests_by_user():
    """Test retrieving requests by username."""
    # Create requests for different users
    DownloadRequestService.create_request(
        task_id="task-user1-1",
        artist="Artist 1",
        album="Album 1",
        username="alice",
        vpn_ip="100.64.0.10",
    )

    DownloadRequestService.create_request(
        task_id="task-user1-2",
        artist="Artist 2",
        album="Album 2",
        username="alice",
        vpn_ip="100.64.0.10",
    )

    DownloadRequestService.create_request(
        task_id="task-user2-1",
        artist="Artist 3",
        album="Album 3",
        username="bob",
        vpn_ip="100.64.0.11",
    )

    # Get requests for alice
    alice_requests = DownloadRequestService.get_requests_by_user("alice")
    assert len(alice_requests) == 2
    assert all(req.username == "alice" for req in alice_requests)

    # Get requests for bob
    bob_requests = DownloadRequestService.get_requests_by_user("bob")
    assert len(bob_requests) == 1
    assert bob_requests[0].username == "bob"


@pytest.mark.unit
def test_get_requests_by_vpn_ip():
    """Test retrieving requests by VPN IP."""
    # Create requests from different IPs
    DownloadRequestService.create_request(
        task_id="task-ip1-1",
        artist="Artist 1",
        album="Album 1",
        username="user1",
        vpn_ip="100.64.0.20",
    )

    DownloadRequestService.create_request(
        task_id="task-ip1-2",
        artist="Artist 2",
        album="Album 2",
        username="user2",
        vpn_ip="100.64.0.20",
    )

    DownloadRequestService.create_request(
        task_id="task-ip2-1",
        artist="Artist 3",
        album="Album 3",
        username="user3",
        vpn_ip="100.64.0.21",
    )

    # Get requests from first IP
    ip1_requests = DownloadRequestService.get_requests_by_vpn_ip("100.64.0.20")
    assert len(ip1_requests) == 2
    assert all(req.vpn_ip == "100.64.0.20" for req in ip1_requests)

    # Get requests from second IP
    ip2_requests = DownloadRequestService.get_requests_by_vpn_ip("100.64.0.21")
    assert len(ip2_requests) == 1
    assert ip2_requests[0].vpn_ip == "100.64.0.21"


@pytest.mark.unit
def test_get_request_count():
    """Test getting total request count."""
    # Initially should be 0
    count = DownloadRequestService.get_request_count()
    assert count == 0

    # Create some requests
    for i in range(3):
        DownloadRequestService.create_request(
            task_id=f"count-task-{i}",
            artist=f"Artist {i}",
            album=f"Album {i}",
            username=f"user{i}",
            vpn_ip=f"100.64.0.{i}",
        )

    # Count should be 3
    count = DownloadRequestService.get_request_count()
    assert count == 3


@pytest.mark.unit
def test_get_user_request_count():
    """Test getting request count for a specific user."""
    # Create requests for different users
    for i in range(3):
        DownloadRequestService.create_request(
            task_id=f"alice-task-{i}",
            artist=f"Artist {i}",
            album=f"Album {i}",
            username="alice",
            vpn_ip=f"100.64.0.{i}",
        )

    DownloadRequestService.create_request(
        task_id="bob-task-1",
        artist="Artist X",
        album="Album X",
        username="bob",
        vpn_ip="100.64.0.99",
    )

    # Check counts
    alice_count = DownloadRequestService.get_user_request_count("alice")
    assert alice_count == 3

    bob_count = DownloadRequestService.get_user_request_count("bob")
    assert bob_count == 1

    charlie_count = DownloadRequestService.get_user_request_count("charlie")
    assert charlie_count == 0


@pytest.mark.unit
def test_download_request_model_to_dict():
    """Test converting DownloadRequest model to dictionary."""
    timestamp = datetime(2025, 11, 3, 12, 0, 0)
    completed_at = datetime(2025, 11, 3, 12, 15, 0)

    request = DownloadRequest(
        id=1,
        task_id="test-123",
        artist="Test Artist",
        album="Test Album",
        username="testuser",
        vpn_ip="100.64.0.1",
        status="completed",
        timestamp=timestamp,
        slskd_username="sharer",
        file_count=10,
        completed_files=10,
        total_size=1024000,
        album_directory="/music/Test Artist/Test Album",
        completed_at=completed_at,
    )

    data = request.to_dict()

    assert data["id"] == 1
    assert data["task_id"] == "test-123"
    assert data["artist"] == "Test Artist"
    assert data["album"] == "Test Album"
    assert data["username"] == "testuser"
    assert data["vpn_ip"] == "100.64.0.1"
    assert data["status"] == "completed"
    assert data["timestamp"] == timestamp.isoformat()
    assert data["slskd_username"] == "sharer"
    assert data["file_count"] == 10
    assert data["completed_files"] == 10
    assert data["total_size"] == 1024000
    assert data["album_directory"] == "/music/Test Artist/Test Album"
    assert data["completed_at"] == completed_at.isoformat()
