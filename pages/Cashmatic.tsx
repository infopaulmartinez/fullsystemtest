 import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Loader, RefreshCw, AlertCircle, TrendingUp, DollarSign, Zap,
  Wifi, WifiOff, Monitor, Settings, ChevronDown, Plus, Trash2,
  Edit2, Check, X, Banknote, ArrowDownCircle, Printer, Database,
} from 'lucide-react'
import {
  cashmaticSessionStatus, cashmaticLogin, cashmaticDeviceInfo, cashmaticAllLevels,
  cashmaticActiveTransaction, cashmaticLastTransaction, cashmaticStartRefill, cashmaticStopRefill, cashmaticWithdrawal, cashmaticGetClosureAmount,
  getDevices, addDevice, updateDevice, deleteDevice, testDevice,
  formatHUF, toCents, fromCents,
  type DeviceConfig, type CashmaticLevel, type CashmaticDeviceInfo, type CashmaticTransaction,
} from '../lib/cashmaticApi'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { toast } from 'react-hot-toast'

type Tab = 'overview' | 'levels' | 'registers' | 'withdrawal' | 'deposit' | 'printer' | 'closure'

export default function Cashmatic() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  // Kapcsolat állapot
  const [online, setOnline] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  // Eszköz adatok
  const [selectedDeviceId, setSelectedDeviceId] = useState('default')
  const [devices, setDevices] = useState<DeviceConfig[]>([])
  const [deviceInfo, setDeviceInfo] = useState<CashmaticDeviceInfo | null>(null)
  const [levels, setLevels] = useState<CashmaticLevel[]>([])
  const [activeTransaction, setActiveTransaction] = useState<CashmaticTransaction | null>(null)
  const [lastTransaction, setLastTransaction] = useState<CashmaticTransaction | null>(null)
  const [transactionHistory, setTransactionHistory] = useState<(CashmaticTransaction & { timestamp: string })[]>([])
  const [dbTransactions, setDbTransactions] = useState<any[]>([])
  const seenTxIdsRef = useRef<Set<number>>(new Set())

  // UI
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showDeviceMenu, setShowDeviceMenu] = useState(false)
  const [showAddDevice, setShowAddDevice] = useState(false)

  // Befizetés / refill
  const [refillReason, setRefillReason] = useState('Befizetés')
  const [refillLoading, setRefillLoading] = useState(false)

  // Kifizetés
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalReason, setWithdrawalReason] = useState('Kifizetés')
  const [withdrawalLoading, setWithdrawalLoading] = useState(false)

  // Kasszazárás / Daily closure
  const [closureAmount, setClosureAmount] = useState<string | null>(null)
  const [closureLoading, setClosureLoading] = useState(false)
  const [shopOpen, setShopOpen] = useState(true)
  const [lastClosureTime, setLastClosureTime] = useState<string | null>(null)

  // IP Nyomtató beállítások
  const [printerIp, setPrinterIp] = useState(() => localStorage.getItem('printer_ip') || import.meta.env.VITE_PRINTER_IP || '192.168.2.30')
  const [printerPort, setPrinterPort] = useState(() => localStorage.getItem('printer_port') || import.meta.env.VITE_PRINTER_PORT || '9100')
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('printer_name') || import.meta.env.VITE_PRINTER_NAME || 'HP Nyomtató')

  // Cashmatic proxy URL beállítások
  const getDefaultProxyUrl = () => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const protocol = window.location.protocol
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `${protocol}//${host}:3002`
      }
    }
    return 'http://localhost:3002'
  }

  const getInitialProxyUrl = () => {
    if (typeof window === 'undefined') {
      return import.meta.env.VITE_CASHMATIC_PROXY_URL || 'http://localhost:3002'
    }
    const saved = localStorage.getItem('cashmatic_proxy_url')
    const defaultUrl = getDefaultProxyUrl()
    if (saved && saved.trim() === 'http://localhost:3002' && defaultUrl !== 'http://localhost:3002') {
      localStorage.setItem('cashmatic_proxy_url', defaultUrl)
      return defaultUrl
    }
    return saved || import.meta.env.VITE_CASHMATIC_PROXY_URL || defaultUrl
  }

  const [customProxyUrl, setCustomProxyUrl] = useState(getInitialProxyUrl)
  const [showProxySettings, setShowProxySettings] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cashmatic_proxy_url')
      if (!saved) {
        const defaultUrl = getDefaultProxyUrl()
        localStorage.setItem('cashmatic_proxy_url', defaultUrl)
        setCustomProxyUrl(defaultUrl)
      }
    }
  }, [])

  useEffect(() => {
    console.log("showProxySettings state changed:", showProxySettings);
  }, [showProxySettings]);

  const [printerProtocol, setPrinterProtocol] = useState(() => localStorage.getItem('printer_protocol') || 'RAW')
  const [printerSaved, setPrinterSaved] = useState(false)

  // Új eszköz form
  const [newDevice, setNewDevice] = useState({ id: '', name: '', ip: '', port: '50301', protocol: 'https', username: '', password: '' })

  const pollRef = useRef<NodeJS.Timeout>()

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    init()
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (online) loadDeviceData()
  }, [selectedDeviceId, online])

  async function init() {
    setLoading(true)
    try {
      await loadDevices()
      const isOnline = await cashmaticSessionStatus(selectedDeviceId)
      if (!isOnline) {
        const ok = await cashmaticLogin(selectedDeviceId)
        setOnline(ok)
        if (!ok) { toast.error('Cashmatic nem elérhető'); return }
      } else {
        setOnline(true)
      }
      toast.success('✓ Cashmatic kapcsolat OK')
      await loadDeviceData()
      await loadDbTransactions()
      // Polling 5 másodpercenként
      pollRef.current = setInterval(() => loadDeviceData(), 5000)
    } catch (e: any) {
      setOnline(false)
      toast.error('Cashmatic hiba: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadDevices() {
    const devs = await getDevices()
    setDevices(devs)
  }

  async function loadDbTransactions() {
    try {
      const { data } = await supabase
        .from('pos_transactions')
        .select('id, receipt_number, total_amount, payment_method, created_at, status, notes')
        .order('created_at', { ascending: false })
        .limit(100)
      setDbTransactions(data || [])
    } catch (e) {
      console.warn('pos_transactions betöltési hiba:', e)
    }
  }

  async function loadDeviceData() {
    try {
      const [info, lvls, activeTx, lastTx] = await Promise.all([
        cashmaticDeviceInfo(selectedDeviceId),
        cashmaticAllLevels(selectedDeviceId),
        cashmaticActiveTransaction(selectedDeviceId),
        cashmaticLastTransaction(selectedDeviceId),
      ])
      setDeviceInfo(info)
      setLevels(lvls)
      setActiveTransaction(activeTx)
      setLastTransaction(lastTx)
      // Accumulate transaction history – add new transactions as they arrive
      if (lastTx && lastTx.id != null && !seenTxIdsRef.current.has(lastTx.id)) {
        seenTxIdsRef.current.add(lastTx.id)
        setTransactionHistory(prev => [{ ...lastTx, timestamp: new Date().toISOString() }, ...prev].slice(0, 200))
      }
    } catch (e: any) {
      console.error('Adatbetöltés hiba:', e.message)
    }
  }

  async function handleRefresh() {
    setLoading(true)
    await loadDeviceData()
    setLoading(false)
    toast.success('Frissítve')
  }

  function saveProxyUrl() {
    const normalized = customProxyUrl.trim()
    if (!normalized) {
      return toast.error('Adj meg egy érvényes Cashmatic proxy URL-t!')
    }
    localStorage.setItem('cashmatic_proxy_url', normalized)
    toast.success('Cashmatic proxy URL mentve')
    setShowProxySettings(false)
  }

  function resetProxyUrl() {
    localStorage.removeItem('cashmatic_proxy_url')
    const defaultUrl = import.meta.env.VITE_CASHMATIC_PROXY_URL || getDefaultProxyUrl()
    setCustomProxyUrl(defaultUrl)
    toast.success('Cashmatic proxy URL visszaállítva')
  }

  async function handleStartRefill() {
    setRefillLoading(true)
    try {
      const r = await cashmaticStartRefill(refillReason, selectedDeviceId)
      if (r.success) {
        toast.success('✅ Befizetés indítva')
        await loadDeviceData()
      } else {
        toast.error('Befizetés hiba: ' + (r.message ?? 'Ismeretlen hiba'))
      }
    } catch (e: any) {
      toast.error('Befizetés hiba: ' + e.message)
    } finally {
      setRefillLoading(false)
    }
  }

  async function handleStopRefill() {
    setRefillLoading(true)
    try {
      const r = await cashmaticStopRefill(selectedDeviceId)
      if (r.success) {
        toast.success('✅ Befizetés lezárva')
        await loadDeviceData()
      } else {
        toast.error('Befizetés lezárása hiba: ' + (r.message ?? 'Ismeretlen hiba'))
      }
    } catch (e: any) {
      toast.error('Befizetés lezárása hiba: ' + e.message)
    } finally {
      setRefillLoading(false)
    }
  }

  async function handleWithdrawal() {
    const amount = parseFloat(withdrawalAmount)
    if (!amount || amount <= 0) { toast.error('Adj meg érvényes összeget!'); return }
    setWithdrawalLoading(true)
    try {
      const r = await cashmaticWithdrawal(toCents(amount), withdrawalReason, selectedDeviceId)
      if (r.success) {
        toast.success(`✅ Kifizetés elindítva: ${formatHUF(amount)}`)
        setWithdrawalAmount('')
        await loadDeviceData()
      } else {
        toast.error('Kifizetés hiba: ' + (r.message ?? 'Ismeretlen hiba'))
      }
    } catch (e: any) {
      toast.error('Kifizetés hiba: ' + e.message)
    } finally {
      setWithdrawalLoading(false)
    }
  }

  async function handleGetClosureAmount() {
    setClosureLoading(true)
    try {
      const r = await cashmaticGetClosureAmount(selectedDeviceId)
      if (r.success) {
        const amount = r.data || 0
        setClosureAmount(typeof amount === 'string' ? amount.replace(/\s/g, '') : String(amount))
        toast.success('✅ Zárási összeg lekérdezve')
      } else {
        toast.error('Zárási összeg lekérdezés hiba: ' + (r.message ?? 'Ismeretlen hiba'))
      }
    } catch (e: any) {
      toast.error('Zárási összeg hiba: ' + e.message)
    } finally {
      setClosureLoading(false)
    }
  }

  async function handleDailyOpening() {
    try {
      setShopOpen(true)
      setLastClosureTime(null)
      toast.success('✅ Kasszanyitás regisztrálva')
      await loadDeviceData()
    } catch (e: any) {
      toast.error('Kasszanyitás hiba: ' + e.message)
    }
  }

  async function handleDailyClosure() {
    await handleGetClosureAmount()
    setShopOpen(false)
    setLastClosureTime(new Date().toISOString())
    toast.success('✅ Kasszazárás regisztrálva')
  }

  async function handleAddDevice() {
    if (!newDevice.id || !newDevice.name || !newDevice.ip || !newDevice.username || !newDevice.password)
      return toast.error('Minden mező kötelező!')
    const r = await addDevice(newDevice)
    if (r.success) {
      toast.success('Eszköz hozzáadva!')
      setShowAddDevice(false)
      setNewDevice({ id: '', name: '', ip: '', port: '50301', protocol: 'https', username: '', password: '' })
      await loadDevices()
    } else toast.error(r.message ?? 'Hiba')
  }

  async function handleTestDevice(id: string) {
    const r = await testDevice(id)
    toast(r.message, { icon: r.success ? '✅' : '❌' })
  }

  async function handleDeleteDevice(id: string) {
    if (!confirm('Biztosan törlöd?')) return
    const r = await deleteDevice(id)
    if (r.success) { toast.success('Eszköz törölve'); await loadDevices() }
    else toast.error(r.message ?? 'Hiba')
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const card = `rounded-2xl p-6 border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`
  const tabBtn = (t: Tab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === t
        ? 'bg-blue-600 text-white'
        : dark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading && online === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cashmatic csatlakozás…</p>
        </div>
      </div>
    )
  }

  if (online === false) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-3 text-red-700 dark:text-red-400 mb-4">
          <AlertCircle className="h-6 w-6" />
          <div>
            <p className="font-semibold">Cashmatic nem elérhető</p>
            <p className="text-sm">
              A proxy szerver (localhost:3002) nem fut, vagy a Cashmatic gép ki van kapcsolva.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <button onClick={init} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
            Újra próbálja
          </button>
          <button
            onClick={() => setShowProxySettings(true)}
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Proxy beállítások
          </button>
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Aktuális proxy: <span className="font-medium text-gray-900 dark:text-white">{customProxyUrl}</span>
        </p>
        {showProxySettings && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm mt-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cashmatic proxy URL</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Add meg a Cashmatic proxy elérhetőségét. Támogatott a helyi localhost és Cloudflare tunnel URL is.
                </p>
              </div>
              <button
                onClick={() => setShowProxySettings(false)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
              >
                Bezár
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
              <label className="block w-full">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Proxy URL</span>
                <input
                  type="text"
                  value={customProxyUrl}
                  onChange={e => setCustomProxyUrl(e.target.value)}
                  placeholder="https://...trycloudflare.com vagy http://localhost:3002"
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveProxyUrl}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Mentés
                </button>
                <button
                  type="button"
                  onClick={resetProxyUrl}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Visszaállítás
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Monitor className="h-8 w-8 text-blue-600" />
            Cashmatic Pénztárgép
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Valós idejű pénztárgép adatok és kezelés
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Online badge */}
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {online ? 'Online' : 'Offline'}
          </span>

          {/* Kassza választó */}
          <div className="relative">
            <button
              onClick={() => setShowDeviceMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
            >
              <Monitor className="h-4 w-4 text-blue-500" />
              {devices.find(d => d.id === selectedDeviceId)?.name ?? 'Főpénztár'}
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
            {showDeviceMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
                {devices.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDeviceId(d.id); setShowDeviceMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      d.id === selectedDeviceId ? 'font-semibold text-blue-600' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowProxySettings(v => !v)}
            className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Cashmatic proxy URL beállítása"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Proxy settings panel */}
      {showProxySettings && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cashmatic proxy URL</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add meg a Cashmatic proxy elérhetőségét. Támogatott a helyi localhost és Cloudflare tunnel URL is.
              </p>
            </div>
            <button
              onClick={() => setShowProxySettings(false)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
            >
              Bezár
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
            <label className="block w-full">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Proxy URL</span>
              <input
                type="text"
                value={customProxyUrl}
                onChange={e => setCustomProxyUrl(e.target.value)}
                placeholder="https://...trycloudflare.com vagy http://localhost:3002"
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveProxyUrl}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Mentés
              </button>
              <button
                type="button"
                onClick={resetProxyUrl}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Visszaállítás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(['overview', 'levels', 'registers', 'withdrawal', 'deposit', 'printer', 'closure'] as Tab[]).map(t => (
          <button key={t} className={tabBtn(t)} onClick={() => setActiveTab(t)}>
            {t === 'overview' && '📋 Áttekintés'}
            {t === 'levels' && '💰 Pénzszintek'}
            {t === 'registers' && '🖥️ Kasszák'}
            {t === 'withdrawal' && '💸 Kifizetés'}
            {t === 'deposit' && '💰 Befizetés'}
            {t === 'printer' && '🖨️ Nyomtató'}
            {t === 'closure' && '🔐 Kasszazárás'}
          </button>
        ))}
      </div>

      {/* Tab: Áttekintés */}
      {activeTab === 'overview' && (
        <div className="space-y-4">

          {/* Aktív tranzakció */}
          {activeTransaction && (activeTransaction.operation ?? '').toLowerCase() !== 'idle' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Zap className="h-5 w-5 mr-2 text-blue-600" />
                🔄 Aktív Tranzakció
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ['Operáció', activeTransaction.operation, 'text-gray-900 dark:text-white'],
                  ['Kért összeg', formatHUF(fromCents(activeTransaction.requested ?? 0)), 'text-gray-900 dark:text-white'],
                  ['Bedobott', formatHUF(fromCents(activeTransaction.inserted ?? 0)), 'text-green-600'],
                  ['Kiadott', formatHUF(fromCents(activeTransaction.dispensed ?? 0)), 'text-blue-600'],
                ].map(([label, value, cls]) => (
                  <div key={label as string}>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
                    <p className={`font-semibold ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device Info */}
          {deviceInfo && (
            <div className={card}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                📋 Eszköz Információ
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ['Eszköz Név', deviceInfo.deviceName],
                  ['Modell', deviceInfo.model],
                  ['Sorozatszám', deviceInfo.serialNumber],
                  ['Státusz', deviceInfo.statusMessage],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{value ?? '–'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tranzakció napló – összes */}
          <div className={card}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Tranzakció Napló
              {transactionHistory.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  {transactionHistory.length} db
                </span>
              )}
            </h2>
            {transactionHistory.length === 0 ? (
              <p className="text-gray-400 text-center py-8 text-sm">
                Még nincs rögzített Cashmatic tranzakció ebben a munkamenetben.<br/>
                A tranzakciók automatikusan megjelennek, ahogy beérkeznek.
              </p>
            ) : (
              <div className="overflow-y-auto max-h-96 space-y-2 pr-1">
                {transactionHistory.map((tx, i) => {
                  const isPayment = (tx.operation ?? '').toLowerCase().includes('payment') || (tx.operation ?? '').toLowerCase().includes('fizet')
                  const isWithdraw = (tx.operation ?? '').toLowerCase().includes('withdrawal') || (tx.operation ?? '').toLowerCase().includes('kifi')
                  return (
                    <div key={`${tx.id}-${i}`} className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${
                      dark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${isPayment ? '💳' : isWithdraw ? '💸' : '🔄'}`}></span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{tx.operation}</p>
                          {tx.operationInfo && <p className="text-xs text-gray-500">{tx.operationInfo}</p>}
                          <p className="text-xs text-gray-400">{new Date(tx.timestamp).toLocaleString('hu-HU')}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        {(tx.requested ?? 0) > 0 && (
                          <p className="font-bold text-green-600">{formatHUF(fromCents(tx.requested ?? 0))}</p>
                        )}
                        {(tx.inserted ?? 0) > 0 && (
                          <p className="text-xs text-blue-500">Bedobott: {formatHUF(fromCents(tx.inserted))}</p>
                        )}
                        {(tx.dispensed ?? 0) > 0 && (
                          <p className="text-xs text-orange-500">Kiadott: {formatHUF(fromCents(tx.dispensed))}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Adatbázis POS tranzakciók ── */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-base font-bold flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
                  <Database className="h-4 w-4 text-blue-500" />
                  Adatbázis – Kassza tranzakciók
                  {dbTransactions.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {dbTransactions.length} db
                    </span>
                  )}
                </h2>
                <button onClick={loadDbTransactions} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              {dbTransactions.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">Nincsenek rögzített POS tranzakciók.</p>
              ) : (
                <div className="overflow-y-auto max-h-96 space-y-1.5 pr-1">
                  {dbTransactions.map((tx) => (
                    <div key={tx.id} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm ${
                      dark ? 'bg-gray-700/50 border-gray-600' : 'bg-blue-50/50 border-blue-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-base">
                          {tx.payment_method === 'return' ? '↩️' : tx.payment_method === 'card' ? '💳' : tx.status === 'cancelled' ? '❌' : '💵'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-xs">{tx.receipt_number || tx.id.slice(0,8)}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(tx.created_at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {' · '}{tx.payment_method}
                            {tx.notes ? ` · ${tx.notes.slice(0, 30)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`font-bold text-sm ${tx.total_amount < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                          {Number(tx.total_amount || 0).toLocaleString('hu-HU')} Ft
                        </p>
                        <p className={`text-xs ${tx.status === 'completed' ? 'text-green-500' : tx.status === 'cancelled' ? 'text-red-400' : 'text-gray-400'}`}>
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!deviceInfo && !activeTransaction && (
            <div className="text-center py-12 text-gray-400">
              <AlertCircle className="h-12 w-12 mx-auto mb-3" />
              <p>Adatok betöltése…</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Pénzszintek */}
      {activeTab === 'levels' && (
        <div className="space-y-4">
          {/* Összesítő */}
          {levels.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Összes kazetta', val: levels.length, icon: '🗃️', cls: 'text-blue-600' },
                { label: 'Teli (>50%)', val: levels.filter(l => l.maxLevel > 0 && (l.level / l.maxLevel) > 0.5).length, icon: '✅', cls: 'text-green-600' },
                { label: 'Alacsony (<20%)', val: levels.filter(l => l.maxLevel > 0 && (l.level / l.maxLevel) < 0.2).length, icon: '⚠️', cls: 'text-red-600' },
                { label: 'Összes érték', val: formatHUF(levels.reduce((sum, l) => sum + (l.value ?? 0) * l.level, 0)), icon: '💵', cls: 'text-amber-600' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-4 border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <p className="text-xs text-gray-500 mb-1">{s.icon} {s.label}</p>
                  <p className={`text-2xl font-black ${s.cls}`}>{s.val}</p>
                </div>
              ))}
            </div>
          )}
          <div className={card}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              💰 Pénzkazetták tartalma
            </h2>
            {levels.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nincs adat</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {levels.map((level, idx) => {
                  const pct = level.maxLevel > 0 ? Math.min((level.level / level.maxLevel) * 100, 100) : 0
                  const totalVal = (level.value ?? 0) * level.level
                  const denomLabel = level.value
                    ? `${level.value.toLocaleString('hu-HU')} ${level.currency ?? 'HUF'}`
                    : (level.type ?? `Kazetta ${idx + 1}`)
                  const isLow = pct < 20
                  const isMed = pct >= 20 && pct < 50
                  return (
                    <div key={idx} className={`rounded-xl border overflow-hidden ${
                      isLow
                        ? (dark ? 'bg-red-950/20 border-red-700/40' : 'bg-red-50 border-red-200')
                        : isMed
                        ? (dark ? 'bg-yellow-950/20 border-yellow-700/40' : 'bg-yellow-50 border-yellow-200')
                        : (dark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200')
                    }`}>
                      {/* Color bar */}
                      <div className={`h-1.5 w-full ${isLow ? 'bg-red-500' : isMed ? 'bg-yellow-400' : 'bg-green-500'}`}
                           style={{ width: '100%' }}>
                        <div className={`h-full transition-all ${isLow ? 'bg-red-300' : isMed ? 'bg-yellow-200' : 'bg-green-300'}`}
                             style={{ width: `${pct}%` }} />
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-black text-gray-900 dark:text-white text-base">{denomLabel}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{level.type} · {level.routing ?? ''}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            isLow ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : isMed ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          }`}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Db:</span>
                            <span className="font-bold text-gray-900 dark:text-white text-lg">{level.level}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Float szint:</span>
                            <span className="text-gray-700 dark:text-gray-300">{level.floatLevel}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Max:</span>
                            <span className="text-gray-700 dark:text-gray-300">{level.maxLevel}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Kazetta értéke:</span>
                            <span className="font-black text-amber-600 dark:text-amber-400">
                              {totalVal > 0 ? formatHUF(totalVal) : '–'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isLow ? 'bg-red-500' : isMed ? 'bg-yellow-400' : 'bg-green-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Kasszák */}
      {activeTab === 'registers' && (
        <div className="space-y-4">
          <div className={card}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">🖥️ Regisztrált Kasszák</h2>
              <button
                onClick={() => setShowAddDevice(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                <Plus className="h-4 w-4" /> Új kassza
              </button>
            </div>

            {showAddDevice && (
              <div className={`mb-4 p-4 rounded-xl border ${dark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Új kassza hozzáadása</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'id', label: 'ID', placeholder: 'kassza2' },
                    { key: 'name', label: 'Név', placeholder: '2. pénztár' },
                    { key: 'ip', label: 'IP cím', placeholder: '192.168.1.105' },
                    { key: 'port', label: 'Port', placeholder: '50301' },
                    { key: 'username', label: 'Felhasználó', placeholder: 'balint' },
                    { key: 'password', label: 'Jelszó', placeholder: '****' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                      <input
                        value={(newDevice as any)[f.key]}
                        onChange={e => setNewDevice(d => ({ ...d, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        type={f.key === 'password' ? 'password' : 'text'}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleAddDevice} className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">Mentés</button>
                  <button onClick={() => setShowAddDevice(false)} className="px-4 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm">Mégsem</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {devices.map(d => (
                <div key={d.id} className={`flex items-center justify-between p-4 rounded-xl border ${dark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{d.name}</p>
                    <p className="text-sm text-gray-500">{d.protocol}://{d.ip}:{d.port} · {d.username}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestDevice(d.id)}
                      className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs"
                    >Test</button>
                    {d.id !== 'default' && (
                      <button
                        onClick={() => handleDeleteDevice(d.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      ><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Kifizetés */}
      {activeTab === 'withdrawal' && (
        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-orange-600" />
            💸 Kifizetés a gépből
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            A Cashmatic gép a megadott összeget fogja kiadni.
          </p>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Összeg (Ft)</label>
              <input
                type="number"
                value={withdrawalAmount}
                onChange={e => setWithdrawalAmount(e.target.value)}
                placeholder="pl. 5000"
                className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Ok / megjegyzés</label>
              <input
                type="text"
                value={withdrawalReason}
                onChange={e => setWithdrawalReason(e.target.value)}
                placeholder="Kifizetés"
                className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={handleWithdrawal}
              disabled={withdrawalLoading || !withdrawalAmount}
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              {withdrawalLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Banknote className="h-5 w-5" />}
              {withdrawalLoading ? 'Feldolgozás…' : 'Kifizetés indítása'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Befizetés */}
      {activeTab === 'deposit' && (
        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            💰 Befizetés / Feltöltés
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Indítsd el a befizetés folyamatát, majd helyezd be a készpénzt. A lezárás leállítja a feltöltést.
          </p>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Ok / megjegyzés</label>
              <input
                type="text"
                value={refillReason}
                onChange={e => setRefillReason(e.target.value)}
                placeholder="pl. napi feltöltés"
                className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleStartRefill}
                disabled={refillLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                {refillLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                {refillLoading ? 'Feldolgozás…' : 'Befizetés indítása'}
              </button>
              <button
                onClick={handleStopRefill}
                disabled={refillLoading}
                className="w-full py-3 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                {refillLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {refillLoading ? 'Feldolgozás…' : 'Befizetés lezárása'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Nyomtató */}
      {activeTab === 'printer' && (
        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            IP Nyomtató beállítások
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Hálózati (IP) nyomtató konfigurálása a blokknyomtatáshoz.
            Az adatok a böngészőben kerülnek mentésre és az összes nyomtatási folyamat ezt fogja használni.
          </p>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nyomtató neve</label>
              <input
                type="text"
                value={printerName}
                onChange={e => setPrinterName(e.target.value)}
                placeholder="pl. HP LaserJet"
                className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">IP-cím</label>
              <input
                type="text"
                value={printerIp}
                onChange={e => setPrinterIp(e.target.value)}
                placeholder="192.168.2.30"
                className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">A hálózati nyomtató IP-címe (HP859A35 → 192.168.2.30)</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Port</label>
                <input
                  type="text"
                  value={printerPort}
                  onChange={e => setPrinterPort(e.target.value)}
                  placeholder="9100"
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Általában 9100 (RAW)</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Protokoll</label>
                <select
                  value={printerProtocol}
                  onChange={e => setPrinterProtocol(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="RAW">RAW / JetDirect (9100)</option>
                  <option value="IPP">IPP (631)</option>
                  <option value="LPD">LPD (515)</option>
                </select>
              </div>
            </div>

            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              printerProtocol === 'RAW'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="text-sm">
                {printerProtocol === 'RAW' && (
                  <p className="text-blue-700 dark:text-blue-300">
                    <strong>RAW / JetDirect:</strong> Közvetlen nyomtatás a hálózaton (leggyorsabb). HP nyomtatókhoz ajánlott.
                    A szerver (server.js) net.Socket segítségével küld adatot a <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{printerIp}:{printerPort}</code> címre.
                  </p>
                )}
                {printerProtocol === 'IPP' && (
                  <p className="text-amber-700 dark:text-amber-300">
                    <strong>IPP:</strong> Internet Printing Protocol. Ha a HP nyomtatón engedélyezve van, a port általában 631.
                  </p>
                )}
                {printerProtocol === 'LPD' && (
                  <p className="text-amber-700 dark:text-amber-300">
                    <strong>LPD:</strong> Line Printer Daemon. Régebbi protokoll, port: 515.
                  </p>
                )}
              </div>
            </div>

            {printerSaved && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                <Check className="h-4 w-4" /> Mentve!
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  localStorage.setItem('printer_ip', printerIp)
                  localStorage.setItem('printer_port', printerPort)
                  localStorage.setItem('printer_name', printerName)
                  localStorage.setItem('printer_protocol', printerProtocol)
                  setPrinterSaved(true)
                  setTimeout(() => setPrinterSaved(false), 2500)
                  toast.success(`✅ Nyomtató mentve: ${printerName} (${printerIp}:${printerPort})`)
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Printer className="h-5 w-5" /> Mentés
              </button>
              <button
                onClick={() => {
                  const testMsg = `\x1B\x40Nyomtató teszt\n${printerName}\n${printerIp}:${printerPort}\n${new Date().toLocaleString('hu-HU')}\n\n\n`
                  navigator.clipboard.writeText(`Nyomtató IP: ${printerIp}:${printerPort}`)
                  toast(`ℹ️ IP a vágólapra másolva: ${printerIp}:${printerPort}\n\nA szerver oldali nyomtatás a server.js RAW socket küldéssel működik.`, { duration: 4000 })
                }}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
              >
                <Wifi className="h-4 w-4" /> IP másolás
              </button>
            </div>

            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
              <p className="font-semibold mb-1">💡 server.js nyomtatás aktiváláshoz add hozzá ezt a server.js-hez:</p>
              <pre className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded-lg overflow-x-auto border border-gray-200 dark:border-gray-600 whitespace-pre-wrap">{`const net = require('net');
app.post('/api/print', (req, res) => {
  const { data } = req.body;
  const client = new net.Socket();
  client.connect(${printerPort}, '${printerIp}', () => {
    client.write(Buffer.from(data, 'base64'));
    client.end();
    res.json({ success: true });
  });
  client.on('error', e => res.status(500).json({ success: false, message: e.message }));
});`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Kasszazárás */}
      {activeTab === 'closure' && (
        <div className="space-y-4">
          {/* Shop Status */}
          <div className={`rounded-2xl p-6 border ${
            shopOpen
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {shopOpen ? (
                  <>
                    <span className="text-green-600 dark:text-green-400">✅ Üzlet NYITVA</span>
                  </>
                ) : (
                  <>
                    <span className="text-red-600 dark:text-red-400">🔴 Üzlet ZÁRVA</span>
                  </>
                )}
              </h2>
              {lastClosureTime && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Zárva: {new Date(lastClosureTime).toLocaleString('hu-HU')}
                </span>
              )}
            </div>
          </div>

          {/* Closure Amount */}
          {closureAmount && (
            <div className={card}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                💰 Zárási Összeg
              </h2>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {closureAmount}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Ez az összeg a napi zárás időpontjában jelent meg a kasszán.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={card}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🔐 Kasszamunkamenet Kezelése
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Opening */}
              <button
                onClick={handleDailyOpening}
                disabled={shopOpen}
                className={`p-6 rounded-xl border-2 transition ${
                  shopOpen
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
              >
                <div className="text-2xl mb-2">🟢</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Kasszanyitás</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Napi üzlet megnyitása
                </p>
              </button>

              {/* Daily Closure */}
              <button
                onClick={handleDailyClosure}
                disabled={!shopOpen || closureLoading}
                className={`p-6 rounded-xl border-2 transition flex flex-col items-center ${
                  !shopOpen || closureLoading
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30'
                }`}
              >
                {closureLoading && <Loader className="h-5 w-5 animate-spin mb-2 text-red-600" />}
                {!closureLoading && <div className="text-2xl mb-2">🔐</div>}
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Kasszazárás</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Napi üzlet lezárása (zárási összeg lekérdezés)
                </p>
              </button>
            </div>
          </div>

          {/* Refresh Closure Amount */}
          <div className={card}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🔄 Zárási Összeg Frissítése
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              A kasszázárás nélkül is megtekintheted az aktuális zárási összeget.
            </p>
            <button
              onClick={handleGetClosureAmount}
              disabled={closureLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition"
            >
              {closureLoading && <Loader className="h-4 w-4 animate-spin" />}
              <RefreshCw className="h-4 w-4" />
              Zárási Összeg Lekérdezése
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
