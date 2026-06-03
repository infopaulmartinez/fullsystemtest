import React, { useState, useEffect } from 'react'
import { 
  Package, 
  Search, 
  Filter, 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Download,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

interface Product {
  id: string
  name: string
  description: string | null
  category: string
  wholesale_price: number
  retail_price: number
  image_url: string | null
}

interface PartnerCompany {
  id: string
  name: string
  discount_percentage: number | null
}

export default function PartnerProducts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<string[]>([])
  const [partnerCompany, setPartnerCompany] = useState<PartnerCompany | null>(null)

  useEffect(() => {
    if (user) {
      loadPartnerData()
      loadProducts()
    }
  }, [user])

  const loadPartnerData = async () => {
    try {
      // Check if user is associated with a partner company
      const { data, error } = await supabase
        .from('partner_users')
        .select('partner_companies(id, name, discount_percentage)')
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
      
      if (data && data.partner_companies) {
        setPartnerCompany(data.partner_companies as PartnerCompany)
      }
    } catch (error) {
      console.error('Hiba a partner adatok betöltésekor:', error)
      toast.error('Hiba a partner adatok betöltésekor')
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      
      // Load products with wholesale prices
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, category, wholesale_price, retail_price, image_url')
        .order('name')
      
      if (error) throw error
      
      if (data) {
        setProducts(data)
        
        // Extract unique categories
        const uniqueCategories = Array.from(new Set(data.map(p => p.category)))
        setCategories(['all', ...uniqueCategories])
      }
    } catch (error) {
      console.error('Hiba a termékek betöltésekor:', error)
      toast.error('Hiba a termékek betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPriceList = () => {
    toast.success('Árlista letöltése folyamatban...')
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Calculate discounted price if partner has a discount
  const getDiscountedPrice = (price: number) => {
    if (!partnerCompany?.discount_percentage) return price
    return price * (1 - partnerCompany.discount_percentage / 100)
  }

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
              <Package className="h-8 w-8 mr-3 text-blue-600" />
              Termékek
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Böngésszen a termékek között és tekintse meg az árlistát
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleDownloadPriceList}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            Árlista letöltése
          </button>
          <Link
            to="/partner/orders/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Rendelés
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Keresés
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Termék neve vagy leírása..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kategória
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'Összes kategória' : category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadProducts}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincsenek termékek</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Nem találhatók termékek a megadott szűrési feltételekkel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-16 w-16 text-gray-400" />
                  )}
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">{product.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {product.description || 'Nincs leírás'}
                </p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nagykereskedelmi ár:</p>
                    <div className="flex items-center">
                      {partnerCompany?.discount_percentage && partnerCompany.discount_percentage > 0 ? (
                        <>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {getDiscountedPrice(product.wholesale_price).toLocaleString('hu-HU')} Ft
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-through ml-2">
                            {product.wholesale_price.toLocaleString('hu-HU')} Ft
                          </p>
                        </>
                      ) : (
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {product.wholesale_price.toLocaleString('hu-HU')} Ft
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/partner/orders/new?product=${product.id}`}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Kosárba
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}