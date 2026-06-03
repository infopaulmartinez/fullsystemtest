import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import {
  ChefHat, Clock, CheckCircle, RefreshCw, FileText, Truck,
  AlertTriangle, X, Play, Pause, SkipForward, Layers,
  Scale, Zap, Timer, ListChecks, Plus, Bell, Flame,
  Eye, Users, ShoppingBag, Activity, Settings2, Coffee,
  Wind, Package, TrendingUp, BarChart2, Cpu, Hash,
  CheckSquare, Circle, ArrowRight, Loader2, Droplets, Edit2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import WeighingStep from '../components/Production/WeighingStep'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface StepTemplate {
  id: string
  title: string
  duration_minutes: number
  type: 'prep' | 'kneading' | 'rest' | 'shaping' | 'proofing' | 'baking' | 'cooling'
  note: string
}

interface RuntimeState {
  current_step_index: number
  step_started_at: string   // ISO timestamp stored in DB
  current_oven_round: number
  total_oven_rounds: number
  paused: boolean
  paused_at?: string
  steps: StepTemplate[]
  total_qty: number
  weight_kg: number
  user_notes: string
}

interface ProductionBatch {
  id: string
  batch_number: string
  recipe_id: string
  batch_size: number
  status: 'planned' | 'in_progress' | 'completed' | 'failed'
  start_time: string | null
  end_time: string | null
  actual_yield: number | null
  notes: string | null
  created_at: string
  product_name?: string
  product_category?: string
  runtime?: RuntimeState
  weighing_confirmed?: boolean
  weighing_completed_at?: string | null
}

interface OrderItem {
  product_id: string
  product_name?: string
  name?: string
  quantity: number
  unit_price?: number
  price?: number
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_address: string | null
  items: OrderItem[]
  status: string
}

interface Product {
  id: string
  name: string
  display_name?: string
  category: string
  weight_kg?: number
  ingredients?: { name: string; amount: number; unit: string }[]
  yield_amount?: number
  retail_price?: number
  wholesale_price?: number
}

interface ProductSummary {
  product_id: string
  product_name: string
  category: string
  weight_kg: number
  total_qty: number
  oven_rounds: number
  kneading_batches: { batch_no: number; dough_kg: number; qty: number }[]
  customers: { name: string; qty: number; order_number: string; order_id: string; address: string | null }[]
  ingredients_total: { name: string; total: number; unit: string }[]
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const OVEN_COUNT = 2
const LARGE_KNEADER = 160
const SMALL_KNEADER = 85
const DOUGH_FACTOR = 1.25

function ovenCapacity(weight_kg: number) {
  if (weight_kg <= 0.5) return 96 * OVEN_COUNT   // 192
  if (weight_kg <= 1.0) return 80 * OVEN_COUNT   // 160
  return 60 * OVEN_COUNT
}

function detectWeight(name: string, wkg?: number): number {
  const n = name?.toLowerCase() || ''
  if (n.includes('0.5') || n.includes('fél') || n.includes('500g') || n.includes('0,5')) return 0.5
  if (n.includes('2kg') || n.includes('2 kg')) return 2
  if (n.includes('1kg') || n.includes('1 kg')) return 1
  return wkg || 1
}

function calcKneading(qty: number, wkg: number) {
  const total_kg = qty * wkg * DOUGH_FACTOR
  const batches = []
  let rem = total_kg, batch = 1, qty_rem = qty
  while (rem > 0.1) {
    const this_kg = Math.min(rem, LARGE_KNEADER)
    const ratio = this_kg / total_kg
    batches.push({ batch_no: batch++, dough_kg: parseFloat(this_kg.toFixed(1)), qty: Math.round(qty * ratio) })
    rem -= this_kg
  }
  return batches
}

function getSteps(weight_kg: number): StepTemplate[] {
  const light = weight_kg <= 0.5
  return [
    { id: 's1', title: 'Előkészítés & mérés', duration_minutes: 10, type: 'prep', note: 'Alapanyagok kimérése, gépek előkészítése' },
    { id: 's2', title: 'Dagasztás', duration_minutes: light ? 18 : 22, type: 'kneading', note: `Nagy dagasztó max ${LARGE_KNEADER}kg, kis max ${SMALL_KNEADER}kg párhuzamosan` },
    { id: 's3', title: '1. Pihentetés', duration_minutes: 30, type: 'rest', note: 'Lefedve, szobahőmérsékleten' },
    { id: 's4', title: 'Darabolás & formázás', duration_minutes: light ? 15 : 20, type: 'shaping', note: 'Egyenlő adagok, kézzel formázás' },
    { id: 's5', title: 'Kelesztés', duration_minutes: light ? 60 : 80, type: 'proofing', note: '38°C, 85% páratartalom' },
    { id: 's6', title: 'Sütő előmelegítés', duration_minutes: 15, type: 'prep', note: `${light ? 210 : 200}°C – Sütő A és B egyszerre` },
    { id: 's7', title: 'Sütés', duration_minutes: light ? 30 : 50, type: 'baking', note: `Mindkét sütő párhuzamosan, max ${ovenCapacity(weight_kg)} db/kör` },
    { id: 's8', title: 'Hűtés & csomagolás', duration_minutes: 30, type: 'cooling', note: 'Rácson hűtés, majd rendelés szerint szétválogatás' },
  ]
}

// Parse & serialize runtime state from/to notes field
function parseRuntime(notes: string | null): RuntimeState | null {
  if (!notes) return null
  try {
    if (notes.startsWith('{')) {
      const parsed = JSON.parse(notes)
      if (parsed.rt) {
        // Ha a JSON gyökerén van weighing_confirmed (WeighingStep menti ide), 
        // azt is adjuk vissza a rt objektumon belül
        const rt = parsed.rt as RuntimeState
        if (parsed.weighing_confirmed != null && !(rt as any).weighing_confirmed) {
          ;(rt as any).weighing_confirmed = parsed.weighing_confirmed
        }
        return rt
      }
    }
  } catch {}
  return null
}

// Segédfüggvény: weighing_confirmed kiolvasása notes JSON-ból közvetlenül
function parseWeighingConfirmed(notes: string | null): boolean {
  if (!notes) return false
  try {
    const parsed = JSON.parse(notes)
    return !!(parsed.weighing_confirmed ?? parsed.rt?.weighing_confirmed)
  } catch { return false }
}

function serializeNotes(rt: RuntimeState, userNotes = ''): string {
  return JSON.stringify({ rt, _n: userNotes })
}

const STEP_STYLE: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  prep:     { color: 'text-gray-300',    bg: 'bg-gray-800/60',      icon: <Settings2 size={13}/> },
  kneading: { color: 'text-amber-300',   bg: 'bg-amber-900/30',     icon: <Activity size={13}/> },
  rest:     { color: 'text-blue-300',    bg: 'bg-blue-900/30',      icon: <Coffee size={13}/> },
  shaping:  { color: 'text-purple-300',  bg: 'bg-purple-900/30',    icon: <Cpu size={13}/> },
  proofing: { color: 'text-emerald-300', bg: 'bg-emerald-900/30',   icon: <Wind size={13}/> },
  baking:   { color: 'text-red-300',     bg: 'bg-red-900/30',       icon: <Flame size={13}/> },
  cooling:  { color: 'text-cyan-300',    bg: 'bg-cyan-900/30',      icon: <Timer size={13}/> },
}

function formatMMSS(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.max(0, seconds) % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
function formatDur(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h}ó ${m}p` : `${m} perc`
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function Production() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [tab, setTab] = useState<'orders' | 'plan' | 'active'>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [summaries, setSummaries] = useState<ProductSummary[]>([])
  const [activeBatches, setActiveBatches] = useState<ProductionBatch[]>([])
  const [completedBatchRecipes, setCompletedBatchRecipes] = useState<Set<string>>(new Set())
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [timers, setTimers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showPlanDetail, setShowPlanDetail] = useState<string | null>(null)
  const [showKimeresModal, setShowKimeresModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editOrderItems, setEditOrderItems] = useState<OrderItem[]>([])
  const [dbStepsCache, setDbStepsCache] = useState<Record<string, StepTemplate[]>>({})
  const [sensorData, setSensorData] = useState<{ oven1Temp?: number; oven2Temp?: number; humidity?: number; power?: number }>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const alertFiredRef = useRef<Set<string>>(new Set())
  const channelRef = useRef<any>(null)

  // ── Load everything ─────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: ordData }, { data: webOrdData }, { data: prodData }, { data: batchData }, { data: completedData }] = await Promise.all([
        supabase.from('orders').select('id,order_number,customer_name,customer_address,items,status')
          .in('status', ['pending', 'processing', 'confirmed']).order('created_at', { ascending: true }),
        supabase.from('webshop_orders').select('id,order_number,customer_name,customer_address,items,status')
          .in('status', ['pending', 'processing', 'confirmed']).order('created_at', { ascending: true }),
        supabase.from('products').select('id,name,display_name,category,retail_price,wholesale_price').order('name'),
        supabase.from('production_batches')
          .select(`id,batch_number,recipe_id,batch_size,status,start_time,end_time,actual_yield,notes,created_at,
            products:products!production_batches_recipe_id_fkey(id,name,category)`)
          .in('status', ['planned', 'in_progress']).order('start_time', { ascending: true }),
        supabase.from('production_batches')
          .select('recipe_id')
          .eq('status', 'completed')
          .gte('end_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ])
      // Merge admin + webshop orders, tag source
      const ord: Order[] = [
        ...(ordData || []).map((o: any) => ({ ...o, source: 'admin' })),
        ...(webOrdData || []).map((o: any) => ({ ...o, source: 'webshop' })),
      ].sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      const prod: Product[] = prodData || []
      const batches: ProductionBatch[] = (batchData || []).map((b: any) => {
        const runtime = parseRuntime(b.notes)
        // weighing_confirmed: DB oszlop → notes JSON gyökér → rt.weighing_confirmed
        const wc = b.weighing_confirmed || parseWeighingConfirmed(b.notes) || false
        return {
          ...b,
          product_name: b.products?.name || '—',
          product_category: b.products?.category || '—',
          runtime,
          weighing_confirmed: wc,
        }
      })
      const completedRecipes = new Set<string>((completedData || []).map((b: any) => b.recipe_id))
      setOrders(ord)
      setProducts(prod)
      setActiveBatches(batches)
      setCompletedBatchRecipes(completedRecipes)
      buildSummaries(ord, prod)
      if (batches.length > 0 && tab === 'orders') setTab('active')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Load recipe steps from DB for a product ──────────
  const loadDbSteps = useCallback(async (productId: string): Promise<StepTemplate[]> => {
    if (dbStepsCache[productId]) return dbStepsCache[productId]
    try {
      const { data, error } = await supabase
        .from('recipe_steps')
        .select('id, step_number, title, description, duration_minutes, temperature, humidity, type')
        .eq('recipe_id', productId)
        .order('step_number', { ascending: true })
      if (error || !data || data.length === 0) return []
      const steps: StepTemplate[] = data.map(row => ({
        id: row.id,
        title: row.title,
        duration_minutes: row.duration_minutes || 15,
        type: (row.type || 'prep') as StepTemplate['type'],
        note: row.description || '',
      }))
      setDbStepsCache(prev => ({ ...prev, [productId]: steps }))
      return steps
    } catch { return [] }
  }, [dbStepsCache])

  // ── Sensor polling (every 30s, mock + real) ──────────
  useEffect(() => {
    const pollSensors = async () => {
      try {
        // Try to get latest sensor readings from DB (saved by Sensors page)
        const { data } = await supabase
          .from('sensor_data')
          .select('device_id, temperature, humidity, power')
          .order('created_at', { ascending: false })
          .limit(10)
        if (data && data.length > 0) {
          const oven1 = data.find((d: any) => d.device_id?.includes('OVEN_1') || d.device_id === '1728053249')
          const oven2 = data.find((d: any) => d.device_id?.includes('OVEN_2') || d.device_id === '1728053250')
          const prod = data.find((d: any) => d.device_id?.includes('PROD') || d.device_id === '1728053253')
          setSensorData({
            oven1Temp: oven1?.temperature || undefined,
            oven2Temp: oven2?.temperature || undefined,
            humidity: prod?.humidity || undefined,
            power: prod?.power || undefined,
          })
        }
      } catch { /* sensor_data table might not exist yet */ }
    }
    pollSensors()
    const interval = setInterval(pollSensors, 30000)
    return () => clearInterval(interval)
  }, [])

  // ── Realtime subscription ───────────────────────────
  useEffect(() => {
    channelRef.current = supabase
      .channel('production-live-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_batches' }, async (payload: any) => {
        // Aktív (in_progress) batchek frissítése
        const { data: active } = await supabase.from('production_batches')
          .select(`id,batch_number,recipe_id,batch_size,status,start_time,end_time,actual_yield,notes,created_at,
            products:products!production_batches_recipe_id_fkey(id,name,category)`)
          .in('status', ['planned', 'in_progress']).order('start_time', { ascending: true })
        if (active) {
          setActiveBatches(active.map((b: any) => {
            const runtime = parseRuntime(b.notes)
            const wc = b.weighing_confirmed || parseWeighingConfirmed(b.notes) || false
            return {
              ...b,
              product_name: b.products?.name || '—',
              product_category: b.products?.category || '—',
              runtime,
              weighing_confirmed: wc,
            }
          }))
        }
        // Elvégzett batchek frissítése (mai nap)
        const { data: done } = await supabase.from('production_batches')
          .select('recipe_id')
          .eq('status', 'completed')
          .gte('end_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        if (done) {
          setCompletedBatchRecipes(new Set(done.map((b: any) => b.recipe_id)))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadAll()
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  // ── Timer engine (client-side, driven by DB timestamps) ──
  useEffect(() => {
    const interval = setInterval(() => {
      const newTimers: Record<string, number> = {}
      for (const b of activeBatches) {
        const rt = b.runtime
        if (!rt || b.status !== 'in_progress') continue
        const step = rt.steps[rt.current_step_index]
        if (!step) continue
        if (rt.paused) {
          newTimers[b.id] = step.duration_minutes * 60
          continue
        }
        const elapsed = Math.floor((Date.now() - new Date(rt.step_started_at).getTime()) / 1000)
        const remaining = Math.max(0, step.duration_minutes * 60 - elapsed)
        newTimers[b.id] = remaining

        // Fire alert when time is up
        const alertKey = `${b.id}_${rt.current_step_index}`
        if (remaining === 0 && !alertFiredRef.current.has(alertKey)) {
          alertFiredRef.current.add(alertKey)
          fireAlert(b.product_name || '?', step.title)
        }
      }
      setTimers(newTimers)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeBatches])

  function fireAlert(productName: string, stepTitle: string) {
    if (!audioRef.current) audioRef.current = new Audio('/figyelem.mp3')
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(() => {})
    setTimeout(() => {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(`Figyelem! ${productName} – ${stepTitle} fázis lejárt! Kérem intézkedjen!`)
        u.lang = 'hu-HU'; u.rate = 0.9
        window.speechSynthesis.speak(u)
      }
    }, 1000)
    toast.custom(
      <div className="flex items-center gap-3 bg-red-950 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl shadow-2xl">
        <Bell className="text-red-400 animate-bounce" size={18}/>
        <span className="font-bold text-sm">{productName}: {stepTitle} — LEJÁRT!</span>
      </div>, { duration: 10000 }
    )
  }

  // ── Build order summaries ───────────────────────────
  function buildSummaries(ord: Order[], prod: Product[]) {
    const map: Record<string, ProductSummary> = {}
    for (const o of ord) {
      const items: OrderItem[] = Array.isArray(o.items) ? o.items : []
      for (const item of items) {
        const pid = item.product_id
        const p = prod.find(x => x.id === pid)
        const wkg = detectWeight(item.product_name || p?.name || '', p?.weight_kg)
        if (!map[pid]) {
          const ingTotal: { name: string; total: number; unit: string }[] = []
          if (p?.ingredients) {
            for (const ing of p.ingredients) {
              const amt = typeof ing.amount === 'string' ? parseFloat((ing.amount as string).replace(',', '.')) : ing.amount
              const existing = ingTotal.find(i => i.name === ing.name && i.unit === ing.unit)
              if (existing) existing.total += 0 // will compute after
              else ingTotal.push({ name: ing.name, total: 0, unit: ing.unit })
            }
          }
          map[pid] = {
            product_id: pid,
            product_name: p?.display_name || item.product_name || item.name || p?.name || 'Ismeretlen termék',
            category: p?.category || '—',
            weight_kg: wkg,
            total_qty: 0,
            oven_rounds: 0,
            kneading_batches: [],
            customers: [],
            ingredients_total: [],
          }
        }
        map[pid].total_qty += item.quantity
        map[pid].customers.push({
          name: o.customer_name, qty: item.quantity,
          order_number: o.order_number, order_id: o.id,
          address: o.customer_address
        })
      }
    }
    // Calculate oven rounds, kneading, ingredients
    for (const s of Object.values(map)) {
      const cap = ovenCapacity(s.weight_kg)
      s.oven_rounds = Math.ceil(s.total_qty / cap)
      s.kneading_batches = calcKneading(s.total_qty, s.weight_kg)
      // Ingredient totals
      const p = prod.find(x => x.id === s.product_id)
        if (p?.ingredients && p.yield_amount) {
        const mult = s.total_qty / p.yield_amount
        const ingMap: Record<string, { total: number; unit: string }> = {}
        for (const ing of p.ingredients) {
          const amt = typeof ing.amount === 'string' ? parseFloat((ing.amount as string).replace(',', '.')) : ing.amount
          const key = `${ing.name}|${ing.unit}`
          if (!ingMap[key]) ingMap[key] = { total: 0, unit: ing.unit }
          ingMap[key].total += amt * mult
        }
        s.ingredients_total = Object.entries(ingMap).map(([k, v]) => ({
          name: k.split('|')[0], total: parseFloat(v.total.toFixed(2)), unit: v.unit
        }))
      }
    }
    setSummaries(Object.values(map).sort((a, b) => b.total_qty - a.total_qty))
  }

  // ── Start production for a product ──────────────────
  async function startProduction(s: ProductSummary) {
    if (activeBatches.find(b => b.recipe_id === s.product_id)) {
      toast.error('Ez a termék már folyamatban van!')
      return
    }
    if (completedBatchRecipes.has(s.product_id)) {
      const confirmed = window.confirm(`${s.product_name} ma már le lett gyártva. Biztosan újraindítod?`)
      if (!confirmed) return
    }
    setSaving('new')
    // Try to load steps from recipe_steps DB table first
    const dbSteps = await loadDbSteps(s.product_id)
    const steps: StepTemplate[] = dbSteps.length > 0 ? dbSteps : getSteps(s.weight_kg)
    const rt: RuntimeState = {
      current_step_index: 0,
      step_started_at: new Date().toISOString(),
      current_oven_round: 1,
      total_oven_rounds: s.oven_rounds,
      paused: false,
      steps,
      total_qty: s.total_qty,
      weight_kg: s.weight_kg,
      user_notes: '',
    }
    try {
      const { data, error } = await supabase.from('production_batches').insert({
        batch_number: `GY-${Date.now().toString().slice(-7)}`,
        recipe_id: s.product_id,
        batch_size: s.total_qty,
        status: 'in_progress',
        start_time: new Date().toISOString(),
        notes: serializeNotes(rt),
      }).select().single()
      if (error) throw error
      toast.success(`${s.product_name} gyártás elindult! ${dbSteps.length > 0 ? '(Receptből betöltött lépések)' : '(Alapértelmezett lépések)'}`)
      setTab('active')
      setSelectedBatchId(data.id)
      // Azonnal frissítjük a listát – ne kelljen realtime-ra várni
      await loadAll()
    } catch (e: any) {
      toast.error('Hiba az indításkor: ' + e.message)
    } finally {
      setSaving(null)
    }
  }

  // ── Advance to next step (saves to DB → realtime broadcast) ──
  async function nextStep(batch: ProductionBatch) {
    if (!batch.runtime) return
    setSaving(batch.id)
    const rt = { ...batch.runtime }
    const nextIdx = rt.current_step_index + 1
    alertFiredRef.current.delete(`${batch.id}_${rt.current_step_index}`)

    if (nextIdx >= rt.steps.length) {
      // All steps done → complete
      await completeBatch(batch)
      return
    }

    // Update oven round when baking step repeats
    const nextStep = rt.steps[nextIdx]
    let newOvenRound = rt.current_oven_round
    if (nextStep.type === 'baking' && rt.current_oven_round < rt.total_oven_rounds) {
      newOvenRound = rt.current_oven_round + 1
    }

    const updatedRt: RuntimeState = {
      ...rt,
      current_step_index: nextIdx,
      step_started_at: new Date().toISOString(),
      current_oven_round: newOvenRound,
      paused: false,
    }
    const { error } = await supabase.from('production_batches').update({
      notes: serializeNotes(updatedRt, rt.user_notes),
    }).eq('id', batch.id)
    if (error) {
      toast.error('DB mentési hiba: ' + error.message)
    } else {
      // Azonnal frissítjük a lokális state-et – ne kelljen realtime-ra várni
      setActiveBatches(prev => prev.map(b =>
        b.id === batch.id ? { ...b, runtime: updatedRt } : b
      ))
    }
    setSaving(null)
  }

  // ── Pause / resume ──────────────────────────────────
  async function togglePause(batch: ProductionBatch) {
    if (!batch.runtime) return
    setSaving(batch.id)
    const rt = batch.runtime
    const updatedRt: RuntimeState = {
      ...rt,
      paused: !rt.paused,
      paused_at: !rt.paused ? new Date().toISOString() : undefined,
      // When resuming: adjust step_started_at to compensate for pause duration
      step_started_at: rt.paused && rt.paused_at
        ? new Date(new Date(rt.step_started_at).getTime() + (Date.now() - new Date(rt.paused_at).getTime())).toISOString()
        : rt.step_started_at,
    }
    const { error } = await supabase.from('production_batches').update({
      notes: serializeNotes(updatedRt, rt.user_notes),
    }).eq('id', batch.id)
    if (!error) {
      setActiveBatches(prev => prev.map(b =>
        b.id === batch.id ? { ...b, runtime: updatedRt } : b
      ))
    }
    setSaving(null)
  }

  // ── Save edited order items ───────────────────────────
  async function saveOrderEdit() {
    if (!editingOrder) return
    setSaving('order-edit')
    try {
      const { error } = await supabase.from('orders').update({ items: editOrderItems }).eq('id', editingOrder.id)
      if (error) throw error
      toast.success('Rendelés frissítve!')
      setEditingOrder(null)
      setEditOrderItems([])
      await loadAll()
    } catch (e: any) {
      toast.error('Mentési hiba: ' + e.message)
    } finally {
      setSaving(null)
    }
  }

  // ── Delete batch ─────────────────────────────────────
  async function deleteBatch(batch: ProductionBatch) {
    if (!confirm(`Biztosan törlöd a(z) "${batch.product_name}" gyártási tételt?\nEz az adatból is törlődik.`)) return
    setSaving(batch.id)
    try {
      const { error } = await supabase.from('production_batches').delete().eq('id', batch.id)
      if (error) throw error
      toast.success(`🗑️ ${batch.product_name} gyártási tétel törölve.`)
      loadAll()
    } catch (e: any) {
      toast.error('Törlési hiba: ' + e.message)
    } finally {
      setSaving(null)
    }
  }

  // ── Stop (fail) batch ────────────────────────────────
  async function stopBatch(batch: ProductionBatch) {
    if (!confirm(`Leállítod a(z) "${batch.product_name}" gyártást? Az állapot "sikertelen" lesz.`)) return
    setSaving(batch.id)
    try {
      const { error } = await supabase.from('production_batches').update({
        status: 'failed',
        end_time: new Date().toISOString(),
      }).eq('id', batch.id)
      if (error) throw error
      toast.success(`⛔ ${batch.product_name} gyártás leállítva.`)
      loadAll()
    } catch (e: any) {
      toast.error('Leállítási hiba: ' + e.message)
    } finally {
      setSaving(null)
    }
  }

  // ── Restart batch (reset to step 0) ──────────────────
  async function restartBatch(batch: ProductionBatch) {
    if (!confirm(`Újraindítod a(z) "${batch.product_name}" gyártást az elejéről?`)) return
    setSaving(batch.id)
    try {
      const steps = batch.runtime?.steps || getSteps(1)
      const newRt: RuntimeState = {
        current_step_index: 0,
        step_started_at: new Date().toISOString(),
        current_oven_round: 1,
        total_oven_rounds: batch.runtime?.total_oven_rounds || 1,
        paused: false,
        steps,
        total_qty: batch.runtime?.total_qty || batch.batch_size,
        weight_kg: batch.runtime?.weight_kg || 1,
        user_notes: batch.runtime?.user_notes || '',
      }
      const { error } = await supabase.from('production_batches').update({
        status: 'in_progress',
        start_time: new Date().toISOString(),
        end_time: null,
        notes: serializeNotes(newRt, newRt.user_notes),
      }).eq('id', batch.id)
      if (error) throw error
      toast.success(`🔄 ${batch.product_name} újraindítva az elejéről.`)
      loadAll()
    } catch (e: any) {
      toast.error('Újraindítási hiba: ' + e.message)
    } finally {
      setSaving(null)
    }
  }

  // ── Complete batch + auto-generate delivery notes ───
  async function completeBatch(batch: ProductionBatch) {
    setSaving(batch.id)
    try {
      // Mark batch as completed
      await supabase.from('production_batches').update({
        status: 'completed',
        end_time: new Date().toISOString(),
        actual_yield: batch.runtime?.total_qty || batch.batch_size,
      }).eq('id', batch.id)

      // Find orders for this product and auto-create delivery notes
      const relevantOrders = orders.filter(o =>
        o.items.some(item => item.product_id === batch.recipe_id)
      )

      // Create one delivery note per customer/order
      for (const ord of relevantOrders) {
        const relevantItems = ord.items.filter(i => i.product_id === batch.recipe_id)
        if (relevantItems.length === 0) continue
        // Enrich items with product info (price) for invoice generation
        const enrichedItems = relevantItems.map((item: OrderItem) => {
          const product = products.find(p => p.id === item.product_id)
          const unitPrice = item.unit_price ?? (item as any).price ?? product?.retail_price ?? product?.wholesale_price ?? 0
          return {
            product_id: item.product_id,
            // Use display_name for delivery/invoice documents when available, otherwise fall back
            product_name: product?.display_name || item.product_name || item.name || product?.name || batch.product_name || 'Ismeretlen',
            quantity: item.quantity,
            unit_price: unitPrice,
            total_price: item.quantity * unitPrice,
          }
        })
        const { error: dnError } = await supabase.from('delivery_notes').insert({
          order_id: ord.id,
          order_number: ord.order_number,
          batch_id: batch.id,
          status: 'pending',
          customer_name: ord.customer_name,
          customer_address: ord.customer_address,
          items: enrichedItems,
          notes: `Automatikusan létrehozva – ${batch.batch_number}`,
        })
        if (dnError) console.error('Delivery note error:', dnError)
      }

      toast.success(`✅ ${batch.product_name} kész! Szállítólevelek elkészültek.`)
      setTimeout(() => navigate('/delivery-notes'), 1500)
    } catch (e: any) {
      toast.error('Hiba: ' + e.message)
    } finally {
      setSaving(null)
    }
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  const alertCount = activeBatches.filter(b => {
    const rt = b.runtime
    if (!rt || rt.paused) return false
    const rem = timers[b.id]
    return rem === 0
  }).length

  const selectedBatch = activeBatches.find(b => b.id === selectedBatchId) || activeBatches[0] || null

  // Consolidated ingredient view across all planned products
  const allIngredients: Record<string, { total: number; unit: string; breakdown: { product: string; amount: number }[] }> = {}
  for (const s of summaries) {
    for (const ing of s.ingredients_total) {
      const key = `${ing.name}|${ing.unit}`
      if (!allIngredients[key]) allIngredients[key] = { total: 0, unit: ing.unit, breakdown: [] }
      allIngredients[key].total += ing.total
      allIngredients[key].breakdown.push({ product: s.product_name, amount: ing.total })
    }
  }

  // ── Compute machine status from active batches ────────
  const machineStatus = {
    kneaderLarge: activeBatches.some(b => {
      const rt = b.runtime; if (!rt) return false
      return rt.steps[rt.current_step_index]?.type === 'kneading'
    }),
    kneaderSmall: false, // external – not tracked yet
    ovenA: activeBatches.some(b => {
      const rt = b.runtime; if (!rt) return false
      return rt.steps[rt.current_step_index]?.type === 'baking'
    }),
    ovenB: activeBatches.some(b => {
      const rt = b.runtime; if (!rt) return false
      return rt.steps[rt.current_step_index]?.type === 'baking'
    }),
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-gray-900 text-white' : 'bg-slate-50 text-slate-900'}`}>

      {/* ─── HEADER ─── */}
      <header className={`flex-shrink-0 flex items-center justify-between px-4 py-2.5 z-10 ${isDark ? 'border-b border-white/5 bg-gray-900' : 'border-b border-slate-200 bg-white shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <ChefHat className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className={`text-lg font-black leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>Gyártásirányítás</h1>
            <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5 ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
              Live – minden felhasználó ugyanezt látja
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          {[
            { label: 'Sütő A', icon: <Flame size={11}/>, busy: machineStatus.ovenA, color: 'text-red-400' },
            { label: 'Sütő B', icon: <Flame size={11}/>, busy: machineStatus.ovenB, color: 'text-red-400' },
            { label: 'Dagasztó 160kg', icon: <Activity size={11}/>, busy: machineStatus.kneaderLarge, color: 'text-amber-400' },
            { label: 'Dagasztó 85kg', icon: <Activity size={11}/>, busy: machineStatus.kneaderSmall, color: 'text-blue-400' },
          ].map(m => (
            <div key={m.label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${isDark ? 'bg-gray-900 border border-white/8 text-gray-300' : 'bg-white border border-slate-200 text-slate-700'} ${m.color}`}>
              {m.icon} <span>{m.label}</span>
              <span className={`ml-1 ${m.busy ? 'text-red-500 animate-pulse' : 'text-emerald-600'}`}>
                ● {m.busy ? 'FOGLALT' : 'szabad'}
              </span>
            </div>
          ))}
          {/* Sensor strip */}
          {(sensorData.oven1Temp || sensorData.humidity) && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] ${isDark ? 'bg-gray-900 border border-blue-500/20' : 'bg-white border border-slate-200'}`}>
              {sensorData.oven1Temp && <span className={`${isDark ? 'text-red-300' : 'text-red-600'} font-bold`}><Flame size={10} className="inline mr-0.5"/>{sensorData.oven1Temp.toFixed(0)}°C</span>}
              {sensorData.humidity && <span className={`${isDark ? 'text-blue-300' : 'text-blue-600'} font-bold ml-1.5`}><Droplets size={10} className="inline mr-0.5"/>{sensorData.humidity.toFixed(0)}%</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {alertCount > 0 && (
            <button onClick={() => setTab('active')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/60 border border-red-500/50 rounded-lg animate-pulse">
              <Bell size={13} className="text-red-400"/>
              <span className="text-[11px] font-black text-red-300">{alertCount} FIGYELEM!</span>
            </button>
          )}
          <button onClick={loadAll} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 transition-all">
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-400' : ''}/>
          </button>
        </div>
      </header>

      {/* ─── TABS ─── */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-white/5">
        {([
          { id: 'orders', label: 'Rendelések', icon: <ShoppingBag size={13}/>, badge: summaries.length },
          { id: 'plan',   label: 'AI Gyártási Terv', icon: <TrendingUp size={13}/>, badge: summaries.length },
          { id: 'active', label: 'Aktív Gyártások', icon: <Flame size={13}/>, badge: activeBatches.length, alert: alertCount > 0 },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === t.id ? 'bg-white text-black' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/8 border border-white/8'
            }`}>
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                tab === t.id ? 'bg-black/20' : (t as any).alert ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500/20 text-amber-400'
              }`}>{t.badge}</span>
            )}
          </button>
        ))}
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => navigate('/delivery-notes')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-all">
            <Truck size={12}/> Szállítólevelek
          </button>
          <button onClick={() => navigate('/invoices')}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-bold transition-all">
            <FileText size={12}/> Számlák
          </button>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-hidden">

        {/* ══ TAB: RENDELÉSEK ══ */}
        {tab === 'orders' && (
          <div className="h-full overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="animate-spin text-amber-400" size={28}/>
              </div>
            ) : summaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Package className="h-14 w-14 text-gray-700 mb-3"/>
                <p className="text-gray-400 font-bold">Nincs aktív rendelés</p>
                <p className="text-gray-600 text-sm mt-1">A rendelések automatikusan megjelennek és gyűlnek</p>
              </div>
            ) : (
              <>
                {/* Stat bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Termékféle', val: summaries.length, color: 'text-amber-400' },
                    { label: 'Összes darab', val: summaries.reduce((a,s)=>a+s.total_qty,0), color: 'text-white' },
                    { label: 'Partner', val: new Set(orders.map(o=>o.customer_name)).size, color: 'text-blue-400' },
                    { label: 'Rendelés db', val: orders.length, color: 'text-emerald-400' },
                  ].map(st => (
                    <div key={st.label} className="bg-gray-900 border border-white/8 rounded-xl p-3.5">
                      <p className={`text-2xl font-black ${st.color}`}>{st.val}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{st.label}</p>
                    </div>
                  ))}
                </div>

                {/* Product cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {summaries.map(s => (
                    <div key={s.product_id} className="bg-gray-900 border border-white/8 rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-white/5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{s.category}</p>
                            <h3 className="text-base font-black text-white mt-0.5">{s.product_name}</h3>
                            <p className="text-xs text-gray-500">{s.weight_kg}kg/db</p>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-black text-amber-400">{s.total_qty}</p>
                            <p className="text-[10px] text-gray-600 font-bold">db összesen</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-red-950/40 border border-red-500/20 rounded-xl p-2.5">
                            <div className="flex items-center gap-1 mb-1">
                              <Flame size={11} className="text-red-400"/>
                              <span className="text-[10px] font-black text-red-300">Sütési körök</span>
                            </div>
                            <p className="text-xl font-black text-white">{s.oven_rounds}<span className="text-sm text-gray-500 ml-1">kör</span></p>
                            <p className="text-[10px] text-gray-600">{ovenCapacity(s.weight_kg)} db/kör</p>
                          </div>
                          <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-2.5">
                            <div className="flex items-center gap-1 mb-1">
                              <Activity size={11} className="text-blue-400"/>
                              <span className="text-[10px] font-black text-blue-300">Dagasztás</span>
                            </div>
                            <p className="text-xl font-black text-white">{s.kneading_batches.length}<span className="text-sm text-gray-500 ml-1">kör</span></p>
                            <p className="text-[10px] text-gray-600">max {LARGE_KNEADER}kg/kör</p>
                          </div>
                        </div>
                      </div>

                      {/* Dagasztási részlet */}
                      {s.kneading_batches.length > 0 && (
                        <div className="px-4 py-2.5 border-b border-white/5 bg-black/10">
                          <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5">Dagasztási terv</p>
                          {s.kneading_batches.map(kb => (
                            <div key={kb.batch_no} className="flex justify-between text-[11px] mb-1">
                              <span className="text-gray-400">{kb.batch_no}. kör – {kb.dough_kg <= SMALL_KNEADER ? 'kis (85kg)' : 'nagy (160kg)'}</span>
                              <span className="text-amber-400 font-black">{kb.dough_kg} kg</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Megrendelők – összevonva, szállítóval szeparálódik */}
                      <div className="px-4 py-2.5">
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5">
                          Megrendelők ({s.customers.length} partner) – szállítólevéllel szeparálódik
                        </p>
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {s.customers.map((c, i) => (
                            <div key={i} className="flex items-center justify-between py-1 border-b border-white/3 last:border-0">
                              <span className="text-xs font-semibold text-blue-300 truncate mr-2">{c.name}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] font-mono text-gray-600">{c.order_number}</span>
                                <span className="text-xs font-black text-white bg-white/8 px-1.5 py-0.5 rounded">{c.qty} db</span>
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    const ord = orders.find(o => o.id === c.order_id)
                                    if (ord) { setEditingOrder(ord); setEditOrderItems(JSON.parse(JSON.stringify(ord.items))) }
                                  }}
                                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-all"
                                  title="Rendelés szerkesztése"
                                >
                                  <Edit2 size={10}/>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Összes kimérés szekció */}
                {Object.keys(allIngredients).length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Scale size={13} className="text-amber-400"/> Összesített kimérés – összes termék
                    </h2>
                    <div className="bg-gray-900 border border-white/8 rounded-2xl overflow-hidden">
                      <div className="divide-y divide-white/5">
                        {Object.entries(allIngredients).map(([key, val]) => {
                          const name = key.split('|')[0]
                          const kneadRounds = Math.ceil(val.total / LARGE_KNEADER)
                          return (
                            <div key={key} className="px-5 py-3.5 flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-black text-white">{name}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {val.breakdown.map((bp, i) => (
                                    <span key={i} className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                                      {bp.product}: {bp.amount.toFixed(1)} {val.unit}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-2xl font-black text-amber-400">{val.total.toFixed(1)}</p>
                                <p className="text-xs text-gray-500">{val.unit}</p>
                                {kneadRounds > 1 && (
                                  <p className="text-[10px] text-blue-400 font-bold mt-0.5">{kneadRounds}× {LARGE_KNEADER}kg kör</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ TAB: AI TERV ══ */}
        {tab === 'plan' && (
          <div className="h-full overflow-y-auto p-4">
            {summaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <TrendingUp className="h-14 w-14 text-gray-700 mb-3"/>
                <p className="text-gray-400 font-bold">Nincs rendelés a tervezéshez</p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-amber-950/30 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                  <Zap className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-xs font-black text-amber-400 uppercase tracking-widest">AI Gyártási Terv</p>
                    <p className="text-sm text-gray-300 mt-1">
                      <strong className="text-white">{summaries.length} termék</strong>, összesen{' '}
                      <strong className="text-amber-300">{summaries.reduce((a,s)=>a+s.total_qty,0)} db</strong>.
                      Párhuzamos indítással a gyártási idő csökkenthető. Az összes rendelés egyetlen gyártási tételbe kerül – a szállítólevelek automatikusan partnerenként szeparálódnak.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {summaries.map((s, idx) => {
                    const isRunning = activeBatches.some(b => b.recipe_id === s.product_id)
                    const isCompleted = completedBatchRecipes.has(s.product_id)
                    const dbS = dbStepsCache[s.product_id] || getSteps(s.weight_kg)
                    const totalMins = dbS.reduce((a,st)=>a+st.duration_minutes,0)
                      + (s.oven_rounds - 1) * 55
                    const expanded = showPlanDetail === s.product_id
                    return (
                      <div key={s.product_id} className="bg-gray-900 border border-white/8 rounded-2xl overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                                idx === 0 ? 'bg-amber-500 text-black' : 'bg-white/10 text-gray-400'
                              }`}>{idx + 1}</div>
                              <div>
                                <h3 className="text-base font-black text-white">{s.product_name}</h3>
                                <p className="text-xs text-gray-500">{s.total_qty} db • {s.oven_rounds} sütési kör • {s.kneading_batches.length} dagasztás • ~{formatDur(totalMins)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => { setShowPlanDetail(expanded ? null : s.product_id); if (!expanded) loadDbSteps(s.product_id); }}
                                className="p-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl text-gray-400 transition-all">
                                <Eye size={13}/>
                              </button>
                              {isRunning ? (
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-900/30 border border-blue-500/30 rounded-xl text-xs font-bold text-blue-300">
                                  <Activity size={12} className="animate-pulse"/> Fut
                                </div>
                              ) : isCompleted ? (
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-900/30 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-400" title="Ma már legyártva">
                                  <CheckCircle size={12}/> Kész ✓
                                </div>
                              ) : (
                                <button onClick={() => startProduction(s)} disabled={saving === 'new'}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/20">
                                  {saving === 'new' ? <Loader2 size={13} className="animate-spin"/> : <Play size={13}/>}
                                  Indítás
                                </button>
                              )}
                            </div>
                          </div>

                          {expanded && (
                            <div className="mt-4 space-y-3">
                              {/* Steps preview – from DB if available, else fallback */}
                              <div className="flex flex-wrap gap-1.5">
                                {dbS.map((step, i) => {
                                  const st = STEP_STYLE[step.type] || STEP_STYLE['prep']
                                  return (
                                    <div key={step.id || i} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${st.bg} ${st.color}`}>
                                      {st.icon} {step.title} ({step.duration_minutes}p)
                                    </div>
                                  )
                                })}
                                {dbStepsCache[s.product_id] && (
                                  <span className="text-[10px] text-emerald-400 font-bold px-2 py-1">✓ receptből</span>
                                )}
                              </div>
                              {/* Oven rounds */}
                              <div>
                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1.5">Sütési körök elosztása</p>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from({ length: s.oven_rounds }, (_, i) => {
                                    const cap = ovenCapacity(s.weight_kg)
                                    const rem = s.total_qty - i * cap
                                    const thisRound = Math.min(rem, cap)
                                    const perOven = Math.ceil(thisRound / OVEN_COUNT)
                                    return (
                                      <div key={i} className="bg-red-950/30 border border-red-500/20 rounded-xl px-3 py-2 text-xs">
                                        <p className="font-black text-red-300">{i+1}. kör – {thisRound} db</p>
                                        <p className="text-gray-500 mt-0.5">A: {perOven} db  B: {Math.max(0, thisRound - perOven)} db</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ TAB: AKTÍV GYÁRTÁSOK ══ */}
        {tab === 'active' && (
          <div className="h-full flex overflow-hidden">
            {/* Left sidebar: batch list */}
            <div className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col">
              <div className="p-3 border-b border-white/5">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Párhuzamos gyártások</p>
                <p className="text-[10px] text-gray-700 mt-0.5">Realtime – minden felhasználónál frissül</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {activeBatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10 px-3">
                    <Flame className="h-8 w-8 text-gray-700 mb-2"/>
                    <p className="text-gray-600 text-xs font-bold">Nincs aktív gyártás</p>
                    <button onClick={() => setTab('plan')} className="mt-2 text-amber-400 text-xs font-bold hover:text-amber-300">
                      → Indítás a tervből
                    </button>
                  </div>
                ) : activeBatches.map(b => {
                  const rt = b.runtime
                  const step = rt?.steps[rt.current_step_index]
                  const rem = timers[b.id] ?? (step ? step.duration_minutes * 60 : 0)
                  const isSelected = selectedBatchId === b.id || (!selectedBatchId && activeBatches[0]?.id === b.id)
                  const isAlert = rem === 0 && !rt?.paused
                  const progress = step ? Math.min(100, (1 - rem / (step.duration_minutes * 60)) * 100) : 0
                  return (
                    <button key={b.id} onClick={() => setSelectedBatchId(b.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected ? 'bg-white/8 border-amber-500/40'
                        : isAlert ? 'bg-red-950/30 border-red-500/40 animate-pulse'
                        : rt?.paused ? 'bg-yellow-950/20 border-yellow-500/20'
                        : 'bg-white/3 border-white/8 hover:border-white/15'
                      }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-white truncate mr-2">{b.product_name}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            isAlert ? 'bg-red-400 animate-ping'
                            : rt?.paused ? 'bg-yellow-400'
                            : 'bg-blue-400 animate-pulse'
                          }`}/>
                          <button
                            onClick={e => { e.stopPropagation(); deleteBatch(b); }}
                            title="Tétel törlése"
                            className="text-red-500/60 hover:text-red-400 transition-colors flex-shrink-0">
                            <X size={12}/>
                          </button>
                        </div>
                      </div>
                      {step && (
                        <>
                          <p className="text-[10px] text-gray-500 truncate">{step.title}</p>
                          <div className="mt-1.5">
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${isAlert ? 'bg-red-500' : 'bg-amber-500'}`}
                                   style={{ width: `${progress}%` }}/>
                            </div>
                            <p className={`text-[10px] font-mono mt-0.5 font-bold ${rem === 0 ? 'text-red-400' : 'text-gray-500'}`}>
                              {rt?.paused ? '⏸ Szünet' : rem === 0 ? '⚠ LEJÁRT' : formatMMSS(rem)}
                            </p>
                          </div>
                        </>
                      )}
                      <p className="text-[10px] text-gray-700 mt-1">{b.batch_size} db • {b.batch_number}</p>
                    </button>
                  )
                })}
              </div>
              <div className="p-2 border-t border-white/5 space-y-1.5">
                <button onClick={() => setTab('plan')}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-black transition-all">
                  <Plus size={13}/> Új gyártás
                </button>
                {activeBatches.length > 1 && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Biztosan törlöd az összes ${activeBatches.length} gyártási tételt?`)) return
                      for (const b of activeBatches) await deleteBatch(b)
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-black transition-all">
                    <X size={13}/> Összes törlése ({activeBatches.length})
                  </button>
                )}
              </div>
            </div>

            {/* Right: step controller */}
            <div className="flex-1 overflow-y-auto">
              {!selectedBatch ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <Eye className="h-12 w-12 text-gray-700 mx-auto mb-3"/>
                    <p className="text-gray-500 font-bold">Válassz gyártást a részletekhez</p>
                  </div>
                </div>
              ) : (() => {
                const rt = selectedBatch.runtime
                if (!rt) return (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto mb-2"/>
                      <p className="text-gray-400 mb-1">Hiányzó futásidő-adatok</p>
                      <p className="text-gray-600 text-xs mb-4">{selectedBatch.product_name} • {selectedBatch.batch_number}</p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => restartBatch(selectedBatch)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
                          <RefreshCw size={13}/> Újraindítás
                        </button>
                        <button
                          onClick={() => deleteBatch(selectedBatch)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all">
                          <X size={13}/> Törlés
                        </button>
                      </div>
                    </div>
                  </div>
                )
                const currentStep = rt.steps[rt.current_step_index]
                const rem = timers[selectedBatch.id] ?? (currentStep ? currentStep.duration_minutes * 60 : 0)
                const progress = currentStep ? Math.min(100, (1 - rem / (currentStep.duration_minutes * 60)) * 100) : 100
                const totalDone = rt.current_step_index
                const totalSteps = rt.steps.length
                const isAlert = rem === 0 && !rt.paused && currentStep
                const isSaving = saving === selectedBatch.id

                return (
                  <div className="p-5 h-full flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Pék Vezérlőpult – Live</p>
                        <h2 className="text-2xl font-black text-white mt-0.5">{selectedBatch.product_name}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {rt.total_qty} db • {rt.total_oven_rounds} sütési kör •
                          Indult: {selectedBatch.start_time ? new Date(selectedBatch.start_time).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'}) : '—'} •
                          <span className="text-gray-600 ml-1">{selectedBatch.batch_number}</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => togglePause(selectedBatch)} disabled={isSaving}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border disabled:opacity-40 ${
                            rt.paused
                              ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}>
                          {isSaving ? <Loader2 size={13} className="animate-spin"/> : rt.paused ? <><Play size={13}/> Folytatás</> : <><Pause size={13}/> Szünet</>}
                        </button>
                        {rt.current_step_index < rt.steps.length - 1 ? (
                          <button onClick={() => nextStep(selectedBatch)} disabled={isSaving || rt.paused}
                            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-xl text-xs font-black transition-all">
                            {isSaving ? <Loader2 size={13} className="animate-spin"/> : <SkipForward size={13}/>}
                            Következő lépés
                          </button>
                        ) : (
                          <button onClick={() => completeBatch(selectedBatch)} disabled={isSaving}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black rounded-xl text-xs font-black transition-all">
                            {isSaving ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle size={13}/>}
                            Gyártás lezárása
                          </button>
                        )}
                        {/* Extra controls: Restart, Stop, Delete */}
                        <div className="flex items-center gap-1 ml-auto">
                          <button onClick={() => restartBatch(selectedBatch)} disabled={isSaving}
                            title="Újrakezd az elejéről"
                            className="flex items-center gap-1 px-2 py-2 rounded-xl text-xs font-bold border border-white/10 text-blue-400 hover:bg-blue-900/30 disabled:opacity-40 transition-all">
                            <RefreshCw size={13}/> Újra
                          </button>
                          <button onClick={() => stopBatch(selectedBatch)} disabled={isSaving}
                            title="Gyártás leállítása"
                            className="flex items-center gap-1 px-2 py-2 rounded-xl text-xs font-bold border border-white/10 text-orange-400 hover:bg-orange-900/30 disabled:opacity-40 transition-all">
                            <X size={13}/> Stop
                          </button>
                          <button onClick={() => deleteBatch(selectedBatch)} disabled={isSaving}
                            title="Tétel törlése"
                            className="flex items-center gap-1 px-2 py-2 rounded-xl text-xs font-bold border border-white/10 text-red-400 hover:bg-red-900/30 disabled:opacity-40 transition-all">
                            <X size={13}/> Törlés
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── WEIGHING STEP (if not confirmed) ── */}
                    {!selectedBatch.weighing_confirmed ? (
                      <WeighingStep
                        batchId={selectedBatch.id}
                        batchSize={rt.total_qty}
                        recipeId={selectedBatch.recipe_id}
                        recipeName={selectedBatch.product_name}
                        onComplete={async () => {
                          // Teljes batch újratöltése – runtime/lépések is frissüljenek
                          const { data } = await supabase.from('production_batches')
                            .select(`id,batch_number,recipe_id,batch_size,status,start_time,end_time,actual_yield,notes,created_at,
                              products:products!production_batches_recipe_id_fkey(id,name,category)`)
                            .eq('id', selectedBatch.id).single()
                          if (data) {
                            const runtime = parseRuntime(data.notes)
                            const wc = data.weighing_confirmed || parseWeighingConfirmed(data.notes) || false
                            const refreshed: ProductionBatch = {
                              ...data,
                              product_name: data.products?.name || selectedBatch.product_name,
                              product_category: data.products?.category || selectedBatch.product_category,
                              runtime,
                              weighing_confirmed: wc,
                            }
                            setActiveBatches(prev => prev.map(b => b.id === selectedBatch.id ? refreshed : b))
                          }
                        }}
                      />
                    ) : (
                      <>
                    {/* Overall progress bar */}
                    <div className="bg-gray-900 border border-white/8 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-400 font-bold">Összesített előrehaladás</span>
                        <span className="text-xs font-black text-white">{totalDone}/{totalSteps} lépés</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                             style={{ width: `${(totalDone / totalSteps) * 100}%` }}/>
                      </div>
                    </div>

                    {/* Current step – big timer */}
                    {currentStep && (
                      <div className={`rounded-2xl border p-5 transition-all ${
                        isAlert ? 'bg-red-950/50 border-red-500/60 ring-1 ring-red-500/30'
                        : rt.paused ? 'bg-gray-900 border-yellow-500/30'
                        : 'bg-gray-900 border-white/10'
                      }`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black mb-2 ${STEP_STYLE[currentStep.type]?.bg} ${STEP_STYLE[currentStep.type]?.color}`}>
                              {STEP_STYLE[currentStep.type]?.icon} {currentStep.type.toUpperCase()}
                            </div>
                            <h3 className="text-xl font-black text-white">{currentStep.title}</h3>
                            <p className="text-xs text-gray-400 mt-1">{currentStep.note}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className={`text-5xl font-black font-mono leading-none ${
                              isAlert ? 'text-red-400 animate-pulse'
                              : rem < 60 ? 'text-yellow-400'
                              : rt.paused ? 'text-yellow-300'
                              : 'text-white'
                            }`}>
                              {rt.paused ? '⏸' : rem === 0 ? '⚠' : formatMMSS(rem)}
                            </p>
                            {isAlert && <p className="text-red-400 text-xs font-black animate-bounce mt-1">BEAVATKOZÁS!</p>}
                            {rt.paused && <p className="text-yellow-400 text-xs font-bold mt-1">Szüneteltetve</p>}
                          </div>
                        </div>
                        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            isAlert ? 'bg-red-500' : 'bg-gradient-to-r from-amber-600 to-amber-300'
                          }`} style={{ width: `${Math.min(100, progress)}%` }}/>
                        </div>
                      </div>
                    )}

                    {/* ── Kimérés panel – ha az aktuális lépés prep/kneading és kimérés ── */}
                    {currentStep && (currentStep.type === 'prep' || currentStep.type === 'kneading') && (() => {
                      const summary = summaries.find(s => s.product_id === selectedBatch.recipe_id)
                      if (!summary || summary.ingredients_total.length === 0) return null
                      return (
                        <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Scale size={14} className="text-amber-400"/>
                              <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest">
                                Kimérési lista – {rt.total_qty} db • {rt.weight_kg}kg/db
                              </p>
                            </div>
                            <button
                              onClick={() => setShowKimeresModal(true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition-all shadow-lg shadow-amber-500/30"
                            >
                              <Scale size={12}/> Nagy nézet
                            </button>
                          </div>
                          {/* Kneading batches breakdown */}
                          {summary.kneading_batches.length > 0 && (
                            <div className="space-y-3">
                              {summary.kneading_batches.map(kb => {
                                const ratio = kb.qty / summary.total_qty
                                const batchLabel = kb.dough_kg <= SMALL_KNEADER ? `Kis dagasztó (max ${SMALL_KNEADER}kg)` : `Nagy dagasztó (max ${LARGE_KNEADER}kg)`
                                return (
                                  <div key={kb.batch_no} className="bg-black/20 rounded-xl p-3">
                                    <p className="text-xs font-black text-white mb-2">
                                      {kb.batch_no}. dagasztási kör – {kb.dough_kg} kg tészta ({kb.qty} db) – {batchLabel}
                                    </p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {summary.ingredients_total.map(ing => {
                                        const batchAmt = (ing.total * ratio)
                                        return (
                                          <div key={ing.name} className="flex justify-between items-center bg-white/5 rounded-lg px-2.5 py-1.5">
                                            <span className="text-[11px] text-gray-300 truncate mr-2">{ing.name}</span>
                                            <span className="text-[11px] font-black text-amber-300 flex-shrink-0">
                                              {batchAmt >= 1000
                                                ? `${(batchAmt / 1000).toFixed(2)} kg`
                                                : `${batchAmt.toFixed(1)} ${ing.unit}`}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* ── KIMÉRÉSI MODAL – nagy számok ── */}
                    {showKimeresModal && (() => {
                      const summary = summaries.find(s => s.product_id === selectedBatch.recipe_id)
                      if (!summary) return null
                      return (
                        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col overflow-y-auto">
                          {/* Modal header */}
                          <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-amber-500/30 px-6 py-4 flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                              <Scale className="text-amber-400" size={24}/>
                              <div>
                                <h2 className="text-xl font-black text-white">KIMÉRÉSI LISTA</h2>
                                <p className="text-sm text-amber-400 font-bold">
                                  {selectedBatch.product_name} · {rt.total_qty} db · {rt.weight_kg} kg/db
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowKimeresModal(false)}
                              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
                            >
                              <X size={22}/>
                            </button>
                          </div>

                          {/* Batches */}
                          <div className="flex-1 p-6 space-y-8">
                            {summary.kneading_batches.map(kb => {
                              const ratio = kb.qty / summary.total_qty
                              const isLarge = kb.dough_kg > SMALL_KNEADER
                              return (
                                <div key={kb.batch_no} className="bg-gray-900 border border-white/10 rounded-3xl overflow-hidden">
                                  {/* Batch header */}
                                  <div className={`px-6 py-4 flex items-center justify-between ${isLarge ? 'bg-blue-950/60 border-b border-blue-500/30' : 'bg-purple-950/60 border-b border-purple-500/30'}`}>
                                    <div>
                                      <p className={`text-2xl font-black ${isLarge ? 'text-blue-300' : 'text-purple-300'}`}>
                                        {kb.batch_no}. dagasztási kör
                                      </p>
                                      <p className="text-base text-gray-400 font-bold mt-1">
                                        {isLarge ? `Nagy dagasztó (max ${LARGE_KNEADER}kg)` : `Kis dagasztó (max ${SMALL_KNEADER}kg)`}
                                        {' · '}{kb.dough_kg} kg tészta{' · '}{kb.qty} db kenyér
                                      </p>
                                    </div>
                                    <div className={`text-right ${isLarge ? 'text-blue-300' : 'text-purple-300'}`}>
                                      <p className="text-5xl font-black">{kb.dough_kg}</p>
                                      <p className="text-sm font-bold">kg tészta összesen</p>
                                    </div>
                                  </div>

                                  {/* Ingredients */}
                                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {summary.ingredients_total.map(ing => {
                                      const batchAmt = ing.total * ratio
                                      const displayAmt = batchAmt >= 1000
                                        ? `${(batchAmt / 1000).toFixed(3)} kg`
                                        : `${batchAmt.toFixed(1)}`
                                      const displayUnit = batchAmt >= 1000 ? '' : ing.unit
                                      return (
                                        <div key={ing.name} className="bg-black/30 border border-white/8 rounded-2xl p-5 flex flex-col justify-between">
                                          <p className="text-base font-bold text-gray-400 uppercase tracking-wide mb-2">{ing.name}</p>
                                          <div className="flex items-end gap-2">
                                            <span className="text-6xl font-black text-amber-400 leading-none">{displayAmt}</span>
                                            <span className="text-2xl font-bold text-amber-300 mb-1">{displayUnit}</span>
                                          </div>
                                          <p className="text-xs text-gray-600 mt-2">
                                            Összesen (összes kör): {ing.total.toFixed(1)} {ing.unit}
                                          </p>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}

                            {/* Grand total row */}
                            {summary.ingredients_total.length > 0 && (
                              <div className="bg-amber-950/30 border border-amber-500/30 rounded-3xl p-6">
                                <p className="text-lg font-black text-amber-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                                  <Scale size={18}/> Teljes receptura – {rt.total_qty} db
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {summary.ingredients_total.map(ing => (
                                    <div key={ing.name} className="bg-black/20 rounded-xl p-4 text-center">
                                      <p className="text-sm text-gray-500 mb-1">{ing.name}</p>
                                      <p className="text-4xl font-black text-white">
                                        {ing.total >= 1000 ? (ing.total / 1000).toFixed(2) : ing.total.toFixed(1)}
                                      </p>
                                      <p className="text-sm text-amber-400 font-bold">
                                        {ing.total >= 1000 ? 'kg' : ing.unit}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Close button bottom */}
                          <div className="sticky bottom-0 bg-black/90 backdrop-blur border-t border-white/10 p-4">
                            <button
                              onClick={() => setShowKimeresModal(false)}
                              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black text-lg rounded-2xl transition-all"
                            >
                              Kimérés kész – Bezárás
                            </button>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Oven round tracker */}
                    {rt.total_oven_rounds > 1 && (
                      <div className="bg-gray-900 border border-white/8 rounded-xl p-3">
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Sütési körök</p>
                        <div className="flex gap-2">
                          {Array.from({ length: rt.total_oven_rounds }, (_, i) => (
                            <div key={i} className={`flex-1 py-2 text-center text-xs font-black rounded-xl border ${
                              i < rt.current_oven_round - 1 ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                              : i === rt.current_oven_round - 1 ? 'bg-red-950/30 border-red-500/40 text-red-300'
                              : 'bg-white/3 border-white/5 text-gray-600'
                            }`}>{i + 1}. kör</div>
                          ))}
                        </div>
                      </div>
                    )}

                      </>
                    )}

                    {/* All steps grid */}
                    <div>
                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Összes lépés</p>
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                        {rt.steps.map((step, idx) => {
                          const isDone = idx < rt.current_step_index
                          const isCur = idx === rt.current_step_index
                          const st = STEP_STYLE[step.type]
                          return (
                            <div key={step.id} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                              isDone ? 'bg-emerald-950/20 border-emerald-500/20 opacity-70'
                              : isCur ? 'bg-white/8 border-amber-500/40 ring-1 ring-amber-500/20'
                              : 'bg-white/3 border-white/5 opacity-40'
                            }`}>
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isDone ? 'bg-emerald-500 text-black'
                                : isCur ? `${st?.bg} ${st?.color}`
                                : 'bg-white/5 text-gray-600'
                              }`}>
                                {isDone ? <CheckCircle size={12}/> : isCur ? st?.icon : <span className="text-[9px] font-black">{idx+1}</span>}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-[11px] font-bold truncate ${isDone ? 'text-emerald-300 line-through' : isCur ? 'text-white' : 'text-gray-600'}`}>
                                  {step.title}
                                </p>
                                <p className="text-[9px] text-gray-700">{step.duration_minutes}p</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ─── ORDER EDIT MODAL ─── */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingOrder(null)}>
          <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Rendelés szerkesztése</p>
                <h2 className="text-lg font-black text-white">{editingOrder.customer_name}</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{editingOrder.order_number}</p>
              </div>
              <button onClick={() => setEditingOrder(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400">
                <X size={18}/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Tételek</p>
              <div className="space-y-2">
                {editOrderItems.map((item, idx) => {
                  const p = products.find(x => x.id === item.product_id)
                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{p?.display_name || p?.name || item.product_name || item.name || 'Ismeretlen termék'}</p>
                        <p className="text-xs text-gray-500">{item.unit_price || item.price ? `${(item.unit_price || item.price)} Ft/db` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setEditOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}
                          className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 text-white font-black flex items-center justify-center">−</button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => setEditOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it))}
                          className="w-16 text-center bg-gray-800 border border-white/15 rounded-lg px-2 py-1.5 text-white text-sm font-black outline-none focus:border-amber-500/60"
                        />
                        <span className="text-xs text-gray-500">db</span>
                        <button onClick={() => setEditOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                          className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 text-white font-black flex items-center justify-center">+</button>
                        <button onClick={() => setEditOrderItems(prev => prev.filter((_, i) => i !== idx))}
                          className="w-8 h-8 rounded-lg bg-red-900/30 hover:bg-red-900/50 border border-red-500/20 text-red-400 flex items-center justify-center">
                          <X size={12}/>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add new product */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-4">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Új tétel hozzáadása</p>
                <div className="flex gap-2">
                  <select
                    onChange={e => {
                      const p = products.find(x => x.id === e.target.value)
                      if (p && !editOrderItems.find(it => it.product_id === p.id)) {
                        setEditOrderItems(prev => [...prev, {
                          product_id: p.id,
                          product_name: p.display_name || p.name,
                          quantity: 1,
                          unit_price: p.retail_price || p.wholesale_price || 0,
                          price: p.retail_price || p.wholesale_price || 0,
                        }])
                      }
                      e.target.value = ''
                    }}
                    defaultValue=""
                    className="flex-1 bg-gray-800 border border-white/15 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-amber-500/60"
                  >
                    <option value="" disabled>Válassz terméket…</option>
                    {products.filter(p => !editOrderItems.find(it => it.product_id === p.id)).map(p => (
                      <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingOrder(null)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-400 rounded-xl text-sm font-bold hover:bg-white/10 transition-all">
                  Mégse
                </button>
                <button onClick={saveOrderEdit} disabled={saving === 'order-edit'}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-xl text-sm font-black transition-all">
                  {saving === 'order-edit' ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}