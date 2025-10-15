import { useState, useCallback } from 'react';
import { WizardConfiguration } from '../types/wizard';
import { ApiService } from '../utils/api';

const defaultConfig: WizardConfiguration = {
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
  },
  musicPaths: {
    hostMusicPath: './music',
  },
  features: {
    scrobbling: false,
    downloads: true,
    discovery: false,
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

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    updateConfig,
    testConnection,
  };
};