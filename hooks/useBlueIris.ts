import { useState, useEffect, useCallback, useRef } from 'react';
import { BlueIrisAPI, BlueIrisConfig, Camera } from '../lib/blueiris';

const STORAGE_KEY = 'blueiris_config';

// CORS FIX: Fejlesztési módban a Vite proxy-n keresztül érjük el a Blue Iris szervert.
// A böngésző nem enged cross-origin hívást a 45.130.240.216:82-re, de a Vite proxy
// /bi-proxy útvonalon átengedi és törli az X-Frame-Options / CORS fejléceket.
const BI_PROXY_SERVER = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
  ? '/bi-proxy'
  : '/bi-proxy/index.php'

const DEFAULT_CONFIG: BlueIrisConfig = {
  serverUrl: BI_PROXY_SERVER,
  username: 'web',
  password: '12345678',
};

function loadConfig(): BlueIrisConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function useBlueIris() {
  const [config, setConfigState] = useState<BlueIrisConfig>(loadConfig);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<{ cpu?: number; mem?: number } | null>(null);

  const apiRef = useRef<BlueIrisAPI | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create/update API instance when config changes
  useEffect(() => {
    apiRef.current = new BlueIrisAPI(config);
  }, [config]);

  const setConfig = useCallback((newConfig: BlueIrisConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    setConfigState(newConfig);
    setIsConnected(false);
    setCameras([]);
    setError(null);
  }, []);

  const login = useCallback(async () => {
    if (!apiRef.current || !config.serverUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const ok = await apiRef.current.login();
      if (ok) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
        setError('Bejelentkezés sikertelen – ellenőrizze a felhasználónevet és jelszót.');
      }
    } catch (e: any) {
      setIsConnected(false);
      setError('Nem sikerült kapcsolódni: ' + (e.message || 'Ismeretlen hiba'));
    } finally {
      setIsLoading(false);
    }
  }, [config.serverUrl]);

  const loadCameras = useCallback(async () => {
    if (!apiRef.current) return;
    try {
      const cams = await apiRef.current.getCameras();
      if (cams.length > 0) {
        setCameras(cams);
        setIsConnected(true);
        setError(null);
      }
    } catch (e: any) {
      // Don't disconnect on refresh error – just log
      console.warn('Camera refresh error:', e.message);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    if (!apiRef.current || !isConnected) return;
    try {
      const status = await apiRef.current.getSystemStatus();
      if (status) setSystemStatus(status);
    } catch {}
  }, [isConnected]);

  const getCameraStreamUrl = useCallback(
    (camera: Camera, format: 'mjpeg' | 'jpeg' | 'h264' = 'mjpeg') => {
      return apiRef.current?.getCameraStreamUrl(camera, format) ?? '';
    },
    []
  );

  const getCameraThumbnail = useCallback((camera: Camera) => {
    return apiRef.current?.getCameraThumbnail(camera) ?? '';
  }, []);

  // Auto-connect on mount and when config changes
  useEffect(() => {
    if (!config.serverUrl) return;

    let cancelled = false;
    async function connect() {
      setIsLoading(true);
      setError(null);
      try {
        const ok = await apiRef.current!.login();
        if (cancelled) return;
        if (ok) {
          setIsConnected(true);
          const cams = await apiRef.current!.getCameras();
          if (!cancelled && cams.length > 0) setCameras(cams);
          const status = await apiRef.current!.getSystemStatus();
          if (!cancelled && status) setSystemStatus(status);
        } else {
          setIsConnected(false);
          setError('Bejelentkezés sikertelen. Ellenőrizze az adatokat.');
        }
      } catch (e: any) {
        if (!cancelled) {
          setIsConnected(false);
          setError('Kapcsolódási hiba: ' + (e.message || 'Ismeretlen hiba'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    connect();

    // Poll every 10 seconds
    pollRef.current = setInterval(() => {
      if (!cancelled) {
        loadCameras();
        loadStatus();
      }
    }, 10000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [config.serverUrl, config.username, config.password]);

  return {
    config,
    setConfig,
    cameras,
    isConnected,
    isLoading,
    error,
    systemStatus,
    login,
    loadCameras,
    getCameraStreamUrl,
    getCameraThumbnail,
  };
}
