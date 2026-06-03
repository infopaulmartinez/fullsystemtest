import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  Thermometer, 
  Droplets, 
  Zap, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wifi,
  WifiOff,
  Settings as SettingsIcon
} from 'lucide-react'
import { smartMacApi, BAKERY_SENSORS, SensorData } from '../lib/smartMacApi'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

interface SensorCardProps {
  title: string
  value: number | undefined
  unit: string
  icon: React.ComponentType<any>
  color: string
  trend?: 'up' | 'down' | 'stable'
  alert?: boolean
  status?: 'online' | 'offline' | 'unknown'
}

function SensorCard({ title, value, unit, icon: Icon, color, trend, alert, status }: SensorCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border ${
      alert ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
    } hover:shadow-md transition-all duration-200`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`rounded-xl p-3 bg-gradient-to-br ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex items-center space-x-2">
          {status === 'online' && <Wifi className="h-4 w-4 text-green-500" />}
          {status === 'offline' && <WifiOff className="h-4 w-4 text-red-500" />}
          {status === 'unknown' && <WifiOff className="h-4 w-4 text-gray-400" />}
          {alert && <AlertTriangle className="h-5 w-5 text-red-500" />}
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
        <div className="flex items-end space-x-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {value !== undefined ? value.toFixed(1) : '--'}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
          {trend && (
            <div className="flex items-center">
              {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
              {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
              {trend === 'stable' && <Activity className="h-4 w-4 text-gray-500" />}
            </div>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {status === 'online' && 'Online'}
          {status === 'offline' && 'Offline'}
          {status === 'unknown' && 'Ismeretlen'}
        </div>
      </div>
    </div>
  )
}

export default function Sensors() {
  const [sensorData, setSensorData] = useState<Record<string, SensorData>>({})
  const [sensorStatus, setSensorStatus] = useState<Record<string, 'online' | 'offline' | 'unknown'>>({})
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  // Function to save sensor data to database
  const saveSensorDataToDatabase = async (sensorData: Record<string, SensorData>) => {
    try {
      // Prepare data for insertion
      const dataToInsert = Object.entries(sensorData).map(([key, data]) => ({
        device_id: data.deviceId,
        device_name: key,
        temperature: data.temperature,
        humidity: data.humidity,
        power: data.power,
        voltage: data.voltage,
        current: data.current,
        energy: data.energy,
        timestamp: new Date().toISOString()
      }));
      
      // Insert data into sensor_data table
      const { error } = await supabase
        .from('sensor_data')
        .insert(dataToInsert);
        
      if (error) {
        console.error('Error saving sensor data to database:', error);
      } else {
        console.log('Sensor data saved to database successfully');
      }
    } catch (error) {
      console.error('Error saving sensor data to database:', error);
    }
  };

  const loadSensorData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const promises = Object.entries(BAKERY_SENSORS).map(async ([key, deviceId]) => {
        try {
          const data = await smartMacApi.getLatestData(deviceId)
          const status = await smartMacApi.getDeviceStatus(deviceId)
          return { key, data, status }
        } catch (error) {
          console.error(`Hiba a ${key} eszköz adatainak betöltésekor:`, error)
          return { key, data: null, status: 'unknown' as const }
        }
      })

      const results = await Promise.all(promises)
      const newSensorData: Record<string, SensorData> = {}
      const newSensorStatus: Record<string, 'online' | 'offline' | 'unknown'> = {}
      
      results.forEach(({ key, data, status }) => {
        if (data) {
          newSensorData[key] = data
        }
        newSensorStatus[key] = status
      })

      setSensorData(newSensorData)
      setSensorStatus(newSensorStatus)
      
      // Save sensor data to database
      saveSensorDataToDatabase(newSensorData);
      
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Hiba az érzékelő adatok betöltésekor:', error)
      setError('Nem sikerült betölteni az érzékelő adatokat. Ellenőrizze az API kapcsolatot.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSensorData()
    
    // Automatikus frissítés 30 másodpercenként
    const interval = setInterval(loadSensorData, 30 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  const getTemperatureAlert = (temp: number | undefined, type: string): boolean => {
    if (!temp) return false
    
    switch (type) {
      case 'OVEN_1':
      case 'OVEN_2':
        return temp > 250 || temp < 150 // Sütő hőmérséklet riasztás
      case 'FREEZER':
        return temp > -15 || temp < -25 // Fagyasztó hőmérséklet riasztás
      case 'STORAGE_ROOM':
        return temp > 25 || temp < 5 // Raktár hőmérséklet riasztás
      case 'PRODUCTION_AREA':
        return temp > 30 || temp < 15 // Gyártóterület hőmérséklet riasztás
      default:
        return false
    }
  }

  const getHumidityAlert = (humidity: number | undefined): boolean => {
    if (!humidity) return false
    return humidity > 70 || humidity < 30 // Páratartalom riasztás
  }

  const getPowerAlert = (power: number | undefined): boolean => {
    if (!power) return false
    return power > 5000 // Túl magas energiafogyasztás riasztás (5kW felett)
  }

  const activeAlerts = Object.entries(sensorData).filter(([key, data]) => 
    getTemperatureAlert(data.temperature, key) || 
    getHumidityAlert(data.humidity) || 
    getPowerAlert(data.power)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Activity className="h-8 w-8 mr-3 text-blue-600" />
            Érzékelő Monitoring
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Valós idejű környezeti és energiafogyasztási adatok Smart-MAC rendszerből
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Utolsó frissítés: {lastUpdate.toLocaleTimeString('hu-HU')}
          </span>
          <button
            onClick={loadSensorData}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Frissítés
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rendszer állapot</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Online eszközök: {Object.values(sensorStatus).filter(s => s === 'online').length}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Offline eszközök: {Object.values(sensorStatus).filter(s => s === 'offline').length}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Aktív riasztások: {activeAlerts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Sütők */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sütők</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SensorCard
            title="Sütő #1 Hőmérséklet"
            value={sensorData.OVEN_1?.temperature}
            unit="°C"
            icon={Thermometer}
            color="from-red-500 to-orange-600"
            alert={getTemperatureAlert(sensorData.OVEN_1?.temperature, 'OVEN_1')}
            status={sensorStatus.OVEN_1}
          />
          <SensorCard
            title="Sütő #1 Energiafogyasztás"
            value={sensorData.OVEN_1?.power}
            unit="W"
            icon={Zap}
            color="from-yellow-500 to-amber-600"
            alert={getPowerAlert(sensorData.OVEN_1?.power)}
            status={sensorStatus.OVEN_1}
          />
          <SensorCard
            title="Sütő #2 Hőmérséklet"
            value={sensorData.OVEN_2?.temperature}
            unit="°C"
            icon={Thermometer}
            color="from-red-500 to-orange-600"
            alert={getTemperatureAlert(sensorData.OVEN_2?.temperature, 'OVEN_2')}
            status={sensorStatus.OVEN_2}
          />
          <SensorCard
            title="Sütő #2 Energiafogyasztás"
            value={sensorData.OVEN_2?.power}
            unit="W"
            icon={Zap}
            color="from-yellow-500 to-amber-600"
            alert={getPowerAlert(sensorData.OVEN_2?.power)}
            status={sensorStatus.OVEN_2}
          />
        </div>
      </div>

      {/* Tárolás és Környezet */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tárolás és Környezet</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SensorCard
            title="Raktár Hőmérséklet"
            value={sensorData.STORAGE_ROOM?.temperature}
            unit="°C"
            icon={Thermometer}
            color="from-blue-500 to-cyan-600"
            alert={getTemperatureAlert(sensorData.STORAGE_ROOM?.temperature, 'STORAGE_ROOM')}
            status={sensorStatus.STORAGE_ROOM}
          />
          <SensorCard
            title="Raktár Páratartalom"
            value={sensorData.STORAGE_ROOM?.humidity}
            unit="%"
            icon={Droplets}
            color="from-cyan-500 to-blue-600"
            alert={getHumidityAlert(sensorData.STORAGE_ROOM?.humidity)}
            status={sensorStatus.STORAGE_ROOM}
          />
          <SensorCard
            title="Fagyasztó Hőmérséklet"
            value={sensorData.FREEZER?.temperature}
            unit="°C"
            icon={Thermometer}
            color="from-indigo-500 to-purple-600"
            alert={getTemperatureAlert(sensorData.FREEZER?.temperature, 'FREEZER')}
            status={sensorStatus.FREEZER}
          />
          <SensorCard
            title="Gyártóterület Hőmérséklet"
            value={sensorData.PRODUCTION_AREA?.temperature}
            unit="°C"
            icon={Thermometer}
            color="from-green-500 to-emerald-600"
            alert={getTemperatureAlert(sensorData.PRODUCTION_AREA?.temperature, 'PRODUCTION_AREA')}
            status={sensorStatus.PRODUCTION_AREA}
          />
        </div>
      </div>

      {/* Energiafogyasztás */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Energiafogyasztás</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SensorCard
            title="Összes Energiafogyasztás"
            value={sensorData.MAIN_POWER?.power}
            unit="W"
            icon={Zap}
            color="from-purple-500 to-violet-600"
            alert={getPowerAlert(sensorData.MAIN_POWER?.power)}
            status={sensorStatus.MAIN_POWER}
          />
          <SensorCard
            title="Feszültség"
            value={sensorData.MAIN_POWER?.voltage}
            unit="V"
            icon={Activity}
            color="from-orange-500 to-red-600"
            status={sensorStatus.MAIN_POWER}
          />
          <SensorCard
            title="Áramerősség"
            value={sensorData.MAIN_POWER?.current}
            unit="A"
            icon={Activity}
            color="from-teal-500 to-cyan-600"
            status={sensorStatus.MAIN_POWER}
          />
          <SensorCard
            title="Napi Energiafelhasználás"
            value={sensorData.MAIN_POWER?.energy}
            unit="kWh"
            icon={TrendingUp}
            color="from-pink-500 to-rose-600"
            status={sensorStatus.MAIN_POWER}
          />
        </div>
      </div>

      {/* Riasztások */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-400">Aktív Riasztások</h3>
          </div>
          <div className="space-y-2">
            {activeAlerts.map(([key, data]) => {
              const alerts = []
              
              if (getTemperatureAlert(data.temperature, key)) {
                alerts.push(`${key}: Hőmérséklet riasztás (${data.temperature?.toFixed(1)}°C)`)
              }
              if (getHumidityAlert(data.humidity)) {
                alerts.push(`${key}: Páratartalom riasztás (${data.humidity?.toFixed(1)}%)`)
              }
              if (getPowerAlert(data.power)) {
                alerts.push(`${key}: Energiafogyasztás riasztás (${data.power?.toFixed(0)}W)`)
              }
              
              return alerts.map((alert, index) => (
                <p key={`${key}-${index}`} className="text-sm text-red-800 dark:text-red-300">
                  • {alert}
                </p>
              ))
            })}
          </div>
        </div>
      )}

      {/* API Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-4">
          <SettingsIcon className="h-6 w-6 text-gray-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart-MAC API Konfiguráció</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Eszköz ID-k</h4>
            <div className="space-y-2">
              {Object.entries(BAKERY_SENSORS).map(([key, deviceId]) => (
                <div key={key} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                  <span className="font-mono text-gray-900 dark:text-white">{deviceId}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">API Állapot</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">API kapcsolat aktív</span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Frissítési gyakoriság: 30 másodperc
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Adatforrás: Smart-MAC IoT Platform
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}