import React, { useState, useEffect } from 'react'
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  FileText,
  Eye,
  ArrowLeft
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

interface Order {
  id: string
  order_number: string
  status: string
  created_at: string
  total_amount: number
  items: any[]
}

export default function PartnerOrders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [partnerId, setPartnerId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      checkPartnerAssociation()
    }
  }, [user])

  useEffect(() => {
    if (partnerId) {
      loadOrders()
    }
  }, [partnerId, statusFilter, dateRange])

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

  const loadOrders = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('orders')
        .select('*')
        .eq('customer_id', partnerId)
        .order('created_at', { ascending: false })
      
      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      
      // Apply date range filter
      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start)
      }
      
      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      if (data) {
        setOrders(data)
      }
    } catch (error) {
      console.error('Hiba a rendelések betöltésekor:', error)
      toast.error('Hiba a rendelések betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (orderId: string) => {
    toast.success('Rendelés letöltése folyamatban...')
  }

  const filteredOrders = orders.filter(order => 
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link to="/partner" className="mr-4">
            <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <ShoppingCart className="h-8 w-8 mr-3 text-blue-600" />
              Rendelések
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Kezelje és kövesse nyomon rendeléseit
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadOrders}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Frissítés
          </button>
          <Link
            to="/partner/orders/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új rendelés
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Keresés
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rendelésszám..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Állapot
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Összes állapot</option>
              <option value="pending">Függőben</option>
              <option value="processing">Feldolgozás alatt</option>
              <option value="confirmed">Megerősítve</option>
              <option value="completed">Teljesítve</option>
              <option value="delivered">Kiszállítva</option>
              <option value="cancelled">Törölve</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kezdő dátum
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Záró dátum
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rendelés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dátum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Állapot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Összeg
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {order.order_number}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {order.items?.length || 0} termék
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(order.created_at).toLocaleDateString('hu-HU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.status === 'completed' || order.status === 'delivered' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                        : order.status === 'processing' || order.status === 'confirmed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                        : order.status === 'cancelled' || order.status === 'failed'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {order.status === 'completed' ? 'Teljesítve' :
                       order.status === 'delivered' ? 'Kiszállítva' :
                       order.status === 'processing' ? 'Feldolgozás' :
                       order.status === 'confirmed' ? 'Megerősítve' :
                       order.status === 'cancelled' ? 'Törölve' :
                       order.status === 'failed' ? 'Sikertelen' :
                       order.status === 'pending' ? 'Függőben' : order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {order.total_amount?.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Link
                        to={`/partner/orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDownload(order.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincsenek rendelések</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kezdje el új rendelés létrehozásával.
            </p>
            <div className="mt-6">
              <Link
                to="/partner/orders/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Új rendelés
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}