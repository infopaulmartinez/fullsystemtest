import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera as CameraIcon, 
  Maximize2, 
  Minimize2, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Settings,
  X,
  Monitor,
  Smartphone
} from 'lucide-react';
import { Camera } from '../../types/blueiris';

interface CameraViewerProps {
  camera: Camera;
  isFullscreen: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
  getCameraStreamUrl: (camera: Camera, format: 'mjpeg' | 'jpeg' | 'h264') => string;
  className?: string;
}

interface StreamSettings {
  quality: number;
  fps: number;
  format: 'mjpeg' | 'h264' | 'jpeg';
  scale: number;
}

export const CameraViewer: React.FC<CameraViewerProps> = ({
  camera,
  isFullscreen,
  onClose,
  onToggleFullscreen,
  getCameraStreamUrl,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [streamSettings, setStreamSettings] = useState<StreamSettings>({
    quality: 75,
    fps: 15,
    format: 'mjpeg',
    scale: 100
  });
  
  const videoRef = useRef<HTMLImageElement>(null);
  const streamUrl = getCameraStreamUrl(camera, streamSettings.format);

  const refreshStream = () => {
    if (videoRef.current) {
      const url = new URL(videoRef.current.src);
      url.searchParams.set('t', Date.now().toString());
      videoRef.current.src = url.toString();
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Auto-refresh MJPEG stream
  useEffect(() => {
    if (streamSettings.format === 'mjpeg' && isPlaying) {
      const interval = setInterval(refreshStream, 30000);
      return () => clearInterval(interval);
    }
  }, [streamSettings.format, isPlaying]);

  const StreamContent = () => {
    if (!isPlaying) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="bg-gray-800 rounded-full p-6 mb-4 mx-auto w-fit">
              <Pause className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Stream szüneteltetve</h3>
            <p className="text-gray-400">Kattintson a lejátszás gombra a folytatáshoz</p>
          </div>
        </div>
      );
    }

    switch (streamSettings.format) {
      case 'mjpeg':
        return (
          <img
            ref={videoRef}
            src={streamUrl}
            alt={camera.name}
            className="w-full h-full object-contain"
            onError={() => {
              console.error('Stream error for camera:', camera.id);
            }}
          />
        );

      case 'h264':
        return (
          <video
            className="w-full h-full object-contain"
            autoPlay
            muted={isMuted}
            controls={false}
            onError={() => {
              console.error('Video stream error for camera:', camera.id);
            }}
          >
            <source src={streamUrl} type="application/x-mpegURL" />
            Böngészője nem támogatja a H.264 streamet.
          </video>
        );

      case 'jpeg':
        return (
          <img
            src={streamUrl}
            alt={camera.name}
            className="w-full h-full object-contain"
            onError={() => {
              console.error('Image error for camera:', camera.id);
            }}
          />
        );

      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <div className="text-center text-white">
              <CameraIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p>Nem támogatott stream formátum</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
    } ${className}`}>
      
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <CameraIcon className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {camera.name}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <span className={`inline-flex h-2 w-2 rounded-full ${
                camera.status === 'online' ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
              <span className="capitalize">{camera.status}</span>
              {camera.recording && (
                <span className="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded-full text-xs">
                  REC
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Beállítások"
          >
            <Settings className="h-4 w-4" />
          </button>
          
          <button
            onClick={onToggleFullscreen}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={isFullscreen ? 'Kilépés a teljes képernyőből' : 'Teljes képernyő'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Bezárás"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Formátum
              </label>
              <select
                value={streamSettings.format}
                onChange={(e) => setStreamSettings({...streamSettings, format: e.target.value as any})}
                className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="mjpeg">MJPEG</option>
                <option value="h264">H.264</option>
                <option value="jpeg">JPEG</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minőség
              </label>
              <select
                value={streamSettings.quality}
                onChange={(e) => setStreamSettings({...streamSettings, quality: parseInt(e.target.value)})}
                className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="30">Alacsony (30%)</option>
                <option value="50">Közepes (50%)</option>
                <option value="75">Jó (75%)</option>
                <option value="90">Kiváló (90%)</option>
                <option value="100">Maximális (100%)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                FPS
              </label>
              <select
                value={streamSettings.fps}
                onChange={(e) => setStreamSettings({...streamSettings, fps: parseInt(e.target.value)})}
                className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="5">5 FPS</option>
                <option value="10">10 FPS</option>
                <option value="15">15 FPS</option>
                <option value="20">20 FPS</option>
                <option value="30">30 FPS</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Méret
              </label>
              <select
                value={streamSettings.scale}
                onChange={(e) => setStreamSettings({...streamSettings, scale: parseInt(e.target.value)})}
                className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Video Area */}
      <div className={`bg-black relative ${
        isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-[400px] md:h-[500px] lg:h-[600px]'
      }`}>
        <StreamContent />
      </div>

      {/* Controls */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePlay}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title={isPlaying ? 'Szüneteltetés' : 'Lejátszás'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          
          <button
            onClick={refreshStream}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Frissítés"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {streamSettings.format === 'h264' && (
            <button
              onClick={toggleMute}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={isMuted ? 'Hang bekapcsolása' : 'Némítás'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            {isFullscreen ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {streamSettings.format.toUpperCase()} • {streamSettings.quality}% • {streamSettings.fps} FPS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};