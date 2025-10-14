import { useEffect } from 'react';
import {
  Title,
  Text,
  Checkbox,
  Paper,
  Stack,
  Alert,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function FeaturesStep({ config, onUpdate, onValidation }: Props) {
  useEffect(() => {
    onValidation(true);
  }, [onValidation]);

  const handleFeatureToggle = (feature: keyof typeof config.features, enabled: boolean) => {
    onUpdate({
      features: { ...config.features, [feature]: enabled }
    });
  };

  return (
    <>
      <Title order={2} mb="md">
        Optional Features
      </Title>
      <Text c="dimmed" mb="md">
        Choose which additional features you'd like to enable. All of these are optional
        and can be configured later through the main application interface.
      </Text>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Checkbox
            label="Enable Scrobbling"
            description="Track your listening history and send data to Last.fm"
            checked={config.features.scrobbling}
            onChange={(event) => handleFeatureToggle('scrobbling', event.currentTarget.checked)}
          />
          
          <Checkbox
            label="Enable Downloads"
            description="Allow automatic downloading of music from Soulseek"
            checked={config.features.downloads}
            onChange={(event) => handleFeatureToggle('downloads', event.currentTarget.checked)}
          />
          
          <Checkbox
            label="Enable Music Discovery"
            description="Get recommendations and discover new music based on your library"
            checked={config.features.discovery}
            onChange={(event) => handleFeatureToggle('discovery', event.currentTarget.checked)}
          />
        </Stack>

        <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light" mt="md">
          <Text size="sm">
            <strong>Feature Details:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li><strong>Scrobbling:</strong> Requires Last.fm account configuration</li>
              <li><strong>Downloads:</strong> Core functionality for music acquisition</li>
              <li><strong>Discovery:</strong> Uses Spotify API and local library analysis</li>
            </ul>
            You can always enable or disable these features later in the application settings.
          </Text>
        </Alert>
      </Paper>
    </>
  );
}