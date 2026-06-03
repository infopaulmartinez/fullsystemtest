import React, { useState, useEffect } from 'react'
import { 
  Building, 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Clock, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Calendar,
  User
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

interface PartnerCompany {
  id: string
  name: string
  tax_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  phone: string | null
  email: string | null
  contact_person: string | null
  status: 'active' | 'inactive' | 'suspended'
  discount_percentage: number | null
  payment_terms: string | null
  notes: string | null
}

interface PartnerUser {
  id: string
  user_id: string
  partner_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  is_admin: boolean
}

interface Order {
  id: string
  order_number: string
  status: string
  created_at: string
  total_amount: number
  items: any[]
}

export default function PartnerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [partnerCompany, setPartnerCompany] = useState<PartnerCompany | null>(null)
  const [partnerUser, setPartnerUser] = useState<PartnerUser | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalSpent: 0
  })
  const [products, setProducts] = useState<any[]>([])
  const [favoriteProducts, setFavoriteProducts] = useState<any[]>([])

  useEffect(() => {
    loadPartnerData()
    loadProducts()
  }, [user])

  const loadPartnerData = async () => {
    try {
      setLoading(true)
      
      // Check if user is associated with a partner company
      const { data: partnerUserData, error: partnerUserError } = await supabase
        .from('partner_users')
        .select('*, partner_companies(*)')
        .eq('user_id', user?.id)
        .single()
      
      if (partnerUserError) {
        if (partnerUserError.code === 'PGRST116') {
          // No partner association found
          toast.error('Nincs hozzárendelve partner céghez')
          navigate('/login')
          return
        }
        throw partnerUserError
      }
      
      if (partnerUserData) {
        setPartnerUser({
          id: partnerUserData.id || '',
          user_id: partnerUserData.user_id || '',
          partner_id: partnerUserData.partner_id || '',
          role: partnerUserData.role || 'member',
          is_admin: partnerUserData.is_admin || false
        })
        
        if (partnerUserData.partner_companies) {
          setPartnerCompany(partnerUserData.partner_companies)
        }
        
        // Load orders for this partner
        if (partnerUserData.partner_id) {
          loadOrders(partnerUserData.partner_id)
        }
      }
    } catch (error) {
      console.error('Hiba a partner adatok betöltésekor:', error)
      toast.error('Hiba a partner adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadOrders = async (partnerId: string) => {
    try {
      // Load orders where the partner is the customer
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', partnerId)
        .order('created_at', { ascending: false })
      
      if (ordersError) throw ordersError
      
      if (ordersData) {
        setOrders(ordersData)

        // Set recent orders (last 5)
        setRecentOrders(ordersData.slice(0, 5))
        
        // Calculate stats
        const totalOrders = ordersData.length
        const pendingOrders = ordersData.filter(o => o.status === 'pending' || o.status === 'processing').length
        const completedOrders = ordersData.filter(o => o.status === 'completed' || o.status === 'delivered').length
        const totalSpent = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0)
        
        setStats({
          totalOrders,
          pendingOrders,
          completedOrders,
          totalSpent
        })
      }
    } catch (error) {
      console.error('Hiba a rendelések betöltésekor:', error)
      toast.error('Hiba a rendelések betöltésekor')
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
      
      if (error) throw error
      
      if (data) {
        setProducts(data)
        
        // Set some random products as favorites for demo
        const randomProducts = [...data].sort(() => 0.5 - Math.random()).slice(0, 5)
        setFavoriteProducts(randomProducts)
      }
    } catch (error) {
      console.error('Hiba a termékek betöltésekor:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  if (!partnerCompany) {
    return (
      <div className="text-center py-12">
        <Building className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincs partner cég</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ön nincs hozzárendelve egyetlen partner céghez sem.
        </p>
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
            {partnerCompany.name}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Üdvözöljük a partneri felületen
          </p>
        </div>
        <Link
          to="/partner/orders/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
        >
          <Plus className="h-5 w-5 mr-2" />
          Új rendelés
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes rendelés</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Függőben lévő</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingOrders}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Teljesített</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedOrders}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-3">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes költés</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalSpent.toLocaleString('hu-HU')} Ft
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center"> 
            <ShoppingCart className="h-5 w-5 mr-2 text-blue-600" />
            Legutóbbi rendelések
          </h2>
          <Link
            to="/partner/orders"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          >
            Összes megtekintése →
          </Link>
        </div>
        
        {recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nincsenek rendelések
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Még nem adott le rendelést.
            </p>
            <Link
              to="/partner/orders/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Új rendelés
            </Link>
          </div>
        ) : (
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
                {recentOrders.map((order) => (
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
                      <Link
                        to={`/partner/orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Részletek
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Popular Products */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Package className="h-5 w-5 mr-2 text-blue-600" />
            Népszerű termékek
          </h2>
          <Link
            to="/partner/products"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          >
            Összes megtekintése →
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteProducts.map((product) => (
            <div key={product.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:shadow-md transition-all duration-200">
              <div className="flex items-start">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-3">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{product.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{product.category}</p>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-2">
                    {product.wholesale_price?.toLocaleString('hu-HU')} Ft
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-3">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Rendelések</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tekintse meg korábbi rendeléseit vagy adjon le új rendelést.
          </p>
          <div className="flex space-x-3">
            <Link
              to="/partner/orders"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              Összes rendelés
            </Link>
            <Link
              to="/partner/orders/new"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              Új rendelés
            </Link>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
            <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Termékek</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Böngésszen a termékek között és tekintse meg az árlistát.
          </p>
          <Link
            to="/partner/products"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          >
            Termékek böngészése
          </Link>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-3">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Dokumentumok</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tekintse meg és töltse le a számlákat és egyéb dokumentumokat.
          </p>
          <Link
            to="/partner/documents"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          >
            Dokumentumok megtekintése
          </Link>
        </div>
      </div>
    </div>
  )
}