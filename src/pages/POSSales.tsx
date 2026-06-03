import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ShoppingCart, Plus, Minus, Trash2, Search, ChefHat, X,
  Settings, CheckCircle, AlertTriangle, Loader2, RefreshCw,
  Banknote, Package, Grid3X3, List, Moon, Sun, Wifi, WifiOff,
  Clock, RotateCcw, Receipt, ChevronRight, Zap, LogOut,
  PackagePlus, Save, ArrowUp, ArrowDown, CreditCard, CircleDollarSign,
  Shield, ChevronDown, Trash, PlusCircle, ArrowDownCircle, Monitor,
  Edit2, Check, AlertCircle, Printer,
  MapPin, FileText, Send, ClipboardList,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { ReceiptHistory } from '../components/ReceiptHistory'
import { ReturnModule } from '../components/ReturnModule'
import {
  cashmaticPing, cashmaticStartPayment, cashmaticGetStatus, cashmaticCancel, cashmaticCommit,
  cashmaticWithdrawal, getDevices, addDevice, updateDevice, deleteDevice, testDevice,
  formatHUF, toCents, fromCents,
  type CashmaticPaymentResponse, type DeviceConfig,
} from '../lib/cashmaticApi'
import { openReceipt, generateReceiptNumber, type ReceiptData } from '../lib/receiptGenerator'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  category: string
  retail_price: number
  vat_percentage: number
  image_url?: string
  barcode?: string
  current_stock: number
  unit: string
}

interface CartItem extends Product {
  quantity: number
  subtotal: number
}

interface CashmaticSettings {
  currency: string
  pollInterval: number
}

type PaymentState =
  | 'idle' | 'method_select' | 'cash_connecting' | 'cash_waiting'
  | 'card_waiting' | 'processing' | 'success' | 'error' | 'cancelled'

type PaymentMethod = 'cash' | 'card'
type AdminTab = 'payout' | 'registers' | 'printer' | 'receipts' | 'returns'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: CashmaticSettings = { currency: 'HUF', pollInterval: 1500 }
const PAYMENT_TIMEOUT_MS = 120_000

function loadSettings(): CashmaticSettings {
  try {
    const raw = localStorage.getItem('cashmatic_settings')
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}
function saveSettings(s: CashmaticSettings) {
  localStorage.setItem('cashmatic_settings', JSON.stringify(s))
}

// ─── Main Component ───────────────────────────────────────────────────────────

function getProxyUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const protocol = window.location.protocol
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${protocol}//${host}:3002`
    }
  }
  return import.meta.env.VITE_CASHMATIC_PROXY_URL || 'http://localhost:3002'
}

