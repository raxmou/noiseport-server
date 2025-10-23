import { WizardConfiguration, ConfigValidationResponse } from '../types/wizard';

const API_BASE = '/api/v1';

export interface ContainerRestartResult {
  container: string;
  status: 'success' | 'error';
  message: string;
}

export interface RestartContainersResponse {
  message: string;
  overall_status: 'success' | 'partial_failure' | 'error';
  containers: ContainerRestartResult[];
  next_steps: string[];
}

export interface ServiceInfo {
  running: boolean;
  url: string;
}

export interface ServiceStatusResponse {
  services: {
    navidrome: ServiceInfo;
    jellyfin: ServiceInfo;
    slskd: ServiceInfo;
    fastapi: ServiceInfo;
  };
}

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

  static async restartContainers(): Promise<RestartContainersResponse> {
    const response = await fetch(`${API_BASE}/config/restart-containers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to restart containers');
    }
    return response.json();
  }

  static async getServiceStatus(): Promise<ServiceStatusResponse> {
    const response = await fetch(`${API_BASE}/config/service-status`);
    
    if (!response.ok) {
      throw new Error('Failed to get service status');
    }
    return response.json();
  }
}