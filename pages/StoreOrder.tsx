import React, { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Save,
  Search,
  MapPin,
  RotateCcw,
  Package,
  CheckCircle,
  ChefHat,
  FileText,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'

// ── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string
  name: string
  type: string
  city: string
  address: string
  status: string
}

interface Product {
  id: string
  name: string
  category: string
  retail_price: number
  wholesale_price: number
  image_url: string | null
  unit?: string
}

interface OrderItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  category: string
}

interface PreviousOrder {
  id: string
  order_number: string
  items: OrderItem[]
  created_at: string
  notes: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  bread: 'Kenyér',
  pastry: 'Sütemény',
  cake: 'Torta',
  cookie: 'Keksz',
  pizza: 'Pizza',
  sandwich: 'Szendvics',
  other: 'Egyéb',
}

const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c

// ── Component ─────────────────────────────────────────────────────────────────

export default function StoreOrder() {
  const { user } = useAuth()

  // ── State ──────────────────────────────────────────────────────────────────
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<OrderItem[]>([])
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [previousOrder, setPreviousOrder] = useState<PreviousOrder | null>(null)
  const [previousLoading, setPreviousLoading] = useState(false)

  const [showSuccess, setShowSuccess] = useState(false)
  const [lastOrderNumber, setLastOrderNumber] = useState('')

  // ── Load locations ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadLocations = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('id, name, type, city, address, status')
          .eq('status', 'active')
          .order('name')
        if (error) throw error
        setLocations(data || [])
      } catch (err) {
        console.error(err)
        toast.error('Helyszínek betöltése sikertelen')
      } finally {
        setLoading(false)
      }
    }
    loadLocations()
  }, [])

  // ── Load products ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true)
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, category, retail_price, wholesale_price, image_url')
          .is('is_deleted', null)
          .order('category')
          .order('name')
        if (error) throw error
        const prods: Product[] = data || []
        setProducts(prods)
        const cats = [...new Set(prods.map(p => p.category))].sort()
        setCategories(cats)
      } catch (err) {
        console.error(err)
        toast.error('Termékek betöltése sikertelen')
      } finally {
        setProductsLoading(false)
      }
    }
    loadProducts()
  }, [])

  // ── Load previous order for selected location ──────────────────────────────
  const loadPreviousOrder = useCallback(async (locationId: string) => {
    if (!locationId) return
    setPreviousLoading(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, items, created_at, notes')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      setPreviousOrder(data)
    } catch (err) {
      console.error(err)
    } finally {
      setPreviousLoading(false)
    }
  }, [])

  const handleLocationChange = (locationId: string) => {
    const loc = locations.find(l => l.id === locationId) || null
    setSelectedLocation(loc)
    setCart([])
    setPreviousOrder(null)
    if (locationId) loadPreviousOrder(locationId)
  }

  // ── Load previous order items into cart ────────────────────────────────────
  const handleLoadPrevious = () => {
    if (!previousOrder?.items?.length) {
      toast('Az előző rendelésnek nincsenek tételei', { icon: 'ℹ️' })
      return
    }
    // Validate items against current products (keep only existing products)
    const validItems = (previousOrder.items as OrderItem[]).filter(item =>
      products.some(p => p.id === item.product_id)
    )
    if (validItems.length === 0) {
      toast.error('Az előző rendelés termékei már nem érhetők el')
      return
    }
    setCart(validItems)
    if (previousOrder.notes) setNotes(previousOrder.notes)
    toast.success(`${validItems.length} tétel betöltve az előző rendelésből`)
  }

  // ── Cart operations ────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.wholesale_price || product.retail_price || 0,
          category: product.category,
        },
      ]
    })
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i =>
          i.product_id === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter(i => i.quantity > 0)
    )
  }

  const setQuantityDirect = (productId: string, value: number) => {
    const qty = Math.max(0, Math.floor(value))
    setCart(prev =>
      qty === 0
        ? prev.filter(i => i.product_id !== productId)
        : prev.map(i => (i.product_id === productId ? { ...i, quantity: qty } : i))
    )
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product_id !== productId))
  }

  const clearCart = () => {
    setCart([])
    setNotes('')
  }

  // ── Submit order + auto production batches ─────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedLocation) {
      toast.error('Válasszon helyszínt')
      return
    }
    if (cart.length === 0) {
      toast.error('A rendelés üres')
      return
    }

    setSubmitting(true)
    try {
      const totalAmount = cart.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      )

      // 1. Create order
      const now = new Date()
      const yy = now.getFullYear().toString().slice(-2)
      const seq = now.getTime().toString().slice(-4)
      const generatedOrderNumber = `INV-${yy}-${seq}`

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: generatedOrderNumber,
          customer_name: selectedLocation.name,
          customer_address: selectedLocation.address,
          items: cart,
          total_amount: totalAmount,
          status: 'pending',
          payment_method: 'transfer',
          payment_status: 'pending',
          location_id: selectedLocation.id,
          location_name: selectedLocation.name,
          notes: notes || null,
          created_by: user?.id || null,
          created_by_user: user?.id || null,
          order_date: new Date().toISOString(),
        })
        .select('id, order_number')
        .single()

      if (orderError) throw orderError

      const orderId = orderData.id
      const orderNumber = orderData.order_number
      setLastOrderNumber(orderNumber)

      // 2. Auto-create production batches (one per product)
      const batchInserts = cart.map(item => ({
        batch_number: `AUTO-${Date.now().toString().slice(-6)}-${item.product_id.slice(-4).toUpperCase()}`,
        recipe_id: item.product_id,
        batch_size: item.quantity,
        status: 'planned',
        location_id: selectedLocation.id,
        notes: `Auto – Rendelés: ${orderNumber}, Bolt: ${selectedLocation.name}`,
      }))

      const { data: batchData, error: batchError } = await supabase
        .from('production_batches')
        .insert(batchInserts)
        .select('id')

      if (batchError) {
        // Order succeeded; log batch error but don't fail
        console.error('Batch creation error:', batchError)
        toast('Rendelés elküldve, de gyártás ütemezése részben sikertelen!', { icon: '⚠️' })
      } else if (batchData?.length) {
        // 3. Link batches → order in production_batches_orders
        const linkInserts = batchData.map(b => ({
          batch_id: b.id,
          order_id: orderId,
        }))
        await supabase.from('production_batches_orders').insert(linkInserts)
      }

      // 4. Success
      setCart([])
      setNotes('')
      setShowSuccess(true)
      toast.success('Rendelés elküldve és gyártásba kerül!')
    } catch (err: any) {
      console.error(err)
      toast.error('Hiba a rendelés elküldésekor: ' + (err.message || ''))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter
    const matchSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchCat && matchSearch
  })

  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const cartQty = (productId: string) =>
    cart.find(i => i.product_id === productId)?.quantity ?? 0

  // ── Success screen ─────────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-3xl p-10 text-center max-w-md w-full shadow-xl">
          <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mb-2">
            Rendelés elküldve!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            Rendelés száma:
          </p>
          <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white mb-4">
            {lastOrderNumber}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center justify-center gap-1">
            <ChefHat className="h-4 w-4 text-amber-500" />
            A gyártás automatikusan ütemezve lett.
          </p>
          <button
            onClick={() => setShowSuccess(false)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Új rendelés
          </button>
        </div>
      </div>
    )
  }

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-amber-500" />
            Bolti rendelés
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Válassza ki a boltot, töltse fel a rendelést és küldje el.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left / main column ─────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Location selector */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-500" />
              Bolt / Helyszín kiválasztása
            </label>
            {loading ? (
              <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : (
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                value={selectedLocation?.id || ''}
                onChange={e => handleLocationChange(e.target.value)}
              >
                <option value="">-- Válasszon helyszínt --</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} – {loc.city}
                  </option>
                ))}
              </select>
            )}

            {/* Previous order banner */}
            {selectedLocation && (
              <div className="mt-3">
                {previousLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Előző rendelés keresése…
                  </div>
                ) : previousOrder ? (
                  <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                      <FileText className="h-4 w-4" />
                      <span>
                        Előző rendelés:{' '}
                        <span className="font-semibold">
                          #{previousOrder.order_number}
                        </span>{' '}
                        ({previousOrder.items?.length ?? 0} tétel,{' '}
                        {new Date(previousOrder.created_at).toLocaleDateString('hu-HU')})
                      </span>
                    </div>
                    <button
                      onClick={handleLoadPrevious}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ml-3"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Betöltés
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                    <AlertCircle className="h-4 w-4" />
                    Ehhez a bolthoz nincs korábbi rendelés.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product catalog */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Termék keresése…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
              {/* Category filter */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              >
                <option value="all">Minden kategória</option>
                {categories.map(c => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                <Package className="h-10 w-10 mb-2" />
                <p className="text-sm">Nincs találat</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
                {filteredProducts.map(product => {
                  const qty = cartQty(product.id)
                  return (
                    <div
                      key={product.id}
                      className={`relative rounded-xl border p-3 transition-all duration-150 cursor-pointer select-none
                        ${qty > 0
                          ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 shadow-sm'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-750 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                        }`}
                      onClick={() => addToCart(product)}
                    >
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                        {categoryLabel(product.category)}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {(product.wholesale_price || product.retail_price || 0).toLocaleString('hu-HU')} Ft
                      </p>
                      {qty > 0 && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {qty}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: cart ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm sticky top-4">
            {/* Cart header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-amber-500" />
                Rendelés ({cartCount} db)
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Törlés
                </button>
              )}
            </div>

            {/* Cart items */}
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-300 dark:text-gray-600">
                <ShoppingCart className="h-10 w-10 mb-2" />
                <p className="text-sm">A rendelés üres</p>
                <p className="text-xs mt-1">Kattintson a termékekre a hozzáadáshoz</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-4">
                {cart.map(item => (
                  <li
                    key={item.product_id}
                    className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.unit_price.toLocaleString('hu-HU')} Ft/db
                      </p>
                    </div>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.product_id, -1)}
                        className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={e =>
                          setQuantityDirect(item.product_id, parseInt(e.target.value) || 0)
                        }
                        className="w-10 text-center text-sm font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md py-0.5"
                      />
                      <button
                        onClick={() => updateQuantity(item.product_id, 1)}
                        className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Notes */}
            <textarea
              placeholder="Megjegyzés (opcionális)…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none mb-4"
            />

            {/* Total */}
            {cart.length > 0 && (
              <div className="flex justify-between items-center text-sm font-semibold mb-4 px-1">
                <span className="text-gray-600 dark:text-gray-300">Összesen:</span>
                <span className="text-lg text-gray-900 dark:text-white">
                  {cartTotal.toLocaleString('hu-HU')} Ft
                </span>
              </div>
            )}

            {/* Auto-production info */}
            {cart.length > 0 && (
              <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl px-3 py-2.5 mb-4">
                <ChefHat className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Rendelés után a gyártás automatikusan ütemezve lesz ({cart.length} tétel).
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0 || !selectedLocation}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Küldés…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Rendelés elküldése
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
