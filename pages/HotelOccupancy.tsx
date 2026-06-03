import React, { useState, useEffect } from 'react'
import { 
  Building, 
  TrendingUp, 
  Calendar, 
  RefreshCw, 
  MapPin,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  BarChart3
} from 'lucide-react'
import { getMultiCityOccupancy, generateProductionRecommendations } from '../lib/bookingApi'
import { format, addDays } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface OccupancyData {
  city: string
  cityId: number
  checkin: string
  checkout: string
  totalRooms: number
  bookedRooms: number
  occupancyRate: number
  avgPrice: number
  changeFromLastWeek: number
  forecast: {
    occupancyTrend: string
    priceTrend: string
    highDemandDays: string[]
  }
}

interface Recommendation {
  type: string
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  city?: string
}

export default function HotelOccupancy() {
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [checkinDate, setCheckinDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [checkoutDate, setCheckoutDate] = useState(format(addDays(new Date(), 2), 'yyyy-MM-dd'))
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState([
    {
      name: "Balaton Sound",
      location: "Zamárdi",
      startDate: "2025-07-02",
      endDate: "2025-07-06",
      expectedAttendance: 150000,
      impact: "high"
    },
    {
      name: "Boglári Szüreti Fesztivál",
      location: "Balatonboglár",
      startDate: "2025-09-12",
      endDate: "2025-09-14",
      expectedAttendance: 15000,
      impact: "medium"
    },
    {
      name: "Balatoni Hal- és Borünnep",
      location: "Balatonföldvár",
      startDate: "2025-05-15",
      endDate: "2025-05-17",
      expectedAttendance: 8000,
      impact: "medium"
    }
  ]);

  useEffect(() => {
    loadOccupancyData()
  }, [checkinDate, checkoutDate])

  const loadOccupancyData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await getMultiCityOccupancy(checkinDate, checkoutDate)
      setOccupancyData(data)
      
      // Javaslatok generálása
      const recs = generateProductionRecommendations(data)
      setRecommendations(recs)
      
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Hiba a foglaltsági adatok betöltésekor:', error)
      setError('Nem sikerült betölteni a foglaltsági adatokat.')
    } finally {
      setLoading(false)
    }
  }

  const getOccupancyColor = (rate: number) => {
    if (rate > 0.8) return 'text-red-600 dark:text-red-400'
    if (rate > 0.6) return 'text-orange-600 dark:text-orange-400'
    if (rate > 0.4) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400'
    if (change < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getChangeIcon = (change: number) => {
    if (change > 0) return ArrowUpRight
    if (change < 0) return ArrowDownRight
    return null
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
      case 'medium': return 'bg-orange-100 border-orange-500 text-orange-800 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-400'
      case 'low': return 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400'
      default: return 'bg-gray-100 border-gray-500 text-gray-800 dark:bg-gray-900/20 dark:border-gray-700 dark:text-gray-400'
    }
  }

  const getImpactIcon = (type: string) => {
    switch (type) {
      case 'high_demand':
      case 'city_high_demand':
        return AlertTriangle
      case 'medium_demand':
      case 'city_increasing_trend':
        return TrendingUp
      case 'weather_based':
        return Lightbulb
      default:
        return CheckCircle
    }
  }

  if (loading && occupancyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Building className="h-8 w-8 mr-3 text-blue-600" />
            Szállásfoglalási Előrejelzés
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Booking.com foglaltsági adatok és termelési javaslatok
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={checkinDate}
              onChange={(e) => setCheckinDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
            <span className="text-gray-500 dark:text-gray-400">-</span>
            <input
              type="date"
              value={checkoutDate}
              onChange={(e) => setCheckoutDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Utolsó frissítés: {lastUpdate.toLocaleTimeString('hu-HU')}
          </div>
          <button
            onClick={loadOccupancyData}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Frissítés
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Közelgő rendezvények
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {upcomingEvents.map((event, index) => (
            <div key={index} className={`p-4 rounded-xl border-l-4 ${
              event.impact === 'high' 
                ? 'border-l-red-500 bg-red-50 dark:bg-red-900/20' 
                : event.impact === 'medium'
                ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
            }`}>
              <h3 className="font-medium text-gray-900 dark:text-white">{event.name}</h3>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex items-center">
                  <MapPin className="h-3 w-3 mr-1 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">{event.location}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {new Date(event.startDate).toLocaleDateString('hu-HU')} - {new Date(event.endDate).toLocaleDateString('hu-HU')}
                  </span>
                </div>
                <div className="flex items-center">
                  <Users className="h-3 w-3 mr-1 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Várható látogatók: {event.expectedAttendance.toLocaleString('hu-HU')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Összesített statisztikák */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
              <Building className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Átlagos foglaltság</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(occupancyData.reduce((sum, city) => sum + city.occupancyRate, 0) / occupancyData.length * 100)}%
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Közelgő rendezvények</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {upcomingEvents.length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Várható látogatók</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {upcomingEvents.reduce((sum, event) => sum + event.expectedAttendance, 0).toLocaleString('hu-HU')}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-3">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Változás</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {(occupancyData.reduce((sum, city) => sum + city.changeFromLastWeek, 0) / occupancyData.length * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Városonkénti foglaltság */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2" />
          Városonkénti foglaltság
        </h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Város
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Foglaltság
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Átlagár
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Változás
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {occupancyData.map((city) => {
                const ChangeIcon = getChangeIcon(city.changeFromLastWeek);
                return (
                  <tr key={city.cityId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{city.city}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getOccupancyColor(city.occupancyRate)}`}>
                        {Math.round(city.occupancyRate * 100)}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {city.bookedRooms} / {city.totalRooms} szoba
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {city.avgPrice.toLocaleString('hu-HU')} Ft
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium flex items-center ${getChangeColor(city.changeFromLastWeek)}`}>
                        {ChangeIcon && <ChangeIcon className="h-4 w-4 mr-1" />}
                        {(city.changeFromLastWeek * 100).toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {city.forecast.occupancyTrend === 'increasing' ? 'Növekvő' : 'Stabil'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Foglaltsági grafikon */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Foglaltsági arányok
        </h2>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={occupancyData.map(city => ({
                name: city.city,
                foglaltság: Math.round(city.occupancyRate * 100),
                átlagár: city.avgPrice / 1000 // ezer forintban
              }))}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="foglaltság" name="Foglaltság (%)" fill="#8884d8" />
              <Bar yAxisId="right" dataKey="átlagár" name="Átlagár (ezer Ft)" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Termelési javaslatok */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Lightbulb className="h-5 w-5 mr-2 text-amber-500" />
          Termelési javaslatok
        </h2>
        
        <div className="space-y-4">
          {recommendations.map((recommendation, index) => {
            const ImpactIcon = getImpactIcon(recommendation.type);
            return (
              <div 
                key={index} 
                className={`p-4 rounded-xl border-l-4 ${getImpactColor(recommendation.impact)}`}
              >
                <div className="flex items-start">
                  <ImpactIcon className="h-5 w-5 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{recommendation.title}</h3>
                    <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">{recommendation.description}</p>
                    {recommendation.city && (
                      <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        <MapPin className="h-3 w-3 mr-1" />
                        {recommendation.city}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}