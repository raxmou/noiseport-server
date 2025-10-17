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
  Divider,
  Stack,
} from '@mantine/core';
import { IconCheck, IconX, IconInfoCircle } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';
import { useWizardConfig } from '../../hooks/useWizardConfig';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function SoulseekStep({ config, onUpdate, onValidation }: Props) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [restartStatus, setRestartStatus] = useState<'idle' | 'restarting' | 'success' | 'error'>('idle');
  const { testConnectionAndSave } = useWizardConfig();

  useEffect(() => {
    const isValid = !config.soulseek.enabled || 
      Boolean(config.soulseek.host && config.soulseek.username && config.soulseek.password &&
              config.soulseek.soulseekUsername && config.soulseek.soulseekPassword);
    onValidation(isValid);
  }, [config.soulseek, onValidation]);

  useEffect(() => {
    // Auto-set host using Tailscale IP if available
    if (config.tailscale.enabled && config.tailscale.ip && !config.soulseek.host.includes(config.tailscale.ip)) {
      onUpdate({
        soulseek: { ...config.soulseek, host: `http://${config.tailscale.ip}:5030` }
      });
    }
  }, [config.tailscale, config.soulseek.host, onUpdate]);

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
      console.log('Saving configuration before testing:', config);
      // Save config before testing
      const saveResponse = await fetch('/api/v1/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      console.log('Saved configuration before testing:');
      if (!saveResponse.ok) {
        setConnectionStatus('error');
        return;
      }
      // Now test connection
      const success = await testConnectionAndSave('soulseek', config.soulseek);
      setConnectionStatus(success ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  };

  const restartSlskdContainer = async () => {
    setRestartStatus('restarting');
    try {
      const response = await fetch('/api/v1/config/restart-slskd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        setRestartStatus('success');
        setTimeout(() => setRestartStatus('idle'), 3000);
      } else {
        setRestartStatus('error');
      }
    } catch {
      setRestartStatus('error');
    }
  };

  const isFormValid = config.soulseek.host && config.soulseek.username && config.soulseek.password &&
                     config.soulseek.soulseekUsername && config.soulseek.soulseekPassword;

  return (
    <>
      <Title order={2} mb="md">
        Soulseek/slskd Configuration
      </Title>
      <Text c="dimmed" mb="md">
        Configure your Soulseek connection for music downloading. This is the core 
        component for finding and downloading music from the Soulseek network.
      </Text>

      <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light" mb="xl">
        <Stack gap="xs">
          <Text fw={500}>Understanding slskd vs Soulseek</Text>
          <Text size="sm">
            <strong>slskd</strong> is the daemon/server that runs on your machine and provides a web interface for Soulseek.
            It requires its own credentials (slskd username/password) to access the web interface.
          </Text>
          <Text size="sm">
            <strong>Soulseek</strong> is the actual peer-to-peer network where you share and download music.
            You need a Soulseek account (Soulseek username/password) to connect to the network and download files.
          </Text>
        </Stack>
      </Alert>

      <Paper p="md" withBorder>
        <Checkbox
          label="Enable Soulseek/slskd Integration"
          checked={config.soulseek.enabled}
          onChange={(event) => handleSoulseekToggle(event.currentTarget.checked)}
          mb="md"
        />
        
        <Collapse in={config.soulseek.enabled}>
          <Title order={4} mb="md">slskd Daemon Configuration</Title>
          <Text size="sm" c="dimmed" mb="md">
            These credentials are for accessing the slskd web interface (the daemon that manages Soulseek connections).
          </Text>
          
          <TextInput
            label="slskd Host URL"
            placeholder="http://slskd:5030"
            value={config.soulseek.host}
            onChange={(event) => handleSoulseekChange('host', event.currentTarget.value)}
            mb="md"
            required
            description={config.tailscale.enabled && config.tailscale.ip ? 
              `Automatically set using Tailscale IP: ${config.tailscale.ip}` : 
              "The URL where your slskd instance is running"}
          />
          
          <Group grow mb="md">
            <TextInput
              label="slskd Username"
              placeholder="slskd"
              value={config.soulseek.username}
              onChange={(event) => handleSoulseekChange('username', event.currentTarget.value)}
              required
              description="Username for the slskd web interface"
            />
            <PasswordInput
              label="slskd Password"
              placeholder="slskd"
              value={config.soulseek.password}
              onChange={(event) => handleSoulseekChange('password', event.currentTarget.value)}
              required
              description="Password for the slskd web interface"
            />
          </Group>

          <Divider my="xl" />

          <Title order={4} mb="md">Soulseek Network Configuration</Title>
          <Text size="sm" c="dimmed" mb="md">
            These credentials are for your Soulseek network account (the actual P2P network for downloading music).
          </Text>

          <Group grow mb="md">
            <TextInput
              label="Soulseek Username"
              placeholder="your_soulseek_username"
              value={config.soulseek.soulseekUsername}
              onChange={(event) => handleSoulseekChange('soulseekUsername', event.currentTarget.value)}
              required
              description="Your Soulseek network username"
            />
            <PasswordInput
              label="Soulseek Password"
              placeholder="your_soulseek_password"
              value={config.soulseek.soulseekPassword}
              onChange={(event) => handleSoulseekChange('soulseekPassword', event.currentTarget.value)}
              required
              description="Your Soulseek network password"
            />
          </Group>

          <Group mb="md">
            <Button
              onClick={testSoulseekConnection}
              loading={connectionStatus === 'testing'}
              disabled={!isFormValid}
            >
              Test slskd Connection
            </Button>
            {connectionStatus === 'success' && (
              <Alert icon={<IconCheck size="1rem" />} color="green" variant="light">
                slskd connection successful!
              </Alert>
            )}
            {connectionStatus === 'error' && (
              <Alert icon={<IconX size="1rem" />} color="red" variant="light">
                Connection failed. Please check your slskd configuration.
              </Alert>
            )}
          </Group>

          {connectionStatus === 'success' && (
            <Paper p="md" withBorder bg="green.0" mt="md">
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={500}>Restart slskd Container</Text>
                  <Text size="sm" c="dimmed">
                    Restart the slskd container to apply your Soulseek network credentials
                  </Text>
                </div>
                <Button
                  onClick={restartSlskdContainer}
                  loading={restartStatus === 'restarting'}
                  color="green"
                >
                  Restart slskd
                </Button>
              </Group>

              {restartStatus === 'success' && (
                <Alert icon={<IconCheck size="1rem" />} color="green" variant="light" mt="md">
                  slskd container restarted successfully! Soulseek credentials have been applied.
                </Alert>
              )}
              
              {restartStatus === 'error' && (
                <Alert icon={<IconX size="1rem" />} color="red" variant="light" mt="md">
                  Failed to restart slskd container. Please restart manually or check the logs.
                </Alert>
              )}
            </Paper>
          )}

          <Alert color="blue" variant="light" mt="md">
            <Text size="sm">
              <strong>Note:</strong> Make sure your slskd instance is running and accessible 
              at the specified URL. The Soulseek network credentials will be saved to the slskd 
              configuration and applied when you restart the container.
            </Text>
          </Alert>
        </Collapse>
      </Paper>
    </>
  );
}