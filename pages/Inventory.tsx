import React, { useState, useEffect } from 'react'
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Download,
  Upload,
  QrCode,
  Barcode,
  Eye,
  X,
  Save,
  FileText,
  Truck,
  Building
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import BarcodeScanner from '../components/Inventory/BarcodeScanner'
import BarcodeGenerator from '../components/Inventory/BarcodeGenerator'

interface InventoryItem {
  id: string
  name: string
  category: string
  current_stock: number
  unit: string
  min_threshold: number
  max_threshold: number | null
  cost_per_unit: number
  supplier: string | null
  supplier_contact: string | null
  supplier_email: string | null
  last_restocked: string | null
  expiry_date: string | null
  location_id: string | null
  barcode: string | null
  qr_code: string | null
  price: number | null
  vat_percentage: number | null
  created_at: string
  updated_at: string
}

interface StoreInventoryItem {
  id: string
  product_id: string | null
  location_id: string | null
  current_stock: number
  min_threshold: number
  max_threshold: number | null
  last_restock_date: string | null
  price: number | null
  vat_percentage: number | null
  category: string | null
  name: string | null
  store_id: string | null
  barcode: string | null
  qr_code: string | null
  unit: string | null
  supplier: string | null
  created_at: string
  updated_at: string
  locations?: {
    name: string
  }
  products?: {
    name: string
    category: string
  }
}

