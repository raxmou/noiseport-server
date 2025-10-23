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
  Stack,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';
import { useWizardConfig } from '../../hooks/useWizardConfig';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function SpotifyStep({ config, onUpdate, onValidation }: Props) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  const [saving, setSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const { testConnection,  } = useWizardConfig();

  useEffect(() => {
    onValidation(true);
  }, [onValidation]);

  const handleSpotifyToggle = (enabled: boolean) => {
    onUpdate({
      spotify: { ...config.spotify, enabled }
    });
  };

  const handleSpotifyChange = (field: string, value: string) => {
    onUpdate({
      spotify: { ...config.spotify, [field]: value }
    });
  };

  const testSpotifyConnection = async () => {
    setConnectionStatus('testing');
    try {
      const success = await testConnection('spotify', config.spotify);
      setConnectionStatus(success ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  };

  const handleSaveConfig = async () => {
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
  const isFormValid =
    config.spotify?.clientId?.trim() !== '' &&
    config.spotify?.clientSecret?.trim() !== '';
  return (
    <>
      <Title order={2} mb="md">
        Spotify API Configuration
      </Title>
      <Text c="dimmed" mb="md">
        Connect to Spotify to enhance music discovery and metadata enrichment.
        Don't worry, you don't need a premium account to use the API.
        We only require basic API access for fetching track and artist information.
      </Text>

      <Alert icon={<IconAlertCircle size="1rem" />} color="blue" mb="md">
        To get Spotify API credentials, visit the{' '}
        <Anchor href="https://developer.spotify.com/dashboard" target="_blank">
          Spotify Developer Dashboard
        </Anchor>{' '}
        and create a new app.
      </Alert>

      <Paper p="md" withBorder>
        <Checkbox
          label="Enable Spotify Integration"
          checked={config.spotify.enabled}
          onChange={(event) => handleSpotifyToggle(event.currentTarget.checked)}
          mb="md"
        />
        
        <Collapse in={config.spotify.enabled}>
          <TextInput
            label="Client ID"
            placeholder="Your Spotify App Client ID"
            value={config.spotify.clientId}
            onChange={(event) => handleSpotifyChange('clientId', event.currentTarget.value)}
            mb="md"
            required
            description="Found in your Spotify app settings under 'Client ID'"
          />
          
          <PasswordInput
            label="Client Secret"
            placeholder="Your Spotify App Client Secret"
            value={config.spotify.clientSecret}
            onChange={(event) => handleSpotifyChange('clientSecret', event.currentTarget.value)}
            mb="md"
            required
            description="Found in your Spotify app settings under 'Client Secret'"
          />

          <Group mb="md">
            <Button
              onClick={testSpotifyConnection}
              loading={connectionStatus === 'testing'}
              disabled={!config.spotify.clientId || !config.spotify.clientSecret}
            >
              Test Connection
            </Button>
            <Button
              onClick={handleSaveConfig}
              loading={saving}
              leftSection={<IconCheck size="1rem" />}
              disabled={!isFormValid}
              color={configSaved ? "green" : "blue"}
            variant={configSaved ? "light" : "filled"}
            >
              {saving ? "Saving..." : configSaved ? "Saved ✓" : "Save Configuration"}
            </Button>
          </Group>

          <Stack gap="xs" mb="md">
            {connectionStatus === 'success' && (
              <Alert icon={<IconCheck size="1rem" />} color="green" variant="light">
                Connection successful!
              </Alert>
            )}
            {connectionStatus === 'error' && (
              <Alert icon={<IconX size="1rem" />} color="red" variant="light">
                Connection failed. Please check your credentials.
              </Alert>
            )}
            
          </Stack>

          <Alert color="yellow" variant="light">
            <Text size="sm">
              <strong>Setup Instructions:</strong>
              <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Go to the Spotify Developer Dashboard</li>
                <li>Create a new app or select an existing one</li>
                <li>Copy the Client ID and Client Secret</li>
                <li>Add http://localhost:8000/callback to your app's redirect URIs</li>
              </ol>
            </Text>
          </Alert>
        </Collapse>
      </Paper>
    </>
  );
}