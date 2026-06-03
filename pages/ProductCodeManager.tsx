import React, { useState, useEffect, useRef } from 'react'
import { 
  QrCode, 
  BarChart3, 
  Package, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload,
  RefreshCw,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  Barcode,
  Filter
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import BarcodeGenerator from '../components/Inventory/BarcodeGenerator'

interface Product {
  id: string
  name: string
  category: string
  barcode?: string
  qr_code?: string
  retail_price: number
  wholesale_price: number
  current_stock?: number
}

interface InventoryItem {
  id: string
  name: string
  category: string
  current_stock: number
  barcode?: string
  qr_code?: string
}

export default function ProductCodeManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | InventoryItem | null>(null)
  const [codeType, setCodeType] = useState<'barcode' | 'qr'>('barcode')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Product | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [generatorType, setGeneratorType] = useState<'barcode' | 'qrcode'>('barcode')
  const [generatorValue, setGeneratorValue] = useState('')
  const [generatedCodes, setGeneratedCodes] = useState<{[key: string]: string}>({})
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState<{id: string, name: string} | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadProducts(),
        loadInventory(),
        loadCategories(),
      ])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Hiba az adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, barcode, qr_code, retail_price, wholesale_price')
        .order('name')
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, name, category, current_stock, barcode, qr_code')
        .order('name')
      
      if (error) throw error
      setInventory(data || [])
    } catch (error) {
      console.error('Error loading inventory:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const { data: productCategoriesData, error: productsError } = await supabase
        .from('products')
        .select('category')
      if (productsError) console.error('Error loading product categories:', productsError)
      
      const { data: inventoryCategoriesData, error: inventoryError } = await supabase
        .from('inventory')
        .select('category')
      if (inventoryError) console.error('Error loading inventory categories:', inventoryError)
      
      const allCategories = [
        ...(productCategoriesData?.map(p => p.category).filter(Boolean) || []),
        ...(inventoryCategoriesData?.map(i => i.category).filter(Boolean) || [])
      ]
      
      const uniqueCategories = [...new Set(allCategories)]
      setCategories(uniqueCategories.length > 0 ? uniqueCategories : ['kenyér', 'sütemény', 'pékáru', 'egyéb'])
    } catch (error) {
      console.error('Error loading categories:', error)
      setCategories(['kenyér', 'sütemény', 'pékáru', 'egyéb'])
    }
  }

  const generateCode = (item: Product | InventoryItem, type: 'barcode' | 'qr') => {
    if (type === 'barcode') {
      const prefix = '590'
      const company = '1234'
      const productCode = item.id.slice(-5).padStart(5, '0')
      const baseCode = prefix + company + productCode
      let sum = 0
      for (let i = 0; i < baseCode.length; i++) {
        const digit = parseInt(baseCode[i])
        sum += i % 2 === 0 ? digit : digit * 3
      }
      const checkDigit = (10 - (sum % 10)) % 10
      return baseCode + checkDigit
    } else {
      return JSON.stringify({
        id: item.id,
        name: item.name,
        category: item.category
      })
    }
  }

  const handleGenerateCode = async (item: Product | InventoryItem, type: 'barcode' | 'qr', sourceTable: 'products' | 'inventory') => {
    try {
      const code = generateCode(item, type)
      const updateData = type === 'barcode' ? { barcode: code } : { qr_code: code }
      
      const { error } = await supabase
        .from(sourceTable)
        .update(updateData)
        .eq('id', item.id)
      
      if (error) throw error
      
      setGeneratedCodes(prev => ({ ...prev, [`${item.id}-${type}`]: code }))
      
      setGeneratorType(type === 'barcode' ? 'barcode' : 'qrcode')
      setGeneratorValue(code)
      setSelectedProduct(item)
      setShowGenerator(true)
      
      toast.success(`${type === 'barcode' ? 'Vonalkód' : 'QR kód'} sikeresen generálva!`)
    } catch (error) {
      console.error('Error generating code:', error)
      toast.error('Hiba a kód generálásakor')
    }
  }

  const handleBulkGenerate = async () => {
    try {
      const itemsWithoutCodes = [...products, ...inventory].filter(p => 
        (codeType === 'barcode' && !p.barcode) || 
        (codeType === 'qr' && !p.qr_code)
      )
      
      if (itemsWithoutCodes.length === 0) {
        toast.info('Minden tételnek már van kódja')
        return
      }
      
      for (const item of itemsWithoutCodes) {
        const sourceTable = 'retail_price' in item ? 'products' : 'inventory'
        await handleGenerateCode(item, codeType, sourceTable)
      }
      
      toast.success(`${itemsWithoutCodes.length} tétel kódja sikeresen generálva!`)
    } catch (error) {
      console.error('Error in bulk generate:', error)
      toast.error('Hiba a tömeges generálásnál')
    }
  }

  const handleExportCodes = () => {
    try {
      const dataToExport = products.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        barcode: product.barcode || '',
        qr_code: product.qr_code || '',
        retail_price: product.retail_price,
        wholesale_price: product.wholesale_price
      }))
      
      const csv = [
        'ID,Név,Kategória,Vonalkód,QR kód,Kiskereskedelmi ár,Nagykereskedelmi ár',
        ...dataToExport.map(item => 
          `${item.id},"${item.name}","${item.category}","${item.barcode}","${item.qr_code}",${item.retail_price},${item.wholesale_price}`
        )
      ].join('\n')
      
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `termek_kodok_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('Kódok sikeresen exportálva!')
    } catch (error) {
      console.error('Error exporting codes:', error)
      toast.error('Hiba az exportálás során')
    }
  }

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      toast.error('Kérjük adjon meg kategória nevet');
      return;
    }
    setCategories(prev => [...prev, newCategory]);
    setNewCategory('');
    toast.success('Kategória sikeresen hozzáadva!');
  }

  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast.error('Kérjük adjon meg kategória nevet');
      return;
    }
    setCategories(prev => prev.map(cat => cat === editingCategory.id ? editingCategory.name : cat));
    setEditingCategory(null);
    toast.success('Kategória sikeresen frissítve!');
  }

  const handleDeleteCategory = async (category: string) => {
    if (!confirm(`Biztosan törölni szeretné a(z) "${category}" kategóriát?`)) return;
    setCategories(prev => prev.filter(cat => cat !== category));
    toast.success('Kategória sikeresen törölve!');
  }

  const filteredProducts = products.filter(product => {
    const searchTermLower = searchTerm.toLowerCase()
    const matchesSearch = 
      (product.name?.toLowerCase() || '').includes(searchTermLower) ||
      (product.barcode || '').includes(searchTerm) ||
      (product.qr_code || '').includes(searchTerm)
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const filteredInventory = inventory.filter(item => {
    const searchTermLower = searchTerm.toLowerCase()
    const matchesSearch = 
      (item.name?.toLowerCase() || '').includes(searchTermLower) ||
      (item.barcode || '').includes(searchTerm) ||
      (item.qr_code || '').includes(searchTerm)
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
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
            <QrCode className="h-8 w-8 mr-3 text-blue-600" />
            Termék kódok kezelése
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Vonalkódok és QR kódok generálása és kezelése
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExportCodes}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            Exportálás
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Filter className="h-5 w-5 mr-2" />
            Kategóriák
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Tömeges generálás
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Frissítés
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Keresés név, vonalkód vagy QR kód alapján..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">Minden kategória</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes tétel</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{products.length + inventory.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
              <Barcode className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vonalkóddal</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {[...products, ...inventory].filter(p => p.barcode).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
              <QrCode className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">QR kóddal</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {[...products, ...inventory].filter(p => p.qr_code).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Kód nélkül</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {[...products, ...inventory].filter(p => !p.barcode && !p.qr_code).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Késztermékek (Products)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Termék</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategória</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vonalkód</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">QR kód</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ár</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Műveletek</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">{product.category || 'Nincs'}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.barcode || <button onClick={() => handleGenerateCode(product, 'barcode', 'products')} className="text-blue-600 text-sm">Generálás</button>}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.qr_code ? 'Van' : <button onClick={() => handleGenerateCode(product, 'qr', 'products')} className="text-blue-600 text-sm">Generálás</button>}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-white">{product.retail_price?.toLocaleString()} Ft</div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => handleGenerateCode(product, 'barcode', 'products')} title="Vonalkód"><Barcode className="h-4 w-4" /></button>
                      <button onClick={() => handleGenerateCode(product, 'qr', 'products')} title="QR kód"><QrCode className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Inventory Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alapanyagok (Inventory)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alapanyag</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategória</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vonalkód</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">QR kód</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Készlet</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Műveletek</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">{item.category || 'Nincs'}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.barcode || <button onClick={() => handleGenerateCode(item, 'barcode', 'inventory')} className="text-blue-600 text-sm">Generálás</button>}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.qr_code ? 'Van' : <button onClick={() => handleGenerateCode(item, 'qr', 'inventory')} className="text-blue-600 text-sm">Generálás</button>}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.current_stock}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => handleGenerateCode(item, 'barcode', 'inventory')} title="Vonalkód"><Barcode className="h-4 w-4" /></button>
                      <button onClick={() => handleGenerateCode(item, 'qr', 'inventory')} title="QR kód"><QrCode className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tömeges kód generálás</h2>
              <button onClick={() => setShowGenerateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="h-6 w-6" /></button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kód típusa</label>
              <div className="space-y-2">
                <label className="flex items-center"><input type="radio" value="barcode" checked={codeType === 'barcode'} onChange={(e) => setCodeType(e.target.value as 'barcode')} className="mr-2" /><Barcode className="h-4 w-4 mr-1" />Vonalkód</label>
                <label className="flex items-center"><input type="radio" value="qr" checked={codeType === 'qr'} onChange={(e) => setCodeType(e.target.value as 'qr')} className="mr-2" /><QrCode className="h-4 w-4 mr-1" />QR kód</label>
              </div>
            </div>
            <div className="mb-6"><p className="text-sm text-gray-600 dark:text-gray-400">{codeType === 'barcode' ? `${[...products, ...inventory].filter(p => !p.barcode).length} tételnek nincs vonalkódja` : `${[...products, ...inventory].filter(p => !p.qr_code).length} tételnek nincs QR kódja`}</p></div>
            <div className="flex space-x-3">
              <button onClick={() => setShowGenerateModal(false)} className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Mégse</button>
              <button onClick={handleBulkGenerate} className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Generálás</button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode/QR Generator Modal */}
      {showGenerator && generatorValue && (
        <BarcodeGenerator
          value={generatorValue}
          type={generatorType}
          inventoryId={selectedProduct?.id}
          onClose={() => setShowGenerator(false)}
          onSaved={() => {
            setShowGenerator(false);
            loadData();
          }}
        />
      )}
      
      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Kategóriák kezelése</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="h-6 w-6" /></button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Új kategória hozzáadása</label>
              <div className="flex">
                <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Kategória neve"/>
                <button onClick={handleAddCategory} className="px-3 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"><Plus className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meglévő kategóriák</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.filter(cat => cat !== 'all').map((category) => (
                  <div key={category} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-900 dark:text-white">{category}</span>
                    <div className="flex space-x-2">
                      <button onClick={() => setEditingCategory({ id: category, name: category })} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleDeleteCategory(category)} className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {editingCategory && (
              <div className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kategória szerkesztése</label>
                <div className="flex">
                  <input type="text" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                  <button onClick={handleEditCategory} className="px-3 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"><Save className="h-5 w-5" /></button>
                </div>
              </div>
            )}
            <div className="flex justify-end"><button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Bezárás</button></div>
          </div>
        </div>
      )}
    </div>
  )
}