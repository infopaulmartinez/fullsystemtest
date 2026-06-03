import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera as CameraIcon,
  Shield,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Activity,
  Clock,
  Database,
} from 'lucide-react';
import { CameraGrid } from '../components/security/CameraGrid';
import { CameraViewer } from '../components/security/CameraViewer';


export default function Security() {
  const {
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
    getCameraThumbnail
  } = useBlueIris();

  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingConfig, setEditingConfig] = useState(config);

  // Sync editing config when hook's config changes
  useEffect(() => {
    setEditingConfig(config);
  }, [config]);

  const handleCameraSelect = (camera: Camera) => {
    setSelectedCamera(camera);
  };

  const handleCameraClose = () => {
    setSelectedCamera(null);
    setIsFullscreen(false);
  };

  const handleSaveSettings = async () => {
    if (!editingConfig.serverUrl || !editingConfig.username || !editingConfig.password) {
      return;
    }

    setConfig(editingConfig);
    setShowSettings(false);
  };

  const handleRefresh = async () => {
    await loadCameras();
  };

  const getConnectionStatusIcon = () => {
    if (isLoading) return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    if (isConnected) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  };

  const getOnlineCameraCount = () => {
    return cameras.filter((camera) => camera.status === 'online').length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Shield className="h-8 w-8 mr-3 text-blue-600" />
            Biztonsági Rendszer
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Blue Iris kamerarendszer vezérlése és megfigyelése
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading || !isConnected}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Frissítés
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Settings className="h-4 w-4 mr-2" />
            Beállítások
          </button>

          {config.serverUrl && (
            <a
              href={config.serverUrl.startsWith('http') ? config.serverUrl : `http://${config.serverUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Blue Iris megnyitása
            </a>
          )}
        </div>
      </div>

      {/* Connection Status & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Kapcsolat állapota
              </p>
              <p className={`text-2xl font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isLoading ? 'Kapcsolódás...' : isConnected ? 'Online' : 'Offline'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate w-40">
                {config.serverUrl || 'Nincs beállítva'}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl flex-shrink-0">
              {getConnectionStatusIcon()}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Kamerák</p>
              <p className="text-2xl font-bold text-blue-600">
                {getOnlineCameraCount()}/{cameras.length}
              </p>
              {isConnected && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {cameras.filter((c) => c.recording).length} rögzít
                </p>
              )}
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex-shrink-0">
              <CameraIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Rendszer terhelés
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {systemStatus?.cpu?.toFixed(1) || '--'}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">CPU használat</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex-shrink-0">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Memória</p>
              <p className="text-2xl font-bold text-orange-600">
                {systemStatus?.mem?.toFixed(1) || '--'}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Használt memória</p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex-shrink-0">
              <Database className="h-5 w-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Kapcsolati hiba
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Message if not connected */}
      {!isConnected && !isLoading && !error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Nincs kapcsolat a Blue Iris szerverrel
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Kérjük, adja meg a kapcsolati beállításokat a{' '}
                <button
                  onClick={() => setShowSettings(true)}
                  className="underline hover:no-underline"
                >
                  beállítások
                </button>{' '}
                menüben.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected Camera View or Camera Grid */}
      {selectedCamera ? (
        <CameraViewer
          camera={selectedCamera}
          isFullscreen={isFullscreen}
          onClose={handleCameraClose}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          getCameraStreamUrl={getCameraStreamUrl}
        />
      ) : (
        !isLoading && (
          <CameraGrid
            cameras={cameras}
            onCameraSelect={handleCameraSelect}
            getCameraThumbnail={getCameraThumbnail}
          />
        )
      )}

      {/* Loading state */}
      {isLoading && !selectedCamera && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Kamerák betöltése...</p>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-md">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Blue Iris beállítások
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Szerver kapcsolat és kamera konfiguráció
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Connection Status */}
              <div className={`p-4 rounded-xl ${
                isLoading
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : isConnected
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center">
                  {isLoading ? (
                    <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0 animate-spin" />
                  ) : isConnected ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
                  )}
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      isLoading
                        ? 'text-blue-800 dark:text-blue-200'
                        : isConnected
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {isLoading ? 'Kapcsolódás...' : isConnected ? 'Sikeres kapcsolat' : 'Nincs kapcsolat'}
                    </p>
                    <p className={`text-xs ${
                      isLoading
                        ? 'text-blue-700 dark:text-blue-300'
                        : isConnected
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {isLoading
                        ? 'Kapcsolat létesítése a szerverrel...'
                        : isConnected
                        ? `${cameras.length} kamera észlelve`
                        : error || 'Ellenőrizze a beállításokat.'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Server Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Blue Iris szerver URL
                  </label>
                  <input
                    type="text"
                    value={editingConfig.serverUrl}
                    onChange={(e) => setEditingConfig({...editingConfig, serverUrl: e.target.value})}
                    placeholder="http://192.168.1.100:81"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Felhasználónév
                    </label>
                    <input
                      type="text"
                      value={editingConfig.username}
                      onChange={(e) => setEditingConfig({...editingConfig, username: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Jelszó
                    </label>
                    <input
                      type="password"
                      value={editingConfig.password}
                      onChange={(e) => setEditingConfig({...editingConfig, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={isLoading}
                >
                  Mégse
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={isLoading || !editingConfig.serverUrl || !editingConfig.username || !editingConfig.password}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Mentés...' : 'Mentés és kapcsolódás'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}