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
import { IconInfoCircle, IconCheck, IconX } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';
import { useWizardConfig } from '../../hooks/useWizardConfig';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function FeaturesStep({ config, onUpdate, onValidation }: Props) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const { saveFeaturesConfig } = useWizardConfig();

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
    setSaveStatus('saving');
    try {
      await saveFeaturesConfig();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  };

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
              loading={saveStatus === 'saving'}
              variant="outline"
            >
              Save Config
            </Button>
          </Group>

          <Stack gap="xs">
            {saveStatus === 'success' && (
              <Alert icon={<IconCheck size="1rem" />} color="blue" variant="light">
                Features configuration saved successfully!
              </Alert>
            )}
            {saveStatus === 'error' && (
              <Alert icon={<IconX size="1rem" />} color="red" variant="light">
                Failed to save configuration. Please try again.
              </Alert>
            )}
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}