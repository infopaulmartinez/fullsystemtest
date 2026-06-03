import React from 'react';
import { Camera as CameraIcon, Play, AlertTriangle, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { Camera } from '../../types/blueiris';

interface CameraGridProps {
  cameras: Camera[];
  onCameraSelect: (camera: Camera) => void;
  getCameraThumbnail: (camera: Camera) => string;
  className?: string;
}

export const CameraGrid: React.FC<CameraGridProps> = ({
  cameras,
  onCameraSelect,
  getCameraThumbnail,
  className = ''
}) => {
  if (cameras.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center ${className}`}>
        <CameraIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Nincsenek elérhető kamerák
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Ellenőrizze a Blue Iris szerver kapcsolatot és a kamera beállításokat.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <CameraIcon className="h-5 w-5 mr-2 text-blue-600" />
        Kamerák ({cameras.length})
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cameras.map((camera) => (
          <CameraCard
            key={camera.id}
            camera={camera}
            onClick={() => onCameraSelect(camera)}
            thumbnailUrl={getCameraThumbnail(camera)}
          />
        ))}
      </div>
    </div>
  );
};

interface CameraCardProps {
  camera: Camera;
  onClick: () => void;
  thumbnailUrl: string;
}

const CameraCard: React.FC<CameraCardProps> = ({ camera, onClick, thumbnailUrl }) => {
  const getStatusIcon = () => {
    switch (camera.status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Wifi className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (camera.status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'error':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div 
      onClick={onClick}
      className="bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 group"
    >
      <div className="aspect-video bg-black relative overflow-hidden">
        <img 
          src={thumbnailUrl}
          alt={camera.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkthbWVyYSBuZW0gZWzDqXJoZXTFkTwvdGV4dD48L3N2Zz4=";
          }}
        />
        
        {/* Status indicator */}
        <div className="absolute top-2 left-2 flex items-center space-x-1">
          <span className={`inline-flex h-3 w-3 rounded-full ${getStatusColor()}`}></span>
          {camera.recording && (
            <div className="bg-red-500 rounded-full p-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            </div>
          )}
        </div>

        {/* Alert indicator */}
        {camera.alerts && (
          <div className="absolute top-2 right-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400 animate-pulse" />
          </div>
        )}
        
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="bg-white bg-opacity-90 rounded-full p-3">
            <Play className="h-6 w-6 text-gray-800" />
          </div>
        </div>
      </div>
      
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate mr-2">
            {camera.name}
          </h3>
          {getStatusIcon()}
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="capitalize">{camera.status}</span>
          <div className="flex items-center space-x-2">
            {camera.recording && (
              <span className="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded-full text-xs">
                REC
              </span>
            )}
            {camera.alerts && (
              <span className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full text-xs">
                ALERT
              </span>
            )}
          </div>
        </div>
        
        {camera.lastUpdate && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Frissítve: {new Date(camera.lastUpdate).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
};