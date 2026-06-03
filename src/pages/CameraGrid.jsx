import React, { useState, useEffect } from 'react'
import { 
  Camera, 
  RefreshCw, 
  AlertCircle, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Maximize2,
  Settings,
  Eye,
  EyeOff,
  Wifi,
  WifiOff
} from 'lucide-react'

const CameraGrid = ({ cameras, onRefresh, loading, onCameraSelect }) => {
  const [refreshing, setRefreshing] = useState(false)
  const [playingCameras, setPlayingCameras] = useState(new Set())
  const [mutedCameras, setMutedCameras] = useState(new Set())
  const [hiddenCameras, setHiddenCameras] = useState(new Set())

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const togglePlay = (cameraId) => {
    const newPlaying = new Set(playingCameras)
    if (newPlaying.has(cameraId)) {
      newPlaying.delete(cameraId)
    } else {
      newPlaying.add(cameraId)
    }
    setPlayingCameras(newPlaying)
  }

  const toggleMute = (cameraId) => {
    const newMuted = new Set(mutedCameras)
    if (newMuted.has(cameraId)) {
      newMuted.delete(cameraId)
    } else {
      newMuted.add(cameraId)
    }
    setMutedCameras(newMuted)
  }

  const toggleVisibility = (cameraId) => {
    const newHidden = new Set(hiddenCameras)
    if (newHidden.has(cameraId)) {
      newHidden.delete(cameraId)
    } else {
      newHidden.add(cameraId)
    }
    setHiddenCameras(newHidden)
  }

  const getCameraStreamUrl = (camera) => {
    // BlueIris MJPEG stream URL formátum
    const baseUrl = 'http://45.130.240.216:82'
    return `${baseUrl}/mjpg/${camera.id}/video.mjpg`
  }

  const getCameraSnapshotUrl = (camera) => {
    // BlueIris snapshot URL formátum
    const baseUrl = 'http://45.130.240.216:82'
    return `${baseUrl}/image/${camera.id}?q=50&s=100`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Kamerák betöltése...</p>
        </div>
      </div>
    )
  }

  if (!cameras || cameras.length === 0) {
    return (
      <div className="text-center py-12">
        <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Nincsenek elérhető kamerák
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Ellenőrizze a BlueIris szerver kapcsolatot és beállításokat.
        </p>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Újratöltés
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Kamerák ({cameras.length})
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Frissítés
        </button>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cameras.map((camera) => (
          <div
            key={camera.id}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-lg ${
              hiddenCameras.has(camera.id) ? 'opacity-50' : ''
            }`}
          >
            {/* Camera Header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${camera.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {camera.name}
                  </h3>
                </div>
                <div className="flex items-center space-x-1">
                  {camera.isOnline ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            </div>

            {/* Camera Stream */}
            <div className="relative aspect-video bg-gray-900">
              {!hiddenCameras.has(camera.id) && camera.isOnline ? (
                <div className="w-full h-full">
                  {playingCameras.has(camera.id) ? (
                    <img
                      src={getCameraStreamUrl(camera)}
                      alt={camera.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to snapshot on stream error
                        e.target.src = getCameraSnapshotUrl(camera)
                      }}
                    />
                  ) : (
                    <img
                      src={getCameraSnapshotUrl(camera)}
                      alt={camera.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Show placeholder on error
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  )}
                  
                  {/* Placeholder for failed images */}
                  <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-white" style={{ display: 'none' }}>
                    <div className="text-center">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-400">Kép nem elérhető</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    {!camera.isOnline ? (
                      <>
                        <WifiOff className="h-8 w-8 mx-auto mb-2 text-red-400" />
                        <p className="text-sm text-red-400">Kamera offline</p>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-400">Kamera rejtett</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
                <div className="flex space-x-2">
                  <button
                    onClick={() => togglePlay(camera.id)}
                    className="p-2 bg-black bg-opacity-70 text-white rounded-full hover:bg-opacity-90 transition-all"
                  >
                    {playingCameras.has(camera.id) ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => onCameraSelect && onCameraSelect(camera.id)}
                    className="p-2 bg-black bg-opacity-70 text-white rounded-full hover:bg-opacity-90 transition-all"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="absolute top-2 right-2 flex space-x-1">
                {playingCameras.has(camera.id) && (
                  <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                    ÉLŐ
                  </div>
                )}
                {camera.ptz && (
                  <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
                    PTZ
                  </div>
                )}
              </div>
            </div>

            {/* Camera Footer */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {camera.resolution || '1920x1080'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {camera.fps || 30}fps
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => toggleMute(camera.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {mutedCameras.has(camera.id) ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleVisibility(camera.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {hiddenCameras.has(camera.id) ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid Controls */}
      <div className="flex items-center justify-center mt-6 space-x-4">
        <button
          onClick={() => {
            // Start all cameras
            const allCameraIds = cameras.map(c => c.id)
            setPlayingCameras(new Set(allCameraIds))
          }}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
        >
          <Play className="h-4 w-4 mr-2" />
          Összes indítása
        </button>
        <button
          onClick={() => {
            // Stop all cameras
            setPlayingCameras(new Set())
          }}
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
        >
          <Pause className="h-4 w-4 mr-2" />
          Összes leállítása
        </button>
        <button
          onClick={() => {
            // Show all cameras
            setHiddenCameras(new Set())
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Eye className="h-4 w-4 mr-2" />
          Összes megjelenítése
        </button>
      </div>
    </div>
  )
}

export default CameraGrid