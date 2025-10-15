import { useEffect, useState } from 'react';
import {
  Title,
  Text,
  TextInput,
  Paper,
  Alert,
  Group,
  Stack,
  Button,
  Loader,
} from '@mantine/core';
import { IconFolder, IconDeviceDesktop, IconServer, IconRocket, IconCheck, IconX, IconExternalLink } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function MusicPathsStep({ config, onUpdate, onValidation }: Props) {
  const [servicesLaunched, setServicesLaunched] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    const isValid = Boolean(
      config.musicPaths?.hostDownloadPath && 
      config.musicPaths?.hostCompletePath
    );
    onValidation(isValid);
  }, [config.musicPaths, onValidation]);

  const handlePathChange = (field: keyof typeof config.musicPaths, value: string) => {
    setConfigSaved(false); // Reset save status when paths change
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

  const saveConfiguration = async () => {
    setSaving(true);
    console.log('Saving configuration:', config);
    try {
      const response = await fetch('/api/v1/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        setConfigSaved(true);
        const result = await response.json();
        console.log('Configuration saved:', result);
      } else {
        console.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
    setSaving(false);
  };

  const launchServices = async () => {
    setLaunching(true);
    try {
      const response = await fetch('/api/v1/config/launch-services', {
        method: 'POST'
      });
      
      if (response.ok) {
        setServicesLaunched(true);
        checkServiceStatus();
      } else {
        console.error('Failed to launch services');
      }
    } catch (error) {
      console.error('Error launching services:', error);
    }
    setLaunching(false);
  };

  const checkServiceStatus = async () => {
    try {
      const response = await fetch('/api/v1/config/service-status');
      if (response.ok) {
        const result = await response.json();
        setServiceStatus(result.services);
      }
    } catch (error) {
      console.error('Error checking service status:', error);
    }
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
          <strong>🎯 New Workflow:</strong><br/>
          1. Configure your host paths below ✅<br/>
          2. <strong>Save configuration</strong> to generate docker-compose files<br/>
          3. Launch all music services with your configured paths<br/>
          4. Access services and create accounts<br/>
          5. Return to wizard to configure authentication
        </Text>
      </Alert>

      {configSaved && (
        <Alert color="blue" variant="light" mb="md">
          <Group gap="sm">
            <IconCheck size="1.2rem" color="blue" />
            <div>
              <Text fw={600} c="blue">Configuration Saved!</Text>
              <Text size="sm" c="dimmed">Docker Compose files generated with your host paths. Ready to launch services.</Text>
            </div>
          </Group>
        </Alert>
      )}

      {servicesLaunched && serviceStatus && (
        <Paper p="md" withBorder mb="md" bg="green.0">
          <Group gap="md" mb="md">
            <IconRocket size="1.5rem" color="green" />
            <div>
              <Text fw={600} c="green">Services Launched Successfully!</Text>
              <Text size="sm" c="dimmed">All services are running with your configured host paths</Text>
            </div>
          </Group>
          
          <Text fw={500} mb="sm">Access your services:</Text>
          <Group gap="md">
            {Object.entries(serviceStatus).map(([name, service]: [string, any]) => (
              <Button
                key={name}
                component="a"
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="sm"
                leftSection={service.running ? <IconCheck size="1rem" color="green" /> : <IconX size="1rem" color="red" />}
                rightSection={<IconExternalLink size="1rem" />}
                color={service.running ? "green" : "red"}
              >
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </Button>
            ))}
          </Group>
        </Paper>
      )}

      <Alert color="blue" variant="light" mb="md">
        <Text size="sm">
          <strong>🐳 Docker Compose Integration:</strong><br/>
          When you save this configuration, a docker-compose.full.yml file will be generated 
          that mounts your host folders into the containers. You can then launch all services with the button below.
        </Text>
      </Alert>

      <Paper p="md" withBorder mb="md">
        <Group justify="space-between" align="center" mb="md">
          <div>
            <Text fw={600} mb="xs">Step 1: Save Configuration</Text>
            <Text size="sm" c="dimmed">
              Save your paths to generate Docker Compose files with host mounting.
            </Text>
          </div>
          <Button
            onClick={saveConfiguration}
            loading={saving}
            leftSection={<IconCheck size="1rem" />}
            disabled={!config.musicPaths?.hostDownloadPath || !config.musicPaths?.hostCompletePath}
            color={configSaved ? "green" : "blue"}
            variant={configSaved ? "light" : "filled"}
          >
            {saving ? "Saving..." : configSaved ? "Saved ✓" : "Save Configuration"}
          </Button>
        </Group>

        <Group justify="space-between" align="center">
          <div>
            <Text fw={600} mb="xs">Step 2: Launch Services</Text>
            <Text size="sm" c="dimmed">
              After saving configuration, launch all music services with your host paths.
            </Text>
          </div>
          <Button
            onClick={launchServices}
            loading={launching}
            leftSection={<IconRocket size="1rem" />}
            disabled={!configSaved}
            color="orange"
          >
            {launching ? "Launching..." : "Launch Services"}
          </Button>
        </Group>
        
        {launching && (
          <Alert color="blue" variant="light" mt="md">
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm">
                Stopping wizard container and starting full music stack with your configured paths...
              </Text>
            </Group>
          </Alert>
        )}
      </Paper>

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