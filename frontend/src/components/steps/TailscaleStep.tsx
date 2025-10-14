import { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Button,
  Group,
  Alert,
  Paper,
  Anchor,
  List,
  Stack,
  Code,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconX, IconExternalLink, IconShield } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function TailscaleStep({ onValidation }: Props) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    onValidation(true);
  }, [onValidation]);

  const checkTailscaleStatus = async () => {
    setConnectionStatus('testing');
    try {
      // Check if tailscale is installed and running
      const response = await fetch('/api/v1/config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'tailscale',
          config: {}
        })
      });
      const result = await response.json();
      setConnectionStatus(result.success ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  };

  return (
    <>
      <Title order={2} mb="md">
        <IconShield size="1.5rem" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Tailscale VPN Setup
      </Title>
      
      <Text c="dimmed" mb="xl">
        Tailscale creates a secure, private network that lets you access your music library from anywhere.
        With Tailscale, you can stream your music remotely while keeping everything secure and private.
      </Text>

      <Alert icon={<IconAlertCircle size="1rem" />} color="blue" mb="xl">
        <Stack gap="xs">
          <Text fw={500}>What is Tailscale?</Text>
          <Text size="sm">
            Tailscale is a zero-config VPN that creates a secure mesh network between your devices.
            It makes your music services accessible from anywhere without exposing them to the internet.
          </Text>
        </Stack>
      </Alert>

      <Paper p="xl" withBorder mb="xl">
        <Title order={3} mb="md">Setup Instructions</Title>
        
        <List spacing="md" withPadding>
          <List.Item>
            <Text fw={500} mb="xs">Install Tailscale on this machine:</Text>
            <Group gap="xs" mb="sm">
              <Anchor
                href="https://tailscale.com/download"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Tailscale
                <IconExternalLink size="0.8rem" style={{ marginLeft: '4px' }} />
              </Anchor>
            </Group>
            <Code block mb="sm">
              {`# Linux/macOS
curl -fsSL https://tailscale.com/install.sh | sh

# Windows: Download from website above`}
            </Code>
          </List.Item>

          <List.Item>
            <Text fw={500} mb="xs">Connect this machine to your Tailscale network:</Text>
            <Code block mb="sm">sudo tailscale up</Code>
            <Text size="sm" c="dimmed">
              This will open a browser window to authenticate with your Tailscale account.
            </Text>
          </List.Item>

          <List.Item>
            <Text fw={500} mb="xs">Install Tailscale on your other devices:</Text>
            <Text size="sm" c="dimmed" mb="xs">
              Install the Tailscale app on your phone, laptop, or other devices where you want to access your music.
            </Text>
          </List.Item>

          <List.Item>
            <Text fw={500} mb="xs">Access your services remotely:</Text>
            <Text size="sm" c="dimmed" mb="xs">
              Once connected, you can access your music services using the Tailscale IP address from any device on your network.
            </Text>
            <Alert color="green" variant="light" mt="sm">
              <Text size="sm">
                <strong>Example:</strong> If your Tailscale IP is 100.64.1.2, access Navidrome at http://100.64.1.2:4533
              </Text>
            </Alert>
          </List.Item>
        </List>
      </Paper>

      <Paper p="md" withBorder>
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500}>Check Tailscale Status</Text>
            <Text size="sm" c="dimmed">
              Verify that Tailscale is installed and running on this machine
            </Text>
          </div>
          <Button
            onClick={checkTailscaleStatus}
            loading={connectionStatus === 'testing'}
            variant="outline"
          >
            Check Status
          </Button>
        </Group>

        {connectionStatus === 'success' && (
          <Alert icon={<IconCheck size="1rem" />} color="green" variant="light" mt="md">
            Tailscale is installed and connected! Your machine is ready for remote access.
          </Alert>
        )}
        
        {connectionStatus === 'error' && (
          <Alert icon={<IconX size="1rem" />} color="red" variant="light" mt="md">
            Tailscale is not detected or not connected. Please follow the installation steps above.
          </Alert>
        )}
      </Paper>

      <Alert color="yellow" variant="light" mt="xl">
        <Text size="sm">
          <strong>Benefits of using Tailscale:</strong>
        </Text>
        <List size="sm" mt="xs">
          <List.Item>🔒 End-to-end encrypted connections</List.Item>
          <List.Item>🌐 Access your music from anywhere in the world</List.Item>
          <List.Item>🚫 No port forwarding or firewall configuration needed</List.Item>
          <List.Item>📱 Works on all devices (phones, tablets, computers)</List.Item>
          <List.Item>⚡ Fast peer-to-peer connections when possible</List.Item>
        </List>
      </Alert>
    </>
  );
}