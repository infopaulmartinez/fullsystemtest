import React, { useState, useEffect } from 'react'
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Truck,
  FileText,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  CreditCard,
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
  Activity
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SalesData {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  topProducts: any[]
  salesChartData: any[]
}
interface ProductionData {
  totalBatches: number
  completedBatches: number
  avgQuality: number
  efficiency: number
  topRecipes: any[]
}
interface InventoryData {
  totalItems: number
  lowStockItems: number
  totalValue: number
  topCategories: any[]
}
interface PersonnelData {
  totalEmployees: number
  activeEmployees: number
  totalHours: number
  departmentBreakdown: any[]
}
interface FleetData {
  totalVehicles: number
  activeVehicles: number
  maintenanceVehicles: number
  totalDeliveries: number
  damageReports: number
  openDamageReports: number
  upcomingService: any[]
  statusBreakdown: any[]
  deliveriesByDriver: any[]
}
interface FinancialData {
  totalRevenue: number
  totalInvoiced: number
  pendingPayments: number
  paidInvoices: number
  totalExpenses: number
  netProfit: number
  invoiceStatusBreakdown: any[]
  revenueBySource: any[]
  cashMovements: any[]
}

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [selectedReport, setSelectedReport] = useState('sales')
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [salesData, setSalesData] = useState<SalesData>({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, topProducts: [], salesChartData: [] })
  const [productionData, setProductionData] = useState<ProductionData>({ totalBatches: 0, completedBatches: 0, avgQuality: 0, efficiency: 0, topRecipes: [] })
  const [inventoryData, setInventoryData] = useState<InventoryData>({ totalItems: 0, lowStockItems: 0, totalValue: 0, topCategories: [] })
  const [personnelData, setPersonnelData] = useState<PersonnelData>({ totalEmployees: 0, activeEmployees: 0, totalHours: 0, departmentBreakdown: [] })
  const [fleetData, setFleetData] = useState<FleetData>({ totalVehicles: 0, activeVehicles: 0, maintenanceVehicles: 0, totalDeliveries: 0, damageReports: 0, openDamageReports: 0, upcomingService: [], statusBreakdown: [], deliveriesByDriver: [] })
  const [financialData, setFinancialData] = useState<FinancialData>({ totalRevenue: 0, totalInvoiced: 0, pendingPayments: 0, paidInvoices: 0, totalExpenses: 0, netProfit: 0, invoiceStatusBreakdown: [], revenueBySource: [], cashMovements: [] })

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ sales: true, production: true, inventory: true, personnel: true, fleet: true, financial: true })

  // ── Dátum számítás ──────────────────────────────────────────────────────
  useEffect(() => {
    const now = new Date()
    let start = new Date()
    let end = new Date()
    switch (selectedPeriod) {
      case 'day':
        start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999); break
      case 'week':
        start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0)
        end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999); break
      case 'month':
        start.setDate(1); start.setHours(0, 0, 0, 0)
        end.setMonth(now.getMonth() + 1); end.setDate(0); end.setHours(23, 59, 59, 999); break
      case 'quarter':
        const q = Math.floor(now.getMonth() / 3)
        start.setMonth(q * 3); start.setDate(1); start.setHours(0, 0, 0, 0)
        end.setMonth(q * 3 + 3); end.setDate(0); end.setHours(23, 59, 59, 999); break
      case 'year':
        start.setMonth(0); start.setDate(1); start.setHours(0, 0, 0, 0)
        end.setMonth(11); end.setDate(31); end.setHours(23, 59, 59, 999); break
    }
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }, [selectedPeriod])

  useEffect(() => {
    if (startDate && endDate) loadReportData()
  }, [startDate, endDate, selectedReport])

  const loadReportData = async () => {
    setLoading(true)
    try {
      switch (selectedReport) {
        case 'sales':      await loadSalesData(); break
        case 'production': await loadProductionData(); break
        case 'inventory':  await loadInventoryData(); break
        case 'personnel':  await loadPersonnelData(); break
        case 'fleet':      await loadFleetData(); break
        case 'financial':  await loadFinancialData(); break
      }
    } catch (error) {
      console.error(`Error loading ${selectedReport} data:`, error)
      toast.error('Hiba az adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  // ── Értékesítés ─────────────────────────────────────────────────────────
  const loadSalesData = async () => {
    try {
      const startISO = `${startDate}T00:00:00`
      const endISO   = `${endDate}T23:59:59`

      const [{ data: orders }, { data: webshopOrders }, { data: posTransactions }] = await Promise.all([
        supabase.from('orders').select('id,order_number,customer_name,items,total_amount,created_at,status').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('webshop_orders').select('id,order_number,customer_name,items,total_amount,created_at,status').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('pos_transactions').select('id,transaction_number,items,total_amount,created_at,status').gte('created_at', startISO).lte('created_at', endISO),
      ])

      const allOrders = [
        ...(orders || []),
        ...(webshopOrders || []).map(o => ({ ...o, customer_name: o.customer_name || 'Webshop vásárló' })),
        ...(posTransactions || []).map(tx => ({ id: tx.id, order_number: tx.transaction_number, customer_name: 'POS Vásárló', items: tx.items, total_amount: tx.total_amount, created_at: tx.created_at, status: tx.status })),
      ]

      const totalRevenue  = allOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
      const totalOrders   = allOrders.length
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
      allOrders.forEach(order => {
        if (!Array.isArray(order.items)) return
        order.items.forEach((item: any) => {
          const name     = item.name || item.product_name
          const qty      = item.quantity || 0
          // Ár: unit_price > price > 0
          const price    = item.unit_price || item.price || 0
          const revenue  = qty * price
          if (!name) return
          if (productMap.has(name)) {
            const p = productMap.get(name)!; p.quantity += qty; p.revenue += revenue
          } else {
            productMap.set(name, { name, quantity: qty, revenue })
          }
        })
      })
      const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

      const salesByDate = new Map<string, { date: string; value: number; count: number }>()
      allOrders.forEach(order => {
        const date   = new Date(order.created_at).toISOString().split('T')[0]
        const amount = order.total_amount || 0
        if (salesByDate.has(date)) {
          const cur = salesByDate.get(date)!; cur.value += amount; cur.count += 1
        } else {
          salesByDate.set(date, { date, value: amount, count: 1 })
        }
      })
      const salesChartData = Array.from(salesByDate.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(d => ({ name: new Date(d.date).toLocaleDateString('hu-HU'), bevétel: Math.round(d.value), rendelések: d.count }))

      setSalesData({ totalRevenue, totalOrders, avgOrderValue, topProducts, salesChartData })
    } catch (error) {
      console.error('Sales data error:', error)
      setSalesData({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, topProducts: [], salesChartData: [] })
    }
  }

  // ── Termelés ────────────────────────────────────────────────────────────
  // JAVÍTÁS: products!production_batches_recipe_id_fkey(name) – helyes FK alias
  const loadProductionData = async () => {
    try {
      const { data: batchesData, error } = await supabase
        .from('production_batches')
        .select('id, batch_size, status, quality_score, actual_yield, created_at, products!production_batches_recipe_id_fkey(name)')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)

      if (error) throw error

      const totalBatches     = batchesData?.length || 0
      const completedBatches = batchesData?.filter(b => b.status === 'completed').length || 0
      const avgQuality       = totalBatches > 0
        ? (batchesData || []).reduce((s, b) => s + (b.quality_score || 0), 0) / totalBatches
        : 0
      const efficiency = totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0

      const recipeMap = new Map<string, { name: string; batches: number; totalQuality: number }>()
      batchesData?.forEach(batch => {
        const name    = (batch as any).products?.name || 'Ismeretlen termék'
        const quality = batch.quality_score || 0
        if (recipeMap.has(name)) {
          const r = recipeMap.get(name)!; r.batches += 1; r.totalQuality += quality
        } else {
          recipeMap.set(name, { name, batches: 1, totalQuality: quality })
        }
      })
      const topRecipes = Array.from(recipeMap.values())
        .map(r => ({ name: r.name, batches: r.batches, quality: r.batches > 0 ? r.totalQuality / r.batches : 0 }))
        .sort((a, b) => b.batches - a.batches)
        .slice(0, 10)

      setProductionData({ totalBatches, completedBatches, avgQuality, efficiency, topRecipes })
    } catch (error) {
      console.error('Production data error:', error)
      setProductionData({ totalBatches: 0, completedBatches: 0, avgQuality: 0, efficiency: 0, topRecipes: [] })
    }
  }

  // ── Készlet ─────────────────────────────────────────────────────────────
  const loadInventoryData = async () => {
    try {
      let data: any[] = []
      const { data: storeInv, error: storeErr } = await supabase.from('store_inventory').select('*')
      if (!storeErr && storeInv) { data = storeInv } else {
        const { data: inv } = await supabase.from('inventory').select('*')
        data = inv || []
      }
      const totalItems    = data.length
      const lowStockItems = data.filter(item => (item.current_stock ?? 0) <= (item.min_threshold ?? item.min_stock ?? 0)).length
      const totalValue    = data.reduce((s, item) => s + ((item.current_stock || 0) * (item.cost_per_unit || item.unit_cost || 0)), 0)
      const categoryMap   = new Map<string, { name: string; count: number; value: number }>()
      data.forEach(item => {
        const category = item.category || 'Egyéb'
        const value    = (item.current_stock || 0) * (item.cost_per_unit || item.unit_cost || 0)
        if (categoryMap.has(category)) {
          const cat = categoryMap.get(category)!; cat.count += 1; cat.value += value
        } else {
          categoryMap.set(category, { name: category, count: 1, value })
        }
      })
      const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.value - a.value).slice(0, 10)
      setInventoryData({ totalItems, lowStockItems, totalValue, topCategories })
    } catch (error) {
      console.error('Inventory data error:', error)
      setInventoryData({ totalItems: 0, lowStockItems: 0, totalValue: 0, topCategories: [] })
    }
  }

  // ── Személyzet ──────────────────────────────────────────────────────────
  const loadPersonnelData = async () => {
    try {
      const [{ data: profilesData }, { data: workLogsData }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('work_logs').select('*').gte('start_time', `${startDate}T00:00:00`).lte('start_time', `${endDate}T23:59:59`),
      ])

      const totalEmployees  = profilesData?.length || 0
      const activeEmployees = profilesData?.filter(p => p.status === 'active').length || 0

      let totalHours = 0
      workLogsData?.forEach(log => {
        if (log.duration) {
          const d = Number(log.duration)
          totalHours += (d > 1440 ? d / 3600 : d / 60)
        } else if (log.start_time && log.end_time) {
          totalHours += (new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 3600000
        }
      })

      const departmentMap = new Map<string, number>()
      profilesData?.forEach(p => departmentMap.set(p.role || 'other', (departmentMap.get(p.role || 'other') || 0) + 1))
      const departmentBreakdown = Array.from(departmentMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
      setPersonnelData({ totalEmployees, activeEmployees, totalHours, departmentBreakdown })
    } catch (error) {
      console.error('Personnel data error:', error)
      setPersonnelData({ totalEmployees: 0, activeEmployees: 0, totalHours: 0, departmentBreakdown: [] })
    }
  }

  // ── Flotta ──────────────────────────────────────────────────────────────
  const loadFleetData = async () => {
    try {
      const startISO = `${startDate}T00:00:00`
      const endISO   = `${endDate}T23:59:59`

      const [
        { data: vehicles },
        { data: damageReports },
        { data: deliveries },
      ] = await Promise.all([
        supabase.from('vehicles').select('id, license_plate, make, model, status, next_service, next_service_date, insurance_expiry, driver_id, profiles:driver_id(full_name)'),
        supabase.from('vehicle_damage_reports').select('id, vehicle_id, status, created_at').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('delivery_notes').select('id, driver_id, vehicle_id, status, created_at, profiles:driver_id(full_name)').gte('created_at', startISO).lte('created_at', endISO),
      ])

      const allVehicles       = vehicles || []
      const totalVehicles     = allVehicles.length
      const activeVehicles    = allVehicles.filter(v => v.status === 'active').length
      const maintenanceVehicles = allVehicles.filter(v => v.status === 'maintenance').length

      // Státusz eloszlás
      const statusMap = new Map<string, number>()
      allVehicles.forEach(v => {
        const label = v.status === 'active' ? 'Aktív' : v.status === 'maintenance' ? 'Szerviz' : 'Inaktív'
        statusMap.set(label, (statusMap.get(label) || 0) + 1)
      })
      const statusBreakdown = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }))

      // Közelgő szerviz (következő 30 napban)
      const now30 = new Date(); now30.setDate(now30.getDate() + 30)
      const upcomingService = allVehicles
        .filter(v => {
          const d = v.next_service_date || v.next_service
          return d && new Date(d) <= now30
        })
        .map(v => ({
          id: v.id,
          name: `${v.make} ${v.model} (${v.license_plate})`,
          date: v.next_service_date || v.next_service,
          driver: (v as any).profiles?.full_name || '–',
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5)

      // Szállítások sofőr szerint
      const driverMap = new Map<string, number>()
      ;(deliveries || []).forEach(d => {
        const name = (d as any).profiles?.full_name || 'Ismeretlen sofőr'
        driverMap.set(name, (driverMap.get(name) || 0) + 1)
      })
      const deliveriesByDriver = Array.from(driverMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8)

      const allDamages     = damageReports || []
      const openDamages    = allDamages.filter(r => !['fixed', 'rejected'].includes(r.status)).length
      const totalDeliveries = deliveries?.length || 0

      setFleetData({ totalVehicles, activeVehicles, maintenanceVehicles, totalDeliveries, damageReports: allDamages.length, openDamageReports: openDamages, upcomingService, statusBreakdown, deliveriesByDriver })
    } catch (error) {
      console.error('Fleet data error:', error)
      setFleetData({ totalVehicles: 0, activeVehicles: 0, maintenanceVehicles: 0, totalDeliveries: 0, damageReports: 0, openDamageReports: 0, upcomingService: [], statusBreakdown: [], deliveriesByDriver: [] })
    }
  }

  // ── Pénzügy ─────────────────────────────────────────────────────────────
  const loadFinancialData = async () => {
    try {
      const startISO = `${startDate}T00:00:00`
      const endISO   = `${endDate}T23:59:59`

      const [
        { data: invoices },
        { data: cashMovements },
        { data: posTransactions },
        { data: orders },
      ] = await Promise.all([
        supabase.from('invoices').select('id, total_amount, subtotal, tax_amount, payment_status, issue_date').gte('issue_date', startDate).lte('issue_date', endDate),
        supabase.from('cash_movements').select('id, type, amount, created_at').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('pos_transactions').select('id, total_amount, created_at').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('orders').select('id, total_amount, status, created_at').gte('created_at', startISO).lte('created_at', endISO),
      ])

      // Számlák összesítése
      const allInvoices   = invoices || []
      const totalInvoiced = allInvoices.reduce((s, i) => s + (i.total_amount || 0), 0)
      const paidInvoices  = allInvoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0)
      const pendingPayments = allInvoices.filter(i => i.payment_status === 'pending').reduce((s, i) => s + (i.total_amount || 0), 0)

      // Számla státusz eloszlás
      const invoiceStatusMap = new Map<string, number>()
      allInvoices.forEach(i => {
        const label = i.payment_status === 'paid' ? 'Fizetve' : i.payment_status === 'overdue' ? 'Lejárt' : 'Függőben'
        invoiceStatusMap.set(label, (invoiceStatusMap.get(label) || 0) + (i.total_amount || 0))
      })
      const invoiceStatusBreakdown = Array.from(invoiceStatusMap.entries()).map(([name, value]) => ({ name, value }))

      // Bevétel forrás szerint
      const orderRevenue   = (orders || []).reduce((s, o) => s + (o.total_amount || 0), 0)
      const posRevenue     = (posTransactions || []).reduce((s, t) => s + (t.total_amount || 0), 0)
      const invoiceRevenue = paidInvoices
      const revenueBySource = [
        { name: 'Rendelések', value: Math.round(orderRevenue) },
        { name: 'POS eladás', value: Math.round(posRevenue) },
        { name: 'Számla (fizetve)', value: Math.round(invoiceRevenue) },
      ].filter(s => s.value > 0)

      const totalRevenue = orderRevenue + posRevenue

      // Pénzmozgások
      const allMovements = cashMovements || []
      const totalExpenses = allMovements.filter(m => m.type === 'expense' || m.type === 'withdrawal').reduce((s, m) => s + (m.amount || 0), 0)
      const netProfit = totalRevenue - totalExpenses

      // Pénzmozgás összesítő (naponta)
      const movByDate = new Map<string, { date: string; bev: number; kiad: number }>()
      allMovements.forEach(m => {
        const d = new Date(m.created_at).toISOString().split('T')[0]
        if (!movByDate.has(d)) movByDate.set(d, { date: d, bev: 0, kiad: 0 })
        const cur = movByDate.get(d)!
        if (m.type === 'income' || m.type === 'deposit') cur.bev += m.amount || 0
        else cur.kiad += m.amount || 0
      })
      const cashMovementsChart = Array.from(movByDate.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(d => ({ name: new Date(d.date).toLocaleDateString('hu-HU'), Bevétel: Math.round(d.bev), Kiadás: Math.round(d.kiad) }))

      setFinancialData({ totalRevenue, totalInvoiced, pendingPayments, paidInvoices, totalExpenses, netProfit, invoiceStatusBreakdown, revenueBySource, cashMovements: cashMovementsChart })
    } catch (error) {
      console.error('Financial data error:', error)
      setFinancialData({ totalRevenue: 0, totalInvoiced: 0, pendingPayments: 0, paidInvoices: 0, totalExpenses: 0, netProfit: 0, invoiceStatusBreakdown: [], revenueBySource: [], cashMovements: [] })
    }
  }

  // ── Export / Print ──────────────────────────────────────────────────────
  const handleExport = () => {
    const map: Record<string, any> = { sales: salesData, production: productionData, inventory: inventoryData, personnel: personnelData, fleet: fleetData, financial: financialData }
    const blob = new Blob([JSON.stringify(map[selectedReport] || {}, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `${selectedReport}_${startDate}_${endDate}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    toast.success('Exportálva!')
  }
  const handlePrint = () => window.print()
  const toggleSection = (s: string) => setExpandedSections(p => ({ ...p, [s]: !p[s] }))

  const roleLabel = (name: string) => ({ admin: 'Admin', baker: 'Pék', salesperson: 'Eladó', driver: 'Sofőr', other: 'Egyéb' }[name] || name)

  const reportTypes = [
    { id: 'sales',      name: 'Értékesítés', icon: DollarSign, color: 'from-green-500 to-emerald-600' },
    { id: 'production', name: 'Termelés',    icon: Package,    color: 'from-blue-500 to-cyan-600' },
    { id: 'inventory',  name: 'Készlet',     icon: Package,    color: 'from-purple-500 to-violet-600' },
    { id: 'personnel',  name: 'Személyzet',  icon: Users,      color: 'from-amber-500 to-orange-600' },
    { id: 'fleet',      name: 'Flotta',      icon: Truck,      color: 'from-red-500 to-pink-600' },
    { id: 'financial',  name: 'Pénzügy',     icon: DollarSign, color: 'from-indigo-500 to-blue-600' },
  ]

  const COLORS = ['#0088FE','#00C49F','#FFBB28','#FF8042','#8884d8','#82ca9d','#ffc658','#8dd1e1','#a4de6c','#d0ed57']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <BarChart3 className="h-8 w-8 mr-3 text-blue-600" />Jelentések
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Üzleti intelligencia és teljesítmény elemzés</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={handleExport} className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Download className="h-5 w-5 mr-2" />Export
          </button>
          <button onClick={handlePrint} className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Printer className="h-5 w-5 mr-2" />Nyomtatás
          </button>
        </div>
      </div>

      {/* Jelentés típusa */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Jelentés típusa</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {reportTypes.map(type => (
            <button key={type.id} onClick={() => setSelectedReport(type.id)}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${selectedReport === type.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center mx-auto mb-2`}>
                <type.icon className="h-6 w-6 text-white" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white text-center">{type.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Szűrők */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Időszak</label>
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="day">Mai nap</option>
              <option value="week">Ez a hét</option>
              <option value="month">Ez a hónap</option>
              <option value="quarter">Ez a negyedév</option>
              <option value="year">Ez az év</option>
              <option value="custom">Egyéni</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kezdő dátum</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Záró dátum</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* ── ÉRTÉKESÍTÉS ─────────────────────────────────────────────────── */}
      {!loading && selectedReport === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Összes bevétel', value: salesData.totalRevenue.toLocaleString('hu-HU') + ' Ft', icon: DollarSign, color: 'from-green-500 to-emerald-600' },
              { label: 'Rendelések', value: salesData.totalOrders, icon: FileText, color: 'from-blue-500 to-cyan-600' },
              { label: 'Átlag kosárérték', value: Math.round(salesData.avgOrderValue).toLocaleString('hu-HU') + ' Ft', icon: TrendingUp, color: 'from-purple-500 to-violet-600' },
              { label: 'Eladott termékek', value: salesData.topProducts.reduce((s, p: any) => s + p.quantity, 0), icon: Package, color: 'from-amber-500 to-orange-600' },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <div className={`rounded-xl bg-gradient-to-br ${card.color} p-3`}><card.icon className="h-6 w-6 text-white" /></div>
                  <div className="ml-4"><p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p></div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Legnépszerűbb termékek</h3>
              <button onClick={() => toggleSection('sales')} className="text-gray-500">{expandedSections.sales ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</button>
            </div>
            {expandedSections.sales && (
              <>
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full"><thead><tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 text-sm font-medium text-gray-500">Termék</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">Mennyiség</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">Bevétel</th>
                  </tr></thead><tbody>
                    {salesData.topProducts.map((p: any, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3 text-sm text-gray-900 dark:text-white">{p.name}</td>
                        <td className="py-3 text-sm text-right text-gray-900 dark:text-white">{p.quantity} db</td>
                        <td className="py-3 text-sm text-right text-gray-900 dark:text-white">{p.revenue.toLocaleString('hu-HU')} Ft</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
                <div className="h-80">
                  {salesData.salesChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesData.salesChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis yAxisId="left" orientation="left" stroke="#0088FE" /><YAxis yAxisId="right" orientation="right" stroke="#00C49F" />
                        <Tooltip formatter={(v: any) => v.toLocaleString('hu-HU')} /><Legend />
                        <Bar yAxisId="left" dataKey="bevétel" name="Bevétel (Ft)" fill="#0088FE" />
                        <Bar yAxisId="right" dataKey="rendelések" name="Rendelések (db)" fill="#00C49F" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full"><p className="text-gray-500">Nincs adat a kijelölt időszakban</p></div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TERMELÉS ────────────────────────────────────────────────────── */}
      {!loading && selectedReport === 'production' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Összes tétel', value: productionData.totalBatches, icon: Package, color: 'from-amber-500 to-orange-600' },
              { label: 'Befejezett', value: productionData.completedBatches, icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
              { label: 'Átlag minőség', value: productionData.avgQuality.toFixed(1) + '%', icon: BarChart3, color: 'from-blue-500 to-cyan-600' },
              { label: 'Hatékonyság', value: productionData.efficiency.toFixed(1) + '%', icon: TrendingUp, color: 'from-purple-500 to-violet-600' },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <div className={`rounded-xl bg-gradient-to-br ${card.color} p-3`}><card.icon className="h-6 w-6 text-white" /></div>
                  <div className="ml-4"><p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p></div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Termékek szerinti bontás</h3>
              <button onClick={() => toggleSection('production')} className="text-gray-500">{expandedSections.production ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</button>
            </div>
            {expandedSections.production && (
              <>
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full"><thead><tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 text-sm font-medium text-gray-500">Termék</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">Tételek</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">Átlag minőség</th>
                  </tr></thead><tbody>
                    {productionData.topRecipes.map((r: any, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3 text-sm text-gray-900 dark:text-white">{r.name}</td>
                        <td className="py-3 text-sm text-right text-gray-900 dark:text-white">{r.batches}</td>
                        <td className="py-3 text-sm text-right text-gray-900 dark:text-white">{r.quality.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productionData.topRecipes.slice(0, 8)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" orientation="left" stroke="#8884d8" /><YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip /><Legend />
                      <Bar yAxisId="left" dataKey="batches" name="Tételek" fill="#8884d8" />
                      <Bar yAxisId="right" dataKey="quality" name="Minőség (%)" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── KÉSZLET ─────────────────────────────────────────────────────── */}
      {!loading && selectedReport === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Összes tétel', value: inventoryData.totalItems, icon: Package, color: 'from-blue-500 to-cyan-600' },
              { label: 'Alacsony készlet', value: inventoryData.lowStockItems, icon: AlertTriangle, color: 'from-red-500 to-pink-600' },
              { label: 'Összes érték', value: inventoryData.totalValue.toLocaleString('hu-HU') + ' Ft', icon: DollarSign, color: 'from-green-500 to-emerald-600' },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <div className={`rounded-xl bg-gradient-to-br ${card.color} p-3`}><card.icon className="h-6 w-6 text-white" /></div>
                  <div className="ml-4"><p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p></div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Kategóriák</h3>
              <button onClick={() => toggleSection('inventory')} className="text-gray-500">{expandedSections.inventory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</button>
            </div>
            {expandedSections.inventory && (
              <>
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full"><thead><tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 text-sm font-medium text-gray-500">Kategória</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">Tételek</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">Érték</th>
                  </tr></thead><tbody>
                    {inventoryData.topCategories.map((cat: any, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3 text-sm text-gray-900 dark:text-white">{cat.name}</td>
                        <td className="py-3 text-sm text-right text-gray-900 dark:text-white">{cat.count}</td>
                        <td className="py-3 text-sm text-right text-gray-900 dark:text-white">{cat.value.toLocaleString('hu-HU')} Ft</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={inventoryData.topCategories.slice(0, 6)} cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {inventoryData.topCategories.slice(0, 6).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => v.toLocaleString('hu-HU') + ' Ft'} /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SZEMÉLYZET ──────────────────────────────────────────────────── */}
      {!loading && selectedReport === 'personnel' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Összes alkalmazott', value: personnelData.totalEmployees, icon: Users, color: 'from-blue-500 to-cyan-600' },
              { label: 'Aktív alkalmazott', value: personnelData.activeEmployees, icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
              { label: 'Összes munkaóra', value: personnelData.totalHours.toFixed(1) + 'h', icon: Clock, color: 'from-purple-500 to-violet-600' },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <div className={`rounded-xl bg-gradient-to-br ${card.color} p-3`}><card.icon className="h-6 w-6 text-white" /></div>
                  <div className="ml-4"><p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p></div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Részleg szerinti megoszlás</h3>
              <button onClick={() => toggleSection('personnel')} className="text-gray-500">{expandedSections.personnel ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</button>
            </div>
            {expandedSections.personnel && (
              <>
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full"><thead><tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 text-sm font-medium text-gray-500">Részleg</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">Alkalmazottak</th>
                  </tr></thead><tbody>
                    {personnelData.departmentBreakdown.map((dept: any, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3 text-sm text-gray-900 dark:text-white">{roleLabel(dept.name)}</td>
                        <td className="py-3 text-sm text-right text-gray-900 dark:text-white">{dept.value}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={personnelData.departmentBreakdown} cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${roleLabel(name)}: ${(percent * 100).toFixed(0)}%`}>
                        {personnelData.departmentBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(_: any, name: string) => [_, roleLabel(name)]} /><Legend formatter={roleLabel} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FLOTTA ──────────────────────────────────────────────────────── */}
      {!loading && selectedReport === 'fleet' && (
        <div className="space-y-6">
          {/* KPI kártyák */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Összes jármű', value: fleetData.totalVehicles, icon: Truck, color: 'from-blue-500 to-cyan-600' },
              { label: 'Aktív', value: fleetData.activeVehicles, icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
              { label: 'Szervizben', value: fleetData.maintenanceVehicles, icon: Wrench, color: 'from-amber-500 to-orange-600' },
              { label: 'Szállítások', value: fleetData.totalDeliveries, icon: Package, color: 'from-purple-500 to-violet-600' },
              { label: 'Kárjelentések', value: fleetData.damageReports, icon: AlertTriangle, color: 'from-red-500 to-pink-600' },
              { label: 'Nyitott kár', value: fleetData.openDamageReports, icon: Activity, color: 'from-rose-500 to-red-600' },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                  <card.icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Jármű státusz eloszlás */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Jármű státuszok</h3>
              {fleetData.statusBreakdown.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={fleetData.statusBreakdown} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {fleetData.statusBreakdown.map((_: any, i: number) => <Cell key={i} fill={['#22c55e','#f59e0b','#ef4444'][i % 3]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">Nincs jármű adat</p>}
            </div>

            {/* Szállítások sofőr szerint */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Szállítások sofőr szerint</h3>
              {fleetData.deliveriesByDriver.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fleetData.deliveriesByDriver} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Szállítások" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">Nincs szállítás az időszakban</p>}
            </div>
          </div>

          {/* Közelgő szerviz */}
          {fleetData.upcomingService.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-500" />Közelgő szerviz (30 napon belül)
              </h3>
              <div className="space-y-3">
                {fleetData.upcomingService.map((v: any, i) => {
                  const days = Math.ceil((new Date(v.date).getTime() - Date.now()) / 86400000)
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{v.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sofőr: {v.driver}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{new Date(v.date).toLocaleDateString('hu-HU')}</p>
                        <p className="text-xs text-gray-500">{days <= 0 ? 'Lejárt!' : `${days} nap`}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PÉNZÜGY ─────────────────────────────────────────────────────── */}
      {!loading && selectedReport === 'financial' && (
        <div className="space-y-6">
          {/* KPI kártyák */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Összes bevétel', value: financialData.totalRevenue.toLocaleString('hu-HU') + ' Ft', icon: ArrowUpCircle, color: 'from-green-500 to-emerald-600' },
              { label: 'Számlázott', value: financialData.totalInvoiced.toLocaleString('hu-HU') + ' Ft', icon: Receipt, color: 'from-blue-500 to-cyan-600' },
              { label: 'Fizetve (számla)', value: financialData.paidInvoices.toLocaleString('hu-HU') + ' Ft', icon: CheckCircle, color: 'from-teal-500 to-green-600' },
              { label: 'Függőben', value: financialData.pendingPayments.toLocaleString('hu-HU') + ' Ft', icon: Clock, color: 'from-amber-500 to-orange-600' },
              { label: 'Kiadások', value: financialData.totalExpenses.toLocaleString('hu-HU') + ' Ft', icon: ArrowDownCircle, color: 'from-red-500 to-pink-600' },
              { label: 'Nettó profit', value: financialData.netProfit.toLocaleString('hu-HU') + ' Ft', icon: TrendingUp, color: financialData.netProfit >= 0 ? 'from-purple-500 to-violet-600' : 'from-red-600 to-rose-700' },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                  <card.icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{card.value}</p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bevétel forrás szerint */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bevétel forrás szerint</h3>
              {financialData.revenueBySource.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={financialData.revenueBySource} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {financialData.revenueBySource.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => v.toLocaleString('hu-HU') + ' Ft'} /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-gray-500 text-sm text-center py-8">Nincs adat az időszakban</p>}
            </div>

            {/* Számla státusz */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Számlák státusz szerint</h3>
              {financialData.invoiceStatusBreakdown.length > 0 ? (
                <>
                  <div className="space-y-3 mb-4">
                    {financialData.invoiceStatusBreakdown.map((item: any, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: ['#22c55e','#f59e0b','#ef4444'][i % 3] }} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{item.value.toLocaleString('hu-HU')} Ft</span>
                      </div>
                    ))}
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={financialData.invoiceStatusBreakdown} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                          {financialData.invoiceStatusBreakdown.map((_: any, i: number) => <Cell key={i} fill={['#22c55e','#f59e0b','#ef4444'][i % 3]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => v.toLocaleString('hu-HU') + ' Ft'} /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : <p className="text-gray-500 text-sm text-center py-8">Nincs számla az időszakban</p>}
            </div>
          </div>

          {/* Pénzmozgás grafikon */}
          {financialData.cashMovements.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pénzmozgások időbeli eloszlása</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialData.cashMovements} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => v.toLocaleString('hu-HU')} />
                    <Tooltip formatter={(v: any) => v.toLocaleString('hu-HU') + ' Ft'} /><Legend />
                    <Bar dataKey="Bevétel" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Kiadás" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}