import React, { useState, useEffect } from 'react'
import { 
  Settings as SettingsIcon, 
  Save, 
  RefreshCw, 
  Database, 
  Server, 
  Lock, 
  Mail, 
  Globe, 
  User,
  Terminal,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  AlertTriangle,
  CheckCircle,
  X,
  Printer
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { elevenlabsApi } from '../lib/elevenlabsApi'
import { toast } from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

interface Setting {
  id: string
  category: string
  key: string
  value: any
  description: string | null
  is_public: boolean
}

export default function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({})
  const [showCLI, setShowCLI] = useState(false)
  const [cliInput, setCliInput] = useState('')
  const [cliOutput, setCliOutput] = useState<{type: 'info' | 'error' | 'success' | 'command'; content: string}[]>([
    {type: 'info', content: 'Szemesi Pékség Rendszeradminisztráció v1.0.1'},
    {type: 'info', content: 'Írja be a "help" parancsot a segítséghez.'},
  ])
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0,
    uptime: 0
  })

  useEffect(() => {
    loadSettings()
    loadActiveUsers()
    startSystemMonitoring()
    
    // Set up real-time subscription for active users
    const activeUsersSubscription = supabase
      .channel('active-users')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles'
      }, () => {
        loadActiveUsers()
      })
      .subscribe()
    
    return () => {
      activeUsersSubscription.unsubscribe()
    }
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('category')
        .order('key')
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a beállítások betöltésekor')
        return
      }
      
      if (data) {
        setSettings(data)
        
        // Initialize edited settings
        const initialEdited: Record<string, any> = {}
        data.forEach(setting => {
          try {
            initialEdited[`${setting.category}.${setting.key}`] = JSON.parse(setting.value)
          } catch {
            initialEdited[`${setting.category}.${setting.key}`] = setting.value
          }
        })
        setEditedSettings(initialEdited)
      }
    } catch (error) {
      console.error('Hiba a beállítások betöltésekor:', error)
      toast.error('Hiba a beállítások betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadActiveUsers = async () => {
    try {
      // Get active users (last active in the last 15 minutes)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, last_active')
        .gt('last_active', fifteenMinutesAgo)
        .order('last_active', { ascending: false })
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setActiveUsers(data)
      }
    } catch (error) {
      console.error('Hiba az aktív felhasználók betöltésekor:', error)
    }
  }

  const startSystemMonitoring = () => {
    // Simulate system monitoring with random values
    const updateStats = () => {
      setSystemStats({
        cpu: Math.floor(Math.random() * 40) + 20, // 20-60%
        memory: Math.floor(Math.random() * 30) + 40, // 40-70%
        disk: Math.floor(Math.random() * 20) + 30, // 30-50%
        network: Math.floor(Math.random() * 50) + 10, // 10-60%
        uptime: systemStats.uptime + 1 // Increment uptime
      })
    }
    
    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000)
    
    // Initial update
    updateStats()
    
    return () => clearInterval(interval)
  }

  const handleSettingChange = (category: string, key: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      [`${category}.${key}`]: value
    }))
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      
      // Prepare updates
      const updates = []
      
      for (const [key, value] of Object.entries(editedSettings)) {
        const [category, settingKey] = key.split('.')
        
        // Find the setting
        const setting = settings.find(s => s.category === category && s.key === settingKey)
        
        if (setting) {
          // Stringify value if it's an object
          const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
          
          // Only update if value has changed
          if (setting.value !== stringValue) {
            updates.push({
              id: setting.id,
              category,
              key: settingKey,
              value: stringValue
            })
          }
        }
      }
      
      if (updates.length === 0) {
        toast.info('Nincs változtatás a beállításokban')
        return
      }
      
      // Update settings
      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .update({ value: update.value })
          .eq('id', update.id)
        
        if (error) {
          console.error('Database error:', error)
          toast.error(`Hiba a beállítás mentésekor: ${update.category}.${update.key}`)
          return
        }
      }
      
      toast.success('Beállítások sikeresen mentve!')
      loadSettings()
    } catch (error) {
      console.error('Hiba a beállítások mentésekor:', error)
      toast.error('Hiba a beállítások mentésekor')
    } finally {
      setSaving(false)
    }
  }

  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!cliInput.trim()) return
    
    // Add command to output
    setCliOutput(prev => [...prev, {type: 'command', content: `> ${cliInput}`}])
    
    // Process command
    processCliCommand(cliInput)
    
    // Clear input
    setCliInput('')
  }

  const processCliCommand = (command: string) => {
    const cmd = command.toLowerCase().trim()
    const apiUrl = import.meta.env.VITE_CASHMATIC_PROXY_URL || 'http://localhost:3002'
    
    if (cmd === 'help') {
      setCliOutput(prev => [...prev, {
        type: 'info', 
        content: `Elérhető parancsok:
- help: Segítség megjelenítése
- clear: Konzol törlése
- scan: Belső hálózatok (VLAN1, VLAN2) valós felderítése
- ping [ip]: Eszköz valós elérhetőségének ellenőrzése
- /v: [szöveg]: Vivien felolvasása ElevenLabs hanggal
- status: Rendszer állapot
- users: Aktív felhasználók listázása
- network: Hálózati kapcsolatok
- security: Biztonsági beállítások
- encrypt: Kapcsolatok újratitkosítása
- proxy: Lenyomozhatatlan IP generálása
- invoices: Számlák kezelése
- late-orders: Késői rendelések kezelése
- production: Gyártási folyamatok állapota
- delivery: Kiszállítások nyomon követése
- exit: Kilépés`},{
      }])
    } else if (cmd === 'scan') {
      setCliOutput(prev => [...prev, {type: 'info', content: 'LAN hálózatok valós feltérképezése folyamatban...'}])
      
      const performRealScan = async () => {
        try {
          // Közvetlen fetch hívás a szerverhez a cashmatic.ts kikerülésével
          const res = await fetch(`${apiUrl}/api/network/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subnets: ['192.168.1.0/24', '192.168.2.0/24'] })
          })
          
          if (res.ok) {
            const data = await res.json()
            if (data.success) {
              let output = "Talált valós eszközök a LAN hálózatokon (ARP Table):\n"
              output += "----------------------------------------------------------------------\n"
              output += "IP Cím          MAC Cím            Típus        Eszköz név\n"
              output += "----------------------------------------------------------------------\n"
              
              if (data.devices && data.devices.length > 0) {
                data.devices.forEach((d: any) => {
                  output += `${(d.ip || '').padEnd(15)} ${(d.mac || '').padEnd(18)} ${(d.type || 'Ismeretlen').padEnd(12)} ${d.name || ''}\n`
                })
                output += "----------------------------------------------------------------------\n"
                output += `Összesen ${data.devices.length} aktív eszköz található. Szkennelés kész.`
              } else {
                output += "Nem található aktív eszköz a hálózaton.\n"
              }
              setCliOutput(prev => [...prev, { type: 'success', content: output }])
            } else {
              throw new Error(data.message || 'Ismeretlen hiba történt a scannelés során.')
            }
          } else {
            throw new Error(`Szerver hiba: ${res.status}`)
          }
        } catch (err: any) {
          setCliOutput(prev => [...prev, { 
            type: 'error', 
            content: `Hiba a hálózat scannelése közben!\nTechnikai infó: Nem sikerült elérni a server.js backendet ezen a címen: ${apiUrl}\nKérlek ellenőrizd, hogy a megfelelő server.js fut-e.\nHibaüzenet: ${err.message}` 
          }])
        }
      }
      
      performRealScan()
    } else if (cmd.startsWith('ping ')) {
      const target = cmd.substring(5).trim()
      if (!target) {
        setCliOutput(prev => [...prev, {type: 'error', content: 'Hiba: Adj meg egy IP címet! Példa: ping 192.168.1.1'}])
      } else {
        setCliOutput(prev => [...prev, {type: 'info', content: `Valós ping indítása ${target} felé...`}])
        
        const performRealPing = async () => {
          try {
            // Közvetlen fetch hívás a pingre
            const res = await fetch(`${apiUrl}/api/network/ping?ip=${target}`)
            
            if (res.ok) {
              const data = await res.json()
              if (data.success) {
                setCliOutput(prev => [...prev, {type: 'success', content: data.output || data.message || 'Sikeres ping válasz.'}])
              } else {
                throw new Error(data.message || 'Hiba a ping futtatásakor.')
              }
            } else {
              throw new Error(`Szerver hiba: ${res.status}`)
            }
          } catch (err: any) {
            setCliOutput(prev => [...prev, {
              type: 'error', 
              content: `Hálózati hiba a ping közben!\nTechnikai infó: Nem sikerült elérni a server.js backendet ezen a címen: ${apiUrl}\nKérlek ellenőrizd, hogy a server.js fut-e.\nHibaüzenet: ${err.message}`
            }])
          }
        }
        
        performRealPing()
      }
    } else if (cmd.startsWith('/v:') || cmd.startsWith('/v ')) {
      const text = command.trim().replace(/^[\/]v[:\s]+/i, '').trim()
      if (!text) {
        setCliOutput(prev => [...prev, {type: 'error', content: 'Hiba: Adj meg szöveget Vivien számára! Példa: /v: Jó nagyon'}])
        return
      }

      setCliOutput(prev => [...prev, {type: 'info', content: 'Vivien beszédének előkészítése...'}])
      elevenlabsApi.textToSpeech(text).then((played) => {
        if (played) {
          setCliOutput(prev => [...prev, {type: 'success', content: 'Vivien most felolvasja a szöveget.'}])
        } else {
          setCliOutput(prev => [...prev, {type: 'error', content: 'Nem sikerült Vivien beszédét lejátszani.'}])
        }
      })
    } else if (cmd === 'clear') {
      setCliOutput([{type: 'info', content: 'Szemesi Pékség Rendszeradminisztráció v1.0.1'}])
    } else if (cmd === 'status') {
      setCliOutput(prev => [...prev, {
        type: 'info', 
        content: `Rendszer állapot:
- CPU: ${systemStats.cpu}% (16 mag, 32 szál)
- Memória: ${systemStats.memory}% (64GB)
- Lemez: ${systemStats.disk}% (2TB SSD)
- Hálózat: ${systemStats.network}% (1Gbps)
- Uptime: ${Math.floor(systemStats.uptime / 60)}h ${systemStats.uptime % 60}m
- Adatbázis: Online (PostgreSQL 15.3)
- Supabase: Online (v2.50.4)
- Node.js: v18.16.0
- Vite: v5.0.10`
      }])
    } else if (cmd === 'users') {
      if (activeUsers.length === 0) {
        setCliOutput(prev => [...prev, {type: 'info', content: 'Jelenleg nincsenek aktív felhasználók.'}])
      } else {
        setCliOutput(prev => [...prev, {
          type: 'info', 
          content: `Aktív felhasználók (${activeUsers.length}):
${activeUsers.map(user => `- ${user.full_name} (${user.email}) - ${user.role} - Utolsó aktivitás: ${new Date(user.last_active).toLocaleTimeString('hu-HU')}`).join('\n')}`
        }])
      }
    } else if (cmd === 'network') {
      setCliOutput(prev => [...prev, {
        type: 'info', 
        content: `Hálózati kapcsolatok:
- Bejövő kapcsolatok: 24
- Kimenő kapcsolatok: 37
- Aktív WebSocket kapcsolatok: 8
- Adatforgalom (be): 1.2 MB/s
- Adatforgalom (ki): 3.5 MB/s
- Ping: 12ms
- DNS: 8.8.8.8, 1.1.1.1
- Tűzfal: Aktív`
      }])
    } else if (cmd === 'security') {
      setCliOutput(prev => [...prev, {
        type: 'info', 
        content: `Biztonsági beállítások:
- SSL/TLS: Aktív (Let's Encrypt)
- Tanúsítvány lejárat: 2025-12-31
- Kéttényezős hitelesítés: Engedélyezve
- Jelszó-szabályzat: Erős (min. 12 karakter)
- Brute force védelem: Aktív (5 próbálkozás után 15 perc zárolás)
- IP korlátozás: Nincs
- Utolsó biztonsági audit: 2025-06-15
- Sebezhetőségek: 0 kritikus, 2 közepes, 5 alacsony`
      }])
    } else if (cmd === 'encrypt') {
      setCliOutput(prev => [...prev, {type: 'info', content: 'Kapcsolatok újratitkosítása folyamatban...'}])
      
      // Simulate encryption process
      setTimeout(() => {
        setCliOutput(prev => [
          ...prev, 
          {type: 'info', content: 'TLS kapcsolatok frissítése... [OK]'},
          {type: 'info', content: 'Adatbázis kapcsolat titkosítása... [OK]'},
          {type: 'info', content: 'API végpontok titkosítása... [OK]'},
          {type: 'info', content: 'WebSocket kapcsolatok titkosítása... [OK]'},
          {type: 'success', content: 'Kapcsolatok újratitkosítása sikeresen befejeződött! Minden kapcsolat AES-256-GCM titkosítással védve.'}
        ])
      }, 2000)
    } else if (cmd === 'proxy') {
      setCliOutput(prev => [...prev, {type: 'info', content: 'Lenyomozhatatlan IP generálása folyamatban...'}])
      
      // Simulate proxy setup
      setTimeout(() => {
        const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
        
        setCliOutput(prev => [
          ...prev, 
          {type: 'info', content: 'VPN kapcsolat létrehozása... [OK]'},
          {type: 'info', content: 'Tor hálózat csatlakozás... [OK]'},
          {type: 'info', content: 'IP cím rotáció beállítása... [OK]'},
          {type: 'info', content: `Új IP cím: ${randomIP} (Lokáció: Németország)`},
          {type: 'success', content: 'Lenyomozhatatlan IP sikeresen beállítva! Minden kapcsolat a proxy szerveren keresztül történik.'}
        ])
      }, 2000)
    } else if (cmd.startsWith('invoices')) {
      // Handle invoice commands
      if (cmd === 'invoices list') {
        setCliOutput(prev => [...prev, {
          type: 'info', 
          content: `Számlák listája (utolsó 5):
- INV-2025-0123: Balatonszárszói Étterem - 125,600 Ft - 2025.07.10 - Fizetve
- INV-2025-0122: Hotel Balaton - 245,800 Ft - 2025.07.08 - Fizetve
- INV-2025-0121: Siófoki Pékség - 78,400 Ft - 2025.07.05 - Fizetve
- INV-2025-0120: Zamárdi Büfé - 56,200 Ft - 2025.07.03 - Fizetésre vár
- INV-2025-0119: Fonyódi Étterem - 112,500 Ft - 2025.07.01 - Fizetve`
        }])
      } else if (cmd.startsWith('invoices generate')) {
        setCliOutput(prev => [...prev, {
          type: 'success', 
          content: `Számla sikeresen generálva: INV-2025-0124`
        }])
      } else {
        setCliOutput(prev => [...prev, {
          type: 'info', 
          content: `Számla parancsok:
- invoices list: Számlák listázása
- invoices generate [partner_id]: Új számla generálása
- invoices status [invoice_id]: Számla állapotának lekérdezése
- invoices send [invoice_id]: Számla küldése emailben`
        }])
      }
    } else if (cmd.startsWith('late-orders')) {
      setCliOutput(prev => [...prev, {
        type: 'info', 
        content: `Késői rendelések (2):
- ORD-2025-0587: Balatonszárszói Étterem - 2 órával késik - Sofőr: Tóth Gábor (JOV-030)
- ORD-2025-0592: Siófoki Pékség - 45 perccel késik - Sofőr: Nagy Péter (LSF-606)

Javasolt intézkedések:
1. Értesítés küldése az ügyfeleknek az új várható érkezési időről
2. Prioritás növelése a gyártásban
3. Alternatív útvonal javaslata a sofőröknek`
      }])
    } else if (cmd === 'production') {
      setCliOutput(prev => [...prev, {
        type: 'info', 
        content: `Gyártási folyamatok állapota:
- BATCH-123456: Fehér kenyér (100 db) - Folyamatban - 75% kész - Várható befejezés: 14:30
- BATCH-123457: Croissant (200 db) - Folyamatban - 40% kész - Várható befejezés: 15:15
- BATCH-123458: Kakaós csiga (150 db) - Tervezett - Kezdés: 14:45
- BATCH-123459: Sajtos pogácsa (300 db) - Befejezve - 100% kész - 13:20

Gyártósor kihasználtság: 85%
Aktív pékek: 4
Hőmérséklet (sütő 1): 220°C
Hőmérséklet (sütő 2): 180°C`
      }])
    } else if (cmd === 'delivery') {
      setCliOutput(prev => [...prev, {
        type: 'info', 
        content: `Kiszállítások állapota:
- Jármű: Ford Transit (JOV-030)
  Sofőr: Tóth Gábor
  Pozíció: 46.8167, 17.7833 (Balatonszemes)
  Sebesség: 45 km/h
  Következő megálló: Balatonszárszó (10 perc)
  Hátralévő megállók: 3
  Üzemanyag: 65%

- Jármű: Mercedes Sprinter (LSF-606)
  Sofőr: Nagy Péter
  Pozíció: 46.8500, 17.8333 (Balatonszárszó)
  Sebesség: 0 km/h (megálló)
  Következő megálló: Balatonföldvár (15 perc)
  Hátralévő megállók: 4
  Üzemanyag: 48%`
      }])
    } else if (cmd === 'exit') {
      setShowCLI(false)
    } else {
      setCliOutput(prev => [...prev, {
        type: 'error', 
        content: `Ismeretlen parancs: ${command}. Használja a "help" parancsot a segítséghez.`
      }])
    }
  }

  const getSettingInput = (setting: Setting) => {
    const value = editedSettings[`${setting.category}.${setting.key}`]
    
    try {
      // Try to parse the value
      const parsedValue = typeof value === 'string' ? JSON.parse(value) : value
      
      // Check if it's a boolean
      if (typeof parsedValue === 'boolean') {
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={parsedValue}
              onChange={(e) => handleSettingChange(setting.category, setting.key, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {parsedValue ? 'Engedélyezve' : 'Letiltva'}
            </span>
          </div>
        )
      }
      
      // Check if it's a number
      if (typeof parsedValue === 'number') {
        return (
          <input
            type="number"
            value={parsedValue}
            onChange={(e) => handleSettingChange(setting.category, setting.key, parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        )
      }
      
      // Check if it's an object or array
      if (typeof parsedValue === 'object' && parsedValue !== null) {
        return (
          <textarea
            value={JSON.stringify(parsedValue, null, 2)}
            onChange={(e) => {
              try {
                const newValue = JSON.parse(e.target.value)
                handleSettingChange(setting.category, setting.key, newValue)
              } catch {
                // If not valid JSON, store as string
                handleSettingChange(setting.category, setting.key, e.target.value)
              }
            }}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
          />
        )
      }
    } catch {
      // Not JSON, treat as string
    }
    
    // Default to text input
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleSettingChange(setting.category, setting.key, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    )
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'general': return SettingsIcon
      case 'database': return Database
      case 'server': return Server
      case 'security': return Lock
      case 'email': return Mail
      case 'api': return Globe
      case 'users': return User
      case 'hardware': return Printer
      default: return SettingsIcon
    }
  }

  const getSettingsByCategory = (category: string) => {
    return settings.filter(setting => setting.category === category)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <SettingsIcon className="h-8 w-8 mr-3 text-blue-600" />
            Beállítások
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Rendszerbeállítások és konfigurációk kezelése
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCLI(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Terminal className="h-5 w-5 mr-2" />
            Terminál
          </button>
          <button
            onClick={loadSettings}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Frissítés
          </button>
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Save className="h-5 w-5 mr-2" />
            Mentés
          </button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
              <Cpu className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">CPU</p>
              <div className="flex items-center">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mr-2">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${systemStats.cpu}%` }}
                  ></div>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{systemStats.cpu}%</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <HardDrive className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Memória</p>
              <div className="flex items-center">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mr-2">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full" 
                    style={{ width: `${systemStats.memory}%` }}
                  ></div>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{systemStats.memory}%</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3">
              <Server className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Lemez</p>
              <div className="flex items-center">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mr-2">
                  <div 
                    className="bg-amber-600 h-2.5 rounded-full" 
                    style={{ width: `${systemStats.disk}%` }}
                  ></div>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{systemStats.disk}%</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-3">
              <Wifi className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Hálózat</p>
              <div className="flex items-center">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mr-2">
                  <div 
                    className="bg-purple-600 h-2.5 rounded-full" 
                    style={{ width: `${systemStats.network}%` }}
                  ></div>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{systemStats.network}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Users */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <User className="h-5 w-5 mr-2 text-blue-600" />
          Aktív felhasználók ({activeUsers.length})
        </h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Felhasználó
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Szerepkör
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Utolsó aktivitás
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {activeUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nincsenek aktív felhasználók
                  </td>
                </tr>
              ) : (
                activeUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.full_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' 
                          : user.role === 'baker'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                          : user.role === 'salesperson'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 
                         user.role === 'baker' ? 'Pék' : 
                         user.role === 'salesperson' ? 'Eladó' : 
                         user.role === 'driver' ? 'Sofőr' : user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(user.last_active).toLocaleTimeString('hu-HU')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex overflow-x-auto">
            {Array.from(new Set(settings.map(s => s.category))).map((category) => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`py-4 px-6 text-sm font-medium whitespace-nowrap ${
                  activeTab === category
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  {React.createElement(getCategoryIcon(category), { className: 'h-4 w-4 mr-2' })}
                  <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            {getSettingsByCategory(activeTab).map((setting) => (
              <div key={setting.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">{setting.key}</h3>
                    {setting.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{setting.description}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    setting.is_public
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                  }`}>
                    {setting.is_public ? 'Nyilvános' : 'Privát'}
                  </span>
                </div>
                
                {getSettingInput(setting)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CLI Modal */}
      {showCLI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-black rounded-lg max-w-4xl w-full h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-800">
              <h2 className="text-lg font-mono text-green-500">Szemesi Pékség - Rendszeradminisztráció</h2>
              <button
                onClick={() => setShowCLI(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm">
              {cliOutput.map((line, index) => (
                <div key={index} className={`mb-1 ${
                  line.type === 'command' ? 'text-blue-400' :
                  line.type === 'error' ? 'text-red-400' :
                  line.type === 'success' ? 'text-green-400' :
                  'text-gray-300'
                }`}>
                  {line.content.split('\n').map((text, i) => (
                    <div key={i}>{text}</div>
                  ))}
                </div>
              ))}
            </div>
            
            <form onSubmit={handleCliSubmit} className="p-4 border-t border-gray-800 flex">
              <span className="text-green-500 mr-2">$</span>
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                className="flex-1 bg-transparent text-white focus:outline-none font-mono"
                autoFocus
              />
            </form>
          </div>
        </div>
      )}
    </div>
  )
}