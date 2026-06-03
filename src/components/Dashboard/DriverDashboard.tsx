import React from 'react'
import { 
  Truck, 
  MapPin, 
  Clock, 
  Package, 
  Route,
  Fuel,
  CheckCircle,
  AlertTriangle,
  Navigation
} from 'lucide-react'
import StatsCard from './StatsCard'

export default function DriverDashboard() {
  const stats = [
    {
      title: 'Mai szállítások',
      value: '0',
      change: '0 függőben',
      changeType: 'neutral' as const,
      icon: Package,
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Teljesített',
      value: '0',
      change: '0 az elmúlt órában',
      changeType: 'neutral' as const,
      icon: CheckCircle,
      gradient: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Megtett távolság',
      value: '0 km',
      change: 'Mai nap',
      changeType: 'neutral' as const,
      icon: Route,
      gradient: 'from-purple-500 to-violet-600'
    },
    {
      title: 'Üzemanyag',
      value: '0%',
      change: 'Nincs adat',
      changeType: 'neutral' as const,
      icon: Fuel,
      gradient: 'from-amber-500 to-orange-600'
    }
  ]

  const todayDeliveries = []

  const vehicleStatus = {
    licensePlate: '',
    model: '',
    fuel: 0,
    mileage: 0,
    lastService: '',
    nextService: '',
    issues: []
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'in-progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Teljesítve'
      case 'in-progress': return 'Folyamatban'
      case 'pending': return 'Függőben'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'in-progress': return Clock
      case 'pending': return Package
      default: return Clock
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Jó utat! 🚛
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Itt az áttekintés a mai szállításokról és útvonalakról.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
          <Navigation className="h-8 w-8 mb-3" />
          <h3 className="font-semibold text-lg">Navigáció</h3>
          <p className="text-sm opacity-90">Útvonal indítása</p>
        </button>
        
        <button className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
          <CheckCircle className="h-8 w-8 mb-3" />
          <h3 className="font-semibold text-lg">Kézbesítés</h3>
          <p className="text-sm opacity-90">Szállítás megerősítése</p>
        </button>
        
        <button className="bg-gradient-to-br from-purple-500 to-violet-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
          <Package className="h-8 w-8 mb-3" />
          <h3 className="font-semibold text-lg">Visszáru</h3>
          <p className="text-sm opacity-90">Visszáru kezelése</p>
        </button>
        
        <button className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
          <Truck className="h-8 w-8 mb-3" />
          <h3 className="font-semibold text-lg">Jármű</h3>
          <p className="text-sm opacity-90">Állapot ellenőrzése</p>
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Deliveries */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Mai szállítások
          </h3>
          <div className="space-y-4">
            {todayDeliveries.map((delivery, index) => {
              const StatusIcon = getStatusIcon(delivery.status)
              return (
                <div key={index} className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                        <StatusIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{delivery.customer}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">#{delivery.id}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
                      {getStatusText(delivery.status)}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{delivery.address}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{delivery.time}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span>{delivery.items} termék</span>
                        <span>{delivery.distance}</span>
                      </div>
                    </div>
                  </div>

                  {delivery.status === 'in-progress' && (
                    <div className="flex space-x-2">
                      <button className="flex-1 py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
                        Kézbesítve
                      </button>
                      <button className="flex-1 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                        Navigáció
                      </button>
                    </div>
                  )}

                  {delivery.status === 'pending' && (
                    <button className="w-full py-2 px-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-cyan-700 transition-all duration-200">
                      Indítás
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Vehicle Status */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Jármű állapot
          </h3>
          
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-3">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{vehicleStatus.model}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">{vehicleStatus.licensePlate}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Üzemanyag</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <div 
                      className="h-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                      style={{ width: `${vehicleStatus.fuel}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{vehicleStatus.fuel}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Kilométeróra</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {vehicleStatus.mileage.toLocaleString('hu-HU')} km
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Utolsó szerviz</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(vehicleStatus.lastService).toLocaleDateString('hu-HU')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Következő szerviz</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(vehicleStatus.nextService).toLocaleDateString('hu-HU')}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Jármű állapot megfelelő</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}