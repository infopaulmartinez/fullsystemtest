import React, { useState, useEffect } from 'react'
import { 
  Map, 
  Navigation, 
  Route as RouteIcon, 
  StopCircle, 
  Fuel, 
  Thermometer, 
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react'
import { 
  trackGPSAPI, 
  TrackGPSVehicle, 
  TrackGPSRoute, 
  TrackGPSStop, 
  TrackGPSConsumption,
  TrackGPSRefill,
  TrackGPSTemperature
} from '../lib/trackgps-api'

interface GPSTrackingDashboardProps {
  selectedVehicle?: string
  onVehicleSelect?: (vehicleId: string) => void
}

export default function GPSTrackingDashboard({ selectedVehicle, onVehicleSelect }: GPSTrackingDashboardProps) {
  const [vehicles, setVehicles] = useState<TrackGPSVehicle[]>([])
  const [routes, setRoutes] = useState<TrackGPSRoute[]>([])
  const [stops, setStops] = useState<TrackGPSStop[]>([])
  const [consumption, setConsumption] = useState<TrackGPSConsumption[]>([])
  const [refills, setRefills] = useState<TrackGPSRefill[]>([])
  const [temperatures, setTemperatures] = useState<TrackGPSTemperature[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'routes' | 'stops' | 'fuel' | 'temperature'>('overview')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadData()
    
    // Set up real-time updates
    const interval = setInterval(loadData, 30000) // Update every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedVehicle) {
      loadVehicleData(selectedVehicle)
    }
  }, [selectedVehicle, dateRange])

  const loadData = async () => {
    try {
      setLoading(true)
      const vehicleData = await trackGPSAPI.getVehicles()
      setVehicles(vehicleData)
    } catch (error) {
      console.error('Error loading GPS data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVehicleData = async (vehicleId: string) => {
    try {
      const [routeData, stopData, consumptionData, refillData, tempData] = await Promise.all([
        trackGPSAPI.getVehicleRoutes(vehicleId, dateRange.start, dateRange.end),
        trackGPSAPI.getVehicleStops(vehicleId, dateRange.start, dateRange.end),
        trackGPSAPI.getFuelConsumption(vehicleId, dateRange.start, dateRange.end),
        trackGPSAPI.getRefills(vehicleId, dateRange.start, dateRange.end),
        trackGPSAPI.getTemperatures(vehicleId, dateRange.start, dateRange.end)
      ])
      
      setRoutes(routeData)
      setStops(stopData)
      setConsumption(consumptionData)
      setRefills(refillData)
      setTemperatures(tempData)
    } catch (error) {
      console.error('Error loading vehicle data:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'moving': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'stopped': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'offline': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'online': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'moving': return 'Mozgásban'
      case 'stopped': return 'Leállítva'
      case 'offline': return 'Offline'
      case 'online': return 'Online'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'moving': return <Activity className="h-4 w-4" />
      case 'stopped': return <StopCircle className="h-4 w-4" />
      case 'offline': return <WifiOff className="h-4 w-4" />
      case 'online': return <Wifi className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('hu-HU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('hu-HU')
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}ó ${minutes}p`
  }

  const calculateTotalDistance = () => {
    return routes.reduce((total, route) => total + route.distance, 0)
  }

  const calculateTotalStops = () => {
    return stops.length
  }

  const calculateTotalConsumption = () => {
    return consumption.reduce((total, item) => total + item.totalConsumption, 0)
  }

  const calculateTotalRefills = () => {
    return refills.reduce((total, refill) => total + refill.amount, 0)
  }

  const onlineVehicles = vehicles.filter(v => v.status === 'moving' || v.status === 'stopped' || v.status === 'online')
  const movingVehicles = vehicles.filter(v => v.status === 'moving')
  const stoppedVehicles = vehicles.filter(v => v.status === 'stopped')
  const offlineVehicles = vehicles.filter(v => v.status === 'offline')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Map className="h-7 w-7 mr-3 text-blue-600" />
            GPS Tracking Dashboard
          </h2>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Valós idejű járműkövetés és adatelemzés
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Időszak:
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Frissítés
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Online járművek</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{onlineVehicles.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
              <Wifi className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {vehicles.length} összesen
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Mozgásban</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{movingVehicles.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {stoppedVehicles.length} leállítva
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Offline</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{offlineVehicles.length}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
              <WifiOff className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Kapcsolat hiányzik
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Átlagsebesség</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(movingVehicles.reduce((total, v) => total + v.lastPosition.speed, 0) / (movingVehicles.length || 1))} km/h
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Mozgó járművek
          </div>
        </div>
      </div>

      {/* Vehicle List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Járművek állapota
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Jármű
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sofőr
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Állapot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Helyzet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sebesség
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Utolsó frissítés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                        <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {vehicle.plateNumber}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {vehicle.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {vehicle.driverName || 'Nincs hozzárendelve'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                      {getStatusIcon(vehicle.status)}
                      <span className="ml-2">{getStatusText(vehicle.status)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {vehicle.lastPosition.latitude.toFixed(4)}, {vehicle.lastPosition.longitude.toFixed(4)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {Math.round(vehicle.lastPosition.speed)} km/h
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatTime(vehicle.lastPosition.timestamp)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onVehicleSelect?.(vehicle.id)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Részletek
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Vehicle Data */}
      {selectedVehicle && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {vehicles.find(v => v.id === selectedVehicle)?.plateNumber} - Részletes adatok
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {dateRange.start} - {dateRange.end}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <BarChart3 className="h-4 w-4 mr-1 inline" />
                  Áttekintés
                </button>
                <button
                  onClick={() => setActiveTab('routes')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'routes'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <RouteIcon className="h-4 w-4 mr-1 inline" />
                  Útvonalak
                </button>
                <button
                  onClick={() => setActiveTab('stops')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'stops'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <StopCircle className="h-4 w-4 mr-1 inline" />
                  Megállások
                </button>
                <button
                  onClick={() => setActiveTab('fuel')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'fuel'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Fuel className="h-4 w-4 mr-1 inline" />
                  Üzemanyag
                </button>
                <button
                  onClick={() => setActiveTab('temperature')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'temperature'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Thermometer className="h-4 w-4 mr-1 inline" />
                  Hőmérséklet
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Megtett távolság</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {calculateTotalDistance().toFixed(1)} km
                      </p>
                    </div>
                    <RouteIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Megállások</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {calculateTotalStops()}
                      </p>
                    </div>
                    <StopCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Fogyasztás</p>
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {calculateTotalConsumption().toFixed(1)} l
                      </p>
                    </div>
                    <Fuel className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Tankolások</p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {calculateTotalRefills().toFixed(1)} l
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'routes' && (
              <div className="space-y-4">
                {routes.length === 0 ? (
                  <div className="text-center py-12">
                    <RouteIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Nincsenek útvonal adatok a kiválasztott időszakban</p>
                  </div>
                ) : (
                  routes.map((route, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                            <RouteIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Útvonal #{index + 1}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(route.startTime)} {formatTime(route.startTime)} - {formatTime(route.endTime)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {route.distance.toFixed(1)} km
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDuration(route.duration)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {route.points.length} GPS pont rögzítve
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'stops' && (
              <div className="space-y-4">
                {stops.length === 0 ? (
                  <div className="text-center py-12">
                    <StopCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Nincsenek megállási adatok a kiválasztott időszakban</p>
                  </div>
                ) : (
                  stops.map((stop, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                            <StopCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Megálló #{index + 1}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(stop.startTime)} {formatTime(stop.startTime)} - {formatTime(stop.endTime)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDuration(stop.duration)}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Időtartam
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p>
                          {stop.location.latitude.toFixed(4)}, {stop.location.longitude.toFixed(4)}
                        </p>
                        {stop.location.address && (
                          <p>{stop.location.address}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'fuel' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4">Fogyasztás</h4>
                    <div className="space-y-3">
                      {consumption.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">Nincsenek fogyasztási adatok</p>
                      ) : (
                        consumption.map((item, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {formatDate(item.date)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {item.distance.toFixed(1)} km megtéve
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {item.totalConsumption.toFixed(1)} l
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {item.averageConsumption.toFixed(1)} l/100km
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4">Tankolások</h4>
                    <div className="space-y-3">
                      {refills.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">Nincsenek tankolási adatok</p>
                      ) : (
                        refills.map((refill, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {formatDate(refill.timestamp)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {refill.location.address || 'Ismeretlen helyszín'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {refill.amount.toFixed(1)} l
                                </p>
                                {refill.cost && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {refill.cost.toLocaleString('hu-HU')} Ft
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'temperature' && (
              <div className="space-y-4">
                {temperatures.length === 0 ? (
                  <div className="text-center py-12">
                    <Thermometer className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Nincsenek hőmérséklet adatok a kiválasztott időszakban</p>
                  </div>
                ) : (
                  temperatures.map((temp, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                            <Thermometer className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Szenzor: {temp.sensorId}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(temp.timestamp)} {formatTime(temp.timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {temp.temperature.toFixed(1)}°C
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}