import { useEffect, useState } from 'react';
import { WizardConfiguration } from '../../types/wizard';
import { useWizardConfig } from '../../hooks/useWizardConfig';
import { ApiService } from '../../utils/api';

// Configuration constants
const RESTART_STATUS_CHECK_DELAY = 3000; // 3 seconds delay before re-testing Tailscale status

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
    // Step is valid if Tailscale is disabled or if it's enabled and has valid IP
    const isValid = !config.tailscale.enabled || (config.tailscale.enabled && !!config.tailscale.ip);
    onValidation(isValid);
  }, [config.tailscale.enabled, config.tailscale.ip, onValidation]);

  const extractTailscaleIP = (message: string): string | null => {
    // Extract IP from message like "Tailscale is running. Your IP: 100.64.1.2"
    const ipRegex = /Your IP: ((?:100\.6[4-9]|100\.[7-9]\d|100\.1[0-1]\d|100\.12[0-7])\.\d{1,3}\.\d{1,3})/;
    const match = message.match(ipRegex);
    return match ? match[1] : null;
  };

  const handleTailscaleToggle = (enabled: boolean) => {
    onUpdate({
      tailscale: {
        ...config.tailscale,
        enabled
      }
    });
  };

  const handleIPChange = (ip: string) => {
    onUpdate({
      tailscale: {
        ...config.tailscale,
        ip
      }
    });
  };

  const checkTailscaleStatus = async () => {
    setConnectionStatus('testing');
    setConnectionMessage(null);

    try {
      const response = await ApiService.checkTailscaleStatus();
      
      if (response.status === 'success') {
        setConnectionStatus('success');
        setConnectionMessage(response.message);
        
        // Extract and auto-fill IP if found
        const extractedIP = extractTailscaleIP(response.message);
        if (extractedIP) {
          handleIPChange(extractedIP);
        }

        // Auto-save configuration when Tailscale status is successful
        await saveConfig();
      } else {
        setConnectionStatus('error');
        setConnectionMessage(response.message);
        setShowRestartSection(true);
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage('Failed to check Tailscale status. Please try again.');
      setShowRestartSection(true);
    }
  };

  const restartContainers = async () => {
    setRestartStatus('restarting');
    setRestartMessage(null);

    try {
      const response = await ApiService.restartContainers();
      
      if (response.status === 'success') {
        setRestartStatus('success');
        setRestartMessage(response.message);
        
        // Wait a bit then automatically re-test Tailscale status
        setTimeout(() => {
          checkTailscaleStatus();
        }, RESTART_STATUS_CHECK_DELAY);
      } else {
        setRestartStatus('error');
        setRestartMessage(response.message);
      }
    } catch (error) {
      setRestartStatus('error');
      setRestartMessage('Failed to restart containers. Please try again.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-kode font-semibold text-primary mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Tailscale VPN Setup
        </h2>
        <p className="text-neutral-300 mb-6">
          Tailscale creates a secure, private network that lets you access your NoisePort servers from anywhere. With Tailscale, you can stream your music remotely while keeping everything secure and private.
        </p>

        <div className="alert alert-info mb-6">
          <div className="flex">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium mb-2">What is Tailscale?</p>
              <p className="text-sm">
                Tailscale is a zero-config VPN that creates a secure mesh network between your devices. It makes your NoisePort servers accessible from anywhere without exposing them to the internet.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-kode font-medium mb-4">Setup Instructions</h3>
        <ol className="space-y-6">
          <li className="flex">
            <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">1</span>
            <div className="flex-1">
              <p className="font-medium mb-2">Install Tailscale on this machine:</p>
              <p className="text-sm text-neutral-400 mb-3">
                Spin up a new terminal on the remote machine and if Tailscale is not installed, run the following command:
              </p>
              <code className="block bg-neutral-800 p-3 rounded text-sm">
                # Linux/macOS<br />
                curl -fsSL https://tailscale.com/install.sh | sh
              </code>
              <p className="text-sm text-neutral-400 mt-2">
                If you use Windows, download the installer from the{' '}
                <a href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Tailscale Downloads Page
                  <svg className="w-3 h-3 inline ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                </a>
              </p>
            </div>
          </li>

          <li className="flex">
            <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">2</span>
            <div className="flex-1">
              <p className="font-medium mb-2">Connect this machine to your Tailscale network:</p>
              <code className="block bg-neutral-800 p-3 rounded text-sm mb-2">
                sudo tailscale up
              </code>
              <p className="text-sm text-neutral-400">
                This will open a browser window to authenticate with your Tailscale account. From experience, redirection link once authenticated may fail on first try. If you authenticate but you still see the authentication URL in the terminal, simply abort and rerun the command to get the connection established.
              </p>
            </div>
          </li>

          <li className="flex">
            <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">3</span>
            <div className="flex-1">
              <p className="font-medium mb-2">Install Tailscale on your other devices:</p>
              <p className="text-sm text-neutral-400">
                Install the Tailscale app on your phone, laptop, or other devices where you want to access your music.
              </p>
            </div>
          </li>
        </ol>
      </div>

      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <input
            type="checkbox"
            id="enable-tailscale"
            checked={config.tailscale.enabled}
            onChange={(e) => handleTailscaleToggle(e.target.checked)}
            className="w-4 h-4 text-primary bg-neutral-800 border-neutral-600 rounded focus:ring-primary focus:ring-2"
          />
          <label htmlFor="enable-tailscale" className="font-medium">Enable Tailscale Integration</label>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">Check Tailscale Status</p>
            <p className="text-sm text-neutral-400">
              Verify that Tailscale is installed and running on this machine
            </p>
          </div>
          <button
            onClick={checkTailscaleStatus}
            disabled={connectionStatus === 'testing'}
            className="btn-outline disabled:opacity-50"
          >
            {connectionStatus === 'testing' ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking...
              </span>
            ) : (
              'Check Status'
            )}
          </button>
        </div>

        {connectionStatus === 'success' && (
          <div className="alert alert-success mt-4">
            <div className="flex">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p>Tailscale is installed and connected! Your machine is ready for remote access.</p>
                {connectionMessage && (
                  <p className="text-sm mt-1">{connectionMessage}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="alert alert-error mt-4">
            <div className="flex">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p>Tailscale is not detected or not connected. Please follow the installation steps above or contact support on the Noiseport Discord server.</p>
                {connectionMessage && (
                  <p className="text-sm mt-1">{connectionMessage}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showRestartSection && (
        <div className="card">
          <h3 className="text-lg font-kode font-medium mb-4">Container Restart</h3>
          <p className="text-neutral-300 mb-4">
            If you've just installed Tailscale, you may need to restart the containers to ensure proper network configuration.
          </p>
          
          <button
            onClick={restartContainers}
            disabled={restartStatus === 'restarting'}
            className="btn-primary disabled:opacity-50"
          >
            {restartStatus === 'restarting' ? 'Restarting...' : 'Restart Containers'}
          </button>

          {restartStatus === 'success' && (
            <div className="alert alert-success mt-4">
              <p>Containers restarted successfully! Re-testing Tailscale status...</p>
              {restartMessage && <p className="text-sm mt-1">{restartMessage}</p>}
            </div>
          )}

          {restartStatus === 'error' && (
            <div className="alert alert-error mt-4">
              <p className="font-medium">Container Restart Failed</p>
              {restartMessage && <p className="text-sm mt-1">{restartMessage}</p>}
            </div>
          )}
        </div>
      )}

      {config.tailscale.enabled && (
        <div className="card">
          <label className="block text-sm font-medium mb-2">
            Tailscale IP Address <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="100.64.1.2"
            value={config.tailscale.ip}
            onChange={(e) => handleIPChange(e.target.value)}
            className="input w-full"
            required
          />
          <p className="text-sm text-neutral-400 mt-1">
            Your Tailscale IP address (automatically detected if status check succeeds)
          </p>
        </div>
      )}

      <div className="alert alert-info">
        <div>
          <p className="font-medium mb-2">Benefits of using Tailscale:</p>
          <ul className="text-sm space-y-1">
            <li>🔒 End-to-end encrypted connections</li>
            <li>🌐 Access your music from anywhere in the world</li>
            <li>🚫 No port forwarding or firewall configuration needed</li>
            <li>📱 Works on all devices (phones, tablets, computers)</li>
            <li>⚡ Fast peer-to-peer connections when possible</li>
          </ul>
        </div>
      </div>
    </div>
  );
}