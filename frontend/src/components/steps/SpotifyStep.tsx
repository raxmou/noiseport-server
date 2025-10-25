import { useEffect, useState } from 'react';
import { WizardConfiguration } from '../../types/wizard';
import { useWizardConfig } from '../../hooks/useWizardConfig';
import { Button, Checkbox, TextInput, PasswordInput, Paper, Alert, Anchor } from '../ui';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function SpotifyStep({ config, onUpdate, onValidation }: Props) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  const [saving, setSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const { testConnection } = useWizardConfig();

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
      <h2 className="text-2xl font-kode mb-4">
        Spotify API Configuration
      </h2>
      <p className="text-neutral-400 mb-4">
        Connect to Spotify to enhance music discovery and metadata enrichment.
        Don't worry, you don't need a premium account to use the API.
        We only require basic API access for fetching track and artist information.
      </p>

      <Alert variant="info" icon={
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      } className="mb-4">
        To get Spotify API credentials, visit the{' '}
        <Anchor href="https://developer.spotify.com/dashboard" target="_blank">
          Spotify Developer Dashboard
        </Anchor>{' '}
        and create a new app.
      </Alert>

      <Paper>
        <Checkbox
          label="Enable Spotify Integration"
          checked={config.spotify.enabled}
          onChange={(event) => handleSpotifyToggle(event.currentTarget.checked)}
          className="mb-4"
        />
        
        {config.spotify.enabled && (
          <div className="space-y-4">
            <TextInput
              label="Client ID"
              placeholder="Your Spotify App Client ID"
              value={config.spotify.clientId}
              onChange={(event) => handleSpotifyChange('clientId', event.currentTarget.value)}
              required
              description="Found in your Spotify app settings under 'Client ID'"
            />
            
            <PasswordInput
              label="Client Secret"
              placeholder="Your Spotify App Client Secret"
              value={config.spotify.clientSecret}
              onChange={(event) => handleSpotifyChange('clientSecret', event.currentTarget.value)}
              required
              description="Found in your Spotify app settings under 'Client Secret'"
            />

            <div className="flex gap-2">
              <Button
                onClick={testSpotifyConnection}
                loading={connectionStatus === 'testing'}
                disabled={!config.spotify.clientId || !config.spotify.clientSecret}
                variant="secondary"
              >
                Test Connection
              </Button>
              <Button
                onClick={handleSaveConfig}
                loading={saving}
                disabled={!isFormValid}
                variant={configSaved ? "outline" : "primary"}
                leftSection={configSaved ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : undefined}
              >
                {saving ? "Saving..." : configSaved ? "Saved ✓" : "Save Configuration"}
              </Button>
            </div>

            {connectionStatus === 'success' && (
              <Alert variant="success" icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              }>
                Connection successful!
              </Alert>
            )}
            
            {connectionStatus === 'error' && (
              <Alert variant="error" icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              }>
                Connection failed. Please check your credentials.
              </Alert>
            )}

            <Alert variant="warning" icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            }>
              <div className="text-sm">
                <strong>Setup Instructions:</strong>
                <ol className="list-decimal ml-5 mt-2 space-y-1">
                  <li>Go to the Spotify Developer Dashboard</li>
                  <li>Create a new app or select an existing one</li>
                  <li>Copy the Client ID and Client Secret</li>
                  <li>Add http://localhost:8000/callback to your app's redirect URIs</li>
                </ol>
              </div>
            </Alert>
          </div>
        )}
      </Paper>
    </>
  );
}