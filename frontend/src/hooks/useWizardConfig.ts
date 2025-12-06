import { useState, useCallback } from 'react';
import { WizardConfiguration } from '../types/wizard';
import { ApiService } from '../utils/api';

const defaultConfig: WizardConfiguration = {
  tailscale: {
    enabled: false,
    ip: '',
  },
  headscale: {
    enabled: false,
    setupMode: 'domain',
    domain: '',
    serverIp: '',
    serverUrl: '',
    apiKey: '',
    baseDomain: 'headscale.local',
  },
  navidrome: {
    enabled: false,
    url: '',
    username: '',
    password: '',
  },
  jellyfin: {
    enabled: false,
    url: '',
    username: '',
    password: '',
  },
  spotify: {
    enabled: false,
    clientId: '',
    clientSecret: '',
  },
  soulseek: {
    enabled: true,
    host: 'http://slskd:5030',
    username: 'slskd',
    password: 'slskd',
    soulseekUsername: '',
    soulseekPassword: '',
  },
  musicPaths: {
    hostMusicPath: './music',
  },
  features: {
    scrobbling: false,
    downloads: true,
    discovery: false,
    lastfmApiKey: '',
    lastfmSecret: '',
  },
};

export const useWizardConfig = () => {
  const [config, setConfig] = useState<WizardConfiguration>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const currentConfig = await ApiService.getCurrentConfig();
      setConfig(currentConfig);
    } catch (err) {
      setError('Failed to load configuration');
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await ApiService.saveConfiguration(config);
    } catch (err) {
      setError('Failed to save configuration');
      console.error('Error saving config:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config]);

  const updateConfig = useCallback((updates: Partial<WizardConfiguration>) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
      musicPaths: {
        ...prev.musicPaths,
        ...(updates.musicPaths || {}),
      },
      features: {
        ...prev.features,
        ...(updates.features || {}),
      },
      spotify: {
        ...prev.spotify,
        ...(updates.spotify || {}),
      },
      
      // Add similar merging for other nested objects if needed
    }));
  }, []);

  const testConnection = useCallback(async (service: string, serviceConfig: any) => {
    try {
      return await ApiService.testConnection(service, serviceConfig);
    } catch (err) {
      console.error('Error testing connection:', err);
      return false;
    }
  }, []);

  const testConnectionAndSave = useCallback(async (service: string, serviceConfig: any) => {
    try {
      const success = await ApiService.testConnection(service, serviceConfig);
      if (success) {
        // Save the configuration automatically when connection is successful
        await ApiService.saveConfiguration(config);
      }
      return success;
    } catch (err) {
      console.error('Error testing connection:', err);
      return false;
    }
  }, [config]);

  const saveSoulseekConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Save the complete config with current soulseek settings
      await ApiService.saveConfiguration(config);
    } catch (err) {
      setError('Failed to save Soulseek configuration');
      console.error('Error saving Soulseek config:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config]);

  const saveSpotifyConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Save the complete config with current spotify settings
      await ApiService.saveConfiguration(config);
    } catch (err) {
      setError('Failed to save Spotify configuration');
      console.error('Error saving Spotify config:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config]);

  const saveFeaturesConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Save the complete config with current features settings
      await ApiService.saveConfiguration(config);
    } catch (err) {
      setError('Failed to save features configuration');
      console.error('Error saving features config:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config]);

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    updateConfig,
    testConnection,
    testConnectionAndSave,
    saveSoulseekConfig,
    saveSpotifyConfig,
    saveFeaturesConfig,
  };
};