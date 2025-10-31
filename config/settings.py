"""Application configuration module."""

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = Field(default="Downloader API", description="Application name")
    app_version: str = Field(default="0.1.0", description="Application version")
    app_description: str = Field(
        default="Production-ready FastAPI application for music downloading",
        description="Application description",
    )
    environment: str = Field(default="development", description="Environment")
    debug: bool = Field(default=False, description="Debug mode")
    log_level: str = Field(default="INFO", description="Logging level")

    # Server
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port", ge=1, le=65535)
    workers: int = Field(default=1, description="Number of workers", ge=1)

    # SLSKD
    slskd_host: str = Field(default="http://slskd:5030", description="SLSKD server URL")
    slskd_username: str = Field(default="slskd", description="SLSKD username")
    slskd_password: str = Field(default="slskd", description="SLSKD password")

    # Navidrome
    navidrome_enabled: bool = Field(
        default=False, description="Enable Navidrome integration"
    )
    navidrome_url: str = Field(default="", description="Navidrome server URL")
    navidrome_username: str = Field(default="", description="Navidrome username")
    navidrome_password: str = Field(default="", description="Navidrome password")

    # Jellyfin
    jellyfin_enabled: bool = Field(
        default=False, description="Enable Jellyfin integration"
    )
    jellyfin_url: str = Field(default="", description="Jellyfin server URL")
    jellyfin_username: str = Field(default="", description="Jellyfin username")
    jellyfin_password: str = Field(default="", description="Jellyfin password")

    # Spotify API
    spotify_enabled: bool = Field(
        default=False, description="Enable Spotify integration"
    )
    spotify_client_id: str = Field(default="", description="Spotify Client ID")
    spotify_client_secret: str = Field(default="", description="Spotify Client Secret")

    # Features
    scrobbling_enabled: bool = Field(default=False, description="Enable scrobbling")
    downloads_enabled: bool = Field(default=True, description="Enable downloads")
    discovery_enabled: bool = Field(default=False, description="Enable music discovery")

    # Last.fm
    lastfm_api_key: str = Field(default="", description="Last.fm API Key")
    lastfm_secret: str = Field(default="", description="Last.fm API Secret")

    # Security
    secret_key: str = Field(
        default="your-secret-key-here-change-in-production",
        description="Secret key for JWT",
        min_length=32,
    )
    access_token_expire_minutes: int = Field(
        default=30, description="Access token expiration in minutes", ge=1
    )
    algorithm: str = Field(default="HS256", description="JWT algorithm")

    # CORS
    allowed_origins: list[str] = Field(
        default=["*"], description="Allowed CORS origins"
    )
    allow_credentials: bool = Field(
        default=True, description="Allow credentials in CORS"
    )

    # Database (for future use)
    database_url: str = Field(default="sqlite:///./app.db", description="Database URL")

    # Monitoring
    enable_metrics: bool = Field(default=True, description="Enable metrics")
    metrics_path: str = Field(default="/metrics", description="Metrics endpoint path")

    # File Storage
    host_music_path: str = Field(
        default="./music",
        description="Host system music directory path (downloads and complete subdirectories will be created)",
    )

    # Wizard Configuration
    wizard_config_dir: str = Field(
        default="./wizard-config",
        description=(
            "Directory for wizard-generated configuration files. "
            "In containers, this is set via WIZARD_CONFIG_DIR environment variable. "
            "On host, the relative path is resolved from the project root."
        ),
    )

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of {valid_levels}")
        return v.upper()

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Validate environment."""
        valid_envs = ["development", "staging", "production", "testing"]
        if v.lower() not in valid_envs:
            raise ValueError(f"Environment must be one of {valid_envs}")
        return v.lower()

    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.environment == "development"


# Global settings instance
settings = Settings()
