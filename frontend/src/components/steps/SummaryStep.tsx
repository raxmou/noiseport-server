import { useEffect } from 'react';
import { WizardConfiguration } from '../../types/wizard';
import { Paper, Alert } from '../ui';

interface Props {
  config: WizardConfiguration;
  onValidation: (valid: boolean) => void;
}

export default function SummaryStep({ config, onValidation }: Props) {
  useEffect(() => {
    onValidation(true);
  }, [onValidation]);

  const enabledServices = [
    config.navidrome.enabled && 'Navidrome',
    config.jellyfin.enabled && 'Jellyfin', 
    config.spotify.enabled && 'Spotify',
    config.soulseek.enabled && 'Soulseek/slskd',
  ].filter(Boolean) as string[];

  const enabledFeatures = [
    config.features.scrobbling && 'Scrobbling',
    config.features.downloads && 'Downloads',
    config.features.discovery && 'Music Discovery',
  ].filter(Boolean) as string[];

  return (
    <>
      <h2 className="text-2xl font-kode mb-4">
        Configuration Summary
      </h2>
      <p className="text-neutral-400 mb-6">
        Review your configuration before completing the setup. You can go back to any 
        previous step to make changes if needed.
      </p>

      <div className="space-y-4">
        <Paper>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Local Libraries</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              enabledServices.includes('Navidrome') || enabledServices.includes('Jellyfin') 
                ? 'bg-green-900/30 text-green-200' 
                : 'bg-neutral-700 text-neutral-300'
            }`}>
              {enabledServices.includes('Navidrome') || enabledServices.includes('Jellyfin') ? 'Configured' : 'Skipped'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {config.navidrome.enabled ? (
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm">Navidrome: {config.navidrome.enabled ? config.navidrome.url : 'Disabled'}</span>
            </div>
            <div className="flex items-center gap-2">
              {config.jellyfin.enabled ? (
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm">Jellyfin: {config.jellyfin.enabled ? config.jellyfin.url : 'Disabled'}</span>
            </div>
          </div>
        </Paper>

        <Paper>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Spotify API</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              config.spotify.enabled ? 'bg-green-900/30 text-green-200' : 'bg-neutral-700 text-neutral-300'
            }`}>
              {config.spotify.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {config.spotify.enabled ? (
            <p className="text-sm">Client ID: {config.spotify.clientId.substring(0, 8)}...</p>
          ) : (
            <p className="text-sm text-neutral-400">Not configured</p>
          )}
        </Paper>

        <Paper>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Soulseek/slskd</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              config.soulseek.enabled ? 'bg-green-900/30 text-green-200' : 'bg-neutral-700 text-neutral-300'
            }`}>
              {config.soulseek.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {config.soulseek.enabled ? (
            <div className="space-y-1">
              <p className="text-sm">Host: {config.soulseek.host}</p>
              <p className="text-sm">Username: {config.soulseek.username}</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Not configured</p>
          )}
        </Paper>

        <Paper>
          <h3 className="font-medium mb-4">Music Paths</h3>
          <div className="space-y-1">
            <p className="text-sm">Base Path: {config.musicPaths?.hostMusicPath}</p>
            <p className="text-sm text-neutral-400">Downloads: {config.musicPaths?.hostMusicPath}/downloads</p>
            <p className="text-sm text-neutral-400">Complete: {config.musicPaths?.hostMusicPath}/complete</p>
          </div>
        </Paper>

        <Paper>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Optional Features</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              enabledFeatures.length > 0 ? 'bg-blue-900/30 text-blue-200' : 'bg-neutral-700 text-neutral-300'
            }`}>
              {enabledFeatures.length} enabled
            </span>
          </div>
          <div className="space-y-2">
            {enabledFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
            {enabledFeatures.length === 0 && (
              <p className="text-sm text-neutral-400">No optional features enabled</p>
            )}
          </div>
        </Paper>

        <Alert variant="info" icon={
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        }>
          <p className="text-sm">
            Once you complete the setup, these settings will be saved and the application
            will be ready to use. You can always modify these settings later through 
            the application interface.
          </p>
        </Alert>
      </div>
    </>
  );
}