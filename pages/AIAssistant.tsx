import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bot, Send, Mic, MicOff, Settings, X, RefreshCw, Volume2,
  VolumeX, Moon, Sun, Trash2, Database, TrendingUp, BarChart3,
  Calendar, Package, ShoppingCart, Users, DollarSign, Truck
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { elevenlabsApi } from '../lib/elevenlabsApi'
import { toast } from 'react-hot-toast'
import { useTheme } from '../contexts/ThemeContext'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface AISettings {
  model: 'gemini-2.5-flash' | 'gemini-2.0-flash-lite'
  temperature: number
  maxTokens: number
  speakResponses: boolean
}

interface BakeryData {
  orders: any[]
  webshopOrders: any[]
  recentOrders: any[]
  production: any[]
  inventory: any[]
  lowStock: any[]
  employees: any[]
  posTransactions: any[]
  revenue: { today: number; week: number; month: number }
  vehicles: any[]
  locations: any[]
  workLogs: any[]
  products: any[]
  recipes: any[]
  deliveryNotes: any[]
  payments: any[]
  partners: any[]
  invoices: any[]
  lastUpdated: Date | null
}

const QUICK_ACTIONS = [
  { icon: TrendingUp, label: 'Napi jelentés', prompt: 'Készíts részletes napi összefoglalót a mai bevételekről, rendelésekről, gyártásról és minden fontos eseményről.' },
  { icon: BarChart3, label: 'Heti összesítő', prompt: 'Készíts heti összesítő jelentést az elmúlt 7 nap bevételeiről, rendeléseiről, gyártásáról, és adj trendeket.' },
  { icon: Calendar, label: 'Havi riport', prompt: 'Készíts havi pénzügyi és operációs riportot az elmúlt 30 napra vonatkozóan, összesítésekkel és javaslatokkal.' },
  { icon: DollarSign, label: 'Bevételek ma', prompt: 'Mutasd meg részletesen a mai összes bevételt: POS kassza, Cashmatic, online rendelések, minden forrásból.' },
  { icon: Package, label: 'Készlet állapot', prompt: 'Elemezd a jelenlegi készletállapotot: mi van alacsony szinten, mit kell rendelni, és mi van feleslegesen.' },
  { icon: ShoppingCart, label: 'Aktív rendelések', prompt: 'Mutasd az összes aktív rendelést státusz szerint csoportosítva, és jelezd a késéseket vagy problémákat.' },
  { icon: Users, label: 'Személyzet', prompt: 'Ki dolgozik most? Mutasd az aktív munkaidő naplókat és a mai munkaidő összesítést alkalmazottanként.' },
  { icon: Truck, label: 'Szállítások', prompt: 'Mutasd a mai szállítások állapotát, az aktív járműveket, és az esetleges késéseket.' },
]

