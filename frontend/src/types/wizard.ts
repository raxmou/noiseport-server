export interface WizardConfiguration {
  // Local libraries
  navidrome: {
    enabled: boolean;
    url: string;
    username: string;
    password: string;
  };
  jellyfin: {
    enabled: boolean;
    url: string;
    username: string;
    password: string;
  };
  
  // Spotify API
  spotify: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
  };
  
  // Soulseek/slskd
  soulseek: {
    enabled: boolean;
    host: string;
    username: string;
    password: string;
  };
  
  // Music folder paths
  musicPaths: {
    hostDownloadPath: string;
    hostCompletePath: string;
    downloadPath: string;
    completePath: string;
  };
  
  // Optional features
  features: {
    scrobbling: boolean;
    downloads: boolean;
    discovery: boolean;
  };
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  valid: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ConfigValidationResponse {
  valid: boolean;
  errors: ValidationError[];
}