"""Unit tests for configuration."""

import pytest
from pydantic import ValidationError

from config import Settings
from app.models.config import WizardConfiguration, MusicPathsConfig


@pytest.mark.unit
def test_settings_default_values():
    """Test default settings values."""
    settings = Settings()
    assert settings.app_name == "Downloader API"
    assert settings.port == 8000
    assert settings.environment == "development"
    assert settings.debug is False
    assert settings.log_level == "INFO"
    assert settings.host_music_path == "./music"


@pytest.mark.unit
def test_music_paths_config():
    """Test new MusicPathsConfig with single hostMusicPath."""
    # Test default value
    config = MusicPathsConfig()
    assert config.hostMusicPath == "./music"
    
    # Test custom value
    config = MusicPathsConfig(hostMusicPath="/home/user/music")
    assert config.hostMusicPath == "/home/user/music"


@pytest.mark.unit
def test_wizard_configuration_music_paths():
    """Test WizardConfiguration with new music paths structure."""
    config = WizardConfiguration()
    assert config.musicPaths.hostMusicPath == "./music"
    
    # Test with custom path
    config = WizardConfiguration(
        musicPaths=MusicPathsConfig(hostMusicPath="/custom/music/path")
    )
    assert config.musicPaths.hostMusicPath == "/custom/music/path"


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
        host_music_path="/custom/music"
    )
    assert settings.log_level == "DEBUG"
    assert settings.environment == "production"
    assert settings.port == 8080
    assert settings.host_music_path == "/custom/music"


@pytest.mark.unit
def test_settings_properties():
    """Test settings properties."""
    dev_settings = Settings(environment="development")
    assert dev_settings.is_development is True
    assert dev_settings.is_production is False

    prod_settings = Settings(environment="production")
    assert prod_settings.is_development is False
    assert prod_settings.is_production is True
