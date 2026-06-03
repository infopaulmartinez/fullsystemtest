import React, { useState, useEffect } from 'react'
import { 
  ShoppingCart, 
  ArrowLeft, 
  Download, 
  Clock, 
  Calendar, 
  MapPin, 
  Truck, 
  FileText, 
  CheckCircle,
  XCircle,
  Package,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { Link, useParams, useNavigate } from 'react-router-dom'

interface Order {
  id: string
  order_number: string
  status: string
  created_at: string
  total_amount: number
  items: any[]
  customer_name: string
  customer_address: string | null
  delivery_date: string | null
  notes: string | null
  payment_method: string | null
  payment_status: string | null
  location_id: string | null
  location_name?: string
}

export default function PartnerOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      checkPartnerAssociation()
    }
  }, [user])

  useEffect(() => {
    if (partnerId && id) {
      loadOrder()
    }
  }, [partnerId, id])

  const checkPartnerAssociation = async () => {
    try {
      // Check if user is associated with a partner company
      const { data, error } = await supabase
        .from('partner_users')
        .select('partner_id')
        .eq('user_id', user?.id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No partner association found
          toast.error('Nincs hozzárendelve partner céghez')
          navigate('/login')
          return
        }
        throw error
      }
      
      if (data) {
        setPartnerId(data.partner_id)
      }
    } catch (error) {
      console.error('Hiba a partner ellenőrzésekor:', error)
      toast.error('Hiba a partner ellenőrzésekor')
    }
  }

  const loadOrder = async () => {
    try {
      setLoading(true)
      
      // Load order details
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          location:location_id (name)
        `)
        .eq('id', id)
        .eq('customer_id', partnerId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('A rendelés nem található vagy nincs hozzáférése')
          navigate('/partner/orders')
          return
        }
        throw error
      }
      
      if (data) {
        setOrder({
          ...data,
          location_name: data.location?.name
        })
      }
    } catch (error) {
      console.error('Hiba a rendelés betöltésekor:', error)
      toast.error('Hiba a rendelés betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    toast.success('Rendelés letöltése folyamatban...')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'processing':
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'cancelled':
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Teljesítve'
      case 'delivered': return 'Kiszállítva'
      case 'processing': return 'Feldolgozás'
      case 'confirmed': return 'Megerősítve'
      case 'cancelled': return 'Törölve'
      case 'failed': return 'Sikertelen'
      case 'pending': return 'Függőben'
      default: return status
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'refunded':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    }
  }

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Fizetve'
      case 'pending': return 'Függőben'
      case 'failed': return 'Sikertelen'
      case 'refunded': return 'Visszatérítve'
      default: return status
    }
  }

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'Készpénz'
      case 'card': return 'Bankkártya'
      case 'transfer': return 'Átutalás'
      default: return method
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Rendelés nem található</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A keresett rendelés nem található vagy nincs hozzáférése.
        </p>
        <div className="mt-6">
          <Link
            to="/partner/orders"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Vissza a rendelésekhez
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link to="/partner/orders" className="mr-4">
            <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <ShoppingCart className="h-8 w-8 mr-3 text-blue-600" />
              Rendelés: {order.order_number}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Létrehozva: {new Date(order.created_at).toLocaleDateString('hu-HU')}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadOrder}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Frissítés
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Download className="h-5 w-5 mr-2" />
            Letöltés
          </button>
        </div>
      </div>

      {/* Order Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Rendelés állapota</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
              {getStatusText(order.status)}
            </span>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Fizetési állapot</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getPaymentStatusColor(order.payment_status || 'pending')}`}>
              {getPaymentStatusText(order.payment_status || 'pending')}
            </span>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Fizetési mód</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {getPaymentMethodText(order.payment_method || 'transfer')}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Átvételi hely</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {order.location_name || 'Nincs megadva'}
            </p>
          </div>
          
          {order.delivery_date && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Szállítási dátum</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {new Date(order.delivery_date).toLocaleDateString('hu-HU')}
              </p>
            </div>
          )}
        </div>
        
        {order.notes && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Megjegyzések:</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rendelt termékek</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Termék
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Egységár
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Mennyiség
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Összesen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {order.items && order.items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {item.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                    {item.price?.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                    {item.quantity} db
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                    {(item.price * item.quantity).toLocaleString('hu-HU')} Ft
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                  Végösszeg:
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white">
                  {order.total_amount?.toLocaleString('hu-HU')} Ft
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Order Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rendelés állapota</h2>
        
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
          
          <div className="space-y-8">
            <div className="relative">
              <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${
                order.status === 'pending' || order.status === 'processing' || order.status === 'confirmed' || order.status === 'completed' || order.status === 'delivered'
                  ? 'bg-green-100 dark:bg-green-900/20'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <CheckCircle className={`h-5 w-5 ${
                  order.status === 'pending' || order.status === 'processing' || order.status === 'confirmed' || order.status === 'completed' || order.status === 'delivered'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`} />
              </div>
              <div className="ml-16">
                <h3 className="text-base font-medium text-gray-900 dark:text-white">Rendelés leadva</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(order.created_at).toLocaleDateString('hu-HU', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${
                order.status === 'processing' || order.status === 'confirmed' || order.status === 'completed' || order.status === 'delivered'
                  ? 'bg-green-100 dark:bg-green-900/20'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <CheckCircle className={`h-5 w-5 ${
                  order.status === 'processing' || order.status === 'confirmed' || order.status === 'completed' || order.status === 'delivered'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`} />
              </div>
              <div className="ml-16">
                <h3 className="text-base font-medium text-gray-900 dark:text-white">Rendelés feldolgozása</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {order.status === 'processing' || order.status === 'confirmed' || order.status === 'completed' || order.status === 'delivered'
                    ? 'A rendelés feldolgozás alatt'
                    : 'Várakozás a feldolgozásra'}
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${
                order.status === 'confirmed' || order.status === 'completed' || order.status === 'delivered'
                  ? 'bg-green-100 dark:bg-green-900/20'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <CheckCircle className={`h-5 w-5 ${
                  order.status === 'confirmed' || order.status === 'completed' || order.status === 'delivered'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`} />
              </div>
              <div className="ml-16">
                <h3 className="text-base font-medium text-gray-900 dark:text-white">Rendelés megerősítve</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {order.status === 'confirmed' || order.status === 'completed' || order.status === 'delivered'
                    ? 'A rendelést megerősítettük'
                    : 'Várakozás a megerősítésre'}
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${
                order.status === 'completed' || order.status === 'delivered'
                  ? 'bg-green-100 dark:bg-green-900/20'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <CheckCircle className={`h-5 w-5 ${
                  order.status === 'completed' || order.status === 'delivered'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`} />
              </div>
              <div className="ml-16">
                <h3 className="text-base font-medium text-gray-900 dark:text-white">Rendelés teljesítve</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {order.status === 'completed' || order.status === 'delivered'
                    ? 'A rendelés teljesítve'
                    : 'Várakozás a teljesítésre'}
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${
                order.status === 'delivered'
                  ? 'bg-green-100 dark:bg-green-900/20'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <CheckCircle className={`h-5 w-5 ${
                  order.status === 'delivered'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`} />
              </div>
              <div className="ml-16">
                <h3 className="text-base font-medium text-gray-900 dark:text-white">Rendelés kiszállítva</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {order.status === 'delivered'
                    ? 'A rendelés kiszállítva'
                    : 'Várakozás a kiszállításra'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}