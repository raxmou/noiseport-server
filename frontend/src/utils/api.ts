import { WizardConfiguration, ConfigValidationResponse } from '../types/wizard';

const API_BASE = '/api/v1';

export class ApiService {
  static async getCurrentConfig(): Promise<WizardConfiguration> {
    const response = await fetch(`${API_BASE}/config`);
    if (!response.ok) {
      throw new Error('Failed to fetch configuration');
    }
    return response.json();
  }

  static async saveConfiguration(config: WizardConfiguration): Promise<void> {
    const response = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save configuration');
    }
  }

  static async validateConfiguration(config: Partial<WizardConfiguration>): Promise<ConfigValidationResponse> {
    const response = await fetch(`${API_BASE}/config/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error('Failed to validate configuration');
    }
    return response.json();
  }

  static async testConnection(service: string, config: any): Promise<boolean> {
    const response = await fetch(`${API_BASE}/config/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ service, config }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to test connection');
    }
    const result = await response.json();
    return result.success;
  }
}