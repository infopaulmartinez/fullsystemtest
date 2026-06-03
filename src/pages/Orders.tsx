import React, { useState, useEffect } from 'react'
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Save,
  Minus,
  X,
  QrCode
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/Inventory/BarcodeScanner'

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  items: any[]
  total_amount: number
  status: string
  order_date: string
  delivery_date: string | null
  payment_method: string | null
  payment_status: string | null
  notes: string | null
  created_at: string
}

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  delivery_addresses: string[]
}

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    delivery_addresses: [] as string[],
    items: [] as any[],
    payment_method: 'transfer',
    notes: '',
    selected_delivery_address: ''
  })
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [newDeliveryAddress, setNewDeliveryAddress] = useState('')
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    loadOrders()
    loadProducts()
    loadCustomers()
  }, [statusFilter, dateRange])

  useEffect(() => {
    if (customerSearchTerm) {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(customerSearchTerm.toLowerCase())
      )
      setFilteredCustomers(filtered)
      setShowCustomerDropdown(true)
    } else {
      setFilteredCustomers([])
      setShowCustomerDropdown(false)
    }
  }, [customerSearchTerm, customers])

  const loadOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (dateRange.start) {
        query = query.gte('order_date', dateRange.start)
      }

      if (dateRange.end) {
        query = query.lte('order_date', dateRange.end)
      }

      const { data, error } = await query

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Hiba a rendelések betöltésekor:', error)
      toast.error('Hiba a rendelések betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Hiba a termékek betöltésekor:', error)
    }
  }

  const loadCustomers = async () => {
    try {
      // Load from partner_companies
      const { data: partnerData, error: partnerError } = await supabase
        .from('partner_companies')
        .select('*')
        .eq('status', 'active')

      if (partnerError) throw partnerError

      // Load from profiles (individual customers)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')

      if (profileError) throw profileError

      // Combine and format customers
      const formattedCustomers: Customer[] = [
        ...(partnerData || []).map(partner => ({
          id: partner.id,
          name: partner.name,
          email: partner.email || '',
          phone: partner.phone || '',
          address: partner.address || '',
          delivery_addresses: [partner.address || '']
        })),
        ...(profileData || []).map(profile => ({
          id: profile.id,
          name: profile.full_name || profile.email,
          email: profile.email,
          phone: profile.phone || '',
          address: profile.address || '',
          delivery_addresses: [profile.address || '']
        }))
      ]

      setCustomers(formattedCustomers)
    } catch (error) {
      console.error('Hiba az ügyfelek betöltésekor:', error)
    }
  }

  const handleCustomerSelect = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_address: customer.address,
      delivery_addresses: customer.delivery_addresses || [customer.address],
      selected_delivery_address: customer.address
    }))
    setCustomerSearchTerm(customer.name)
    setShowCustomerDropdown(false)
  }

  const addDeliveryAddress = () => {
    if (newDeliveryAddress.trim()) {
      setFormData(prev => ({
        ...prev,
        delivery_addresses: [...prev.delivery_addresses, newDeliveryAddress.trim()]
      }))
      setNewDeliveryAddress('')
    }
  }

  const removeDeliveryAddress = (index: number) => {
    setFormData(prev => ({
      ...prev,
      delivery_addresses: prev.delivery_addresses.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`
      
      const orderData = {
        order_number: orderNumber,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        customer_address: formData.selected_delivery_address || formData.customer_address,
        items: formData.items,
        total_amount: formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
        payment_method: formData.payment_method,
        notes: formData.notes || null,
        status: 'pending',
        payment_status: 'pending'
      }

      const { error } = await supabase
        .from('orders')
        .insert([orderData])

      if (error) throw error

      toast.success('Rendelés sikeresen létrehozva!')
      setShowAddModal(false)
      resetForm()
      loadOrders()
    } catch (error) {
      console.error('Hiba a rendelés létrehozásakor:', error)
      toast.error('Hiba a rendelés létrehozásakor')
    }
  }

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_address: '',
      delivery_addresses: [],
      items: [],
      payment_method: 'transfer',
      notes: '',
      selected_delivery_address: ''
    })
    setCustomerSearchTerm('')
    setNewDeliveryAddress('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a rendelést?')) return

    try {
      // Check if it's a webshop order
      const { data: webshopOrder } = await supabase
        .from('webshop_orders')
        .select('id')
        .eq('id', id)
        .single()

      if (webshopOrder) {
        // Delete from webshop_orders
        const { error } = await supabase
          .from('webshop_orders')
          .delete()
          .eq('id', id)

        if (error) throw error
      } else {
        // Delete from orders
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', id)

        if (error) throw error
      }

      toast.success('Rendelés törölve!')
      loadOrders()
    } catch (error) {
      console.error('Hiba a rendelés törlésekor:', error)
      toast.error('Hiba a rendelés törlésekor')
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)

      if (error) throw error

      toast.success(`Rendelés állapota frissítve: ${status}`);
      loadOrders();
    } catch (error) {
      console.error('Hiba a rendelés állapotának frissítésekor:', error)
      toast.error('Hiba a rendelés állapotának frissítésekor')
    }
  }

  const sendToProduction = async (order: Order) => {
    try {
      // Check if already sent to production
      const { data: existingBatch, error: checkError } = await supabase 
        .from('production_batches')
        .select('id')
        .eq('webshop_order_id', order.order_number || order.id)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing batch:', checkError)
      }

      if (existingBatch && existingBatch.id) {
        toast.error('Ez a rendelés már gyártásba lett küldve!')
        return
      }

      // Create production batch for each item
      for (const item of order.items) {
        const batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        const { error: insertError } = await supabase
          .from('production_batches')
          .insert([{
            batch_number: batchNumber,
            recipe_id: item.product_id || item.id,
            batch_size: item.quantity,
            status: 'planned',
            webshop_order_id: order.order_number || order.id
          }])

        if (insertError) {
          console.error('Error creating production batch:', insertError)
          throw insertError
        }
      }

      // Update order status
      await handleUpdateStatus(order.id, 'processing')
      
      toast.success('Rendelés sikeresen gyártásba küldve!')
    } catch (error) {
      console.error('Hiba a gyártásba küldéskor:', error)
      toast.error('Hiba a gyártásba küldéskor')
    }
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', name: '', quantity: 1, price: 0 }]
    }))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const filteredOrders = orders.filter(order =>
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'processing': return <RefreshCw className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 dark:bg-gray-900">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 dark:bg-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rendelések</h1>
          <p className="text-gray-600 dark:text-gray-400">Rendelések kezelése és nyomon követése</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowScanner(true)}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            QR kód olvasása
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Új rendelés
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Keresés..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="all">Minden állapot</option>
            <option value="pending">Függőben</option>
            <option value="processing">Feldolgozás alatt</option>
            <option value="completed">Befejezett</option>
            <option value="cancelled">Törölve</option>
          </select>

          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />

          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rendelés szám
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ügyfél
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Összeg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Állapot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dátum
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {order.order_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{order.customer_name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{order.customer_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {order.total_amount.toLocaleString()} Ft
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(order.order_date).toLocaleDateString('hu-HU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedOrder(order)
                          setShowViewModal(true)
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {order.status === 'pending' && (
                        <button
                          onClick={() => sendToProduction(order)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="Gyártásba küldés"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Új rendelés</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Name with Autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ügyfél neve *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Kezdje el gépelni az ügyfél nevét..."
                  />
                  
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => handleCustomerSelect(customer)}
                          className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">{customer.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{customer.email}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cím</label>
                  <input
                    type="text"
                    value={formData.customer_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Delivery Addresses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Szállítási címek</label>
                
                {/* Add new delivery address */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDeliveryAddress}
                    onChange={(e) => setNewDeliveryAddress(e.target.value)}
                    placeholder="Új szállítási cím hozzáadása..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addDeliveryAddress}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* List of delivery addresses */}
                <div className="space-y-2">
                  {formData.delivery_addresses.map((address, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <input
                        type="radio"
                        name="selected_delivery_address"
                        value={address}
                        checked={formData.selected_delivery_address === address}
                        onChange={(e) => setFormData(prev => ({ ...prev, selected_delivery_address: e.target.value }))}
                        className="text-blue-600 dark:text-blue-400"
                      />
                      <span className="flex-1 text-gray-900 dark:text-white">{address}</span>
                      <button
                        type="button"
                        onClick={() => removeDeliveryAddress(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fizetési mód</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="transfer">Átutalás</option>
                  <option value="cash">Készpénz</option>
                  <option value="card">Kártya</option>
                </select>
              </div>

              {/* Order Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rendelési tételek</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Tétel hozzáadása
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <select
                        value={item.product_id}
                        onChange={(e) => {
                          const product = products.find(p => p.id === e.target.value)
                          updateItem(index, 'product_id', e.target.value)
                          updateItem(index, 'name', product?.name || '')
                          updateItem(index, 'price', product?.retail_price || 0)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Válassz terméket</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {product.retail_price} Ft
                          </option>
                        ))}
                      </select>
                      
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Db"
                      />
                      
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ár"
                      />
                      
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Megjegyzések</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Total */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    Összesen: {formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString()} Ft
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Rendelés létrehozása
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Rendelés részletei</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rendelés szám</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Állapot</label>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)} dark:bg-opacity-20`}>
                    {getStatusIcon(selectedOrder.status)}
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ügyfél neve</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.customer_email || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Telefon</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.customer_phone || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cím</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.customer_address || '-'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rendelési tételek</label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Termék</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mennyiség</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ár</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Összesen</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedOrder.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.name || item.product_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{(item.price || item.unit_price || 0).toLocaleString()} Ft</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{((item.quantity || 0) * (item.price || item.unit_price || 0)).toLocaleString()} Ft</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-white">Végösszeg:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedOrder.total_amount.toLocaleString()} Ft</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Megjegyzések</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* QR Code Scanner */}
      {showScanner && (
        <BarcodeScanner 
          onScan={(data) => {
            // Implement QR code scanning logic
            toast.success(`QR kód beolvasva: ${data}`);
            setShowScanner(false);
            
            // Check if it's an order number
            const orderMatch = data.match(/ORD-\d+/i);
            if (orderMatch) {
              const orderNumber = orderMatch[0];
              // Find order by order number
              const order = orders.find(o => o.order_number === orderNumber);
              if (order) {
                setSelectedOrder(order);
                setShowViewModal(true);
              } else {
                toast.error(`Nem található rendelés ezzel az azonosítóval: ${orderNumber}`);
              }
            }
          }}
          onClose={() => setShowScanner(false)}
          scanningFor="search"
        />
      )}
    </div>
  )
}