export default function POSSales({
  onLogout,
  posSession,
}: {
  onLogout?: () => void
  posSession?: any
}) {
  const { user, signOut } = useAuth()

  const handlePOSLogout = async () => {
    if (posSession?.session_id) {
      try {
        const proxy = getProxyUrl()
        const response = await fetch(`${proxy}/api/close-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: posSession.session_id,
          }),
        })
        const data = await response.json()
        if (data.success) {
          toast.success('Kasszamunkamenet lezárva')
        }
      } catch (e) {
        console.error('Kasszazárás hiba:', e)
      }
      localStorage.removeItem('pos_session')
      if (onLogout) onLogout()
    } else {
      signOut()
    }
  }

  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'))

  // Products & cart
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [showCategoryView, setShowCategoryView] = useState(true)  // Kategória nézet alapból
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)

  // Cashmatic settings
  const [settings, setSettings] = useState<CashmaticSettings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [tempSettings, setTempSettings] = useState<CashmaticSettings>(settings)
  const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null)
  const [pingLoading, setPingLoading] = useState(false)

  // Multi-kassza
  const [selectedDeviceId, setSelectedDeviceId] = useState('default')
  const [devices, setDevices] = useState<DeviceConfig[]>([])
  const [showDeviceMenu, setShowDeviceMenu] = useState(false)

  // Admin panel
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminTab, setAdminTab] = useState<AdminTab>('payout')

  // Payment
  const [paymentState, setPaymentState] = useState<PaymentState>('idle')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [currentTxId, setCurrentTxId] = useState<string | null>(null)
  const [amountPaid, setAmountPaid] = useState(0)
  const [change, setChange] = useState(0)
  const [paymentError, setPaymentError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Session stats
  const [sessionStart] = useState(new Date())
  const [txCount, setTxCount] = useState(0)
  const [totalSales, setTotalSales] = useState(0)

  // Stock refill
  const [showStock, setShowStock] = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  const [stockDeltas, setStockDeltas] = useState<Record<string, number>>({})
  const [stockSaving, setStockSaving] = useState(false)

  // ─── Bolti rendelés ───────────────────────────────────────────────────────
  const [showOrderPanel, setShowOrderPanel] = useState(false)
  const [orderLocations, setOrderLocations] = useState<{id: string; name: string; city: string}[]>([])
  const [orderSelectedLocId, setOrderSelectedLocId] = useState(() => localStorage.getItem('pos_order_location_id') || '')
  const [orderSelectedLocName, setOrderSelectedLocName] = useState(() => localStorage.getItem('pos_order_location_name') || '')
  const [orderCart, setOrderCart] = useState<{product_id: string; product_name: string; quantity: number; category: string}[]>([])
  const [orderNotes, setOrderNotes] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderCategory, setOrderCategory] = useState('all')
  const [orderPrev, setOrderPrev] = useState<{id:string; order_number:string; items:any[]; created_at:string; notes:string|null} | null>(null)
  const [orderPrevLoading, setOrderPrevLoading] = useState(false)
  const [orderLocsLoading, setOrderLocsLoading] = useState(false)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState('')



  const categories = ['all', ...Array.from(new Set(products.map(p => p.category))).sort()]
  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode ?? '').includes(search)
    return matchCat && matchSearch
  })
  const cartTotal = cart.reduce((s, i) => s + i.subtotal, 0)
  const cartTax = cart.reduce((s, i) => s + (i.subtotal * (i.vat_percentage ?? 0)) / (100 + (i.vat_percentage ?? 0)), 0)
  const selectedDevice = devices.find(d => d.id === selectedDeviceId)

  // ─── Load products ────────────────────────────────────────────────────────

  async function loadProducts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`id, name, category, retail_price, vat_percentage, image_url, barcode, store_inventory ( current_stock, unit )`)
        .order('name')
      if (error) throw error
      setProducts((data ?? []).map((p: any) => {
        const inv = Array.isArray(p.store_inventory) ? p.store_inventory[0] : p.store_inventory
        return {
          id: p.id, name: p.name, category: p.category ?? 'Egyéb',
          retail_price: p.retail_price ?? 0, vat_percentage: p.vat_percentage ?? 27,
          image_url: p.image_url, barcode: p.barcode,
          current_stock: inv?.current_stock != null ? Number(inv.current_stock) : 9999,
          unit: inv?.unit ?? 'db',
        }
      }))
    } catch (err: any) {
      toast.error('Betöltési hiba: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load devices
  async function loadDevices() {
    const devs = await getDevices()
    setDevices(devs)
  }

  useEffect(() => {
    loadProducts()
    loadDevices()
  }, [])

  // ─── Cart ─────────────────────────────────────────────────────────────────

  function addToCart(product: Product) {
    if (product.current_stock <= 0) { toast.error('Nincs készleten!'); return }
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id)
      if (ex) {
        if (ex.quantity >= product.current_stock) { toast.error('Nincs több készleten!'); return prev }
        return prev.map(i => i.id === product.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.retail_price }
          : i)
      }
      return [...prev, { ...product, quantity: 1, subtotal: product.retail_price }]
    })
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i
      const qty = i.quantity + delta
      if (qty <= 0) return null as any
      if (qty > i.current_stock) { toast.error('Nincs elég készlet!'); return i }
      return { ...i, quantity: qty, subtotal: qty * i.retail_price }
    }).filter(Boolean))
  }

  function removeFromCart(id: string) { setCart(p => p.filter(i => i.id !== id)) }
  function clearCart() { setCart([]) }

  // ─── Ping ─────────────────────────────────────────────────────────────────

  async function pingDevice() {
    setPingLoading(true)
    const ok = await cashmaticPing(selectedDeviceId)
    setDeviceOnline(ok)
    setPingLoading(false)
    toast(ok ? '✅ Cashmatic elérhető!' : '❌ Cashmatic nem válaszol!')
  }

  // ─── Payment ──────────────────────────────────────────────────────────────

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }

  function openMethodSelect() {
    if (cart.length === 0) { toast.error('A kosár üres!'); return }
    setPaymentState('method_select')
    setPaymentError('')
  }

  async function startCashPayment() {
    setPaymentMethod('cash')
    setPaymentState('cash_connecting')
    // A Cashmatic fillérben (cents) várja az összeget! 540 Ft = 54000 fillér
    const amountCents = toCents(cartTotal)
    let txResp: CashmaticPaymentResponse
    try {
      txResp = await cashmaticStartPayment({ amount: amountCents, currency: settings.currency }, selectedDeviceId)
    } catch (err: any) {
      setPaymentState('error'); setPaymentError(err.message); return
    }
    setCurrentTxId(txResp.transactionId)
    setPaymentState('cash_waiting')

    timeoutRef.current = setTimeout(async () => {
      stopPolling()
      try { await cashmaticCancel(txResp.transactionId, selectedDeviceId) } catch {}
      setPaymentState('error'); setPaymentError('Időkorlát lejárt (2 perc)')
    }, PAYMENT_TIMEOUT_MS)

    // hasSeenTx: true ha már kaptunk legalább 1 waiting_cash választ.
    // CSAK akkor kezeljük completed-ként a "nincs aktív tx" választ.
    let hasSeenTx = false

    // 2 másodperc várakozás – Cashmatic-nak időbe telik a tx regisztrálása
    await new Promise(r => setTimeout(r, 2000))

    // STALE CLOSURE ELKERÜLÉSE: ne paymentState-et ellenőrizzük (régi értéket látna),
    // hanem a timeoutRef-et – ha null, akkor már timeout/cancel történt
    if (!timeoutRef.current) return

    pollRef.current = setInterval(async () => {
      try {
        const status = await cashmaticGetStatus(txResp.transactionId, selectedDeviceId, hasSeenTx)
        console.log('[Poll] status:', status.status, '| hasSeenTx:', hasSeenTx, '| paid:', status.amountPaid, '| change:', status.change)

        if (status.status === 'waiting_cash') hasSeenTx = true

        if (status.status === 'completed') {
          stopPolling()
          const paidFt   = fromCents(status.amountPaid ?? amountCents)
          const changeFt = fromCents(status.change ?? 0)
          setAmountPaid(paidFt)
          setChange(changeFt)
          const txId = await finalizeTransaction('cashmatic_cash')
          const receiptData = buildReceiptData('cashmatic_cash', paidFt, changeFt, true)
          await saveReceiptToHistory(receiptData, txId)
          openReceipt(receiptData)
          setPaymentState('success')
        } else if (status.status === 'failed' || status.status === 'timeout') {
          stopPolling()
          const receiptData = buildReceiptData('cashmatic_cash', 0, 0, false, status.error ?? 'Sikertelen fizetés')
          await saveReceiptToHistory(receiptData)
          openReceipt(receiptData)
          setPaymentState('error'); setPaymentError(status.error ?? 'Sikertelen fizetés')
        } else if (status.status === 'cancelled') {
          stopPolling()
          const receiptData = buildReceiptData('cashmatic_cash', 0, 0, false, 'Megszakítva')
          await saveReceiptToHistory(receiptData)
          openReceipt(receiptData)
          setPaymentState('cancelled')
        }
        // 'pending' és 'waiting_cash' → folytatjuk a pollingot
      } catch (e) {
        console.warn('[Poll] active-transaction hiba:', e)
      }
    }, settings.pollInterval)
  }

  function startCardPayment() {
    setPaymentMethod('card')
    setPaymentState('card_waiting')
    setAmountPaid(cartTotal)
    setChange(0)
  }

  async function confirmCardPayment() {
    setPaymentState('processing')
    try {
      const txId = await finalizeTransaction('card')
      const receiptData = buildReceiptData('card', cartTotal, 0, true)
      await saveReceiptToHistory(receiptData, txId)
      openReceipt(receiptData)
      setPaymentState('success')
    } catch (err: any) {
      const receiptData = buildReceiptData('card', 0, 0, false, err.message)
      await saveReceiptToHistory(receiptData)
      openReceipt(receiptData)
      setPaymentState('error')
      setPaymentError(err.message)
    }
  }

  function cancelCardPayment() { setPaymentState('method_select') }

  async function cancelCashPayment() {
    if (!currentTxId) { setPaymentState('idle'); return }
    stopPolling(); setPaymentState('processing')
    try { await cashmaticCancel(currentTxId, selectedDeviceId) } catch {}
    setCurrentTxId(null)
    const receiptData = buildReceiptData('cashmatic_cash', 0, 0, false, 'Vevő által megszakítva')
    await saveReceiptToHistory(receiptData)
    openReceipt(receiptData)
    setPaymentState('cancelled')
  }

  // ─── Receipt helper ──────────────────────────────────────────────────────

  function buildReceiptData(
    method: string,
    paidFt: number,
    changeFt: number,
    success: boolean,
    failReason?: string
  ): ReceiptData {
    return {
      receiptNumber: generateReceiptNumber(),
      date:          new Date(),
      cashierName:   user?.email ?? user?.id ?? 'Pénztáros',
      items: cart.map(i => ({
        name:      i.name,
        quantity:  i.quantity,
        unitPrice: i.retail_price,
        subtotal:  i.subtotal,
        vatPct:    i.vat_percentage ?? 27,
        unit:      i.unit ?? 'db',
      })),
      subtotalNet:   cartTotal - cartTax,
      taxAmount:     cartTax,
      total:         cartTotal,
      paymentMethod: method === 'card' ? 'card' : 'cash',
      amountPaid:    paidFt,
      change:        changeFt,
      success,
      failReason,
    }
  }

  async function saveReceiptToHistory(receiptData: ReceiptData, transactionId?: string) {
    try {
      // 1. receipt_history-ba mindig mentünk (sikeres és sikertelen is)
      const { error: rhError } = await supabase.from('receipt_history').insert([{
        receipt_number: receiptData.receiptNumber,
        cashier_id:     user?.id,
        transaction_id: transactionId || null,
        payment_method: receiptData.paymentMethod,
        amount_total:   receiptData.total,
        success:        receiptData.success,
        receipt_data:   receiptData,
      }])
      if (rhError) console.error('❌ receipt_history insert hiba:', rhError)

      // 2. Ha van transactionId (sikeres fizetés), frissítjük a pos_transactions receipt_number-t
      if (transactionId) {
        const { error: txError } = await supabase.from('pos_transactions').update({
          receipt_number: receiptData.receiptNumber,
        }).eq('id', transactionId)
        if (txError) console.error('❌ pos_transactions update hiba:', txError)
        return
      }

      // 3. Sikertelen / megszakított: pos_transactions-ba is beírjuk cancelled státusszal
      const { error: txError } = await supabase.from('pos_transactions').insert([{
        cashier_id:    user?.id,
        location_id:   posSession?.location_id ?? null,
        subtotal:      receiptData.total - receiptData.taxAmount,
        tax_amount:    receiptData.taxAmount,
        total_amount:  receiptData.total,
        payment_method: receiptData.paymentMethod,
        status:        'cancelled',
        receipt_number: receiptData.receiptNumber,
        amount_paid:   receiptData.amountPaid ?? 0,
        change_amount: receiptData.change ?? 0,
        notes:         receiptData.failReason ?? 'Megszakítva',
      }])
      if (txError) console.error('❌ pos_transactions insert (cancelled) hiba:', txError)
    } catch (err) {
      console.error('❌ saveReceiptToHistory error:', err)
    }
  }

  async function finalizeTransaction(method: string) {
    const { data: tx, error } = await supabase.from('pos_transactions').insert([{
      cashier_id: user?.id,
      location_id: posSession?.location_id ?? null,
      subtotal: cartTotal - cartTax,
      tax_amount: cartTax,
      total_amount: cartTotal,
      payment_method: method,
      status: 'completed',
    }]).select().single()
    if (error) throw error
    await supabase.from('pos_transaction_items').insert(cart.map(i => ({
      transaction_id: tx.id, product_id: i.id, quantity: i.quantity,
      unit_price: i.retail_price, total_price: i.subtotal, discount_amount: 0,
    })))
    await Promise.all(cart.map(i =>
      supabase.rpc('decrement_stock', { p_product_id: i.id, p_quantity: i.quantity })
    ))
    setTxCount(n => n + 1)
    setTotalSales(s => s + cartTotal)
    return tx.id
  }

  function resetAfterPayment() {
    stopPolling(); setPaymentState('idle'); setCurrentTxId(null)
    setAmountPaid(0); setChange(0); setPaymentError('')
    clearCart(); loadProducts()
  }

  // ─── Stock refill ─────────────────────────────────────────────────────────

  async function saveStockRefill() {
    const entries = Object.entries(stockDeltas).filter(([, v]) => v !== 0)
    if (entries.length === 0) { toast.error('Nincs módosítás!'); return }
    setStockSaving(true)
    let ok = 0, fail = 0
    for (const [productId, delta] of entries) {
      try {
        await supabase.rpc(delta > 0 ? 'increment_stock' : 'decrement_stock', {
          p_product_id: productId, p_quantity: Math.abs(delta),
        })
        ok++
      } catch { fail++ }
    }
    setStockSaving(false)
    setStockDeltas({})
    toast(fail === 0 ? `✅ ${ok} termék készlete frissítve!` : `${ok} OK, ${fail} hiba!`)
    await loadProducts()
    setShowStock(false)
  }

  // ─── Bolti rendelés funkciók ──────────────────────────────────────────────

  async function openOrderPanel() {
    setShowOrderPanel(true)
    setOrderSuccess('')
    if (orderLocations.length === 0) {
      setOrderLocsLoading(true)
      const { data } = await supabase
        .from('locations')
        .select('id, name, city')
        .eq('status', 'active')
        .order('name')
      setOrderLocations(data || [])
      setOrderLocsLoading(false)
    }
    if (orderSelectedLocId) loadOrderPrev(orderSelectedLocId)
  }

  async function handleOrderLocChange(locId: string, locName: string) {
    setOrderSelectedLocId(locId)
    setOrderSelectedLocName(locName)
    localStorage.setItem('pos_order_location_id', locId)
    localStorage.setItem('pos_order_location_name', locName)
    setOrderPrev(null)
    setOrderCart([])
    if (locId) loadOrderPrev(locId)
  }

  async function loadOrderPrev(locId: string) {
    setOrderPrevLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, items, created_at, notes')
      .eq('location_id', locId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setOrderPrev(data)
    setOrderPrevLoading(false)
  }

  function handleLoadPrevOrder() {
    if (!orderPrev?.items?.length) { toast('Nincs tétel az előző rendelésben', { icon: 'ℹ️' }); return }
    const valid = (orderPrev.items as any[]).filter(i => products.some(p => p.id === i.product_id))
    if (!valid.length) { toast.error('Az előző rendelés termékei már nem elérhetők'); return }
    setOrderCart(valid.map((i: any) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      category: i.category ?? '',
    })))
    if (orderPrev.notes) setOrderNotes(orderPrev.notes)
    toast.success(`${valid.length} tétel betöltve!`)
  }

  function orderAddProduct(p: {id: string; name: string; category: string}) {
    setOrderCart(prev => {
      const ex = prev.find(i => i.product_id === p.id)
      if (ex) return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product_id: p.id, product_name: p.name, quantity: 1, category: p.category }]
    })
  }

  function orderSetQty(productId: string, qty: number) {
    const q = Math.max(0, Math.floor(qty))
    setOrderCart(prev => q === 0 ? prev.filter(i => i.product_id !== productId)
      : prev.map(i => i.product_id === productId ? { ...i, quantity: q } : i))
  }

  function orderRemove(productId: string) {
    setOrderCart(prev => prev.filter(i => i.product_id !== productId))
  }

  async function handleSubmitOrder() {
    if (!orderSelectedLocId) { toast.error('Válasszon helyszínt!'); return }
    if (orderCart.length === 0) { toast.error('A rendelés üres!'); return }
    setOrderSubmitting(true)
    try {
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_name: orderSelectedLocName,
          items: orderCart.map(i => ({ ...i, unit_price: 0 })),
          total_amount: 0,
          status: 'pending',
          payment_method: 'transfer',
          payment_status: 'pending',
          location_id: orderSelectedLocId,
          location_name: orderSelectedLocName,
          notes: orderNotes || null,
          created_by: user?.id || null,
          created_by_user: user?.id || null,
          order_date: new Date().toISOString(),
        })
        .select('id, order_number')
        .single()
      if (orderErr) throw orderErr

      // Auto gyártás – minden termékhez egy production_batch
      const batchInserts = orderCart.map(item => ({
        batch_number: `AUTO-${Date.now().toString().slice(-5)}-${item.product_id.slice(-4).toUpperCase()}`,
        recipe_id: item.product_id,
        batch_size: item.quantity,
        status: 'planned',
        location_id: orderSelectedLocId,
        notes: `Auto – Rendelés: ${orderData.order_number}, Bolt: ${orderSelectedLocName}`,
      }))
      const { data: batchData } = await supabase.from('production_batches').insert(batchInserts).select('id')
      if (batchData?.length) {
        await supabase.from('production_batches_orders').insert(
          batchData.map(b => ({ batch_id: b.id, order_id: orderData.id }))
        )
      }

      setOrderSuccess(orderData.order_number)
      setOrderCart([])
      setOrderNotes('')
      toast.success('Rendelés elküldve!')
    } catch (e: any) {
      toast.error('Hiba: ' + (e.message || ''))
    } finally {
      setOrderSubmitting(false)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function toggleDark() { document.documentElement.classList.toggle('dark'); setDarkMode(d => !d) }
  function saveAndClose() {
    saveSettings(tempSettings); setSettings(tempSettings)
    setShowSettings(false); setDeviceOnline(null)
    toast.success('Beállítások mentve!')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">

      {/* TOP BAR */}
      <header className="flex-none flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Cashmatic POS</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date().toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Session stats */}
          <div className="hidden lg:flex items-center gap-2 mr-2 text-xs">
            <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg text-gray-500 dark:text-gray-400">
              <Receipt className="h-3.5 w-3.5" /> {txCount} tranzakció
            </span>
            <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg font-medium">
              <Banknote className="h-3.5 w-3.5" /> {formatHUF(totalSales)}
            </span>
            <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {sessionStart.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })} óta
            </span>
          </div>

          {/* Kassza választó */}
          <div className="relative">
            <button
              onClick={() => setShowDeviceMenu(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
            >
              <Monitor className="h-3.5 w-3.5 text-amber-500" />
              {selectedDevice?.name ?? 'Főpénztár'}
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
            {showDeviceMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 min-w-[180px] py-1">
                {devices.map(d => (
                  <button key={d.id} onClick={() => { setSelectedDeviceId(d.id); setShowDeviceMenu(false); setDeviceOnline(null) }}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedDeviceId === d.id ? 'text-amber-600 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                    <Monitor className="h-3.5 w-3.5" />
                    {d.name}
                    {selectedDeviceId === d.id && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                ))}
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                  <button onClick={() => { setShowAdmin(true); setAdminTab('registers'); setShowDeviceMenu(false) }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                    <PlusCircle className="h-3.5 w-3.5" /> Kassza kezelés
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ping */}
          <button onClick={pingDevice} disabled={pingLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium border-gray-200 dark:border-gray-600">
            {pingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
              : deviceOnline === true ? <Wifi className="h-3.5 w-3.5 text-green-500" />
              : deviceOnline === false ? <WifiOff className="h-3.5 w-3.5 text-red-500" />
              : <Wifi className="h-3.5 w-3.5 text-gray-400" />}
            <span className={deviceOnline === true ? 'text-green-600' : deviceOnline === false ? 'text-red-500' : 'text-gray-400'}>
              {deviceOnline === true ? 'Online' : deviceOnline === false ? 'Offline' : 'Cashmatic'}
            </span>
          </button>

          <button onClick={toggleDark} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={loadProducts} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="Frissítés">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => { setStockDeltas({}); setStockSearch(''); setShowStock(true) }}
            className="p-2 rounded-lg text-gray-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20" title="Készletfeltöltés">
            <PackagePlus className="h-4 w-4" />
          </button>
          {/* Bolti rendelés gomb */}
          <button onClick={openOrderPanel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-sm" title="Bolti rendelés">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Rendelés</span>
          </button>
          {/* Admin gomb */}
          <button onClick={() => { setShowAdmin(true); setAdminTab('payout') }}
            className="p-2 rounded-lg text-gray-500 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20" title="Admin panel">
            <Shield className="h-4 w-4" />
          </button>
          <button onClick={() => { setTempSettings(settings); setShowSettings(true) }}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Settings className="h-4 w-4" />
          </button>
          <button onClick={handlePOSLogout} className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title={posSession ? 'Kasszazárás' : 'Kilépés'}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Products */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden pos-scroll-hidden">
          <div className="flex-none px-3 pt-3 pb-2 space-y-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Keresés termék neve, vonalkód..." value={search}
                onChange={e => { setSearch(e.target.value); if (e.target.value) setShowCategoryView(false); else if (activeCategory === 'all') setShowCategoryView(true) }}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-gray-400" /></button>}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {!showCategoryView && (
                <button onClick={() => { setShowCategoryView(true); setActiveCategory('all') }}
                  className="flex-none flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 whitespace-nowrap">
                  ← Vissza
                </button>
              )}
              {categories.map(cat => (
                <button key={cat} onClick={() => { setActiveCategory(cat); if (cat !== 'all') setShowCategoryView(false); else setShowCategoryView(true) }}
                  className={`flex-none px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === cat && !showCategoryView ? 'bg-amber-600 text-white' : showCategoryView && cat === 'all' ? 'bg-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                  {cat === 'all' ? 'Összes' : cat}
                </button>
              ))}
              <div className="flex-none ml-auto flex gap-1 pl-2 border-l border-gray-200 dark:border-gray-600">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-gray-400'}`}><Grid3X3 className="h-4 w-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-gray-400'}`}><List className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 pos-scroll-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>
            ) : showCategoryView && !search ? (
              /* ── Kategória csempék nézet ── */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {categories.filter(c => c !== 'all').map(cat => {
                  const catProducts = products.filter(p => p.category === cat)
                  const inStock = catProducts.filter(p => p.current_stock > 0).length
                  const firstImg = catProducts.find(p => p.image_url)?.image_url
                  return (
                    <button key={cat} onClick={() => { setActiveCategory(cat); setShowCategoryView(false) }}
                      className="relative flex flex-col items-center justify-end rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-400 hover:shadow-xl active:scale-95 transition-all overflow-hidden aspect-square group">
                      <div className="absolute inset-0">
                        {firstImg
                          ? <img src={firstImg} alt={cat} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                          : <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20" />}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="relative z-10 p-3 w-full text-left">
                        <p className="font-bold text-white text-sm leading-tight drop-shadow">{cat}</p>
                        <p className="text-xs text-white/70 mt-0.5">{inStock} / {catProducts.length} db</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Package className="h-12 w-12 mb-2 opacity-30" /><p className="text-sm">Nincs találat</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} disabled={paymentState !== 'idle'} />)}
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map(p => <ProductRow key={p.id} product={p} onAdd={addToCart} disabled={paymentState !== 'idle'} />)}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div className="flex flex-col w-72 xl:w-80 2xl:w-96 bg-white dark:bg-gray-800 flex-none pos-scroll-hidden">
          <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-gray-900 dark:text-white text-sm">Kosár</span>
              {cart.length > 0 && (
                <span className="bg-amber-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            {cart.length > 0 && paymentState === 'idle' && (
              <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" /> Törlés
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pos-scroll-hidden">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Üres kosár</p>
                <p className="text-xs mt-0.5 text-gray-300 dark:text-gray-500">Érintsd meg a terméket!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {cart.map(item => (
                  <CartRow key={item.id} item={item}
                    onIncrease={() => updateQty(item.id, 1)}
                    onDecrease={() => updateQty(item.id, -1)}
                    onRemove={() => removeFromCart(item.id)}
                    disabled={paymentState !== 'idle'} />
                ))}
              </div>
            )}
          </div>

          <div className="flex-none border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
            {cart.length > 0 && (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500 dark:text-gray-400">
                  <span>Nettó összeg</span><span>{formatHUF(cartTotal - cartTax)}</span>
                </div>
                <div className="flex justify-between text-gray-500 dark:text-gray-400">
                  <span>ÁFA</span><span>{formatHUF(cartTax)}</span>
                </div>
                <div className="flex justify-between font-bold text-xl text-gray-900 dark:text-white pt-1.5 border-t border-gray-200 dark:border-gray-600">
                  <span>Fizetendő</span>
                  <span className="text-amber-600">{formatHUF(cartTotal)}</span>
                </div>
              </div>
            )}

            <PaymentSection
              state={paymentState}
              cartEmpty={cart.length === 0}
              total={cartTotal}
              amountPaid={amountPaid}
              change={change}
              error={paymentError}
              onOpenSelect={openMethodSelect}
              onCash={startCashPayment}
              onCard={startCardPayment}
              onConfirmCard={confirmCardPayment}
              onCancelCard={cancelCardPayment}
              onCancelCash={cancelCashPayment}
              onReset={resetAfterPayment}
            />
          </div>
        </div>
      </div>

      {/* Click away for device menu */}
      {showDeviceMenu && <div className="fixed inset-0 z-40" onClick={() => setShowDeviceMenu(false)} />}

      {/* BOLTI RENDELÉS PANEL */}
      {showOrderPanel && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-stretch justify-end"
          onClick={e => { if (e.target === e.currentTarget) setShowOrderPanel(false) }}>
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-amber-600">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> Bolti rendelés
              </h2>
              <button onClick={() => setShowOrderPanel(false)}>
                <X className="h-5 w-5 text-white/80 hover:text-white" />
              </button>
            </div>

            {/* Success screen */}
            {orderSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-3xl p-10 w-full max-w-sm">
                  <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mb-1">Elküldve!</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Rendelésszám:</p>
                  <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white mb-4">{orderSuccess}</p>
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-1 mb-6">
                    <ChefHat className="h-3.5 w-3.5 text-amber-500" /> Gyártás automatikusan ütemezve.
                  </p>
                  <button onClick={() => setOrderSuccess('')}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl transition-colors">
                    Új rendelés
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col">

                {/* Location selector */}
                <div className="flex-none px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-amber-500" /> Bolt / Helyszín
                    </label>
                    {orderLocsLoading ? (
                      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                    ) : (
                      <select
                        value={orderSelectedLocId}
                        onChange={e => {
                          const opt = orderLocations.find(l => l.id === e.target.value)
                          handleOrderLocChange(e.target.value, opt ? `${opt.name}` : '')
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                        <option value="">-- Válasszon boltot --</option>
                        {orderLocations.map(l => (
                          <option key={l.id} value={l.id}>{l.name} – {l.city}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Previous order banner */}
                  {orderSelectedLocId && (
                    orderPrevLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Előző rendelés keresése…
                      </div>
                    ) : orderPrev ? (
                      <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span>Előző rendelés: <strong>#{orderPrev.order_number}</strong> ({orderPrev.items?.length ?? 0} tétel – {new Date(orderPrev.created_at).toLocaleDateString('hu-HU')})</span>
                        </div>
                        <button onClick={handleLoadPrevOrder}
                          className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ml-2 whitespace-nowrap">
                          <RotateCcw className="h-3.5 w-3.5" /> Betöltés
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Nincs korábbi rendelés ehhez a bolthoz.
                      </p>
                    )
                  )}
                </div>

                {/* Product list */}
                <div className="flex-none px-5 pt-4 pb-2 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="text" placeholder="Termék keresése…" value={orderSearch}
                        onChange={e => setOrderSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                    </div>
                    <select value={orderCategory} onChange={e => setOrderCategory(e.target.value)}
                      className="border border-gray-200 dark:border-gray-600 rounded-xl px-2.5 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                      <option value="all">Összes</option>
                      {[...new Set(products.map(p => p.category))].sort().map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {products
                      .filter(p => (orderCategory === 'all' || p.category === orderCategory) &&
                        (!orderSearch || p.name.toLowerCase().includes(orderSearch.toLowerCase())))
                      .map(p => {
                        const inCart = orderCart.find(i => i.product_id === p.id)
                        return (
                          <div key={p.id}
                            onClick={() => orderAddProduct(p)}
                            className={`relative rounded-xl border p-3 cursor-pointer transition-all select-none
                              ${inCart
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                              }`}>
                            <p className="text-xs text-gray-400 mb-0.5">{p.category}</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">{p.name}</p>
                            {inCart && (
                              <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                {inCart.quantity}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Cart & submit */}
                {orderCart.length > 0 && (
                  <div className="flex-none border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-5 py-4 space-y-3">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Kosár ({orderCart.reduce((s, i) => s + i.quantity, 0)} db)
                    </p>
                    <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {orderCart.map(item => (
                        <li key={item.product_id} className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-xl px-3 py-2">
                          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{item.product_name}</span>
                          <button onClick={e => { e.stopPropagation(); orderSetQty(item.product_id, item.quantity - 1) }}
                            className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-600 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                            <Minus className="h-3 w-3" />
                          </button>
                          <input type="number" min={0} value={item.quantity}
                            onClick={e => e.stopPropagation()}
                            onChange={e => orderSetQty(item.product_id, parseInt(e.target.value) || 0)}
                            className="w-10 text-center text-sm font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md py-0.5 text-gray-900 dark:text-white" />
                          <button onClick={e => { e.stopPropagation(); orderSetQty(item.product_id, item.quantity + 1) }}
                            className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-600 flex items-center justify-center hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors">
                            <Plus className="h-3 w-3" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); orderRemove(item.product_id) }}
                            className="text-gray-300 hover:text-red-400 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <textarea
                      placeholder="Megjegyzés (opcionális)…"
                      value={orderNotes}
                      onChange={e => setOrderNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none" />
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl px-3 py-2">
                      <ChefHat className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Elküldés után a gyártás automatikusan ütemezve lesz.
                      </p>
                    </div>
                    <button onClick={handleSubmitOrder} disabled={orderSubmitting || !orderSelectedLocId}
                      className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow">
                      {orderSubmitting
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Küldés…</>
                        : <><Send className="h-4 w-4" /> Rendelés elküldése</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}


      {showAdmin && (
        <AdminPanel
          tab={adminTab}
          onTabChange={setAdminTab}
          onClose={() => setShowAdmin(false)}
          selectedDeviceId={selectedDeviceId}
          devices={devices}
          onDevicesChange={loadDevices}
          onDeviceSelect={setSelectedDeviceId}
        />
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-amber-600" /> POS beállítások
              </h2>
              <button onClick={() => setShowSettings(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Pénznem</label>
                <select value={tempSettings.currency} onChange={e => setTempSettings(s => ({ ...s, currency: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                  <option value="HUF">HUF – Magyar forint</option>
                  <option value="EUR">EUR – Euro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Lekérdezési intervallum (ms)</label>
                <input type="number" value={tempSettings.pollInterval}
                  onChange={e => setTempSettings(s => ({ ...s, pollInterval: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5 flex items-center justify-between border border-gray-100 dark:border-gray-600">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Cashmatic kapcsolat teszt</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {deviceOnline === true ? '✅ Elérhető' : deviceOnline === false ? '❌ Nem válaszol' : 'Nem tesztelt'}
                  </p>
                </div>
                <button onClick={pingDevice} disabled={pingLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                  {pingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />} Ping
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowSettings(false)} className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Mégse</button>
              <button onClick={saveAndClose} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl">Mentés</button>
            </div>
          </div>
        </div>
      )}

      {/* STOCK REFILL MODAL */}
      {showStock && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowStock(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-none">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PackagePlus className="h-5 w-5 text-amber-600" /> Készletfeltöltés
              </h2>
              <button onClick={() => setShowStock(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-none">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Termék keresése..." value={stockSearch}
                  onChange={e => setStockSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
              {products
                .filter(p => !stockSearch || p.name.toLowerCase().includes(stockSearch.toLowerCase()))
                .map(p => {
                  const delta = stockDeltas[p.id] ?? 0
                  const displayStock = p.current_stock >= 9999 ? '∞' : String(p.current_stock)
                  const newStock = p.current_stock + delta
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.category}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-24 text-right">
                          Jelenlegi: <span className="font-semibold text-gray-700 dark:text-gray-300">{displayStock} {p.unit}</span>
                        </span>
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 rounded-xl px-2 py-1.5 border border-gray-200 dark:border-gray-600">
                          <button onClick={() => setStockDeltas(d => ({ ...d, [p.id]: (d[p.id] ?? 0) - 1 }))}
                            className="w-6 h-6 rounded-lg bg-white dark:bg-gray-600 flex items-center justify-center hover:bg-red-50 hover:text-red-600 border border-gray-200 dark:border-gray-500 transition-colors">
                            <Minus className="h-3 w-3" />
                          </button>
                          <input type="number" value={delta === 0 ? '' : delta} placeholder="0"
                            onChange={e => setStockDeltas(d => ({ ...d, [p.id]: parseInt(e.target.value) || 0 }))}
                            className="w-12 text-center text-sm font-bold bg-transparent text-gray-900 dark:text-white focus:outline-none" />
                          <button onClick={() => setStockDeltas(d => ({ ...d, [p.id]: (d[p.id] ?? 0) + 1 }))}
                            className="w-6 h-6 rounded-lg bg-white dark:bg-gray-600 flex items-center justify-center hover:bg-green-50 hover:text-green-600 border border-gray-200 dark:border-gray-500 transition-colors">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className={`w-24 text-right text-xs font-semibold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-300 dark:text-gray-600'}`}>
                          {delta !== 0 ? (
                            <span className="flex items-center justify-end gap-0.5">
                              {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                              → {newStock} {p.unit}
                            </span>
                          ) : '—'}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-none">
              <p className="text-xs text-gray-400">{Object.values(stockDeltas).filter(v => v !== 0).length} termék módosítva</p>
              <div className="flex gap-3">
                <button onClick={() => setStockDeltas({})} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Visszaállítás
                </button>
                <button onClick={saveStockRefill} disabled={stockSaving || Object.values(stockDeltas).every(v => v === 0)}
                  className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
                  {stockSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Mentés
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

interface AdminPanelProps {
  tab: AdminTab
  onTabChange: (t: AdminTab) => void
  onClose: () => void
  selectedDeviceId: string
  devices: DeviceConfig[]
  onDevicesChange: () => void
  onDeviceSelect: (id: string) => void
}

function AdminPanel({ tab, onTabChange, onClose, selectedDeviceId, devices, onDevicesChange, onDeviceSelect }: AdminPanelProps) {

  // Payout state
  const [payoutAmountFt, setPayoutAmountFt] = useState('')
  const [payoutReason, setPayoutReason] = useState('Kifizetés')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutResult, setPayoutResult] = useState<{ success: boolean; message: string } | null>(null)

  // Printer state
  const [printerIp, setPrinterIp] = useState(() => localStorage.getItem('printer_ip') || '192.168.2.30')
  const [printerPort, setPrinterPort] = useState(() => localStorage.getItem('printer_port') || '9100')
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('printer_name') || 'HP LaserJet M404dw')
  const [printerSaved, setPrinterSaved] = useState(false)
  const [printerTesting, setPrinterTesting] = useState(false)
  const [printerStatus, setPrinterStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  // Register state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const emptyForm = { id: '', name: '', ip: '', port: '50301', protocol: 'https', username: '', password: '' }
  const [newForm, setNewForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState<Partial<typeof emptyForm> & { password?: string }>({})
  const [savingDevice, setSavingDevice] = useState(false)

  async function handlePayout() {
    const ft = parseFloat(payoutAmountFt)
    if (!ft || ft <= 0) { toast.error('Adj meg érvényes összeget!'); return }
    setPayoutLoading(true)
    setPayoutResult(null)
    try {
      const cents = toCents(ft) // fillérre váltás
      const r = await cashmaticWithdrawal(cents, payoutReason, selectedDeviceId)
      setPayoutResult({ success: r.success, message: r.message ?? (r.success ? 'Kifizetés elindítva' : 'Hiba történt') })
      if (r.success) {
        toast.success(`✅ Kifizetés: ${formatHUF(ft)}`)
        setPayoutAmountFt('')
      } else {
        toast.error(r.message ?? 'Kifizetés sikertelen')
      }
    } catch (e: any) {
      setPayoutResult({ success: false, message: e.message })
      toast.error(e.message)
    } finally {
      setPayoutLoading(false)
    }
  }

  async function handleAddDevice() {
    if (!newForm.id || !newForm.name || !newForm.ip || !newForm.port || !newForm.username || !newForm.password) {
      toast.error('Minden mező kötelező!'); return
    }
    setSavingDevice(true)
    const r = await addDevice(newForm)
    setSavingDevice(false)
    if (r.success) {
      toast.success('Kassza hozzáadva!')
      setShowAddForm(false)
      setNewForm(emptyForm)
      onDevicesChange()
    } else {
      toast.error(r.message ?? 'Hiba!')
    }
  }

  async function handleUpdateDevice(id: string) {
    setSavingDevice(true)
    const r = await updateDevice(id, editForm)
    setSavingDevice(false)
    if (r.success) {
      toast.success('Kassza frissítve!')
      setEditingId(null)
      setEditForm({})
      onDevicesChange()
    } else {
      toast.error(r.message ?? 'Hiba!')
    }
  }

  async function handleDeleteDevice(id: string, name: string) {
    if (!confirm(`Törlöd a "${name}" kasszát?`)) return
    const r = await deleteDevice(id)
    if (r.success) { toast.success('Kassza törölve'); onDevicesChange() }
    else toast.error(r.message ?? 'Hiba!')
  }

  async function handleTestDevice(id: string) {
    setTestingId(id)
    const r = await testDevice(id)
    setTestResults(prev => ({ ...prev, [id]: r }))
    setTestingId(null)
  }

  const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'payout', label: 'Kifizetés', icon: <ArrowDownCircle className="h-4 w-4" /> },
    { key: 'registers', label: 'Kasszák', icon: <Monitor className="h-4 w-4" /> },
    { key: 'printer', label: 'Nyomtató', icon: <Printer className="h-4 w-4" /> },
    { key: 'receipts', label: 'Blokkok', icon: <Receipt className="h-4 w-4" /> },
    { key: 'returns', label: 'Visszáru', icon: <RotateCcw className="h-4 w-4" /> },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-none">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" /> Admin panel
          </h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-none bg-gray-50 dark:bg-gray-800/50">
          {TABS.map(t => (
            <button key={t.key} onClick={() => onTabChange(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Kifizetés tab ── */}
          {tab === 'payout' && (
            <div className="p-6 space-y-5">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownCircle className="h-4 w-4 text-purple-600" />
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-300">Kifizetés a kasszából</p>
                </div>
                <p className="text-xs text-purple-700 dark:text-purple-400">
                  A gép kiadja a megadott összeget. Aktív kassza: <strong>{devices.find(d => d.id === selectedDeviceId)?.name ?? selectedDeviceId}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Összeg (Ft)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">Ft</span>
                  <input
                    type="number" min="1" step="1"
                    value={payoutAmountFt}
                    onChange={e => { setPayoutAmountFt(e.target.value); setPayoutResult(null) }}
                    placeholder="pl. 500"
                    className="w-full pl-10 pr-4 py-3 text-xl font-bold rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                {/* Gyors összegek */}
                <div className="flex gap-2 mt-2">
                  {[500, 1000, 2000, 5000].map(v => (
                    <button key={v} onClick={() => { setPayoutAmountFt(String(v)); setPayoutResult(null) }}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors">
                      {formatHUF(v)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Indok (opcionális)</label>
                <input type="text" value={payoutReason} onChange={e => setPayoutReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>

              {payoutResult && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${payoutResult.success ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {payoutResult.success ? <CheckCircle className="h-4 w-4 flex-none" /> : <AlertCircle className="h-4 w-4 flex-none" />}
                  {payoutResult.message}
                </div>
              )}

              <button onClick={handlePayout} disabled={payoutLoading || !payoutAmountFt}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-base shadow-lg shadow-purple-600/25 transition-all">
                {payoutLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowDownCircle className="h-5 w-5" />}
                {payoutLoading ? 'Kifizetés folyamatban...' : `Kifizet${payoutAmountFt ? ` – ${formatHUF(Number(payoutAmountFt))}` : ''}`}
              </button>
            </div>
          )}

          {/* ── Kasszák tab ── */}
          {tab === 'registers' && (
            <div className="p-4 space-y-3">
              {devices.map(d => (
                <div key={d.id} className={`rounded-xl border p-4 ${selectedDeviceId === d.id ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'}`}>
                  {editingId === d.id ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Kassza szerkesztése</p>
                      {[
                        { label: 'Név', field: 'name', type: 'text' },
                        { label: 'IP-cím', field: 'ip', type: 'text' },
                        { label: 'Port', field: 'port', type: 'text' },
                        { label: 'Felhasználónév', field: 'username', type: 'text' },
                        { label: 'Jelszó (üresen hagyva = változatlan)', field: 'password', type: 'password' },
                      ].map(({ label, field, type }) => (
                        <div key={field}>
                          <label className="block text-xs text-gray-500 mb-1">{label}</label>
                          <input type={type}
                            value={(editForm as any)[field] ?? (d as any)[field] ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingId(null); setEditForm({}) }} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400">Mégse</button>
                        <button onClick={() => handleUpdateDevice(d.id)} disabled={savingDevice}
                          className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                          {savingDevice ? 'Mentés...' : 'Mentés'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-amber-600" />
                            <span className="font-semibold text-sm text-gray-900 dark:text-white">{d.name}</span>
                            {selectedDeviceId === d.id && <span className="text-xs bg-amber-600 text-white px-1.5 py-0.5 rounded-full">Aktív</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{d.protocol}://{d.ip}:{d.port} · @{d.username}</p>
                          {testResults[d.id] && (
                            <p className={`text-xs mt-1 font-medium ${testResults[d.id].success ? 'text-green-600' : 'text-red-500'}`}>
                              {testResults[d.id].message}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { onDeviceSelect(d.id); toast(`🖥️ Átváltva: ${d.name}`) }}
                            title="Aktiválás"
                            className={`p-1.5 rounded-lg ${selectedDeviceId === d.id ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}>
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleTestDevice(d.id)} disabled={testingId === d.id}
                            title="Kapcsolat teszt"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                            {testingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                          </button>
                          <button onClick={() => { setEditingId(d.id); setEditForm({}) }}
                            title="Szerkesztés"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {d.id !== 'default' && (
                            <button onClick={() => handleDeleteDevice(d.id, d.name)}
                              title="Törlés"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                              <Trash className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Új kassza form */}
              {showAddForm ? (
                <div className="rounded-xl border border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/10 p-4 space-y-3">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase">Új kassza hozzáadása</p>
                  {[
                    { label: 'Azonosító (pl. kassza2)', field: 'id', type: 'text' },
                    { label: 'Megjelenő név', field: 'name', type: 'text' },
                    { label: 'IP-cím', field: 'ip', type: 'text' },
                    { label: 'Port', field: 'port', type: 'text' },
                    { label: 'Felhasználónév', field: 'username', type: 'text' },
                    { label: 'Jelszó', field: 'password', type: 'password' },
                  ].map(({ label, field, type }) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input type={type}
                        value={(newForm as any)[field]}
                        onChange={e => setNewForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddForm(false); setNewForm(emptyForm) }}
                      className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400">Mégse</button>
                    <button onClick={handleAddDevice} disabled={savingDevice}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                      {savingDevice ? 'Mentés...' : '+ Hozzáadás'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-purple-400 hover:text-purple-600 text-sm font-medium transition-colors">
                  <PlusCircle className="h-4 w-4" /> Új kassza hozzáadása
                </button>
              )}
            </div>
          )}

          {/* ── Nyomtató tab ── */}
          {tab === 'printer' && (
            <div className="p-5 space-y-4">

              {/* Nyomtató kártya */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-none">
                  <Printer className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">{printerName}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">{printerIp}:{printerPort}</p>
                </div>
                <a
                  href={`http://${printerIp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex-none"
                >
                  <Wifi className="h-3 w-3" /> Webfelület
                </a>
              </div>

              {/* IP cím */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Nyomtató neve</label>
                <input
                  type="text"
                  value={printerName}
                  onChange={e => setPrinterName(e.target.value)}
                  placeholder="HP LaserJet M404dw"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">IP-cím</label>
                  <input
                    type="text"
                    value={printerIp}
                    onChange={e => { setPrinterIp(e.target.value); setPrinterStatus(null) }}
                    placeholder="192.168.2.30"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Port</label>
                  <input
                    type="text"
                    value={printerPort}
                    onChange={e => setPrinterPort(e.target.value)}
                    placeholder="9100"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Teszt gomb */}
              <button
                onClick={async () => {
                  setPrinterTesting(true)
                  setPrinterStatus(null)
                  try {
                    // Teszt: próbáljuk elérni a nyomtató webfelületét
                    const r = await fetch(`http://${printerIp}/hp/device/DeviceStatus/Index`, {
                      method: 'GET',
                      signal: AbortSignal.timeout(3000),
                      mode: 'no-cors',
                    })
                    setPrinterStatus({ ok: true, msg: '✅ Nyomtató elérhető a hálózaton!' })
                  } catch (e: any) {
                    // no-cors esetén opaque response = valójában el tudtuk érni
                    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
                      setPrinterStatus({ ok: false, msg: '❌ Időtúllépés – nyomtató nem válaszol' })
                    } else {
                      // TypeError = blocked by CSP vagy network error
                      setPrinterStatus({ ok: true, msg: '✅ Nyomtató elérhető (no-cors)' })
                    }
                  } finally {
                    setPrinterTesting(false)
                  }
                }}
                disabled={printerTesting}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
              >
                {printerTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Kapcsolat teszt
              </button>

              {printerStatus && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium ${printerStatus.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {printerStatus.ok ? <CheckCircle className="h-3.5 w-3.5 flex-none" /> : <AlertCircle className="h-3.5 w-3.5 flex-none" />}
                  {printerStatus.msg}
                </div>
              )}

              {printerSaved && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-medium">
                  <Check className="h-3.5 w-3.5" /> Mentve!
                </div>
              )}

              <button
                onClick={() => {
                  localStorage.setItem('printer_ip', printerIp)
                  localStorage.setItem('printer_port', printerPort)
                  localStorage.setItem('printer_name', printerName)
                  setPrinterSaved(true)
                  setTimeout(() => setPrinterSaved(false), 2500)
                  toast.success(`🖨️ Nyomtató mentve: ${printerIp}:${printerPort}`)
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                <Printer className="h-4 w-4" /> Mentés
              </button>

            </div>
          )}

          {/* ── Blokkok tab ── */}
          {tab === 'receipts' && (
            <div className="p-4 sm:p-6">
              <ReceiptHistory />
            </div>
          )}
          {tab === 'returns' && (
            <div className="p-4 sm:p-6">
              <ReturnModule />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductCard({ product, onAdd, disabled }: { product: Product; onAdd: (p: Product) => void; disabled: boolean }) {
  const outOfStock = product.current_stock <= 0
  return (
    <button onClick={() => onAdd(product)} disabled={outOfStock || disabled}
      className={`relative flex flex-col rounded-xl border text-left transition-all select-none overflow-hidden ${outOfStock || disabled ? 'opacity-50 cursor-not-allowed border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-400 hover:shadow-lg active:scale-95'}`}>
      <div className="w-full aspect-square bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 flex items-center justify-center overflow-hidden">
        {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <ChefHat className="h-8 w-8 text-amber-200 dark:text-amber-800" />}
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">{product.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{product.category}</p>
        <div className="flex items-end justify-between mt-1.5 gap-1">
          <span className="text-sm font-bold text-amber-600">{formatHUF(product.retail_price)}</span>
          <span className="text-xs text-gray-400">{product.current_stock >= 9999 ? '∞' : product.current_stock} {product.unit}</span>
        </div>
      </div>
      {outOfStock && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-900/70">
          <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/40 px-2 py-0.5 rounded-full border border-red-100">Elfogyott</span>
        </div>
      )}
    </button>
  )
}

function ProductRow({ product, onAdd, disabled }: { product: Product; onAdd: (p: Product) => void; disabled: boolean }) {
  const outOfStock = product.current_stock <= 0
  return (
    <button onClick={() => onAdd(product)} disabled={outOfStock || disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${outOfStock || disabled ? 'opacity-50 cursor-not-allowed border-transparent bg-gray-50 dark:bg-gray-800/50' : 'border-transparent bg-white dark:bg-gray-800 hover:border-amber-300 hover:shadow-sm active:scale-[0.99]'}`}>
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 flex items-center justify-center flex-none overflow-hidden">
        {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <ChefHat className="h-5 w-5 text-amber-200 dark:text-amber-800" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
        <p className="text-xs text-gray-400">{product.category} · {product.current_stock >= 9999 ? '∞' : product.current_stock} {product.unit}</p>
      </div>
      <div className="flex-none text-right">
        <p className="text-sm font-bold text-amber-600">{formatHUF(product.retail_price)}</p>
        {outOfStock && <p className="text-xs text-red-500">Elfogyott</p>}
      </div>
      {!outOfStock && !disabled && <ChevronRight className="flex-none h-4 w-4 text-gray-300" />}
    </button>
  )
}

function CartRow({ item, onIncrease, onDecrease, onRemove, disabled }: { item: CartItem; onIncrease: () => void; onDecrease: () => void; onRemove: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
        <p className="text-xs text-gray-400">{formatHUF(item.retail_price)} / {item.unit}</p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onDecrease} disabled={disabled} className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-amber-100 disabled:opacity-40"><Minus className="h-3 w-3" /></button>
        <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-white">{item.quantity}</span>
        <button onClick={onIncrease} disabled={disabled} className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-amber-100 disabled:opacity-40"><Plus className="h-3 w-3" /></button>
      </div>
      <p className="text-sm font-bold text-amber-600 min-w-[56px] text-right">{formatHUF(item.subtotal)}</p>
      {!disabled && <button onClick={onRemove} className="text-gray-300 hover:text-red-500"><X className="h-4 w-4" /></button>}
    </div>
  )
}

// ─── Payment Section ──────────────────────────────────────────────────────────

interface PaymentSectionProps {
  state: PaymentState; cartEmpty: boolean; total: number
  amountPaid: number; change: number; error: string
  onOpenSelect: () => void; onCash: () => void; onCard: () => void
  onConfirmCard: () => void; onCancelCard: () => void
  onCancelCash: () => void; onReset: () => void
}

function PaymentSection(p: PaymentSectionProps) {
  if (p.state === 'idle') return (
    <button onClick={p.onOpenSelect} disabled={p.cartEmpty}
      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base disabled:opacity-40 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white shadow-xl shadow-amber-600/25 transition-all">
      <CircleDollarSign className="h-5 w-5" /> Fizetés
    </button>
  )

  if (p.state === 'method_select') return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center uppercase tracking-wide">Fizetési mód</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={p.onCash}
          className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all active:scale-95 shadow-lg shadow-amber-600/20">
          <Banknote className="h-7 w-7" />
          <span className="text-sm">Készpénz</span>
          <span className="text-xs opacity-75">Cashmatic</span>
        </button>
        <button onClick={p.onCard}
          className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20">
          <CreditCard className="h-7 w-7" />
          <span className="text-sm">Bankkártya</span>
          <span className="text-xs opacity-75">Terminál</span>
        </button>
      </div>
      <button onClick={p.onReset} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← Vissza</button>
    </div>
  )

  if (p.state === 'cash_connecting') return (
    <div className="flex flex-col items-center gap-3 py-4">
      <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Csatlakozás...</p>
    </div>
  )

  if (p.state === 'cash_waiting') return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <Banknote className="h-9 w-9 text-amber-600" />
        </div>
        <svg className="absolute inset-0 w-20 h-20 animate-spin" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="text-amber-200" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="56 170" className="text-amber-600" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatHUF(p.total)}</p>
        <p className="text-sm text-amber-600 font-medium mt-1 animate-pulse">Várjuk a befizetést...</p>
        <p className="text-xs text-gray-400 mt-0.5">Cashmatic eszközön fizessen!</p>
      </div>
      <button onClick={p.onCancelCash}
        className="flex items-center gap-1.5 px-5 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 text-sm font-medium hover:bg-red-50">
        <X className="h-4 w-4" /> Mégse
      </button>
    </div>
  )

  if (p.state === 'card_waiting') return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center border-4 border-blue-200 dark:border-blue-800">
        <CreditCard className="h-9 w-9 text-blue-600" />
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatHUF(p.total)}</p>
        <p className="text-sm text-blue-600 font-medium mt-1">Kártyás fizetés folyamatban</p>
        <p className="text-xs text-gray-400 mt-0.5">Fizessen a banki terminálon!</p>
      </div>
      <div className="w-full space-y-2">
        <button onClick={p.onConfirmCard}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors shadow-lg shadow-green-600/20">
          <CheckCircle className="h-5 w-5" /> Terminál jóváhagyta
        </button>
        <button onClick={p.onCancelCard}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
          <X className="h-4 w-4" /> Mégse
        </button>
      </div>
    </div>
  )

  if (p.state === 'processing') return (
    <div className="flex flex-col items-center gap-3 py-4">
      <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Mentés...</p>
    </div>
  )

  if (p.state === 'success') return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle className="h-9 w-9 text-green-600" />
      </div>
      <div className="text-center w-full">
        <p className="font-bold text-green-700 dark:text-green-400 text-xl">Sikeres fizetés!</p>
        {p.amountPaid > 0 && p.change === 0 && (
          <p className="text-sm text-gray-500 mt-1">{formatHUF(p.amountPaid)} kifizetve</p>
        )}
        {p.change > 0 && (
          <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 font-medium">Visszajáró</p>
            <p className="text-2xl font-bold text-amber-600">{formatHUF(p.change)}</p>
          </div>
        )}
      </div>
      <button onClick={p.onReset}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg shadow-amber-600/20">
        <Zap className="h-4 w-4" /> Következő vevő
      </button>
    </div>
  )

  if (p.state === 'error') return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-red-600" />
      </div>
      <div className="text-center">
        <p className="font-bold text-red-700 dark:text-red-400">Hiba!</p>
        {p.error && <p className="text-xs text-gray-500 mt-1 max-w-[220px] mx-auto">{p.error}</p>}
      </div>
      <button onClick={p.onReset} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
        <RotateCcw className="h-4 w-4" /> Újra
      </button>
    </div>
  )

  if (p.state === 'cancelled') return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <X className="h-7 w-7 text-gray-500" />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Fizetés megszakítva</p>
      <button onClick={p.onReset} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold">
        <RotateCcw className="h-4 w-4" /> Újra próbál
      </button>
    </div>
  )

  return null
}