import { useEffect } from 'react';
import {
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Card,
  Alert,
} from '@mantine/core';
import { IconCheck, IconX, IconInfoCircle } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';

interface Props {
  config: WizardConfiguration;
  onValidation: (valid: boolean) => void;
}

export default function SummaryStep({ config, onValidation }: Props) {
  useEffect(() => {
    onValidation(true);
  }, [onValidation]);

  const enabledServices = [
    config.navidrome.enabled && 'Navidrome',
    config.jellyfin.enabled && 'Jellyfin', 
    config.spotify.enabled && 'Spotify',
    config.soulseek.enabled && 'Soulseek/slskd',
  ].filter(Boolean) as string[];

  const enabledFeatures = [
    config.features.scrobbling && 'Scrobbling',
    config.features.downloads && 'Downloads',
    config.features.discovery && 'Music Discovery',
  ].filter(Boolean) as string[];

  return (
    <>
      <Title order={2} mb="md">
        Configuration Summary
      </Title>
      <Text c="dimmed" mb="md">
        Review your configuration before completing the setup. You can go back to any 
        previous step to make changes if needed.
      </Text>

      <Stack gap="md">
        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500}>Local Libraries</Text>
            <Badge color={enabledServices.includes('Navidrome') || enabledServices.includes('Jellyfin') ? 'green' : 'gray'}>
              {enabledServices.includes('Navidrome') || enabledServices.includes('Jellyfin') ? 'Configured' : 'Skipped'}
            </Badge>
          </Group>
          <Stack gap="xs">
            <Group>
              {config.navidrome.enabled ? <IconCheck size="1rem" color="green" /> : <IconX size="1rem" color="gray" />}
              <Text size="sm">Navidrome: {config.navidrome.enabled ? config.navidrome.url : 'Disabled'}</Text>
            </Group>
            <Group>
              {config.jellyfin.enabled ? <IconCheck size="1rem" color="green" /> : <IconX size="1rem" color="gray" />}
              <Text size="sm">Jellyfin: {config.jellyfin.enabled ? config.jellyfin.url : 'Disabled'}</Text>
            </Group>
          </Stack>
        </Card>

        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500}>Spotify API</Text>
            <Badge color={config.spotify.enabled ? 'green' : 'gray'}>
              {config.spotify.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Group>
          {config.spotify.enabled ? (
            <Text size="sm">Client ID: {config.spotify.clientId.substring(0, 8)}...</Text>
          ) : (
            <Text size="sm" c="dimmed">Not configured</Text>
          )}
        </Card>

        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500}>Soulseek/slskd</Text>
            <Badge color={config.soulseek.enabled ? 'green' : 'gray'}>
              {config.soulseek.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Group>
          {config.soulseek.enabled ? (
            <Stack gap="xs">
              <Text size="sm">Host: {config.soulseek.host}</Text>
              <Text size="sm">Username: {config.soulseek.username}</Text>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">Not configured</Text>
          )}
        </Card>

        <Card withBorder p="md">
          <Text fw={500} mb="xs">Music Paths</Text>
          <Stack gap="xs">
            <Text size="sm">Base Path: {config.musicPaths?.hostMusicPath}</Text>
            <Text size="sm" c="dimmed">Downloads: {config.musicPaths?.hostMusicPath}/downloads</Text>
            <Text size="sm" c="dimmed">Complete: {config.musicPaths?.hostMusicPath}/complete</Text>
          </Stack>
        </Card>

        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500}>Optional Features</Text>
            <Badge color={enabledFeatures.length > 0 ? 'blue' : 'gray'}>
              {enabledFeatures.length} enabled
            </Badge>
          </Group>
          <Stack gap="xs">
            {enabledFeatures.map((feature) => (
              <Group key={feature}>
                <IconCheck size="1rem" color="green" />
                <Text size="sm">{feature}</Text>
              </Group>
            ))}
            {enabledFeatures.length === 0 && (
              <Text size="sm" c="dimmed">No optional features enabled</Text>
            )}
          </Stack>
        </Card>

        <Alert icon={<IconInfoCircle size="1rem" />} color="blue">
          <Text size="sm">
            Once you complete the setup, these settings will be saved and the application
            will be ready to use. You can always modify these settings later through 
            the application interface.
          </Text>
        </Alert>
      </Stack>
    </>
  );
}