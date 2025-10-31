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
  state?: string;
  status?: string;
}

export interface ServiceStatusResponse {
  services: {
    navidrome: ServiceInfo;
    jellyfin: ServiceInfo;
    slskd: ServiceInfo;
    fastapi: ServiceInfo;
  };
}

export interface ContainerLogsResponse {
  container: string;
  logs: string;
}

export interface DockerEvent {
  type: string;
  action: string;
  name: string;
  timestamp: string;
}

export interface DockerEventsResponse {
  events: DockerEvent[];
}

export interface StackStatusResponse {
  project: string;
  services: {
    [serviceName: string]: {
      name: string;
      status: string;
      state: string;
      id: string;
    };
  };
  count: number;
  error?: string;
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

  static async getContainerLogs(containerName: string): Promise<ContainerLogsResponse> {
    const response = await fetch(`${API_BASE}/config/container-logs/${containerName}`);
    
    if (!response.ok) {
      throw new Error('Failed to get container logs');
    }
    return response.json();
  }

  static async getDockerEvents(): Promise<DockerEventsResponse> {
    const response = await fetch(`${API_BASE}/config/docker-events`);
    
    if (!response.ok) {
      throw new Error('Failed to get Docker events');
    }
    return response.json();
  }

  static async getStackStatus(): Promise<StackStatusResponse> {
    const response = await fetch(`${API_BASE}/config/stack-status`);
    
    if (!response.ok) {
      throw new Error('Failed to get stack status');
    }
    return response.json();
  }

  static async stopStack(): Promise<{success: boolean; message: string}> {
    const response = await fetch(`${API_BASE}/config/stack-stop`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to stop stack');
    }
    return response.json();
  }

  static async pullStackImages(): Promise<{success: boolean; message: string}> {
    const response = await fetch(`${API_BASE}/config/stack-pull`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to pull stack images');
    }
    return response.json();
  }

  static async getMachineIP(): Promise<{ip: string}> {
    const response = await fetch(`${API_BASE}/config/machine-ip`);
    
    if (!response.ok) {
      throw new Error('Failed to get machine IP');
    }
    return response.json();
  }
}