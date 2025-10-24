import { useEffect, useState } from 'react';
import { WizardConfiguration } from '../../types/wizard';
import { useWizardConfig } from '../../hooks/useWizardConfig';
import { ApiService } from '../../utils/api';
import { Button, Checkbox, TextInput, Paper, Alert, Anchor, Code } from '../ui';

const RESTART_STATUS_CHECK_DELAY = 3000;

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function TailscaleStep({ config, onUpdate, onValidation }: Props) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [restartStatus, setRestartStatus] = useState<'idle' | 'restarting' | 'success' | 'error'>('idle');
  const [restartMessage, setRestartMessage] = useState<string | null>(null);
  const [showRestartSection, setShowRestartSection] = useState(false);
  const { saveConfig } = useWizardConfig();

  useEffect(() => {
    const isValid = !config.tailscale.enabled || (config.tailscale.enabled && !!config.tailscale.ip);
    onValidation(isValid);
  }, [config.tailscale.enabled, config.tailscale.ip, onValidation]);

  const extractTailscaleIP = (message: string): string | null => {
    const ipRegex = /Your IP: ((?:100\.6[4-9]|100\.[7-9]\d|100\.1[0-1]\d|100\.12[0-7])\.\d{1,3}\.\d{1,3})/;
    const match = message.match(ipRegex);
    return match ? match[1] : null;
  };

  const checkTailscaleStatus = async () => {
    setConnectionStatus('testing');
    setConnectionMessage(null);
    try {
      const response = await fetch('/api/v1/config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'tailscale',
          config: {}
        })
      });
      const result = await response.json();
      
      if (result.success) {
        setConnectionStatus('success');
        setConnectionMessage(result.message || null);
        
        const tailscaleIP = extractTailscaleIP(result.message || '');
        if (tailscaleIP) {
          onUpdate({
            tailscale: { 
              enabled: true, 
              ip: tailscaleIP 
            }
          });
        }
        
        try {
          await saveConfig();
        } catch (err) {
          console.error('Failed to auto-save config after Tailscale test:', err);
        }

        if (!showRestartSection) {
          setShowRestartSection(true);
        }
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.message || null);
        setShowRestartSection(false);
      }
    } catch {
      setConnectionStatus('error');
      setConnectionMessage(null);
      setShowRestartSection(false);
    }
  };

  const restartContainers = async () => {
    setRestartStatus('restarting');
    setRestartMessage(null);
    
    try {
      const result = await ApiService.restartContainers();
      
      if (result.overall_status === 'success') {
        setRestartStatus('success');
        setRestartMessage('Development containers restarted successfully! Tailscale integration is now active.');
        
        setTimeout(() => {
          checkTailscaleStatus();
        }, RESTART_STATUS_CHECK_DELAY);
      } else {
        setRestartStatus('error');
        setRestartMessage(result.message || 'Some containers failed to restart. Check the logs for details.');
      }
    } catch (error) {
      setRestartStatus('error');
      setRestartMessage('Failed to restart containers. Please check your Docker setup.');
      console.error('Container restart error:', error);
    }
  };

  const handleTailscaleToggle = (enabled: boolean) => {
    onUpdate({
      tailscale: { ...config.tailscale, enabled }
    });
  };

  const handleIPChange = (value: string) => {
    onUpdate({
      tailscale: { ...config.tailscale, ip: value }
    });
  };

  return (
    <>
      <h2 className="text-2xl font-kode mb-4 flex items-center gap-2">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Tailscale VPN Setup
      </h2>
      
      <p className="text-neutral-400 mb-6">
        Tailscale creates a secure, private network that lets you access your NoisePort servers from anywhere.
        With Tailscale, you can stream your music remotely while keeping everything secure and private.
      </p>

      <Alert variant="info" className="mb-6">
        <div className="space-y-2">
          <p className="font-medium">What is Tailscale?</p>
          <p className="text-sm">
            Tailscale is a zero-config VPN that creates a secure mesh network between your devices.
            It makes your NoisePort servers accessible from anywhere without exposing them to the internet.
          </p>
        </div>
      </Alert>

      <Paper className="mb-6">
        <h3 className="text-lg font-kode mb-4">Setup Instructions</h3>
        
        <ol className="space-y-4 list-decimal ml-5">
          <li>
            <p className="font-medium mb-2">Install Tailscale on this machine:</p>
            <p className="text-sm text-neutral-400 mb-2">
              Spin up a new terminal on the remote machine and if Tailscale is not installed, run the following command:
            </p>
            
            <Code block>
{`# Linux/macOS
curl -fsSL https://tailscale.com/install.sh | sh`}
            </Code>
            <p className="text-sm text-neutral-400">
              If you use Windows, download the installer from the{' '}
              <Anchor href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer">
                Tailscale Downloads Page
              </Anchor>
            </p>
          </li>

          <li>
            <p className="font-medium mb-2">Connect this machine to your Tailscale network:</p>
            <Code block>sudo tailscale up</Code>
            <p className="text-sm text-neutral-400 mt-2">
              This will open a browser window to authenticate with your Tailscale account.
              From experience, redirection link once authenticated may fail on first try. If you authenticate but you still see the authentication URL in the terminal, simply abort and rerun the command to get the connection established.
            </p>
          </li>

          <li>
            <p className="font-medium mb-2">Install Tailscale on your other devices:</p>
            <p className="text-sm text-neutral-400">
              Install the Tailscale app on your phone, laptop, or other devices where you want to access your music.
            </p>
          </li>
        </ol>
      </Paper>

      <Paper className="mb-6">
        <Checkbox
          label="Enable Tailscale Integration"
          checked={config.tailscale.enabled}
          onChange={(event) => handleTailscaleToggle(event.currentTarget.checked)}
          className="mb-4"
        />
        
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">Check Tailscale Status</p>
            <p className="text-sm text-neutral-400">
              Verify that Tailscale is installed and running on this machine
            </p>
          </div>
          <Button
            onClick={checkTailscaleStatus}
            loading={connectionStatus === 'testing'}
            variant="secondary"
          >
            Check Status
          </Button>
        </div>

        {connectionStatus === 'success' && (
          <Alert variant="success" icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          } className="mt-4">
            <div>
              Tailscale is installed and connected! Your machine is ready for remote access.
              {connectionMessage && (
                <p className="mt-2 text-sm text-green-200">
                  {connectionMessage}
                </p>
              )}
            </div>
          </Alert>
        )}
        
        {connectionStatus === 'error' && (
          <Alert variant="error" icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          } className="mt-4">
            <div>
              Tailscale is not detected or not connected. Please follow the installation steps above or contact support on the Noiseport Discord server.
              {connectionMessage && (
                <p className="mt-2 text-sm text-red-200">
                  {connectionMessage}
                </p>
              )}
            </div>
          </Alert>
        )}
      </Paper>

      {showRestartSection && connectionStatus === 'success' && (
        <Paper className="bg-blue-900/20 border-blue-700/30 mb-6">
          <Alert variant="info" icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          } className="mb-4">
            <div className="space-y-2">
              <p className="font-medium">Container Restart Required</p>
              <p className="text-sm">
                For Tailscale integration to work properly, the development containers need to be restarted 
                to mount the Tailscale socket and network configuration.
              </p>
            </div>
          </Alert>

          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Restart Development Containers</p>
              <p className="text-sm text-neutral-400">
                This will restart the FastAPI and other containers to enable Tailscale integration
              </p>
            </div>
            <Button
              onClick={restartContainers}
              loading={restartStatus === 'restarting'}
              variant="primary"
              leftSection={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              {restartStatus === 'restarting' ? 'Restarting...' : 'Restart Containers'}
            </Button>
          </div>

          {restartStatus === 'restarting' && (
            <div className="bg-neutral-900 rounded p-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <p className="text-sm">Restarting containers...</p>
              </div>
              <div className="mt-2 w-full bg-neutral-800 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
              </div>
            </div>
          )}

          {restartStatus === 'success' && (
            <Alert variant="success" icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            } className="mt-4">
              <div>
                <p className="font-medium">Containers Restarted Successfully!</p>
                <p className="mt-2 text-sm">
                  {restartMessage}
                </p>
              </div>
            </Alert>
          )}
          
          {restartStatus === 'error' && (
            <Alert variant="error" icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            } className="mt-4">
              <div>
                <p className="font-medium">Container Restart Failed</p>
                <p className="mt-2 text-sm">
                  {restartMessage}
                </p>
              </div>
            </Alert>
          )}
        </Paper>
      )}

      {config.tailscale.enabled && (
        <Paper className="mb-6">
          <TextInput
            label="Tailscale IP Address"
            placeholder="100.64.1.2"
            value={config.tailscale.ip}
            onChange={(event) => handleIPChange(event.currentTarget.value)}
            description="Your Tailscale IP address (automatically detected if status check succeeds)"
            required
          />
        </Paper>
      )}

      <Alert variant="warning" icon={
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      }>
        <div className="text-sm">
          <p className="font-medium mb-2">Benefits of using Tailscale:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>🔒 End-to-end encrypted connections</li>
            <li>🌐 Access your music from anywhere in the world</li>
            <li>🚫 No port forwarding or firewall configuration needed</li>
            <li>📱 Works on all devices (phones, tablets, computers)</li>
            <li>⚡ Fast peer-to-peer connections when possible</li>
          </ul>
        </div>
      </Alert>
    </>
  );
}
