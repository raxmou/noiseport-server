import { useEffect, useState } from 'react';
import {
  Title,
  Text,
  TextInput,
  Paper,
  Alert,
  Group,
  Button,
  Loader,
} from '@mantine/core';
import { IconFolder, IconDeviceDesktop, IconRocket, IconCheck, IconX, IconExternalLink } from '@tabler/icons-react';
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
      config.musicPaths?.hostMusicPath
    );
    onValidation(isValid);
  }, [config.musicPaths, onValidation]);

  const handlePathChange = (value: string) => {
    setConfigSaved(false); // Reset save status when paths change
    onUpdate({
      musicPaths: { 
        ...config.musicPaths,
        hostMusicPath: value 
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
        Configure the base music folder on your host system. The system will create necessary subdirectories for downloads and completed music files.

      </Text>

      <Paper p="md" withBorder mb="md">
        <Title order={4} mb="md" c="blue">
          <IconDeviceDesktop size="1.2rem" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Music Folder Configuration
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Specify the base folder on your computer where music will be stored. 
          The system will automatically create "downloads" and "complete" subdirectories within this folder.
        </Text>
        <Alert color="blue" variant="light" mt="md">
          <Text size="sm"  mb="md">
          Since we're setting up a dedicated music server, it's important to make sure the path you're providing can handle large volumes of music files. 
          Consequently, using external drives or network-attached storage (NAS) is highly recommended for optimal performance and storage capacity.
          If you do so, make sure the drive is properly mounted and accessible by the system before proceeding. Don't hesitate to reach out on the Noiseport Discord server if you need any assistance with this setup.
        </Text>
          <Text size="sm">
            <strong>📁 Directory Structure:</strong><br/>
            • <code>{config.musicPaths?.hostMusicPath || './music'}/downloads/</code> - For files being downloaded<br/>
            • <code>{config.musicPaths?.hostMusicPath || './music'}/complete/</code> - For your organized music library
          </Text>
        </Alert>
        <TextInput
          label="Host Music Path"
          placeholder="./music"
          value={config.musicPaths?.hostMusicPath || './music'}
          onChange={(event) => handlePathChange(event.currentTarget.value)}
          required
          leftSection={<IconFolder size="1rem" />}
          description="Base folder on your computer for music storage (e.g., /home/user/music or ./music)"
        />
        
        
      </Paper>


      {configSaved && (
        <Alert color="blue" variant="light" mb="md">
          <Group gap="sm">
            <IconCheck size="1.2rem" color="blue" />
            <div>
              <Text fw={600} c="blue">Configuration Saved!</Text>
              <Text size="sm" c="dimmed">Configuration files correctly generated, ready to launch services!</Text>
            </div>
          </Group>
        </Alert>
      )}

      

      

      <Paper p="md" withBorder mb="md">
        <Group justify="space-between" align="center" mb="md">
          <div>
            <Text fw={600} mb="xs">Step 1: Save Configuration</Text>
            <Text size="sm" c="dimmed">
              Save your music base path to generate correct config files.
            </Text>
          </div>
          <Button
            onClick={saveConfiguration}
            loading={saving}
            leftSection={<IconCheck size="1rem" />}
            disabled={!config.musicPaths?.hostMusicPath}
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
              After saving configuration, launch all music services with your music base path.
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
                Stopping wizard container and starting full music stack with your configured music path...
              </Text>
            </Group>
          </Alert>
        )}
        {servicesLaunched && serviceStatus && (
        <Paper p="md" withBorder mb="md" bg="green.0">
          <Group gap="md" mb="md">
            <IconRocket size="1.5rem" color="green" />
            <div>
              <Text fw={600} c="green">Services Launched Successfully!</Text>
              <Text size="sm" c="dimmed">All services are running with your configured music path</Text>
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
      </Paper>

      
    </>
  );
}