import React from 'react'
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Package, 
  Users,
  Clock,
  Star,
  AlertTriangle
} from 'lucide-react'
import StatsCard from './StatsCard'

export default function SalespersonDashboard() {
  const stats = [
    {
      title: 'Mai forgalom',
      value: '0 Ft',
      change: '0% tegnap óta',
      changeType: 'neutral' as const,
      icon: DollarSign,
      gradient: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Tranzakciók',
      value: '0',
      change: '0 az elmúlt órában',
      changeType: 'neutral' as const,
      icon: ShoppingCart,
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Átlag kosárérték',
      value: '0 Ft',
      change: '0% a múlt héthez képest',
      changeType: 'neutral' as const,
      icon: TrendingUp,
      gradient: 'from-purple-500 to-violet-600'
    },
    {
      title: 'Készlet riasztások',
      value: '0',
      change: '0 kritikus',
      changeType: 'neutral' as const,
      icon: AlertTriangle,
      gradient: 'from-red-500 to-pink-600'
    }
  ]

  const topProducts = []

  const recentTransactions = []

  const lowStockItems = []

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Jó napot! 🛒
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Itt az áttekintés a mai értékesítésről és készletről.
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
        <button className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
          <ShoppingCart className="h-8 w-8 mb-3" />
          <h3 className="font-semibold text-lg">Új eladás</h3>
          <p className="text-sm opacity-90">POS rendszer indítása</p>
        </button>
        
        <button className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
          <Package className="h-8 w-8 mb-3" />
          <h3 className="font-semibold text-lg">Készlet</h3>
          <p className="text-sm opacity-90">Készlet ellenőrzése</p>
        </button>
        
        <button className="bg-gradient-to-br from-purple-500 to-violet-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
          <Users className="h-8 w-8 mb-3" />
          <h3 className="font-semibold text-lg">Rendelések</h3>
          <p className="text-sm opacity-90">Vevői rendelések</p>
        </button>
        
        <button className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
          <Star className="h-8 w-8 mb-3" />
          <h3 className="font-semibold text-lg">Akciók</h3>
          <p className="text-sm opacity-90">Kedvezmények kezelése</p>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Legnépszerűbb termékek
          </h3>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{product.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{product.sold} db eladva</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{product.revenue.toLocaleString('hu-HU')} Ft</p>
                  <div className="flex items-center">
                    {product.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                    {product.trend === 'down' && <TrendingUp className="h-4 w-4 text-red-500 transform rotate-180" />}
                    {product.trend === 'stable' && <div className="w-4 h-0.5 bg-gray-400"></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Legutóbbi tranzakciók
          </h3>
          <div className="space-y-3">
            {recentTransactions.map((transaction, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">#{transaction.id}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{transaction.time} • {transaction.items} termék</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{transaction.amount.toLocaleString('hu-HU')} Ft</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{transaction.customer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Alacsony készletű termékek
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lowStockItems.map((item, index) => (
            <div key={index} className={`p-4 rounded-xl border-2 ${
              item.status === 'critical' 
                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' 
                : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
                <AlertTriangle className={`h-5 w-5 ${
                  item.status === 'critical' ? 'text-red-500' : 'text-amber-500'
                }`} />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Jelenlegi: <span className="font-medium">{item.current} db</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Minimum: <span className="font-medium">{item.min} db</span>
                </p>
              </div>
              <button className="mt-3 w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-700 transition-all duration-200">
                Újrarendelés
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}