"""Configuration models for the setup wizard."""

from enum import Enum

from pydantic import BaseModel, Field


class HeadscaleSetupMode(str, Enum):
    """Headscale setup mode options."""

    DOMAIN = "domain"
    IP = "ip"


class NavidromeConfig(BaseModel):
    """Navidrome configuration."""

    enabled: bool = Field(default=False, description="Enable Navidrome integration")
    url: str = Field(default="", description="Navidrome server URL")
    username: str = Field(default="", description="Navidrome username")
    password: str = Field(default="", description="Navidrome password")


class JellyfinConfig(BaseModel):
    """Jellyfin configuration."""

    enabled: bool = Field(default=False, description="Enable Jellyfin integration")
    url: str = Field(default="", description="Jellyfin server URL")
    username: str = Field(default="", description="Jellyfin username")
    password: str = Field(default="", description="Jellyfin password")


class SpotifyConfig(BaseModel):
    """Spotify API configuration."""

    enabled: bool = Field(default=False, description="Enable Spotify integration")
    clientId: str = Field(default="", description="Spotify Client ID")
    clientSecret: str = Field(default="", description="Spotify Client Secret")

    model_config = {"populate_by_name": True}


class SoulseekConfig(BaseModel):
    """Soulseek/slskd configuration."""

    enabled: bool = Field(default=True, description="Enable Soulseek integration")
    host: str = Field(default="http://slskd:5030", description="SLSKD server URL")
    username: str = Field(default="slskd", description="SLSKD daemon username")
    password: str = Field(default="slskd", description="SLSKD daemon password")
    soulseekUsername: str = Field(default="", description="Soulseek network username")
    soulseekPassword: str = Field(default="", description="Soulseek network password")


class MusicPathsConfig(BaseModel):
    """Music folder paths configuration."""

    hostMusicPath: str = Field(
        default="./music",
        description="Host system path for music (downloads and complete subdirectories will be created)",
    )

    model_config = {"populate_by_name": True}


class FeaturesConfig(BaseModel):
    """Optional features configuration."""

    scrobbling: bool = Field(default=False, description="Enable scrobbling")
    downloads: bool = Field(default=True, description="Enable downloads")
    discovery: bool = Field(default=False, description="Enable music discovery")
    lastfmApiKey: str = Field(default="", description="Last.fm API Key")
    lastfmSecret: str = Field(default="", description="Last.fm API Secret")


class HeadscaleConfig(BaseModel):
    """Headscale VPN configuration."""

    enabled: bool = Field(default=False, description="Enable Headscale integration")
    setupMode: HeadscaleSetupMode = Field(
        default=HeadscaleSetupMode.IP,
        description="Setup mode: domain-based or IP-based",
    )
    domain: str = Field(default="", description="Domain name for Headscale server")
    serverIp: str = Field(
        default="", description="Server IP address (for IP-based setup)"
    )
    serverUrl: str = Field(default="", description="Complete Headscale server URL")
    apiKey: str = Field(default="", description="Headscale API key")
    baseDomain: str = Field(
        default="headscale.local", description="Base domain for MagicDNS"
    )
    serverVpnHostname: str = Field(
        default="",
        description="Server's VPN hostname (MagicDNS name after joining Headscale)",
    )


class WizardConfiguration(BaseModel):
    """Complete wizard configuration."""

    headscale: HeadscaleConfig = Field(default_factory=HeadscaleConfig)
    navidrome: NavidromeConfig = Field(default_factory=NavidromeConfig)
    jellyfin: JellyfinConfig = Field(default_factory=JellyfinConfig)
    spotify: SpotifyConfig = Field(default_factory=SpotifyConfig)
    soulseek: SoulseekConfig = Field(default_factory=SoulseekConfig)
    musicPaths: MusicPathsConfig = Field(default_factory=MusicPathsConfig)
    features: FeaturesConfig = Field(default_factory=FeaturesConfig)

    model_config = {"populate_by_name": True}


class ValidationError(BaseModel):
    """Validation error model."""

    field: str = Field(description="Field name with error")
    message: str = Field(description="Error message")


class ConfigValidationResponse(BaseModel):
    """Configuration validation response."""

    valid: bool = Field(description="Whether the configuration is valid")
    errors: list[ValidationError] = Field(
        default_factory=list, description="Validation errors"
    )


class ConnectionTestRequest(BaseModel):
    """Connection test request."""

    service: str = Field(description="Service name to test")
    config: dict = Field(description="Service configuration to test")


class ConnectionTestResponse(BaseModel):
    """Connection test response."""

    success: bool = Field(description="Whether the connection test succeeded")
    message: str = Field(default="", description="Additional message about the test")
