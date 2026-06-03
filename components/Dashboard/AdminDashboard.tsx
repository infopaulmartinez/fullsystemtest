import React, { useState, useEffect, useRef } from 'react'
import { 
  Users, 
  ShoppingCart, 
  Package, 
  DollarSign,
  Clock,
  AlertTriangle,
  Activity,
  User,
  Printer,
  X,
  Receipt
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import StatsCard from './StatsCard'
import { toast } from 'react-hot-toast'

interface RealtimeStats {
  onlineUsers: number
  activeOrders: number
  activeBatches: number
  lowStockItems: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<RealtimeStats>({
    onlineUsers: 0,
    activeOrders: 0,
    activeBatches: 0,
    lowStockItems: 0,
  })
  
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [activeBatches, setActiveBatches] = useState<any[]>([])
  const [userSessions, setUserSessions] = useState<any[]>([])
  const [clockedInEmployees, setClockedInEmployees] = useState<any[]>([])
  const [totalHoursToday, setTotalHoursToday] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<any>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  
  // Ref to track if subscriptions are set up
  const subscriptionsSetupRef = useRef(false)

  useEffect(() => {
    loadDashboardData()
    
    // Setup realtime only once
    if (!subscriptionsSetupRef.current) {
      setupRealtimeSubscriptions()
      subscriptionsSetupRef.current = true
    }
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000)
    
    return () => {
      clearInterval(interval)
    }
  }, [])

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        loadStats(),
        loadRecentActivities(),
        loadActiveOrders(),
        loadActiveBatches(),
        loadUserSessions(),
        loadWorkLogs(),
        loadRecentTransactions()
      ])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // Get active orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id')
        .in('status', ['pending', 'processing', 'confirmed'])
      
      // Get active production batches
      const { data: batchesData } = await supabase
        .from('production_batches')
        .select('id')
        .in('status', ['planned', 'in_progress'])
      
      // Get low stock items
      const { data: lowStockData } = await supabase
        .from('store_inventory')
        .select('id, current_stock, min_threshold')
      
      const lowStockItems = lowStockData?.filter(item => 
        item.current_stock <= item.min_threshold
      ).length || 0
      
      // Get online users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, last_active')
        .gte('last_active', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      
      setStats({
        onlineUsers: profilesData?.length || 0,
        activeOrders: ordersData?.length || 0,
        activeBatches: batchesData?.length || 0,
        lowStockItems,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadRecentActivities = async () => {
    try {
      // Get recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      
      const activities = (orders?.map(o => ({
        id: o.id,
        type: 'order',
        title: `Új rendelés: ${o.order_number}`,
        description: o.customer_name,
        amount: o.total_amount,
        time: o.created_at,
        icon: ShoppingCart
      })) || []).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10)
      
      setRecentActivities(activities)
    } catch (error) {
      console.error('Error loading recent activities:', error)
    }
  }

  const loadActiveOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'processing', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      setActiveOrders(data || [])
    } catch (error) {
      console.error('Error loading active orders:', error)
    }
  }

  const loadActiveBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select(`
          id,
          batch_number,
          recipe_id,
          batch_size,
          status,
          created_at
        `)
        .in('status', ['planned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      setActiveBatches(data || [])
    } catch (error) {
      console.error('Error loading active batches:', error)
    }
  }

  const loadUserSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, last_active')
        .gte('last_active', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order('last_active', { ascending: false })
      
      if (error) throw error
      setUserSessions(data || [])
    } catch (error) {
      console.error('Error loading user sessions:', error)
    }
  }

  const loadWorkLogs = async () => {
    try {
      // Get currently clocked in employees
      // FIX: profiles:employee_id FK join 400-at dob (nincs FK a DB-ben).
      // Megoldás: work_logs-t lekérjük join nélkül, majd profiles-t külön.
      const { data: activeLogsData } = await supabase
        .from('work_logs')
        .select('id, employee_id, user_id, start_time, status')
        .is('end_time', null)
        .order('start_time', { ascending: false })

      if (activeLogsData) {
        // Resolve employee names from profiles separately
        const empIds = activeLogsData
          .map((l: any) => l.employee_id || l.user_id)
          .filter(Boolean)

        let profileMap: Record<string, string> = {}
        if (empIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', empIds)
          if (profilesData) {
            profilesData.forEach((p: any) => { profileMap[p.id] = p.full_name })
          }
        }

        // Deduplicate: keep latest entry per employee
        const seen = new Set<string>()
        const deduped = activeLogsData
          .map((log: any) => {
            const uid = log.employee_id || log.user_id
            return { ...log, employee_name: (uid && profileMap[uid]) || 'Ismeretlen' }
          })
          .filter((log: any) => {
            const uid = log.employee_id || log.user_id
            if (!uid || seen.has(uid)) return false
            seen.add(uid)
            return true
          })

        setClockedInEmployees(deduped)
      }

      // Get today's total hours — duration oszlop opcionális, fallback: end_time-start_time
      const today = new Date().toISOString().split('T')[0]
      const { data: todayLogs } = await supabase
        .from('work_logs')
        .select('start_time, end_time')
        .gte('start_time', `${today}T00:00:00Z`)
        .lt('start_time', `${today}T23:59:59Z`)
        .not('end_time', 'is', null)

      if (todayLogs) {
        const totalMinutes = todayLogs.reduce((sum: number, log: any) => {
          // Prefer explicit duration, fallback to computed
          if (log.duration != null) return sum + log.duration
          if (log.start_time && log.end_time) {
            const diff = (new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 60000
            return sum + Math.max(0, diff)
          }
          return sum
        }, 0)
        setTotalHoursToday(totalMinutes / 60)
      }
    } catch (error) {
      console.error('Error loading work logs:', error)
    }
  }

  const loadRecentTransactions = async () => {
    try {
      // POS tranzakciók – receipt_number és receipt_history_id is kellhet
      const { data: posTx } = await supabase
        .from('pos_transactions')
        .select('id, transaction_number, total_amount, payment_method, created_at, status, receipt_number')
        .order('created_at', { ascending: false })
        .limit(10)

      // Webshop rendelések
      const { data: webshopOrders } = await supabase
        .from('webshop_orders')
        .select('id, order_number, total_amount, payment_method, created_at, status, customer_name')
        .order('created_at', { ascending: false })
        .limit(3)

      const combined: any[] = [
        ...(posTx || []).map(t => ({
          id: t.id,
          number: t.transaction_number || t.receipt_number,
          amount: t.total_amount,
          method: t.payment_method,
          created_at: t.created_at,
          status: t.status,
          source: 'POS',
          receipt_number: t.receipt_number,
        })),
        ...(webshopOrders || []).map(o => ({
          id: o.id,
          number: o.order_number,
          amount: o.total_amount,
          method: o.payment_method,
          created_at: o.created_at,
          status: o.status,
          source: 'Webshop',
          receipt_number: null,
        }))
      ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

      setRecentTransactions(combined)
    } catch (error) {
      console.error('Error loading recent transactions:', error)
    }
  }

  const handleOpenReceipt = async (tx: any) => {
    if (tx.source !== 'POS') return
    setReceiptLoading(true)
    try {
      const { data: receipts } = await supabase
        .from('receipt_history')
        .select('receipt_data, receipt_number, created_at')
        .eq('transaction_id', tx.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (receipts && receipts.length > 0 && receipts[0].receipt_data) {
        setSelectedReceiptTx({ ...tx, receiptData: receipts[0].receipt_data })
      } else {
        // Nincs mentett blokk – generálunk az alap adatokból
        const { data: items } = await supabase
          .from('pos_transaction_items')
          .select('*, products(name)')
          .eq('transaction_id', tx.id)
        setSelectedReceiptTx({
          ...tx,
          receiptData: {
            receiptNumber: tx.receipt_number || tx.number || tx.id,
            date: tx.created_at,
            cashierName: 'Admin',
            items: (items || []).map((i: any) => ({
              name: i.products?.name || 'Termék',
              quantity: i.quantity,
              unitPrice: i.unit_price,
              subtotal: i.total_price,
              vatPct: i.vat_percentage || 27,
              unit: 'db',
            })),
            subtotalNet: tx.amount * 0.787,
            taxAmount: tx.amount * 0.213,
            total: tx.amount,
            paymentMethod: tx.method,
            amountPaid: tx.amount,
            change: 0,
            success: tx.status === 'completed',
          }
        })
      }
    } catch (e) {
      toast.error('Blokk betöltési hiba')
    } finally {
      setReceiptLoading(false)
    }
  }

  const printReceipt = (receiptData: any) => {
    const w = window.open('', '_blank', 'width=400,height=700')
    if (!w) return
    const items = (receiptData.items || []).map((i: any) => `
      <tr>
        <td>${i.name}</td>
        <td style="text-align:right">${i.quantity} ${i.unit || 'db'}</td>
        <td style="text-align:right">${Number(i.unitPrice || 0).toLocaleString('hu-HU')} Ft</td>
        <td style="text-align:right">${Number(i.subtotal || 0).toLocaleString('hu-HU')} Ft</td>
      </tr>`).join('')
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>Blokk</title>
      <style>
        body { font-family: monospace; font-size: 13px; padding: 20px; max-width: 320px; margin: 0 auto; }
        h2,h3 { text-align: center; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 4px; }
        .total { font-weight: bold; font-size: 16px; }
        .sep { border-top: 1px dashed #000; margin: 8px 0; }
        @media print { button { display: none; } }
      </style>
    </head><body>
      <h2>NYUGTA</h2>
      <h3>${receiptData.receiptNumber || ''}</h3>
      <p style="text-align:center;font-size:11px">${new Date(receiptData.date || '').toLocaleString('hu-HU')}</p>
      <div class="sep"></div>
      <table>
        <thead><tr><th>Termék</th><th>db</th><th>Egységár</th><th>Összeg</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <div class="sep"></div>
      <table>
        <tr><td>Nettó:</td><td style="text-align:right">${Number(receiptData.subtotalNet || 0).toLocaleString('hu-HU')} Ft</td></tr>
        <tr><td>ÁFA:</td><td style="text-align:right">${Number(receiptData.taxAmount || 0).toLocaleString('hu-HU')} Ft</td></tr>
        <tr class="total"><td>Fizetendő:</td><td style="text-align:right">${Number(receiptData.total || 0).toLocaleString('hu-HU')} Ft</td></tr>
        <tr><td>Fizetve:</td><td style="text-align:right">${Number(receiptData.amountPaid || 0).toLocaleString('hu-HU')} Ft</td></tr>
        ${receiptData.change > 0 ? `<tr><td>Visszajáró:</td><td style="text-align:right">${Number(receiptData.change).toLocaleString('hu-HU')} Ft</td></tr>` : ''}
        <tr><td>Fizetési mód:</td><td style="text-align:right">${receiptData.paymentMethod || ''}</td></tr>
      </table>
      <div class="sep"></div>
      <p style="text-align:center;font-size:11px">Köszönjük a vásárlást!</p>
      <br><button onclick="window.print()">🖨️ Nyomtatás</button>
    </body></html>`)
    w.document.close()
  }

  const setupRealtimeSubscriptions = () => {
    try {
      // Subscribe to orders
      const orderChannel = supabase
        .channel('realtime:orders', {
          config: {
            broadcast: { self: false },
            presence: { key: 'orders' }
          }
        })
      
      orderChannel
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'orders' 
        }, () => {
          loadStats()
          loadActiveOrders()
          loadRecentActivities()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✓ Orders subscription ready')
          }
        })

      // Subscribe to production batches
      const batchChannel = supabase
        .channel('realtime:batches', {
          config: {
            broadcast: { self: false },
            presence: { key: 'batches' }
          }
        })
      
      batchChannel
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'production_batches' 
        }, () => {
          loadStats()
          loadActiveBatches()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✓ Batches subscription ready')
          }
        })

      // Cleanup function
      return () => {
        orderChannel.unsubscribe()
        batchChannel.unsubscribe()
      }
    } catch (error) {
      console.error('Error setting up realtime subscriptions:', error)
      return () => {}
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': case 'delivered': case 'active':
        return 'text-green-600 dark:text-green-400'
      case 'processing': case 'in_progress': case 'confirmed':
        return 'text-blue-600 dark:text-blue-400'
      case 'pending': case 'planned':
        return 'text-amber-600 dark:text-amber-400'
      case 'cancelled': case 'failed': case 'inactive':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Függőben',
      'processing': 'Feldolgozás',
      'confirmed': 'Megerősítve',
      'completed': 'Befejezve',
      'delivered': 'Kiszállítva',
      'cancelled': 'Törölve',
      'failed': 'Sikertelen',
      'planned': 'Tervezett',
      'in_progress': 'Folyamatban',
      'active': 'Aktív',
      'inactive': 'Inaktív'
    }
    return statusMap[status] || status
  }

  const statsCards = [
    {
      title: 'Online felhasználók',
      value: stats.onlineUsers.toString(),
      change: `${stats.onlineUsers} összes aktív`,
      changeType: 'positive' as const,
      icon: Users,
      gradient: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Aktív rendelések',
      value: stats.activeOrders.toString(),
      change: 'Feldolgozás alatt',
      changeType: 'neutral' as const,
      icon: ShoppingCart,
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Gyártás folyamatban',
      value: stats.activeBatches.toString(),
      change: 'Aktív tételek',
      changeType: 'neutral' as const,
      icon: Package,
      gradient: 'from-purple-500 to-violet-600'
    },
    {
      title: 'Készlet riasztások',
      value: stats.lowStockItems.toString(),
      change: 'Alacsony készlet',
      changeType: stats.lowStockItems > 0 ? 'negative' as const : 'positive' as const,
      icon: AlertTriangle,
      gradient: 'from-red-500 to-pink-600'
    },
    {
      title: 'Munkaidő ma',
      value: `${totalHoursToday.toFixed(1)}h`,
      change: clockedInEmployees.length > 0 ? `${clockedInEmployees.length} fő dolgozik` : 'Nincs aktív műszak',
      changeType: clockedInEmployees.length > 0 ? 'positive' as const : 'neutral' as const,
      icon: Clock,
      gradient: 'from-teal-500 to-cyan-600'
    }
  ]

  if (loading) {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Irányítópult
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time áttekintés a rendszer állapotáról
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center text-green-600 dark:text-green-400">
            <Activity className="h-5 w-5 mr-1" />
            <span className="text-sm font-medium">Live</span>
          </div>
          <button
            onClick={loadDashboardData}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Clock className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statsCards.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Online Felhasználók */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Users className="h-5 w-5 mr-2 text-green-600" />
              Online felhasználók
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {userSessions.length} online
            </span>
          </div>
          
          <div className="space-y-3">
            {userSessions.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Nincs online felhasználó</p>
              </div>
            ) : (
              userSessions.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.full_name || 'Névtelen'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-green-600 dark:text-green-400">
                    <div className="w-2 h-2 rounded-full bg-current mr-2"></div>
                    <span className="text-xs">Online</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Utolsó tranzakciók */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-amber-600" />
              Utolsó tranzakciók
            </h3>
            <a href="#/cashmatic" className="text-xs text-amber-600 hover:text-amber-700 font-semibold">
              Kassza →
            </a>
          </div>
          
          <div className="space-y-2">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Nincsenek tranzakciók</p>
            ) : (
              recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => handleOpenReceipt(tx)}
                  className={`flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 ${tx.source === 'POS' ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors group' : ''}`}
                  title={tx.source === 'POS' ? 'Kattints a blokk megtekintéséhez' : ''}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${tx.source === 'POS' ? 'bg-green-500' : 'bg-blue-500'}`} />
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tx.number || tx.id.slice(0,8)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {tx.source} • {new Date(tx.created_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {Number(tx.amount || 0).toLocaleString('hu-HU')} Ft
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{tx.method || '-'}</p>
                    </div>
                    {tx.source === 'POS' && (
                      <Printer className="h-4 w-4 text-gray-300 group-hover:text-amber-500 transition-colors flex-none" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Receipt modal */}
          {selectedReceiptTx && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedReceiptTx(null)}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-amber-600" />
                    Blokk – {selectedReceiptTx.number || selectedReceiptTx.id.slice(0,8)}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printReceipt(selectedReceiptTx.receiptData)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg"
                    >
                      <Printer className="h-3.5 w-3.5" /> Nyomtatás
                    </button>
                    <button onClick={() => setSelectedReceiptTx(null)}>
                      <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="p-5 font-mono text-sm">
                  <div className="text-center mb-3">
                    <p className="font-bold text-lg">NYUGTA</p>
                    <p className="text-xs text-gray-500">{selectedReceiptTx.receiptData?.receiptNumber}</p>
                    <p className="text-xs text-gray-400">{new Date(selectedReceiptTx.receiptData?.date || '').toLocaleString('hu-HU')}</p>
                  </div>
                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2" />
                  <div className="space-y-1">
                    {(selectedReceiptTx.receiptData?.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="truncate flex-1">{item.name} × {item.quantity}</span>
                        <span className="ml-2 flex-none">{Number(item.subtotal || 0).toLocaleString('hu-HU')} Ft</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2" />
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>Nettó:</span><span>{Number(selectedReceiptTx.receiptData?.subtotalNet || 0).toLocaleString('hu-HU')} Ft</span></div>
                    <div className="flex justify-between"><span>ÁFA:</span><span>{Number(selectedReceiptTx.receiptData?.taxAmount || 0).toLocaleString('hu-HU')} Ft</span></div>
                    <div className="flex justify-between font-bold text-base"><span>Összesen:</span><span className="text-amber-600">{Number(selectedReceiptTx.receiptData?.total || 0).toLocaleString('hu-HU')} Ft</span></div>
                    <div className="flex justify-between"><span>Fizetve:</span><span>{Number(selectedReceiptTx.receiptData?.amountPaid || 0).toLocaleString('hu-HU')} Ft</span></div>
                    {(selectedReceiptTx.receiptData?.change || 0) > 0 && (
                      <div className="flex justify-between text-green-600"><span>Visszajáró:</span><span>{Number(selectedReceiptTx.receiptData?.change).toLocaleString('hu-HU')} Ft</span></div>
                    )}
                    <div className="flex justify-between"><span>Fizetési mód:</span><span className="capitalize">{selectedReceiptTx.receiptData?.paymentMethod}</span></div>
                  </div>
                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2" />
                  <p className="text-center text-xs text-gray-400">Köszönjük a vásárlást!</p>
                </div>
              </div>
            </div>
          )}

          {receiptLoading && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex items-center gap-3 shadow-xl">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Blokk betöltése...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Munkaidő Szekció - mindig látható */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Clock className="h-5 w-5 mr-2 text-teal-600" />
            Munkaidő Áttekintés
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-teal-600">Ma összesen: {totalHoursToday.toFixed(1)}h</span>
            <a href="#/worklogs" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">Részletek →</a>
          </div>
        </div>

        {clockedInEmployees.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Jelenleg senki sem dolgozik</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Mai ledolgozott idő: {totalHoursToday.toFixed(1)} óra</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {clockedInEmployees.map(log => {
              const startTime = new Date(log.start_time)
              const now = new Date()
              const minutesWorked = Math.round((now.getTime() - startTime.getTime()) / 60000)
              const hoursWorked = Math.floor(minutesWorked / 60)
              const minsLeft = minutesWorked % 60

              return (
                <div
                  key={log.id}
                  className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-200 dark:border-teal-800"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {log.employee_name}
                    </p>
                    <div className="flex items-center gap-1 text-green-600">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-teal-700 dark:text-teal-400">
                    {hoursWorked > 0 ? `${hoursWorked}h ${minsLeft}m` : `${minutesWorked} perc`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {startTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })} óta
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aktív Rendelések */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2 text-blue-600" />
            Aktív rendelések
          </h3>
          
          <div className="space-y-3">
            {activeOrders.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nincs aktív rendelés
              </p>
            ) : (
              activeOrders.map((order) => (
                <div key={order.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {order.order_number}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)} bg-current bg-opacity-10`}>
                      {getStatusText(order.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {order.customer_name}
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {order.total_amount?.toLocaleString('hu-HU')} Ft
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Aktív Gyártás */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2 text-purple-600" />
            Aktív gyártás
          </h3>
          
          <div className="space-y-3">
            {activeBatches.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nincs aktív gyártás
              </p>
            ) : (
              activeBatches.map((batch) => (
                <div key={batch.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {batch.batch_number}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(batch.status)} bg-current bg-opacity-10`}>
                      {getStatusText(batch.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {batch.products?.name || 'Ismeretlen termék'}
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {batch.batch_size} db
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Legutóbbi Tevékenységek */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-amber-600" />
            Legutóbbi tevékenységek
          </h3>
          
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nincs tevékenység
              </p>
            ) : (
              recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <activity.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {activity.description}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-400">
                        {new Date(activity.time).toLocaleTimeString('hu-HU', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      {activity.amount && (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">
                          {activity.amount.toLocaleString('hu-HU')} Ft
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}