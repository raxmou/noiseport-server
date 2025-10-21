import { ServiceInfoData } from '../components/ServiceInfo';
import { IconMusic, IconVideo, IconPlayerPlay, IconApi } from '@tabler/icons-react';

export const serviceInfoData: Record<string, ServiceInfoData> = {
  navidrome: {
    name: 'Navidrome',
    description: 'A modern music server and streamer compatible with Subsonic/Airsonic clients. Provides web-based music streaming, playlists, and metadata management for your music collection.',
    badge: 'Music Server',
    badgeColor: 'blue',
    icon: <IconMusic size="2rem" color="blue" />,
    url: 'http://localhost:4533',
    accountSetupInstructions: [
      'Click "Open Navidrome" to access the web interface',
      'Create your admin account with a username and password',
      'Log in to explore your music library once files are added',
      'Download mobile apps like DSub or Ultrasonic for on-the-go access'
    ]
  },
  jellyfin: {
    name: 'Jellyfin',
    description: 'A free media system that puts you in control of your media. Streams music and videos to any device with rich metadata, artwork, and cross-device synchronization.',
    badge: 'Media Server',
    badgeColor: 'orange',
    icon: <IconVideo size="2rem" color="orange" />,
    url: 'http://localhost:8096',
    accountSetupInstructions: [
      'Click "Open Jellyfin" to start the setup wizard',
      'Choose your preferred language and create an admin account',
      'Configure media libraries by pointing to your music folder',
      'Install Jellyfin apps on your devices for streaming anywhere'
    ]
  },
  slskd: {
    name: 'slskd',
    description: 'A web-based Soulseek client for downloading music from the Soulseek network. Enables music discovery and downloading from a vast peer-to-peer music community.',
    badge: 'Download Client',
    badgeColor: 'green',
    icon: <IconPlayerPlay size="2rem" color="green" />,
    url: 'http://localhost:5030',
    accountSetupInstructions: [
      'Click "Open slskd Web" to access the download interface',
      'The client is pre-configured with your Soulseek credentials',
      'Search for music and download directly to your music folder',
      'Monitor download progress and browse shared libraries'
    ]
  },
  api: {
    name: 'FastAPI Backend',
    description: 'The orchestration layer that connects all services together. Provides automation, configuration management, and API endpoints for music downloading and library management.',
    badge: 'API Server',
    badgeColor: 'violet',
    icon: <IconApi size="2rem" color="violet" />,
    url: 'http://localhost:8000/docs',
    accountSetupInstructions: [
      'Access the interactive API documentation',
      'Use the API to automate downloads and library management',
      'Integrate with third-party applications and scripts',
      'Monitor system status and configuration through API endpoints'
    ]
  }
};