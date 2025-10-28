import { useEffect, useState } from 'react';
import { WizardConfiguration } from '../../types/wizard';
import { Button, Checkbox, TextInput, PasswordInput, Paper, Alert } from '../ui';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function FeaturesStep({ config, onUpdate, onValidation }: Props) {
  const [saving, setSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartSuccess, setRestartSuccess] = useState(false);

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

  const handleLastfmSecretChange = (secret: string) => {
    onUpdate({
      features: { ...config.features, lastfmSecret: secret }
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

  const handleRestartNavidrome = async () => {
    setRestarting(true);
    setRestartSuccess(false);
    try {
      const response = await fetch('/api/v1/config/restart-navidrome', {
        method: 'POST',
      });
      
      if (response.ok) {
        setRestartSuccess(true);
        console.log('Navidrome container restarted successfully');
      } else {
        console.error('Failed to restart Navidrome container');
      }
    } catch (error) {
      console.error('Error restarting Navidrome container:', error);
    }
    setRestarting(false);
  };

  const isFormValid = !config.features.scrobbling || 
    (config.features.scrobbling && 
     config.features.lastfmApiKey.trim() !== '' && 
     config.features.lastfmSecret.trim() !== '');

  return (
    <>
      <h2 className="text-2xl font-kode mb-4">
        Additional Features
      </h2>
      <p className="text-neutral-400 mb-6">
        Configure optional features for enhanced functionality. Scrobbling allows you to track 
        your listening history and send data to Last.fm for music discovery and statistics.
      </p>

      <Paper>
        <div className="space-y-4">
          <div>
            <Checkbox
              label="Enable Scrobbling"
              checked={config.features.scrobbling}
              onChange={(event) => handleScrobblingToggle(event.currentTarget.checked)}
            />
            <p className="text-sm text-neutral-400 ml-8 mt-1">
              Track your listening history and send data to Last.fm
            </p>
          </div>
          
          {config.features.scrobbling && (
            <div className="ml-8 space-y-4">
              <TextInput
                label="Last.fm API Key"
                placeholder="Your Last.fm API Key"
                value={config.features.lastfmApiKey}
                onChange={(event) => handleLastfmApiKeyChange(event.currentTarget.value)}
                required
                description="Get your API key from https://www.last.fm/api/account/create"
              />
              
              <PasswordInput
                label="Last.fm API Secret"
                placeholder="Your Last.fm API Secret"
                value={config.features.lastfmSecret}
                onChange={(event) => handleLastfmSecretChange(event.currentTarget.value)}
                required
                description="Get your API secret from https://www.last.fm/api/account/create"
              />
              
              <Alert variant="info" icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              }>
                <div className="text-sm">
                  <strong>Setup Instructions:</strong>
                  <ol className="list-decimal ml-5 mt-2 space-y-1">
                    <li>Visit the Last.fm API account creation page</li>
                    <li>Create a new application</li>
                    <li>Copy both the API Key and API Secret</li>
                    <li>Save the configuration to enable scrobbling</li>
                  </ol>
                </div>
              </Alert>
            </div>
          )}

          <div className="mt-6 flex gap-2">
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
              {saving ? "Saving..." : configSaved ? "Saved" : "Save Configuration"}
            </Button>
            
            {configSaved && config.features.scrobbling && (
              <Button
                onClick={handleRestartNavidrome}
                loading={restarting}
                variant="secondary"
                leftSection={restartSuccess ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                )}
              >
                {restarting ? "Restarting..." : restartSuccess ? "Restarted" : "Restart Navidrome"}
              </Button>
            )}
          </div>
          
          {restartSuccess && (
            <Alert variant="success" icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            }>
              Navidrome container restarted successfully with new Last.fm credentials!
            </Alert>
          )}
        </div>
      </Paper>
    </>
  );
}