import React, { useState, useEffect } from 'react'
import { X, Printer, Wifi, Check, Globe, Settings } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PrinterConfig {
  name: string
  ip: string
  port: string
  protocol: string
}

interface PrinterSettingsModalProps {
  moduleKey: string          // e.g. 'invoices', 'delivery', 'documents'
  moduleLabel?: string       // e.g. 'Számlák', 'Szállítólevelek'
  onClose: () => void
  onSave?: (config: PrinterConfig) => void
}

function getStorageKey(moduleKey: string, field: string) {
  return `printer_${moduleKey}_${field}`
}

export function getPrinterConfig(moduleKey: string): PrinterConfig {
  const globalName = localStorage.getItem('printer_name') || import.meta.env.VITE_PRINTER_NAME || 'HP Nyomtató'
  const globalIp   = localStorage.getItem('printer_ip')   || import.meta.env.VITE_PRINTER_IP   || '192.168.2.30'
  const globalPort = localStorage.getItem('printer_port') || import.meta.env.VITE_PRINTER_PORT  || '9100'
  const globalProto = localStorage.getItem('printer_protocol') || 'RAW'

  return {
    name:     localStorage.getItem(getStorageKey(moduleKey, 'name'))     || globalName,
    ip:       localStorage.getItem(getStorageKey(moduleKey, 'ip'))       || globalIp,
    port:     localStorage.getItem(getStorageKey(moduleKey, 'port'))     || globalPort,
    protocol: localStorage.getItem(getStorageKey(moduleKey, 'protocol')) || globalProto,
  }
}

export default function PrinterSettingsModal({
  moduleKey,
  moduleLabel = 'Modul',
  onClose,
  onSave
}: PrinterSettingsModalProps) {
  const [config, setConfig] = useState<PrinterConfig>(() => getPrinterConfig(moduleKey))
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)

  const update = (field: keyof PrinterConfig, value: string) =>
    setConfig(prev => ({ ...prev, [field]: value }))

  const handleSave = () => {
    localStorage.setItem(getStorageKey(moduleKey, 'name'),     config.name)
    localStorage.setItem(getStorageKey(moduleKey, 'ip'),       config.ip)
    localStorage.setItem(getStorageKey(moduleKey, 'port'),     config.port)
    localStorage.setItem(getStorageKey(moduleKey, 'protocol'), config.protocol)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    toast.success(`✅ Nyomtató mentve: ${config.name} (${config.ip}:${config.port})`)
    onSave?.(config)
  }

  const handleTest = async () => {
    setTesting(true)
    await navigator.clipboard.writeText(`${config.ip}:${config.port}`)
    toast(`🖨️ Kapcsolat teszt: ${config.name}\nIP: ${config.ip}:${config.port}\n\nAz IP a vágólapra másolva.`, { duration: 3500 })
    setTesting(false)
  }

  const handleUseGlobal = () => {
    const global: PrinterConfig = {
      name:     localStorage.getItem('printer_name')     || import.meta.env.VITE_PRINTER_NAME || 'HP Nyomtató',
      ip:       localStorage.getItem('printer_ip')       || import.meta.env.VITE_PRINTER_IP   || '192.168.2.30',
      port:     localStorage.getItem('printer_port')     || import.meta.env.VITE_PRINTER_PORT  || '9100',
      protocol: localStorage.getItem('printer_protocol') || 'RAW',
    }
    setConfig(global)
    toast('ℹ️ Globális nyomtató beállítások betöltve', { icon: 'ℹ️' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#1a1f2e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-white">Nyomtató beállítás</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-5 text-xs text-gray-400 mb-4">
          {moduleLabel} modul nyomtatója — a beállítás csak ennél a modulnál érvényes.
        </p>

        {/* Current printer card */}
        <div className="mx-5 mb-5 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Printer className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{config.name}</p>
              <p className="text-xs text-blue-400 font-mono">{config.ip}:{config.port}</p>
            </div>
          </div>
          <a
            href={`http://${config.ip}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Wifi className="h-3 w-3" /> Webfelület
          </a>
        </div>

        {/* Form */}
        <div className="px-5 space-y-4">
          {/* Printer name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Nyomtató neve
            </label>
            <input
              type="text"
              value={config.name}
              onChange={e => update('name', e.target.value)}
              placeholder="pl. HP LaserJet"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* IP + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                IP-cím
              </label>
              <input
                type="text"
                value={config.ip}
                onChange={e => update('ip', e.target.value)}
                placeholder="192.168.2.30"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Port
              </label>
              <input
                type="text"
                value={config.port}
                onChange={e => update('port', e.target.value)}
                placeholder="9100"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Protocol */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Protokoll
            </label>
            <select
              value={config.protocol}
              onChange={e => update('protocol', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="RAW">RAW / JetDirect (9100)</option>
              <option value="IPP">IPP (631)</option>
              <option value="LPD">LPD (515)</option>
            </select>
          </div>

          {/* Global button */}
          <button
            onClick={handleUseGlobal}
            className="w-full py-2 border border-white/10 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Globális nyomtató beállítások átvétele
          </button>
        </div>

        {/* Footer buttons */}
        <div className="px-5 pb-5 pt-4 space-y-2.5 mt-2">
          {/* Test connection */}
          <button
            onClick={handleTest}
            disabled={testing}
            className="w-full py-3 flex items-center justify-center gap-2 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Wifi className="h-4 w-4" />
            Kapcsolat teszt
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {saved ? (
              <><Check className="h-4 w-4" /> Mentve!</>
            ) : (
              <><Printer className="h-4 w-4" /> Mentés</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