interface DeliveryNote {
  id: string
  order_number: string
  customer_name: string
  items: any[]
  status: string
  created_at: string
  location_id: string | null
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<'production' | 'store'>('production')
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [storeInventoryItems, setStoreInventoryItems] = useState<StoreInventoryItem[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [showDeliveryNotesModal, setShowDeliveryNotesModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | StoreInventoryItem | null>(null)
  const [generatorData, setGeneratorData] = useState<{value: string, type: 'barcode' | 'qrcode', inventoryId?: string, productId?: string}>({
    value: '',
    type: 'barcode'
  })
  const [formData, setFormData] = useState({
    name: '',
    category: 'flour',
    current_stock: 0,
    unit: 'kg',
    min_threshold: 0,
    max_threshold: null as number | null,
    cost_per_unit: 0,
    supplier: '',
    supplier_contact: '',
    supplier_email: '',
    expiry_date: '',
    location_id: '',
    price: null as number | null,
    vat_percentage: null as number | null,
    barcode: '',
    qr_code: ''
  })

  const categories = [
    'all', 'flour', 'sugar', 'dairy', 'eggs', 'yeast', 'oil', 'salt', 
    'spices', 'nuts', 'fruits', 'chocolate', 'packaging', 'other'
  ]

  useEffect(() => {
    loadData()
    loadLocations()
  }, [activeTab])

  useEffect(() => {
    filterItems()
  }, [inventoryItems, storeInventoryItems, searchTerm, categoryFilter, locationFilter, activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
      
      if (activeTab === 'production') {
        await loadInventoryItems()
      } else {
        await loadStoreInventoryItems()
        await loadDeliveryNotes()
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Hiba az adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadInventoryItems = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('name')

    if (error) throw error
    setInventoryItems(data || [])
  }

  const loadStoreInventoryItems = async () => {
    const { data, error } = await supabase
      .from('store_inventory')
      .select(`
        *,
        locations(name),
        products(name, category)
      `)
      .order('name')

    if (error) throw error
    setStoreInventoryItems(data || [])
  }

  const loadDeliveryNotes = async () => {
    let query = supabase
      .from('delivery_notes')
      .select('*')
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(20)

    if (locationFilter !== 'all') {
      query = query.eq('location_id', locationFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading delivery notes:', error)
      return
    }
    setDeliveryNotes(data || [])
  }

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error loading locations:', error)
      return
    }
    setLocations(data || [])
  }

  const filterItems = () => {
    // This function is called when filters change
    // The actual filtering is done in the render method
  }

  const getFilteredItems = () => {
    const items = activeTab === 'production' ? inventoryItems : storeInventoryItems
    
    return items.filter(item => {
      const name = activeTab === 'production' 
        ? (item as InventoryItem).name 
        : (item as StoreInventoryItem).name || (item as StoreInventoryItem).products?.name || ''
      
      const category = activeTab === 'production'
        ? (item as InventoryItem).category
        : (item as StoreInventoryItem).category || (item as StoreInventoryItem).products?.category || ''
      
      const locationId = activeTab === 'production'
        ? (item as InventoryItem).location_id
        : (item as StoreInventoryItem).location_id

      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || category === categoryFilter
      const matchesLocation = locationFilter === 'all' || locationId === locationFilter

      return matchesSearch && matchesCategory && matchesLocation
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const table = activeTab === 'production' ? 'inventory' : 'store_inventory'
      const { error } = await supabase
        .from(table)
        .insert([formData])

      if (error) throw error

      toast.success('Tétel sikeresen hozzáadva!')
      setShowAddModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error adding item:', error)
      toast.error('Hiba a tétel hozzáadásakor')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedItem) return

    try {
      const table = activeTab === 'production' ? 'inventory' : 'store_inventory'
      const { error } = await supabase
        .from(table)
        .update(formData)
        .eq('id', selectedItem.id)

      if (error) throw error

      toast.success('Tétel sikeresen frissítve!')
      setShowEditModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error updating item:', error)
      toast.error('Hiba a tétel frissítésekor')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a tételt?')) return

    try {
      const table = activeTab === 'production' ? 'inventory' : 'store_inventory'
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Tétel törölve!')
      loadData()
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Hiba a tétel törlésekor')
    }
  }

  const handleEdit = (item: InventoryItem | StoreInventoryItem) => {
    setSelectedItem(item)
    
    if (activeTab === 'production') {
      const inventoryItem = item as InventoryItem
      setFormData({
        name: inventoryItem.name,
        category: inventoryItem.category,
        current_stock: inventoryItem.current_stock,
        unit: inventoryItem.unit,
        min_threshold: inventoryItem.min_threshold,
        max_threshold: inventoryItem.max_threshold,
        cost_per_unit: inventoryItem.cost_per_unit,
        supplier: inventoryItem.supplier || '',
        supplier_contact: inventoryItem.supplier_contact || '',
        supplier_email: inventoryItem.supplier_email || '',
        expiry_date: inventoryItem.expiry_date ? inventoryItem.expiry_date.split('T')[0] : '',
        location_id: inventoryItem.location_id || '',
        price: inventoryItem.price,
        vat_percentage: inventoryItem.vat_percentage,
        barcode: inventoryItem.barcode || '',
        qr_code: inventoryItem.qr_code || ''
      })
    } else {
      const storeItem = item as StoreInventoryItem
      setFormData({
        name: storeItem.name || '',
        category: storeItem.category || '',
        current_stock: storeItem.current_stock,
        unit: storeItem.unit || 'db',
        min_threshold: storeItem.min_threshold,
        max_threshold: storeItem.max_threshold,
        cost_per_unit: 0,
        supplier: storeItem.supplier || '',
        supplier_contact: '',
        supplier_email: '',
        expiry_date: '',
        location_id: storeItem.location_id || '',
        price: storeItem.price,
        vat_percentage: storeItem.vat_percentage,
        barcode: storeItem.barcode || '',
        qr_code: storeItem.qr_code || ''
      })
    }
    
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'flour',
      current_stock: 0,
      unit: 'kg',
      min_threshold: 0,
      max_threshold: null,
      cost_per_unit: 0,
      supplier: '',
      supplier_contact: '',
      supplier_email: '',
      expiry_date: '',
      location_id: '',
      price: null,
      vat_percentage: null,
      barcode: '',
      qr_code: ''
    })
    setSelectedItem(null)
  }

  const handleScan = (data: string, type: 'barcode' | 'qrcode') => {
    const items = getFilteredItems()
    const foundItem = items.find(item => {
      if (activeTab === 'production') {
        const inventoryItem = item as InventoryItem
        return (type === 'barcode' && inventoryItem.barcode === data) ||
               (type === 'qrcode' && inventoryItem.qr_code === data)
      } else {
        const storeItem = item as StoreInventoryItem
        return (type === 'barcode' && storeItem.barcode === data) ||
               (type === 'qrcode' && storeItem.qr_code === data)
      }
    })

    if (foundItem) {
      handleEdit(foundItem)
      toast.success(`Tétel megtalálva: ${activeTab === 'production' ? (foundItem as InventoryItem).name : (foundItem as StoreInventoryItem).name}`)
    } else {
      toast.error('Tétel nem található ezzel a kóddal')
    }
    setShowScanner(false)
  }

  const generateCode = (item: InventoryItem | StoreInventoryItem, type: 'barcode' | 'qrcode') => {
    const value = type === 'barcode' 
      ? `${Date.now()}${Math.random().toString(36).substr(2, 9)}`
      : JSON.stringify({
          id: item.id,
          name: activeTab === 'production' ? (item as InventoryItem).name : (item as StoreInventoryItem).name,
          type: activeTab === 'production' ? 'inventory' : 'store_inventory'
        })

    setGeneratorData({
      value,
      type,
      inventoryId: activeTab === 'production' ? item.id : undefined,
      productId: activeTab === 'store' ? item.id : undefined
    })
    setShowGenerator(true)
  }

  const importFromDeliveryNote = async (deliveryNote: DeliveryNote) => {
    try {
      // Import items from delivery note to store inventory
      for (const item of deliveryNote.items) {
        const storeInventoryData = {
          product_id: item.product_id || null,
          location_id: deliveryNote.location_id,
          current_stock: item.quantity || 0,
          min_threshold: 5,
          max_threshold: null,
          price: item.unit_price || 0,
          vat_percentage: 18,
          category: item.category || 'other',
          name: item.name || item.product_name,
          unit: 'db',
          supplier: 'Szállítólevélből'
        }

        // Check if item already exists
        const { data: existingItem } = await supabase
          .from('store_inventory')
          .select('id, current_stock')
          .eq('name', storeInventoryData.name)
          .eq('location_id', deliveryNote.location_id)
          .single()

        if (existingItem) {
          // Update existing item
          await supabase
            .from('store_inventory')
            .update({
              current_stock: existingItem.current_stock + storeInventoryData.current_stock
            })
            .eq('id', existingItem.id)
        } else {
          // Insert new item
          await supabase
            .from('store_inventory')
            .insert([storeInventoryData])
        }
      }

      toast.success(`${deliveryNote.items.length} tétel importálva a szállítólevélből!`)
      setShowDeliveryNotesModal(false)
      loadData()
    } catch (error) {
      console.error('Error importing from delivery note:', error)
      toast.error('Hiba a szállítólevél importálásakor')
    }
  }

  const getCategoryName = (category: string) => {
    const categoryNames: Record<string, string> = {
      'all': 'Minden',
      'flour': 'Liszt',
      'sugar': 'Cukor',
      'dairy': 'Tejtermék',
      'eggs': 'Tojás',
      'yeast': 'Élesztő',
      'oil': 'Olaj',
      'salt': 'Só',
      'spices': 'Fűszerek',
      'nuts': 'Diófélék',
      'fruits': 'Gyümölcs',
      'chocolate': 'Csokoládé',
      'packaging': 'Csomagolás',
      'other': 'Egyéb'
    }
    return categoryNames[category] || category
  }

  const getStockStatus = (current: number, min: number) => {
    if (current <= 0) return { color: 'text-red-600 dark:text-red-400', text: 'Elfogyott' }
    if (current <= min) return { color: 'text-amber-600 dark:text-amber-400', text: 'Alacsony' }
    return { color: 'text-green-600 dark:text-green-400', text: 'Megfelelő' }
  }

  const filteredItems = getFilteredItems()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Package className="h-8 w-8 mr-3 text-blue-600" />
            Készletkezelés
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Alapanyagok és termékek készletének nyilvántartása
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowScanner(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <QrCode className="h-4 w-4 mr-2" />
            Szkennelés
          </button>
          {activeTab === 'store' && (
            <button
              onClick={() => setShowDeliveryNotesModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Truck className="h-4 w-4 mr-2" />
              Behívás szállítólevélből
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Új tétel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('production')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'production'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Package className="h-4 w-4 inline mr-2" />
            Gyártás alapanyag készlet
          </button>
          <button
            onClick={() => setActiveTab('store')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'store'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Building className="h-4 w-4 inline mr-2" />
            Saját boltok/üzletek
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Keresés..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {getCategoryName(category)}
              </option>
            ))}
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">Minden helyszín</option>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Frissítés
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm || categoryFilter !== 'all' || locationFilter !== 'all' ? 'Nincs találat' : 'Nincsenek készlet tételek'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || categoryFilter !== 'all' || locationFilter !== 'all' 
                ? 'Próbáljon meg más keresési feltételekkel.'
                : 'Kezdje el az első tétel hozzáadásával.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Termék
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kategória
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Készlet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Állapot
                  </th>
                  {activeTab === 'production' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Beszerzési ár
                    </th>
                  )}
                  {activeTab === 'store' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Eladási ár
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Helyszín
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Műveletek
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((item) => {
                  const isProduction = activeTab === 'production'
                  const inventoryItem = item as InventoryItem
                  const storeItem = item as StoreInventoryItem
                  
                  const name = isProduction ? inventoryItem.name : (storeItem.name || storeItem.products?.name || 'Névtelen')
                  const category = isProduction ? inventoryItem.category : (storeItem.category || storeItem.products?.category || 'other')
                  const currentStock = item.current_stock
                  const minThreshold = item.min_threshold
                  const unit = isProduction ? inventoryItem.unit : (storeItem.unit || 'db')
                  const price = isProduction ? inventoryItem.cost_per_unit : (storeItem.price || 0)
                  const locationName = isProduction 
                    ? locations.find(l => l.id === inventoryItem.location_id)?.name || 'Nincs megadva'
                    : storeItem.locations?.name || 'Nincs megadva'
                  
                  const stockStatus = getStockStatus(currentStock, minThreshold)

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mr-3">
                            <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {name}
                            </div>
                            {isProduction && inventoryItem.supplier && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {inventoryItem.supplier}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                          {getCategoryName(category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {currentStock} {unit}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Min: {minThreshold} {unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {price.toLocaleString('hu-HU')} Ft/{unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {locationName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => generateCode(item, 'barcode')}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                            title="Vonalkód generálása"
                          >
                            <Barcode className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => generateCode(item, 'qrcode')}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                            title="QR kód generálása"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {showAddModal ? 'Új tétel hozzáadása' : 'Tétel szerkesztése'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setShowEditModal(false)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={showAddModal ? handleSubmit : handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Név *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kategória *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      {categories.filter(c => c !== 'all').map(category => (
                        <option key={category} value={category}>
                          {getCategoryName(category)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Jelenlegi készlet *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.current_stock}
                      onChange={(e) => setFormData({...formData, current_stock: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mértékegység *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="db">db</option>
                      <option value="csomag">csomag</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Minimum küszöb *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.min_threshold}
                      onChange={(e) => setFormData({...formData, min_threshold: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Maximum küszöb
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.max_threshold || ''}
                      onChange={(e) => setFormData({...formData, max_threshold: e.target.value ? parseFloat(e.target.value) : null})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {activeTab === 'production' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Beszerzési ár
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.cost_per_unit}
                        onChange={(e) => setFormData({...formData, cost_per_unit: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}

                  {activeTab === 'store' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Eladási ár
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.price || ''}
                        onChange={(e) => setFormData({...formData, price: e.target.value ? parseFloat(e.target.value) : null})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Helyszín
                    </label>
                    <select
                      value={formData.location_id}
                      onChange={(e) => setFormData({...formData, location_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Válassz helyszínt</option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeTab === 'production' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Beszállító
                        </label>
                        <input
                          type="text"
                          value={formData.supplier}
                          onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Beszállító kapcsolat
                        </label>
                        <input
                          type="text"
                          value={formData.supplier_contact}
                          onChange={(e) => setFormData({...formData, supplier_contact: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Beszállító email
                        </label>
                        <input
                          type="email"
                          value={formData.supplier_email}
                          onChange={(e) => setFormData({...formData, supplier_email: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lejárati dátum
                        </label>
                        <input
                          type="date"
                          value={formData.expiry_date}
                          onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ÁFA %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.vat_percentage || ''}
                      onChange={(e) => setFormData({...formData, vat_percentage: e.target.value ? parseFloat(e.target.value) : null})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setShowEditModal(false)
                      resetForm()
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Mégse
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {showAddModal ? 'Hozzáadás' : 'Frissítés'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Notes Modal */}
      {showDeliveryNotesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Szállítólevelek
                </h2>
                <button
                  onClick={() => setShowDeliveryNotesModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {deliveryNotes.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    Nincsenek elérhető szállítólevelek
                  </p>
                ) : (
                  deliveryNotes.map((deliveryNote) => (
                    <div key={deliveryNote.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {deliveryNote.order_number}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {deliveryNote.customer_name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(deliveryNote.created_at).toLocaleString('hu-HU')}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {deliveryNote.items?.length || 0} tétel
                          </p>
                        </div>
                        <button
                          onClick={() => importFromDeliveryNote(deliveryNote)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Importálás
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          scanningFor="edit"
        />
      )}

      {/* Generator Modal */}
      {showGenerator && (
        <BarcodeGenerator
          value={generatorData.value}
          type={generatorData.type}
          inventoryId={generatorData.inventoryId}
          productId={generatorData.productId}
          onClose={() => setShowGenerator(false)}
          onSaved={() => loadData()}
        />
      )}
    </div>
  )
}