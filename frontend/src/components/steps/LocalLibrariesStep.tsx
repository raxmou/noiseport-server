import { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Checkbox,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Alert,
  Collapse,
  Paper,
  Anchor,
  List,
  Stack,
  Badge,
} from '@mantine/core';
import { IconCheck, IconX, IconExternalLink, IconMusic, IconPlayerPlay, IconVideo, IconApi } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';
import { useWizardConfig } from '../../hooks/useWizardConfig';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function LocalLibrariesStep({ config, onUpdate, onValidation }: Props) {
  const [navidromeStatus, setNavidromeStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [jellyfinStatus, setJellyfinStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const { testConnection } = useWizardConfig();

  useEffect(() => {
    onValidation(true);
  }, [onValidation]);

  const handleNavidromeToggle = (enabled: boolean) => {
    onUpdate({
      navidrome: { ...config.navidrome, enabled }
    });
  };

  const handleJellyfinToggle = (enabled: boolean) => {
    onUpdate({
      jellyfin: { ...config.jellyfin, enabled }
    });
  };

  const handleNavidromeChange = (field: string, value: string) => {
    onUpdate({
      navidrome: { ...config.navidrome, [field]: value }
    });
  };

  const handleJellyfinChange = (field: string, value: string) => {
    onUpdate({
      jellyfin: { ...config.jellyfin, [field]: value }
    });
  };

  const testNavidromeConnection = async () => {
    setNavidromeStatus('testing');
    try {
      const success = await testConnection('navidrome', config.navidrome);
      setNavidromeStatus(success ? 'success' : 'error');
    } catch {
      setNavidromeStatus('error');
    }
  };

  const testJellyfinConnection = async () => {
    setJellyfinStatus('testing');
    try {
      const success = await testConnection('jellyfin', config.jellyfin);
      setJellyfinStatus(success ? 'success' : 'error');
    } catch {
      setJellyfinStatus('error');
    }
  };

  return (
    <>
      <Title order={2} mb="md">
        <IconMusic size="1.5rem" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Connect to Local Libraries
      </Title>
      <Text c="dimmed" mb="xl">
        Connect to your local music libraries for enhanced metadata and organization.
        These services work together to provide a complete music streaming and management experience.
      </Text>

      {/* Service Overview */}
      <Paper p="xl" withBorder mb="xl" bg="blue.0">
        <Title order={3} mb="md">Available Services</Title>
        <Stack gap="lg">
          <Group align="flex-start" gap="md">
            <IconMusic size="2rem" color="blue" />
            <div style={{ flex: 1 }}>
              <Group gap="sm" mb="xs">
                <Text fw={600} size="lg">Navidrome</Text>
                <Badge color="blue" variant="light">Music Server</Badge>
                <Anchor
                  href="http://localhost:4533"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                >
                  Open Navidrome
                  <IconExternalLink size="0.8rem" style={{ marginLeft: '4px' }} />
                </Anchor>
              </Group>
              <Text size="sm" c="dimmed">
                A modern music server and streamer compatible with Subsonic/Airsonic clients. 
                Provides web-based music streaming, playlists, and metadata management for your music collection.
              </Text>
            </div>
          </Group>

          <Group align="flex-start" gap="md">
            <IconVideo size="2rem" color="orange" />
            <div style={{ flex: 1 }}>
              <Group gap="sm" mb="xs">
                <Text fw={600} size="lg">Jellyfin</Text>
                <Badge color="orange" variant="light">Media Server</Badge>
                <Anchor
                  href="http://localhost:8096"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                >
                  Open Jellyfin
                  <IconExternalLink size="0.8rem" style={{ marginLeft: '4px' }} />
                </Anchor>
              </Group>
              <Text size="sm" c="dimmed">
                A free media system that puts you in control of your media. Streams music and videos 
                to any device with rich metadata, artwork, and cross-device synchronization.
              </Text>
            </div>
          </Group>

          <Group align="flex-start" gap="md">
            <IconPlayerPlay size="2rem" color="green" />
            <div style={{ flex: 1 }}>
              <Group gap="sm" mb="xs">
                <Text fw={600} size="lg">slskd</Text>
                <Badge color="green" variant="light">Download Client</Badge>
                <Anchor
                  href="http://localhost:5030"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                >
                  Open slskd Web
                  <IconExternalLink size="0.8rem" style={{ marginLeft: '4px' }} />
                </Anchor>
              </Group>
              <Text size="sm" c="dimmed">
                A web-based Soulseek client for downloading music from the Soulseek network. 
                Enables music discovery and downloading from a vast peer-to-peer music community.
              </Text>
            </div>
          </Group>

          <Group align="flex-start" gap="md">
            <IconApi size="2rem" color="violet" />
            <div style={{ flex: 1 }}>
              <Group gap="sm" mb="xs">
                <Text fw={600} size="lg">FastAPI Backend</Text>
                <Badge color="violet" variant="light">API Server</Badge>
                <Anchor
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                >
                  API Documentation
                  <IconExternalLink size="0.8rem" style={{ marginLeft: '4px' }} />
                </Anchor>
              </Group>
              <Text size="sm" c="dimmed">
                The orchestration layer that connects all services together. Provides automation, 
                configuration management, and API endpoints for music downloading and library management.
              </Text>
            </div>
          </Group>
        </Stack>
      </Paper>

      <Alert color="blue" variant="light" mb="xl">
        <Text fw={500} mb="xs">🚀 Getting Started Guide</Text>
        <List size="sm">
          <List.Item>Click the service links above to open each web interface</List.Item>
          <List.Item>Create user accounts in Navidrome and Jellyfin to access your library</List.Item>
          <List.Item>Configure authentication below to enable wizard integration</List.Item>
          <List.Item>Use slskd to download new music that will appear in your libraries</List.Item>
        </List>
      </Alert>

      <Paper p="md" mb="md" withBorder>
        <Checkbox
          label="Enable Navidrome Integration"
          checked={config.navidrome.enabled}
          onChange={(event) => handleNavidromeToggle(event.currentTarget.checked)}
          mb="md"
        />
        
        <Collapse in={config.navidrome.enabled}>
          <TextInput
            label="Navidrome URL"
            placeholder="http://localhost:4533"
            value={config.navidrome.url}
            onChange={(event) => handleNavidromeChange('url', event.currentTarget.value)}
            mb="md"
            required
          />
          
          <Group grow mb="md">
            <TextInput
              label="Username"
              placeholder="admin"
              value={config.navidrome.username}
              onChange={(event) => handleNavidromeChange('username', event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Password"
              placeholder="password"
              value={config.navidrome.password}
              onChange={(event) => handleNavidromeChange('password', event.currentTarget.value)}
              required
            />
          </Group>

          <Group mb="md">
            <Button
              onClick={testNavidromeConnection}
              loading={navidromeStatus === 'testing'}
              disabled={!config.navidrome.url || !config.navidrome.username || !config.navidrome.password}
            >
              Test Connection
            </Button>
            {navidromeStatus === 'success' && (
              <Alert icon={<IconCheck size="1rem" />} color="green" variant="light">
                Connection successful!
              </Alert>
            )}
            {navidromeStatus === 'error' && (
              <Alert icon={<IconX size="1rem" />} color="red" variant="light">
                Connection failed. Please check your credentials.
              </Alert>
            )}
          </Group>
        </Collapse>
      </Paper>

      <Paper p="md" withBorder>
        <Checkbox
          label="Enable Jellyfin Integration"
          checked={config.jellyfin.enabled}
          onChange={(event) => handleJellyfinToggle(event.currentTarget.checked)}
          mb="md"
        />
        
        <Collapse in={config.jellyfin.enabled}>
          <TextInput
            label="Jellyfin URL"
            placeholder="http://localhost:8096"
            value={config.jellyfin.url}
            onChange={(event) => handleJellyfinChange('url', event.currentTarget.value)}
            mb="md"
            required
          />
          
          <Group grow mb="md">
            <TextInput
              label="Username"
              placeholder="admin"
              value={config.jellyfin.username}
              onChange={(event) => handleJellyfinChange('username', event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Password"
              placeholder="password"
              value={config.jellyfin.password}
              onChange={(event) => handleJellyfinChange('password', event.currentTarget.value)}
              required
            />
          </Group>

          <Group mb="md">
            <Button
              onClick={testJellyfinConnection}
              loading={jellyfinStatus === 'testing'}
              disabled={!config.jellyfin.url || !config.jellyfin.username || !config.jellyfin.password}
            >
              Test Connection
            </Button>
            {jellyfinStatus === 'success' && (
              <Alert icon={<IconCheck size="1rem" />} color="green" variant="light">
                Connection successful!
              </Alert>
            )}
            {jellyfinStatus === 'error' && (
              <Alert icon={<IconX size="1rem" />} color="red" variant="light">
                Connection failed. Please check your credentials.
              </Alert>
            )}
          </Group>
        </Collapse>
      </Paper>
    </>
  );
}