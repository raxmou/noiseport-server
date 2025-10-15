import { useEffect } from 'react';
import {
  Title,
  Text,
  TextInput,
  Paper,
  Alert,
  Group,
  Stack,
} from '@mantine/core';
import { IconFolder, IconDeviceDesktop, IconServer } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function MusicPathsStep({ config, onUpdate, onValidation }: Props) {
  useEffect(() => {
    const isValid = Boolean(
      config.musicPaths?.hostDownloadPath && 
      config.musicPaths?.hostCompletePath
    );
    onValidation(isValid);
  }, [config.musicPaths, onValidation]);

  const handlePathChange = (field: keyof typeof config.musicPaths, value: string) => {
    onUpdate({
      musicPaths: { 
        hostDownloadPath: config.musicPaths?.hostDownloadPath || './music/downloads',
        hostCompletePath: config.musicPaths?.hostCompletePath || './music/complete',
        downloadPath: config.musicPaths?.downloadPath || '/music/downloads',
        completePath: config.musicPaths?.completePath || '/music/complete',
        [field]: value 
      }
    });
  };

  return (
    <>
      <Title order={2} mb="md">
        Music Folder Configuration
      </Title>
      <Text c="dimmed" mb="xl">
        Configure the folders on your host system where music will be downloaded and stored. 
        These folders will be mounted into the Docker containers for the services to access.
      </Text>

      <Paper p="md" withBorder mb="md">
        <Title order={4} mb="md" c="blue">
          <IconDeviceDesktop size="1.2rem" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Host System Paths
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          These are the actual folders on your computer that will store your music files.
        </Text>

        <Stack gap="md">
          <TextInput
            label="Host Download Path"
            placeholder="./music/downloads"
            value={config.musicPaths?.hostDownloadPath || ''}
            onChange={(event) => handlePathChange('hostDownloadPath', event.currentTarget.value)}
            required
            leftSection={<IconFolder size="1rem" />}
            description="Folder on your computer for downloads in progress (e.g., /home/user/music/downloads)"
          />
          
          <TextInput
            label="Host Complete Path"
            placeholder="./music/complete"
            value={config.musicPaths?.hostCompletePath || ''}
            onChange={(event) => handlePathChange('hostCompletePath', event.currentTarget.value)}
            required
            leftSection={<IconFolder size="1rem" />}
            description="Folder on your computer for completed music (e.g., /home/user/music/complete)"
          />
        </Stack>
      </Paper>

      <Paper p="md" withBorder mb="md">
        <Title order={4} mb="md" c="green">
          <IconServer size="1.2rem" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Container Paths (Advanced)
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          These are the paths inside the Docker containers. Usually you don't need to change these.
        </Text>

        <Group grow>
          <TextInput
            label="Container Download Path"
            value={config.musicPaths?.downloadPath || '/music/downloads'}
            onChange={(event) => handlePathChange('downloadPath', event.currentTarget.value)}
            leftSection={<IconServer size="1rem" />}
            description="Path inside containers"
          />
          
          <TextInput
            label="Container Complete Path"
            value={config.musicPaths?.completePath || '/music/complete'}
            onChange={(event) => handlePathChange('completePath', event.currentTarget.value)}
            leftSection={<IconServer size="1rem" />}
            description="Path inside containers"
          />
        </Group>
      </Paper>

      <Alert color="green" variant="light" mb="md">
        <Text size="sm">
          <strong>🐳 Docker Compose Integration:</strong><br/>
          When you save this configuration, a <code>docker-compose.override.yml</code> file will be generated 
          that mounts your host folders into the containers. You can then start all services with:
          <br/><br/>
          <code>docker compose up -d</code>
        </Text>
      </Alert>

      <Alert color="blue" variant="light">
        <Text size="sm">
          <strong>Path Guidelines:</strong>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li><strong>Host paths</strong> can be relative (./music/downloads) or absolute (/home/user/music)</li>
            <li>Make sure you have read/write permissions for the host folders</li>
            <li>The download folder is for temporary files during processing</li>
            <li>The complete folder is for your final organized music library</li>
            <li>These folders will be automatically created if they don't exist</li>
            <li>Use different folders for downloads and complete to avoid conflicts</li>
          </ul>
        </Text>
      </Alert>
    </>
  );
}