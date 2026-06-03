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
}

export interface BlueIrisSession {
  session: string;
  response: string;
  data?: {
    session: string;
  };
}

export interface BlueIrisCameraList {
  result: string;
  session: string;
  data: Array<{
    optionValue: string;
    optionDisplay: string;
    isEnabled: boolean;
    isOnline: boolean;
    isRecording: boolean;
    isAlerting: boolean;
  }>;
}

export interface BlueIrisStatus {
  result: string;
  session: string;
  data: {
    signal: number;
    lock: number;
    admin: boolean;
    latitude: number;
    longitude: number;
    profile: number;
    schedule: number;
    schedules: string[];
    profiles: string[];
    clips: number;
    warnings: number;
    alerts: number;
    mem: number;
    cpu: number;
    audio: boolean;
    dio: number;
    version: string;
  };
}

export interface StreamSettings {
  quality: number;
  fps: number;
  format: 'mjpeg' | 'h264' | 'jpeg';
  scale: number;
}