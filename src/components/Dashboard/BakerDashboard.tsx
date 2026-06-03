import React, { useState, useEffect } from 'react'
import { 
  ChefHat, 
  Clock,
  TrendingUp, 
  Package, 
  CheckCircle,
  AlertTriangle,
  Calendar,
  Thermometer,
  Droplets
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import StatsCard from './StatsCard'

export default function BakerDashboard() {
  const [productionBatches, setProductionBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [sensorData, setSensorData] = useState({
    oven1Temp: 0,
    oven2Temp: 0,
    storeTemp: 0, 
    storeHumidity: 0 
  })
  const [workTime, setWorkTime] = useState({
    hoursWorked: 0,
    totalHours: 0,
    hoursRemaining: 0,
    earnings: 0
  })

  useEffect(() => {
    loadProductionBatches()
    loadSensorData()
    calculateWorkingHours()
    
    // Set up interval to update sensor data
    const interval = setInterval(loadSensorData, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadProductionBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select(`
          *,
          products:recipe_id (name, category)
        `)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) {
        console.error('Error loading production batches:', error)
        return
      }
      
      if (data) {
        setProductionBatches(data)
      }
    } catch (error) {
      console.error('Error loading production batches:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSensorData = async () => {
    try {
      // In a real app, this would fetch data from sensors
      // For demo purposes, we'll use random values
      setSensorData({
        oven1Temp: Math.floor(180 + Math.random() * 40),
        oven2Temp: Math.floor(160 + Math.random() * 60),
        storeTemp: Math.floor(20 + Math.random() * 5),
        storeHumidity: Math.floor(40 + Math.random() * 20)
      })
    } catch (error) {
      console.error('Error loading sensor data:', error)
    }
  }

  const calculateWorkingHours = () => {
    // Calculate working hours
    const today = new Date()
    const startHour = 4 // 4 AM
    const endHour = 16 // 4 PM
    const currentHour = today.getHours()
    const hoursWorked = currentHour >= startHour && currentHour < endHour 
      ? currentHour - startHour 
      : (currentHour >= endHour ? endHour - startHour : 0)
    const totalHours = endHour - startHour
    const hoursRemaining = Math.max(0, totalHours - hoursWorked)
    
    // Calculate earnings (example calculation)
    const hourlyRate = 2500 // HUF per hour
    const earnings = hoursWorked * hourlyRate
    
    setWorkTime({
      hoursWorked,
      totalHours,
      hoursRemaining,
      earnings
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'in_progress': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'planned': return 'Tervezett'
      case 'in_progress': return 'Folyamatban'
      case 'completed': return 'Befejezve'
      case 'failed': return 'Sikertelen'
      default: return status
    }
  }

  // Calculate stats
  const completedBatches = productionBatches.filter(batch => batch.status === 'completed').length
  const inProgressBatches = productionBatches.filter(batch => batch.status === 'in_progress').length
  const plannedBatches = productionBatches.filter(batch => batch.status === 'planned').length
  
  // Calculate working hours
  const today = new Date()
  const startHour = 4 // 4 AM
  const endHour = 16 // 4 PM
  const currentHour = today.getHours()
  const hoursWorked = currentHour >= startHour && currentHour < endHour 
    ? currentHour - startHour 
    : (currentHour >= endHour ? endHour - startHour : 0)
  const totalHours = endHour - startHour
  const hoursRemaining = Math.max(0, totalHours - hoursWorked)
  
  // Calculate earnings (example calculation)
  const hourlyRate = 2500 // HUF per hour
  const earnings = hoursWorked * hourlyRate

  const stats = [
    {
      title: 'Mai gyártási tételek',
      value: productionBatches.length.toString() || '0',
      change: `${completedBatches || 0} befejezve`,
      changeType: 'positive',
      icon: ChefHat,
      gradient: 'from-amber-500 to-orange-600'
    },
    {
      title: 'Folyamatban',
      value: inProgressBatches.toString() || '0',
      change: `${plannedBatches || 0} tervezett`,
      changeType: 'neutral',
      icon: Clock,
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Ledolgozott órák',
      value: `${workTime.hoursWorked}/${workTime.totalHours}`,
      change: `${workTime.hoursRemaining} óra hátravan`,
      changeType: 'neutral',
      icon: TrendingUp,
      gradient: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Mai kereset',
      value: `${workTime.earnings.toLocaleString('hu-HU')} Ft`,
      change: `${hourlyRate.toLocaleString('hu-HU')} Ft/óra`,
      changeType: 'positive',
      icon: TrendingUp,
      gradient: 'from-purple-500 to-violet-600'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Jó reggelt! 🥐
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Itt az áttekintés a mai gyártási tételekről és feladatokról.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Sensor Data */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Szenzorok</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Sütő #1</h3>
              <Thermometer className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{sensorData.oven1Temp}°C</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Beállítva: 220°C</p>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Sütő #2</h3>
              <Thermometer className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{sensorData.oven2Temp}°C</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Beállítva: 180°C</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Üzlet hőmérséklet</h3>
              <Thermometer className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{sensorData.storeTemp}°C</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Optimális: 18-24°C</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Üzlet páratartalom</h3>
              <Droplets className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{sensorData.storeHumidity}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Optimális: 40-60%</p>
          </div>
        </div>
      </div>

      {/* Production Batches */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mai gyártási tételek</h2>
        
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        ) : productionBatches.length === 0 ? (
          <div className="text-center py-8">
            <ChefHat className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nincsenek gyártási tételek
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Ma még nem kezdődött el a gyártás.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {productionBatches.map((batch) => (
              <div key={batch.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mr-4">
                      <ChefHat className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{batch.products?.name || 'Ismeretlen termék'}</h3>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}>
                          {getStatusText(batch.status)}
                        </span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {batch.batch_size} db
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{new Date(batch.created_at).toLocaleDateString('hu-HU')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Figyelmeztetések</h2>
        
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3" />
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-300">Alacsony lisztkészlet</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  A BL-55 liszt készlete 15 kg alá csökkent. Javasolt újrarendelés.
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-3" />
              <div>
                <h3 className="font-medium text-green-800 dark:text-green-300">Minden berendezés megfelelően működik</h3>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Az összes sütő és kelesztő megfelelően működik.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}