export interface BlueIrisConfig {
  serverUrl: string;
  username: string;
  password: string;
  session?: string;
}

export interface Camera {
  id: string;
  name: string;
  shortName: string;
  enabled: boolean;
  recording: boolean;
  alerts: boolean;
  status: 'online' | 'offline' | 'error';
  lastUpdate?: string;
  thumbnailUrl?: string;
  streamUrl?: string;
  width?: number;
  height?: number;
  fps?: number;
  isOnline?: boolean;
  isRecording?: boolean;
  isAlerting?: boolean;
}

export interface BlueIrisResponse {
  result: string;
  session: string;
  data?: any;
}

// Resolve serverUrl: ha relatív (/bi-proxy), production-ban az index.php proxy kezeli.
function buildProxyUrl(serverUrl: string, path: string, query: string = ''): string {
  const baseUrl = serverUrl.replace(/\/$/, '')
  if (baseUrl.endsWith('/index.php')) {
    const url = `${baseUrl}?path=${encodeURIComponent(path)}`
    return query ? `${url}&${query}` : url
  }
  return query ? `${baseUrl}/${path}?${query}` : `${baseUrl}/${path}`
}

export class BlueIrisAPI {
  private config: BlueIrisConfig;
  private session: string = '';

  constructor(config: BlueIrisConfig) {
    this.config = config;
  }

  private async makeRequest(cmd: string, params: any = {}): Promise<BlueIrisResponse> {
    const requestBody = {
      cmd,
      session: this.session || '0',
      ...params
    };

    const response = await fetch(buildProxyUrl(this.config.serverUrl, 'json'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async login(): Promise<boolean> {
    try {
      const response = await this.makeRequest('login', {
        user: this.config.username,
        pw: this.config.password
      });

      if (response.result === 'success' && response.session) {
        this.session = response.session;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  async getCameras(): Promise<Camera[]> {
    try {
      const response = await this.makeRequest('camlist');
      
      if (response.result === 'success' && response.data) {
        return response.data.map((cam: any) => ({
          id: cam.optionValue,
          name: cam.optionDisplay,
          shortName: cam.optionValue,
          enabled: cam.isEnabled,
          recording: cam.isRecording,
          alerts: cam.isAlerting,
          status: cam.isOnline ? 'online' : 'offline',
          lastUpdate: new Date().toISOString(),
          isOnline: cam.isOnline,
          isRecording: cam.isRecording,
          isAlerting: cam.isAlerting
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get cameras:', error);
      return [];
    }
  }

  async getSystemStatus(): Promise<any> {
    try {
      const response = await this.makeRequest('status');
      return response.result === 'success' ? response.data : null;
    } catch (error) {
      console.error('Failed to get system status:', error);
      return null;
    }
  }

  getCameraStreamUrl(camera: Camera, format: 'mjpeg' | 'jpeg' | 'h264' = 'mjpeg'): string {
    const baseUrl = this.config.serverUrl.endsWith('/') 
      ? this.config.serverUrl.slice(0, -1) 
      : this.config.serverUrl;

    switch (format) {
      case 'mjpeg':
        return buildProxyUrl(baseUrl, `mjpg/${camera.id}/video.mjpg`, `session=${encodeURIComponent(this.session)}`);
      case 'jpeg':
        return buildProxyUrl(baseUrl, `image/${camera.id}`, `q=75&s=100&session=${encodeURIComponent(this.session)}`);
      case 'h264':
        return buildProxyUrl(baseUrl, `h264/${camera.id}/temp.m3u8`, `session=${encodeURIComponent(this.session)}`);
      default:
        return buildProxyUrl(baseUrl, `mjpg/${camera.id}/video.mjpg`, `session=${encodeURIComponent(this.session)}`);
    }
  }

  getCameraThumbnail(camera: Camera): string {
    const baseUrl = this.config.serverUrl.endsWith('/') 
      ? this.config.serverUrl.slice(0, -1) 
      : this.config.serverUrl;

    return buildProxyUrl(baseUrl, `image/${camera.id}`, `q=60&s=100&session=${encodeURIComponent(this.session)}&timestamp=${Date.now()}`);
  }

  getSession(): string {
    return this.session;
  }

  isLoggedIn(): boolean {
    return !!this.session;
  }
}