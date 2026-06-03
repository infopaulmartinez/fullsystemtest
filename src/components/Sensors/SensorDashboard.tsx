import React, { useState, useEffect } from 'react'
import { 
  Thermometer, 
  Droplets, 
  Zap, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw
} from 'lucide-react'
import { smartMacApi, BAKERY_SENSORS, SensorData } from '../../lib/smartMacApi'

interface SensorCardProps {
  title: string
  value: number | undefined
  unit: string
  icon: React.ComponentType<any>
  color: string
  trend?: 'up' | 'down' | 'stable'
  alert?: boolean
}

function SensorCard({ title, value, unit, icon: Icon, color, trend, alert }: SensorCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border ${
      alert ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`rounded-xl p-3 bg-gradient-to-br ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {alert && (
          <AlertTriangle className="h-5 w-5 text-red-500" />
        )}
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
      </div>
    </div>
  )
}

export default function SensorDashboard() {
  const [sensorData, setSensorData] = useState<Record<string, SensorData>>({})
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const loadSensorData = async () => {
    try {
      setLoading(true)
      const promises = Object.entries(BAKERY_SENSORS).map(async ([key, deviceId]) => {
        const data = await smartMacApi.getLatestData(deviceId)
        return { key, data }
      })

      const results = await Promise.all(promises)
      const newSensorData: Record<string, SensorData> = {}
      
      results.forEach(({ key, data }) => {
        if (data) {
          newSensorData[key] = data
        }
      })

      setSensorData(newSensorData)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Hiba az érzékelő adatok betöltésekor:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSensorData()
    
    // Automatikus frissítés 5 percenként
    const interval = setInterval(loadSensorData, 5 * 60 * 1000)
    
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Érzékelő Monitoring</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Valós idejű környezeti és energiafogyasztási adatok
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
          />
          <SensorCard
            title="Sütő #1 Energiafogyasztás"
            value={sensorData.OVEN_1?.power}
            unit="W"
            icon={Zap}
            color="from-yellow-500 to-amber-600"
            alert={getPowerAlert(sensorData.OVEN_1?.power)}
          />
          <SensorCard
            title="Sütő #2 Hőmérséklet"
            value={sensorData.OVEN_2?.temperature}
            unit="°C"
            icon={Thermometer}
            color="from-red-500 to-orange-600"
            alert={getTemperatureAlert(sensorData.OVEN_2?.temperature, 'OVEN_2')}
          />
          <SensorCard
            title="Sütő #2 Energiafogyasztás"
            value={sensorData.OVEN_2?.power}
            unit="W"
            icon={Zap}
            color="from-yellow-500 to-amber-600"
            alert={getPowerAlert(sensorData.OVEN_2?.power)}
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
          />
          <SensorCard
            title="Raktár Páratartalom"
            value={sensorData.STORAGE_ROOM?.humidity}
            unit="%"
            icon={Droplets}
            color="from-cyan-500 to-blue-600"
            alert={getHumidityAlert(sensorData.STORAGE_ROOM?.humidity)}
          />
          <SensorCard
            title="Fagyasztó Hőmérséklet"
            value={sensorData.FREEZER?.temperature}
            unit="°C"
            icon={Thermometer}
            color="from-indigo-500 to-purple-600"
            alert={getTemperatureAlert(sensorData.FREEZER?.temperature, 'FREEZER')}
          />
          <SensorCard
            title="Gyártóterület Hőmérséklet"
            value={sensorData.PRODUCTION_AREA?.temperature}
            unit="°C"
            icon={Thermometer}
            color="from-green-500 to-emerald-600"
            alert={getTemperatureAlert(sensorData.PRODUCTION_AREA?.temperature, 'PRODUCTION_AREA')}
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
          />
          <SensorCard
            title="Feszültség"
            value={sensorData.MAIN_POWER?.voltage}
            unit="V"
            icon={Activity}
            color="from-orange-500 to-red-600"
          />
          <SensorCard
            title="Áramerősség"
            value={sensorData.MAIN_POWER?.current}
            unit="A"
            icon={Activity}
            color="from-teal-500 to-cyan-600"
          />
          <SensorCard
            title="Napi Energiafelhasználás"
            value={sensorData.MAIN_POWER?.energy}
            unit="kWh"
            icon={TrendingUp}
            color="from-pink-500 to-rose-600"
          />
        </div>
      </div>

      {/* Riasztások */}
      {Object.entries(sensorData).some(([key, data]) => 
        getTemperatureAlert(data.temperature, key) || 
        getHumidityAlert(data.humidity) || 
        getPowerAlert(data.power)
      ) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-400">Aktív Riasztások</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(sensorData).map(([key, data]) => {
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
    </div>
  )
}