import React, { useState, useEffect } from 'react'
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Save, 
  ArrowLeft,
  Package,
  Search,
  Filter,
  Calendar,
  MapPin,
  Clock,
  Truck,
  FileText,
  CheckCircle
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

interface CartItem extends Product {
  quantity: number
}

interface PartnerCompany {
  id: string
  name: string
  discount_percentage: number | null
}

export default function PartnerNewOrder() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<string[]>([])
  const [partnerCompany, setPartnerCompany] = useState<PartnerCompany | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    customer_name: '',
    default_order: false,
    load_previous: false,
    customer_email: '',
    customer_phone: '',
  })
  const [orderNotes, setOrderNotes] = useState('')
  const [deliveryDate, setDeliveryDate] = useState<string>('')
  const [locations, setLocations] = useState<{id: string, name: string}[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  useEffect(() => {
    if (user) {
      loadPartnerData()
      loadProducts()
      loadLocations()
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
        setPartnerId(data.partner_companies.id)
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

  const loadLocations = async () => {
    try {
      // Load locations
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
      
      if (error) throw error
      
      if (data) {
        setLocations(data)
        if (data.length > 0) {
          setSelectedLocation(data[0].id)
        }
      }
    } catch (error) {
      console.error('Hiba a helyszínek betöltésekor:', error)
    }
  }

  // Load previous day's order
  const loadPreviousOrder = async () => {
    try {
      if (!partnerId) {
        toast.error('Nincs partner azonosító'); 
        return;
      }
      
      // Get yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Find the most recent order from yesterday or before
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', partnerId)
        .lte('created_at', `${yesterdayStr}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const prevOrder = data[0];

        // Add items to cart
        const cartItems: CartItem[] = [];
        
        for (const item of prevOrder.items || []) {
          // Find product details
          const product = products.find(p => p.id === item.id || p.id === item.product_id);
          
          if (product) {
            cartItems.push({
              ...product,
              quantity: item.quantity || 1
            });
          }
        }
        
        if (cartItems.length > 0) {
          setCart(cartItems);
          toast.success('Előző rendelés betöltve');
        } else {
          toast.error('Az előző rendelés nem tartalmaz termékeket');
        }
      } else {
        toast.error('Nem található korábbi rendelés');
      }
    } catch (error) {
      console.error('Hiba az előző rendelés betöltésekor:', error);
      toast.error('Hiba az előző rendelés betöltésekor');
    }
  };

  // Save default order
  const saveDefaultOrder = async () => {
    try {
      if (!partnerId) {
        toast.error('Nincs partner azonosító'); 
        return;
      }
      
      if (cart.length === 0) {
        toast.error('A kosár üres');
        return;
      }
      
      // Save the current cart as default order
      const defaultOrderData = {
        partner_id: partnerId,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.wholesale_price
        }))
      };
      
      // Store in default_orders table
      const { error } = await supabase
        .from('default_orders')
        .upsert({
          partner_id: partnerId,
          items: defaultOrderData.items
        }, { onConflict: 'partner_id' });
      
      if (error) throw error;
      
      toast.success('Alapértelmezett rendelés mentve');
    } catch (error) {
      console.error('Hiba az alapértelmezett rendelés mentésekor:', error);
      toast.error('Hiba az alapértelmezett rendelés mentésekor');
    }
  };

  // Load default order
  const loadDefaultOrder = async () => {
    try {
      if (!partnerId) {
        toast.error('Nincs partner azonosító'); 
        return;
      }
      
      // Get default order from default_orders table
      const { data, error } = await supabase
        .from('default_orders')
        .select('items')
        .eq('partner_id', partnerId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Nincs még alapértelmezett rendelés');
        } else {
          throw error;
        }
        return;
      }
      
      if (data && data.items) {
        const cartItems: CartItem[] = [];
        
        for (const item of data.items) {
          // Find product details
          const product = products.find(p => p.id === item.id);
          
          if (product) {
            cartItems.push({
              ...product,
              quantity: item.quantity
            });
          }
        }
        
        setCart(cartItems);
        toast.success('Alapértelmezett rendelés betöltve');
      }
    } catch (error) {
      console.error('Hiba az alapértelmezett rendelés betöltésekor:', error);
      toast.error('Hiba az alapértelmezett rendelés betöltésekor');
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
    
    toast.success(`${product.name} hozzáadva a kosárhoz`)
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id))
      toast.success('Termék eltávolítva a kosárból')
    } else {
      setCart(prev => prev.map(item =>
        item.id === id ? { ...item, quantity } : item
      ))
    }
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
    toast.success('Termék eltávolítva a kosárból')
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.wholesale_price * item.quantity), 0)
  }

  const calculateDiscount = () => {
    if (!partnerCompany?.discount_percentage) return 0
    return calculateSubtotal() * (partnerCompany.discount_percentage / 100)
  }

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount()
  }

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('A kosár üres')
      return
    }
    
    if (!selectedLocation) {
      toast.error('Kérjük válasszon átvételi helyet')
      return
    }
    
    try {
      setSubmitting(true)
      
      // Create order data
      const orderData = {
        customer_id: partnerCompany?.id,
        customer_name: partnerCompany?.name,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.wholesale_price
        })),
        total_amount: calculateTotal(),
        status: 'pending',
        order_date: new Date().toISOString(),
        delivery_date: deliveryDate ? new Date(deliveryDate).toISOString() : null,
        location_id: selectedLocation,
        notes: orderNotes,
        payment_method: 'transfer',
        payment_status: 'pending',
        order_number: `ORD-${Date.now()}`
      }
      
      // Insert into database
      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
      
      if (error) throw error
      
      toast.success('Rendelés sikeresen létrehozva!')
      navigate('/partner/orders')
    } catch (error) {
      console.error('Hiba a rendelés létrehozásakor:', error)
      toast.error('Hiba a rendelés létrehozásakor')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link to="/partner/orders" className="mr-4">
            <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <ShoppingCart className="h-8 w-8 mr-3 text-blue-600" />
              Új rendelés
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Válassza ki a termékeket és adja le rendelését
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6">
        {/* Products */}
        <div className="w-2/3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Termékek</h2>
              <div className="flex space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Keresés..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'Összes kategória' : category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="h-12 w-12 text-gray-400" />
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">{product.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                      {product.description || 'Nincs leírás'}
                    </p>
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {product.wholesale_price.toLocaleString('hu-HU')} Ft
                      </p>
                      <button
                        onClick={() => addToCart(product)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="w-1/3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Kosár ({cart.reduce((sum, item) => sum + item.quantity, 0)} termék)
            </h2>
            
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">A kosár üres</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Adjon hozzá termékeket a kosárhoz a rendelés leadásához.
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between mb-4">
                  <button
                    onClick={loadDefaultOrder}
                    className="px-3 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors"
                  >
                    Alapértelmezett rendelés betöltése
                  </button>
                  <button
                    onClick={loadPreviousOrder}
                    className="px-3 py-2 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800/30 transition-colors"
                  >
                    Előző rendelés betöltése
                  </button>
                </div>
                
                <div className="space-y-3 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.wholesale_price.toLocaleString('hu-HU')} Ft/db
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-medium text-gray-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Átvételi hely *
                    </label>
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="">Válasszon átvételi helyet</option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kívánt szállítási dátum
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Megjegyzések
                    </label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Speciális kérések, szállítási információk..."
                    />
                  </div>
                </div>
                
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="save_default"
                    checked={formData.default_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, default_order: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="save_default" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Mentés alapértelmezett rendelésként
                  </label>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Részösszeg:</span>
                    <span className="text-gray-900 dark:text-white">{calculateSubtotal().toLocaleString('hu-HU')} Ft</span>
                  </div>
                  
                  {partnerCompany?.discount_percentage && partnerCompany.discount_percentage > 0 && (
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-400">
                        Kedvezmény ({partnerCompany.discount_percentage}%):
                      </span>
                      <span className="text-green-600 dark:text-green-400">-{calculateDiscount().toLocaleString('hu-HU')} Ft</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-gray-900 dark:text-white">Végösszeg:</span>
                    <span className="text-gray-900 dark:text-white">{calculateTotal().toLocaleString('hu-HU')} Ft</span>
                  </div>
                </div>
                
                <button
                  onClick={handleSubmitOrder}
                  disabled={submitting || cart.length === 0 || !selectedLocation}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center mb-3"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Feldolgozás...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Rendelés leadása
                    </>
                  )}
                </button>
                
                {cart.length > 0 && (
                  <button
                    onClick={saveDefaultOrder}
                    className="w-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 py-2 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Mentés alapértelmezett rendelésként
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}