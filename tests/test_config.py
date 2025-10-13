"""Unit tests for configuration."""

import pytest
from pydantic import ValidationError

from config import Settings


@pytest.mark.unit
def test_settings_default_values():
    """Test default settings values."""
    settings = Settings()
    assert settings.app_name == "Downloader API"
    assert settings.port == 8000
    assert settings.environment == "development"
    assert settings.debug is False
    assert settings.log_level == "INFO"


@pytest.mark.unit
def test_settings_validation():
    """Test settings validation."""
    # Test invalid log level
    with pytest.raises(ValidationError):
        Settings(log_level="INVALID")

    # Test invalid environment
    with pytest.raises(ValidationError):
        Settings(environment="invalid")

    # Test invalid port
    with pytest.raises(ValidationError):
        Settings(port=70000)

    # Test valid values
    settings = Settings(
        log_level="DEBUG",
        environment="production",
        port=8080,
    )
    assert settings.log_level == "DEBUG"
    assert settings.environment == "production"
    assert settings.port == 8080


@pytest.mark.unit
def test_settings_properties():
    """Test settings properties."""
    dev_settings = Settings(environment="development")
    assert dev_settings.is_development is True
    assert dev_settings.is_production is False

    prod_settings = Settings(environment="production")
    assert prod_settings.is_development is False
    assert prod_settings.is_production is True