export default function AIAssistant() {
  const { theme, toggleTheme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AISettings>({
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 4096,
    speakResponses: false,
  })
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [bakeryData, setBakeryData] = useState<BakeryData>({
    orders: [], webshopOrders: [], recentOrders: [], production: [], inventory: [],
    lowStock: [], employees: [], posTransactions: [],
    revenue: { today: 0, week: 0, month: 0 },
    vehicles: [], locations: [], workLogs: [], products: [], recipes: [],
    deliveryNotes: [], payments: [], partners: [], invoices: [],
    lastUpdated: null
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const welcome: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '🥐 Üdvözlöm! **Vivien** vagyok, a Szemesi Pékség Kft. AI asszisztense.\n\nHozzáféréssel rendelkezem az összes pékségi adathoz: rendelések, termelés, készlet, bevételek, Cashmatic kassza, POS tranzakciók, személyzet és szállítások.\n\nKérhetek napi, heti, havi jelentéseket, vagy bármilyen operációs kérdésre válaszolok. Miben segíthetek?',
      timestamp: new Date()
    }
    setMessages([welcome])
    loadAllBakeryData()
    initSpeechRecognition()
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadAllBakeryData = async () => {
    setLoadingData(true)
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [
        ordersRes, webshopOrdersRes, productionRes, inventoryRes, employeesRes,
        posRes, vehiclesRes, locationsRes, workLogsRes,
        storeInvRes, productsRes, recipesRes, deliveryNotesRes,
        paymentsRes, partnersRes, invoicesRes
      ] = await Promise.allSettled([
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('webshop_orders').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('production_batches').select('*, products:recipe_id(name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('inventory').select('*').order('name'),
        supabase.from('profiles').select('id, full_name, role, last_active'),
        supabase.from('pos_transactions').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('vehicles').select('*, profiles:driver_id(full_name)'),
        supabase.from('locations').select('*').eq('status', 'active'),
        supabase.from('work_logs').select('*, profiles:employee_id(full_name)').gte('start_time', weekAgo).order('start_time', { ascending: false }),
        supabase.from('store_inventory').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('recipes').select('*').order('name'),
        supabase.from('delivery_notes').select('*').gte('created_at', weekAgo).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').gte('created_at', monthAgo).order('created_at', { ascending: false }),
        supabase.from('partner_companies').select('*').eq('status', 'active'),
        supabase.from('invoices').select('*').gte('created_at', monthAgo).order('created_at', { ascending: false })
      ])

      const orders = ordersRes.status === 'fulfilled' ? (ordersRes.value.data || []) : []
      const webshopOrders = webshopOrdersRes.status === 'fulfilled' ? (webshopOrdersRes.value.data || []) : []
      const production = productionRes.status === 'fulfilled' ? (productionRes.value.data || []) : []
      const inventory = inventoryRes.status === 'fulfilled' ? (inventoryRes.value.data || []) : []
      const employees = employeesRes.status === 'fulfilled' ? (employeesRes.value.data || []) : []
      const posTransactions = posRes.status === 'fulfilled' ? (posRes.value.data || []) : []
      const vehicles = vehiclesRes.status === 'fulfilled' ? (vehiclesRes.value.data || []) : []
      const locations = locationsRes.status === 'fulfilled' ? (locationsRes.value.data || []) : []
      const workLogs = workLogsRes.status === 'fulfilled' ? (workLogsRes.value.data || []) : []
      const storeInventory = storeInvRes.status === 'fulfilled' ? (storeInvRes.value.data || []) : []
      const products = productsRes.status === 'fulfilled' ? (productsRes.value.data || []) : []
      const recipes = recipesRes.status === 'fulfilled' ? (recipesRes.value.data || []) : []
      const deliveryNotes = deliveryNotesRes.status === 'fulfilled' ? (deliveryNotesRes.value.data || []) : []
      const payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data || []) : []
      const partners = partnersRes.status === 'fulfilled' ? (partnersRes.value.data || []) : []
      const invoices = invoicesRes.status === 'fulfilled' ? (invoicesRes.value.data || []) : []

      // Bevétel számítás
      const todayOrders = orders.filter(o => o.created_at >= todayStart)
      const weekOrders = orders.filter(o => o.created_at >= weekAgo)
      const monthOrders = orders.filter(o => o.created_at >= monthAgo)

      const todayPosTx = posTransactions.filter(t => t.created_at >= todayStart)
      const weekPosTx = posTransactions.filter(t => t.created_at >= weekAgo)
      const monthPosTx = posTransactions.filter(t => t.created_at >= monthAgo)

      const sumRevenue = (orderList: any[], posList: any[]) => {
        const orderRev = orderList.reduce((s, o) => s + (o.total_amount || 0), 0)
        const posRev = posList.reduce((s, t) => s + (t.total || t.total_amount || t.amount || 0), 0)
        return orderRev + posRev
      }

      // Alacsony készlet
      const allInv = [...inventory, ...storeInventory]
      const lowStock = allInv.filter(item =>
        item.current_stock !== undefined && item.min_threshold !== undefined &&
        item.current_stock <= item.min_threshold
      )

      setBakeryData({
        orders,
        webshopOrders,
        recentOrders: orders.slice(0, 20),
        production,
        inventory: allInv,
        lowStock,
        employees,
        posTransactions,
        revenue: {
          today: sumRevenue(todayOrders, todayPosTx),
          week: sumRevenue(weekOrders, weekPosTx),
          month: sumRevenue(monthOrders, monthPosTx)
        },
        vehicles,
        locations,
        workLogs,
        products,
        recipes,
        deliveryNotes,
        payments,
        partners,
        invoices,
        lastUpdated: new Date()
      })
    } catch (error) {
      console.error('Hiba az adatok betöltésekor:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const buildSystemPrompt = useCallback(() => {
    const d = bakeryData
    const now = new Date()

    const activeOrders = d.orders.filter(o => ['pending', 'processing', 'confirmed'].includes(o.status))
    const activeBatches = d.production.filter(b => ['planned', 'in_progress'].includes(b.status))
    const clockedIn = d.workLogs.filter(w => !w.end_time)
    const todayTx = d.posTransactions.filter(t => {
      const txDate = new Date(t.created_at)
      return txDate.toDateString() === now.toDateString()
    })

    return `Te Vivien vagy, a Szemesi Pékség Kft. professzionális AI asszisztense. 
Adminisztrátori szintű hozzáféréssel rendelkezel az összes pékségi adathoz.
Mindig magyarul válaszolj. Légy konkrét, számszerű és hasznos.
Jelenlegi dátum/idő: ${now.toLocaleString('hu-HU')}

=== VALÓS IDEJŰ PÉKSÉGI ADATOK ===

RENDELÉSEK:
- Összes rendelés (DB): ${d.orders.length} db
- Aktív rendelések: ${activeOrders.length} db
- Aktív rendelések részlete: ${JSON.stringify(activeOrders.slice(0, 10).map(o => ({
  sz: o.order_number, ug: o.customer_name, oss: o.total_amount, st: o.status, dat: o.created_at?.split('T')[0]
})))}
- Legutóbbi 10 rendelés: ${JSON.stringify(d.recentOrders.slice(0, 10).map(o => ({
  sz: o.order_number, ug: o.customer_name, oss: o.total_amount, st: o.status
})))}

BEVÉTELEK:
- Ma: ${d.revenue.today.toLocaleString('hu-HU')} Ft
- Elmúlt 7 nap: ${d.revenue.week.toLocaleString('hu-HU')} Ft
- Elmúlt 30 nap: ${d.revenue.month.toLocaleString('hu-HU')} Ft
- Mai POS tranzakciók: ${todayTx.length} db, összeg: ${todayTx.reduce((s: number, t: any) => s + (t.total || t.total_amount || t.amount || 0), 0).toLocaleString('hu-HU')} Ft

KASSZA (POS TRANZAKCIÓK - legutóbbi 20):
${JSON.stringify(d.posTransactions.slice(0, 20).map(t => ({
  dat: t.created_at?.split('T')[0], oss: t.total || t.total_amount || t.amount, tip: t.payment_method || t.type
})))}

GYÁRTÁS:
- Aktív tételek: ${activeBatches.length} db
- ${JSON.stringify(activeBatches.slice(0, 10).map(b => ({
  sz: b.batch_number, term: b.products?.name || 'N/A', menny: b.batch_size, st: b.status
})))}
- Legutóbbi befejezett tételek: ${d.production.filter(b => b.status === 'completed').slice(0, 5).length} db

KÉSZLET:
- Összes tétel: ${d.inventory.length} db
- ALACSONY KÉSZLET (${d.lowStock.length} db): ${JSON.stringify(d.lowStock.slice(0, 10).map(i => ({
  nev: i.name, keszlet: i.current_stock, min: i.min_threshold, egyseg: i.unit
})))}

SZEMÉLYZET:
- Összes alkalmazott: ${d.employees.length} fő
- Jelenleg dolgozik (bejelentkezett): ${clockedIn.length} fő
- ${JSON.stringify(clockedIn.slice(0, 10).map(w => ({
  nev: w.profiles?.full_name || w.employee_id, kezd: w.start_time
})))}

FLOTTA:
- Járművek: ${d.vehicles.length} db
- Aktív: ${d.vehicles.filter((v: any) => v.status === 'active').length} db
- ${JSON.stringify(d.vehicles.map((v: any) => ({
  rendszam: v.license_plate, modell: v.model, sofor: v.profiles?.full_name, st: v.status
})))}

HELYSZÍNEK/ÜZLETEK:
${JSON.stringify(d.locations.slice(0, 10).map(l => ({ nev: l.name, cim: l.address, tip: l.type })))}

WEBSHOP RENDELÉSEK (Online):
- Összes webshop rendelés: ${d.webshopOrders.length} db
- Legutóbbi webshop rendelések: ${JSON.stringify(d.webshopOrders.slice(0, 5).map(o => ({
  sz: o.order_number, nev: o.customer_name, oss: o.total_amount, st: o.status, dat: o.created_at?.split('T')[0]
})))}

TERMÉKEK KATALÓGUSA:
- Összes termék: ${d.products.length} db
- Termékek: ${JSON.stringify(d.products.slice(0, 15).map(p => ({
  nev: p.name, kategoria: p.category, ar: p.retail_price, beszerzesi: p.cost_per_unit
})))}

RECEPTEK:
- Összes recept: ${d.recipes.length} db
- Receptek: ${JSON.stringify(d.recipes.slice(0, 10).map(r => ({
  nev: r.name, kategoria: r.category, adagsam: r.yield_amount
})))}

SZÁLLÍTÁSOK (Legutóbbi 10):
${JSON.stringify(d.deliveryNotes.slice(0, 10).map(dn => ({
  sz: dn.delivery_note_number, st: dn.status, sof: dn.driver_name, dat: dn.created_at?.split('T')[0]
})))}

FIZETÉSEK (Legutóbbi 20):
${JSON.stringify(d.payments.slice(0, 20).map(p => ({
  ossz: p.amount, tip: p.payment_method, st: p.status, dat: p.created_at?.split('T')[0]
})))}

PARTNEREK:
- Aktív partnerek: ${d.partners.length} db
- Partnerek: ${JSON.stringify(d.partners.slice(0, 10).map(p => ({
  nev: p.name, email: p.email, telefon: p.phone
})))}

SZÁMLÁK (Legutóbbi 10):
${JSON.stringify(d.invoices.slice(0, 10).map(i => ({
  szamlasz: i.invoice_number, ossz: i.total_amount, st: i.status, dat: i.created_at?.split('T')[0]
})))}

=== UTASÍTÁSOK ===
- Mindig használd a fenti valós adatokat a válaszaidban
- Számszerű összesítéseket adj (bevételek Ft-ban, darabszámok)
- Ha napi/heti/havi jelentést kérnek, strukturált formában add meg
- Azonosítsd az anomáliákat (pl. alacsony készlet, késő rendelések, kifizetetlen számlák)
- Ha nem áll rendelkezésre adat, mondd meg egyértelműen
- Ha emailt kell küldeni (pl. automatikus rendelés, értesítés), használd az email_action blokkot
- Alacsony készlet esetén ajánld fel az automatikus rendelőlevél küldést a beszállítónak
- Webshop rendeléseket ugyanúgy kezel mint a rendes rendeléseket, azonos prioritással`
  }, [bakeryData])

  const handleSendMessage = async (voiceInput?: string) => {
    const messageText = voiceInput || input
    if (!messageText.trim()) return

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const allMessages = [...messages, userMessage].filter(m => m.role !== 'system')

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          system_prompt: buildSystemPrompt(),
          model: settings.model,
          temperature: settings.temperature,
          maxOutputTokens: settings.maxTokens
        }
      })

      if (error) throw new Error(error.message || 'Hiba az AI szolgáltatásban')
      if (!data?.text) throw new Error('Érvénytelen válasz az AI-tól')

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

      if (settings.speakResponses) {
        speakText(data.text)
      }
    } catch (error: any) {
      console.error('AI hiba:', error)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Hiba: ${error.message || 'Ismeretlen hiba'}\n\nEllenőrizd, hogy az AI asszisztens Supabase Edge Function fut-e, és a Gemini API kulcs be van-e állítva.`,
        timestamp: new Date()
      }])
      toast.error('Hiba az AI válasz generálásakor')
    } finally {
      setLoading(false)
    }
  }

  const speakText = async (text: string) => {
    const plain = text.replace(/[#*`]/g, '').substring(0, 500)
    setIsSpeaking(true)
    window.speechSynthesis.cancel()

    const playedByElevenLabs = await elevenlabsApi.textToSpeech(plain)
    if (playedByElevenLabs) {
      return
    }

    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(plain)
    utterance.lang = 'hu-HU'
    utterance.rate = 0.95
    const voices = window.speechSynthesis.getVoices()
    const huVoice = voices.find(v => v.lang.startsWith('hu'))
    if (huVoice) utterance.voice = huVoice
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const initSpeechRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    recognitionRef.current = new SR()
    recognitionRef.current.lang = 'hu-HU'
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = false
    recognitionRef.current.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setTimeout(() => handleSendMessage(transcript), 300)
      setIsListening(false)
    }
    recognitionRef.current.onerror = () => setIsListening(false)
    recognitionRef.current.onend = () => setIsListening(false)
  }

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current?.start()
        setIsListening(true)
      } catch {
        toast.error('Hiba a hangfelismerés indításakor')
      }
    }
  }

  const clearChat = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: '🥐 Chat törölve. Miben segíthetek?',
      timestamp: new Date()
    }])
  }

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-slate-950 text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 p-4 bg-slate-900/95 rounded-2xl shadow-sm border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Vivien AI Asszisztens</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${loadingData ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {loadingData ? 'Adatok betöltése...' :
                  `Adatok frissítve: ${bakeryData.lastUpdated?.toLocaleTimeString('hu-HU') || 'N/A'}`}
              </p>
              {!loadingData && (
                <span className="text-xs text-gray-400">
                  | {bakeryData.orders.length} rend. | {bakeryData.posTransactions.length} kassza tx | {bakeryData.inventory.length} készlet
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex space-x-1">
          <button onClick={() => { loadAllBakeryData(); toast.success('Adatok frissítve') }}
            className="p-2 text-gray-500 hover:text-green-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Adatok frissítése">
            <Database className={`h-4 w-4 ${loadingData ? 'animate-pulse text-amber-500' : ''}`} />
          </button>
          <button onClick={toggleTheme}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => { if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false) } else { setSettings(p => ({ ...p, speakResponses: !p.speakResponses })) } }}
            className={`p-2 rounded-full transition-colors ${settings.speakResponses ? 'text-green-600 bg-green-100 dark:bg-green-900/20' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title={isSpeaking ? 'Leállít' : 'Hangos válaszok'}>
            {settings.speakResponses ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button onClick={clearChat}
            className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Chat törlése">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={() => setShowSettings(true)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Beállítások">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Gyors műveletek */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 flex-shrink-0">
        {QUICK_ACTIONS.map((action, i) => (
          <button key={i} onClick={() => handleSendMessage(action.prompt)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-amber-400 hover:text-amber-600 transition-all whitespace-nowrap disabled:opacity-50">
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-slate-900 rounded-2xl shadow-sm border border-slate-700 overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={`max-w-3xl rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-amber-600 text-slate-950'
                  : 'bg-slate-800 text-slate-100'
              }`}>
                {message.role === 'assistant' ? (
                  <div className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
                ) : (
                  <div className="text-sm">{message.content}</div>
                )}
                <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-amber-200' : 'text-gray-400 dark:text-gray-500'}`}>
                  {message.timestamp.toLocaleTimeString('hu-HU')}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mr-2 flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Vivien elemez...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Revenue Stats Bar */}
        {!loadingData && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-750">
            <span>💰 Ma: <strong className="text-green-600">{bakeryData.revenue.today.toLocaleString('hu-HU')} Ft</strong></span>
            <span>📅 Hét: <strong className="text-blue-600">{bakeryData.revenue.week.toLocaleString('hu-HU')} Ft</strong></span>
            <span>📆 Hó: <strong className="text-purple-600">{bakeryData.revenue.month.toLocaleString('hu-HU')} Ft</strong></span>
            <span>⚠️ Alacsony kész.: <strong className="text-red-500">{bakeryData.lowStock.length} db</strong></span>
            <span>🚚 Aktív rend.: <strong className="text-amber-600">{bakeryData.orders.filter(o => ['pending','processing','confirmed'].includes(o.status)).length} db</strong></span>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center space-x-2">
          <button onClick={toggleListening}
            className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            title={isListening ? 'Leállítás' : 'Hangbevitel'}>
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
            placeholder="Kérdezzen Vivientől... (pl. 'Mennyi volt a mai bevétel?')"
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm"
            disabled={loading}
          />
          <button onClick={() => handleSendMessage()}
            disabled={loading || !input.trim()}
            className="p-3 bg-amber-600 text-white rounded-full hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Vivien AI Beállítások</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Modell</label>
                <select value={settings.model}
                  onChange={(e) => setSettings(p => ({ ...p, model: e.target.value as AISettings['model'] }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ajánlott)</option>
                  <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (Gyors)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kreativitás: {settings.temperature}
                </label>
                <input type="range" min="0" max="1" step="0.1" value={settings.temperature}
                  onChange={(e) => setSettings(p => ({ ...p, temperature: parseFloat(e.target.value) }))}
                  className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max válasz hossz: {settings.maxTokens}
                </label>
                <input type="range" min="1000" max="8000" step="500" value={settings.maxTokens}
                  onChange={(e) => setSettings(p => ({ ...p, maxTokens: parseInt(e.target.value) }))}
                  className="w-full" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="speak" checked={settings.speakResponses}
                  onChange={() => setSettings(p => ({ ...p, speakResponses: !p.speakResponses }))}
                  className="h-4 w-4 text-amber-600 rounded" />
                <label htmlFor="speak" className="text-sm text-gray-700 dark:text-gray-300">Hangos válaszok</label>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 space-y-1">
                <p>📊 Betöltött adatok:</p>
                <p>• {bakeryData.orders.length} rendelés | {bakeryData.posTransactions.length} POS tranzakció</p>
                <p>• {bakeryData.inventory.length} készlet tétel | {bakeryData.employees.length} alkalmazott</p>
                <p>• {bakeryData.vehicles.length} jármű | {bakeryData.locations.length} helyszín</p>
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                Bezárás
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}