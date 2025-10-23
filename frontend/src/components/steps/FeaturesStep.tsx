import { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Checkbox,
  TextInput,
  Button,
  Paper,
  Stack,
  Alert,
  Collapse,
  Group,
} from '@mantine/core';
import { IconInfoCircle, IconCheck,  } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';


interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function FeaturesStep({ config, onUpdate, onValidation }: Props) {
  const [saving, setSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  

  useEffect(() => {
    onValidation(true);
  }, [onValidation]);

  const handleScrobblingToggle = (enabled: boolean) => {
    onUpdate({
      features: { ...config.features, scrobbling: enabled }
    });
  };

  const handleLastfmApiKeyChange = (apiKey: string) => {
    onUpdate({
      features: { ...config.features, lastfmApiKey: apiKey }
    });
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
  const isFormValid = !config.features.scrobbling || (config.features.scrobbling && config.features.lastfmApiKey.trim() !== '');
  return (
    <>
      <Title order={2} mb="md">
        Additional Features
      </Title>
      <Text c="dimmed" mb="md">
        Configure optional features for enhanced functionality. Scrobbling allows you to track 
        your listening history and send data to Last.fm for music discovery and statistics.
      </Text>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Checkbox
            label="Enable Scrobbling"
            description="Track your listening history and send data to Last.fm"
            checked={config.features.scrobbling}
            onChange={(event) => handleScrobblingToggle(event.currentTarget.checked)}
          />
          
          <Collapse in={config.features.scrobbling}>
            <TextInput
              label="Last.fm API Key"
              placeholder="Your Last.fm API Key"
              value={config.features.lastfmApiKey}
              onChange={(event) => handleLastfmApiKeyChange(event.currentTarget.value)}
              mt="md"
              required
              description="Get your API key from https://www.last.fm/api/account/create"
            />
            
            <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light" mt="md">
              <Text size="sm">
                <strong>Setup Instructions:</strong>
                <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Visit the Last.fm API account creation page</li>
                  <li>Create a new application</li>
                  <li>Copy the API Key and paste it above</li>
                  <li>Save the configuration to enable scrobbling</li>
                </ol>
              </Text>
            </Alert>
          </Collapse>

          <Group mt="md">
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

          
        </Stack>
      </Paper>
    </>
  );
}