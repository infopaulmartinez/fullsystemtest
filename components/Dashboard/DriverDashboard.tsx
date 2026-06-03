import React, { useState, useEffect } from 'react'
import { 
  Truck, 
  MapPin, 
  Clock, 
  Package, 
  Route,
  Fuel,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Car,
  X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import StatsCard from './StatsCard'

const VEHICLES = [
  { id: 'dyna', label: 'DYNA', plate: 'JOV-030', icon: '🚚' },
  { id: 'boxer', label: 'BOXER', plate: 'LSF-606', icon: '🚐' },
]

export default function DriverDashboard() {
  const { user } = useAuth()
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [pendingStartId, setPendingStartId] = useState<string | null>(null)

  useEffect(() => {
    loadDeliveries()
    // Check localStorage for selected vehicle
    const saved = localStorage.getItem('driver_vehicle')
    if (saved) setSelectedVehicle(saved)
  }, [])

  const loadDeliveries = async () => {
    try {
      const { data } = await supabase
        .from('delivery_notes')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: true })
      setDeliveries(data || [])
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleStartDelivery = (noteId: string) => {
    if (!selectedVehicle) {
      setPendingStartId(noteId)
      setShowVehicleModal(true)
    } else {
      doStartDelivery(noteId)
    }
  }

  const doStartDelivery = async (noteId: string) => {
    const vehicle = VEHICLES.find(v => v.id === selectedVehicle)
    await supabase.from('delivery_notes').update({
      status: 'in_progress',
      notes: `Jármű: ${vehicle?.label} ${vehicle?.plate}`,
    }).eq('id', noteId)
    toast.success(`Indulás! Jármű: ${vehicle?.label} (${vehicle?.plate})`)
    loadDeliveries()
    setShowVehicleModal(false)
    setPendingStartId(null)
  }

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId)
    localStorage.setItem('driver_vehicle', vehicleId)
    if (pendingStartId) {
      // need to update state before calling
      setTimeout(() => {
        const v = VEHICLES.find(vv => vv.id === vehicleId)
        supabase.from('delivery_notes').update({
          status: 'in_progress',
          notes: `Jármű: ${v?.label} ${v?.plate}`,
        }).eq('id', pendingStartId).then(() => {
          toast.success(`Indulás! Jármű: ${v?.label} (${v?.plate})`)
          loadDeliveries()
          setShowVehicleModal(false)
          setPendingStartId(null)
        })
      }, 50)
    } else {
      setShowVehicleModal(false)
    }
  }

  const pending = deliveries.filter(d => d.status === 'pending').length
  const inProgress = deliveries.filter(d => d.status === 'in_progress').length

  const stats = [
    {
      title: 'Mai szállítások',
      value: deliveries.length.toString(),
      change: `${pending} függőben`,
      changeType: 'neutral' as const,
      icon: Package,
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Folyamatban',
      value: inProgress.toString(),
      change: 'Úton',
      changeType: inProgress > 0 ? 'positive' as const : 'neutral' as const,
      icon: Truck,
      gradient: 'from-amber-500 to-orange-600'
    },
    {
      title: 'Jármű',
      value: selectedVehicle ? VEHICLES.find(v => v.id === selectedVehicle)?.plate || '—' : '—',
      change: selectedVehicle ? VEHICLES.find(v => v.id === selectedVehicle)?.label || '' : 'Nincs kiválasztva',
      changeType: selectedVehicle ? 'positive' as const : 'negative' as const,
      icon: Car,
      gradient: 'from-purple-500 to-violet-600'
    },
    {
      title: 'Megtett távolság',
      value: '0 km',
      change: 'Mai nap',
      changeType: 'neutral' as const,
      icon: Route,
      gradient: 'from-green-500 to-emerald-600'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Vehicle selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Car className="h-5 w-5 text-amber-500" /> Használt jármű
          </h3>
          <button
            onClick={() => setShowVehicleModal(true)}
            className="text-sm text-amber-500 hover:text-amber-600 font-semibold"
          >
            {selectedVehicle ? 'Csere' : 'Kiválasztás'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {VEHICLES.map(v => (
            <button
              key={v.id}
              onClick={() => handleVehicleSelect(v.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                selectedVehicle === v.id
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-amber-300'
              }`}
            >
              <span className="text-2xl">{v.icon}</span>
              <div className="text-left">
                <p className="font-black text-gray-900 dark:text-white">{v.label}</p>
                <p className={`text-sm font-mono font-bold ${selectedVehicle === v.id ? 'text-amber-600' : 'text-gray-500'}`}>{v.plate}</p>
              </div>
              {selectedVehicle === v.id && (
                <CheckCircle className="ml-auto h-5 w-5 text-amber-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Deliveries list */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" /> Mai szállítások
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Betöltés...</div>
        ) : deliveries.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Nincs szállítás</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {deliveries.map(d => (
              <div key={d.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{d.customer_name}</p>
                  {d.customer_address && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {d.customer_address}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{d.order_number}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.status === 'pending' && (
                    <button
                      onClick={() => handleStartDelivery(d.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black transition-all"
                    >
                      <Truck className="h-3.5 w-3.5" /> Indulás
                    </button>
                  )}
                  {d.status === 'in_progress' && (
                    <span className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold">
                      <Navigation className="h-3.5 w-3.5" /> Úton
                    </span>
                  )}
                  {d.customer_address && (
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.customer_address)}`, '_blank')}
                      className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                    >
                      <Navigation className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vehicle selection modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Válassz járművet</h2>
              <button onClick={() => { setShowVehicleModal(false); setPendingStartId(null) }}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Melyik járművel indulsz el?</p>
            <div className="space-y-3">
              {VEHICLES.map(v => (
                <button
                  key={v.id}
                  onClick={() => handleVehicleSelect(v.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all"
                >
                  <span className="text-3xl">{v.icon}</span>
                  <div className="text-left">
                    <p className="text-lg font-black text-gray-900 dark:text-white">{v.label}</p>
                    <p className="text-base font-mono font-bold text-amber-600">{v.plate}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
