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
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';
import { useWizardConfig } from '../../hooks/useWizardConfig';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function SoulseekStep({ config, onUpdate, onValidation }: Props) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const { testConnection } = useWizardConfig();

  useEffect(() => {
    const isValid = !config.soulseek.enabled || 
      Boolean(config.soulseek.host && config.soulseek.username && config.soulseek.password);
    onValidation(isValid);
  }, [config.soulseek, onValidation]);

  const handleSoulseekToggle = (enabled: boolean) => {
    onUpdate({
      soulseek: { ...config.soulseek, enabled }
    });
  };

  const handleSoulseekChange = (field: string, value: string) => {
    onUpdate({
      soulseek: { ...config.soulseek, [field]: value }
    });
  };

  const testSoulseekConnection = async () => {
    setConnectionStatus('testing');
    try {
      const success = await testConnection('soulseek', config.soulseek);
      setConnectionStatus(success ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  };

  const isFormValid = config.soulseek.host && config.soulseek.username && config.soulseek.password;

  return (
    <>
      <Title order={2} mb="md">
        Soulseek/slskd Configuration
      </Title>
      <Text c="dimmed" mb="md">
        Configure your Soulseek connection for music downloading. This is the core 
        component for finding and downloading music from the Soulseek network.
      </Text>

      <Paper p="md" withBorder>
        <Checkbox
          label="Enable Soulseek/slskd Integration"
          checked={config.soulseek.enabled}
          onChange={(event) => handleSoulseekToggle(event.currentTarget.checked)}
          mb="md"
        />
        
        <Collapse in={config.soulseek.enabled}>
          <TextInput
            label="slskd Host URL"
            placeholder="http://slskd:5030"
            value={config.soulseek.host}
            onChange={(event) => handleSoulseekChange('host', event.currentTarget.value)}
            mb="md"
            required
            description="The URL where your slskd instance is running"
          />
          
          <Group grow mb="md">
            <TextInput
              label="Username"
              placeholder="slskd"
              value={config.soulseek.username}
              onChange={(event) => handleSoulseekChange('username', event.currentTarget.value)}
              required
              description="Your slskd username"
            />
            <PasswordInput
              label="Password"
              placeholder="slskd"
              value={config.soulseek.password}
              onChange={(event) => handleSoulseekChange('password', event.currentTarget.value)}
              required
              description="Your slskd password"
            />
          </Group>

          <Group mb="md">
            <Button
              onClick={testSoulseekConnection}
              loading={connectionStatus === 'testing'}
              disabled={!isFormValid}
            >
              Test Connection
            </Button>
            {connectionStatus === 'success' && (
              <Alert icon={<IconCheck size="1rem" />} color="green" variant="light">
                Connection successful!
              </Alert>
            )}
            {connectionStatus === 'error' && (
              <Alert icon={<IconX size="1rem" />} color="red" variant="light">
                Connection failed. Please check your slskd configuration.
              </Alert>
            )}
          </Group>

          <Alert color="blue" variant="light">
            <Text size="sm">
              <strong>Note:</strong> Make sure your slskd instance is running and accessible 
              at the specified URL. The default configuration assumes slskd is running 
              in a Docker container on the same network.
            </Text>
          </Alert>
        </Collapse>
      </Paper>
    </>
  );
}