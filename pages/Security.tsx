import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Shield, RefreshCw, Settings, X, Maximize2,
  Camera as CameraIcon, Wifi, WifiOff, AlertTriangle,
  Play, Pause, RotateCcw, ExternalLink, ChevronLeft,
  Video, Key, CheckCircle, Brain, Bell, BellOff,
  Eye, EyeOff, Car, User, Scan, ChevronDown, ChevronUp,
  Mail, Zap, ZapOff, Activity, Clock
} from 'lucide-react'
import {
  loadAIConfig, saveAIConfig, analyzeCamera, getAlerts,
  translateLabel, buildAlertEmail, DEFAULT_AI_CONFIG,
  type AIConfig, type DetectionResult, type DetectedObject, type LicensePlate
} from '../lib/aiDetection'
import { sendEmail } from '../lib/emailService'
import { useNotifications } from '../contexts/NotificationContext'

// ─── Admin értesítési célpontok ───────────────────────────────────────────
const ADMIN_EMAILS = ['admin@szemesipekseg.hu', 'pal.konecsny@outlook.hu']

// ─── Konfiguráció ───────────────────────────────────────────────────────────
const BI_PROXY = '/bi-proxy'
const STORAGE_KEY = 'bi_config_v2'

interface BIConfig {
  serverUrl: string
  username: string
  password: string
}

function loadConfig(): BIConfig {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return {
    serverUrl: 'http://45.130.240.216:82',
    username: 'Web',
    password: '12345678Aa!',
  }
}

// ─── MD5 ────────────────────────────────────────────────────────────────────
function md5(inputStr: string): string {
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xffff)
  }
  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt))
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b)
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn((b & c) | (~b & d), a, b, x, s, t) }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t) }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn(b ^ c ^ d, a, b, x, s, t) }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn(c ^ (b | ~d), a, b, x, s, t) }
  function md5blks(s: string): number[] {
    const nblk = ((s.length + 8) >> 6) + 1
    const blks: number[] = new Array(nblk * 16).fill(0)
    for (let i = 0; i < s.length; i++) blks[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8)
    blks[s.length >> 2] |= 0x80 << ((s.length % 4) * 8)
    blks[nblk * 16 - 2] = s.length * 8
    return blks
  }
  function binl2hex(binarray: number[]): string {
    const hex = '0123456789abcdef'; let str = ''
    for (let i = 0; i < binarray.length * 4; i++) {
      str += hex.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) + hex.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xf)
    }
    return str
  }
  function coreMD5(x: number[], len: number): number[] {
    x[len >> 5] |= 0x80 << (len % 32); x[(((len + 64) >>> 9) << 4) + 14] = len
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878
    for (let i = 0; i < x.length; i += 16) {
      const olda = a, oldb = b, oldc = c, oldd = d
      a = md5ff(a,b,c,d,x[i+ 0], 7,-680876936);  d = md5ff(d,a,b,c,x[i+ 1],12,-389564586)
      c = md5ff(c,d,a,b,x[i+ 2],17, 606105819);  b = md5ff(b,c,d,a,x[i+ 3],22,-1044525330)
      a = md5ff(a,b,c,d,x[i+ 4], 7,-176418897);  d = md5ff(d,a,b,c,x[i+ 5],12, 1200080426)
      c = md5ff(c,d,a,b,x[i+ 6],17,-1473231341); b = md5ff(b,c,d,a,x[i+ 7],22,-45705983)
      a = md5ff(a,b,c,d,x[i+ 8], 7, 1770035416); d = md5ff(d,a,b,c,x[i+ 9],12,-1958414417)
      c = md5ff(c,d,a,b,x[i+10],17,-42063);       b = md5ff(b,c,d,a,x[i+11],22,-1990404162)
      a = md5ff(a,b,c,d,x[i+12], 7, 1804603682); d = md5ff(d,a,b,c,x[i+13],12,-40341101)
      c = md5ff(c,d,a,b,x[i+14],17,-1502002290); b = md5ff(b,c,d,a,x[i+15],22, 1236535329)
      a = md5gg(a,b,c,d,x[i+ 1], 5,-165796510);  d = md5gg(d,a,b,c,x[i+ 6], 9,-1069501632)
      c = md5gg(c,d,a,b,x[i+11],14, 643717713);   b = md5gg(b,c,d,a,x[i+ 0],20,-373897302)
      a = md5gg(a,b,c,d,x[i+ 5], 5,-701558691);  d = md5gg(d,a,b,c,x[i+10], 9, 38016083)
      c = md5gg(c,d,a,b,x[i+15],14,-660478335);   b = md5gg(b,c,d,a,x[i+ 4],20,-405537848)
      a = md5gg(a,b,c,d,x[i+ 9], 5, 568446438);  d = md5gg(d,a,b,c,x[i+14], 9,-1019803690)
      c = md5gg(c,d,a,b,x[i+ 3],14,-187363961);   b = md5gg(b,c,d,a,x[i+ 8],20, 1163531501)
      a = md5gg(a,b,c,d,x[i+13], 5,-1444681467); d = md5gg(d,a,b,c,x[i+ 2], 9,-51403784)
      c = md5gg(c,d,a,b,x[i+ 7],14, 1735328473);  b = md5gg(b,c,d,a,x[i+12],20,-1926607734)
      a = md5hh(a,b,c,d,x[i+ 5], 4,-378558);      d = md5hh(d,a,b,c,x[i+ 8],11,-2022574463)
      c = md5hh(c,d,a,b,x[i+11],16, 1839030562);  b = md5hh(b,c,d,a,x[i+14],23,-35309556)
      a = md5hh(a,b,c,d,x[i+ 1], 4,-1530992060); d = md5hh(d,a,b,c,x[i+ 4],11, 1272893353)
      c = md5hh(c,d,a,b,x[i+ 7],16,-155497632);   b = md5hh(b,c,d,a,x[i+10],23,-1094730640)
      a = md5hh(a,b,c,d,x[i+13], 4, 681279174);  d = md5hh(d,a,b,c,x[i+ 0],11,-358537222)
      c = md5hh(c,d,a,b,x[i+ 3],16,-722521979);   b = md5hh(b,c,d,a,x[i+ 6],23, 76029189)
      a = md5hh(a,b,c,d,x[i+ 9], 4,-640364487);  d = md5hh(d,a,b,c,x[i+12],11,-421815835)
      c = md5hh(c,d,a,b,x[i+15],16, 530742520);   b = md5hh(b,c,d,a,x[i+ 2],23,-995338651)
      a = md5ii(a,b,c,d,x[i+ 0], 6,-198630844);  d = md5ii(d,a,b,c,x[i+ 7],10, 1126891415)
      c = md5ii(c,d,a,b,x[i+14],15,-1416354905);  b = md5ii(b,c,d,a,x[i+ 5],21,-57434055)
      a = md5ii(a,b,c,d,x[i+12], 6, 1700485571); d = md5ii(d,a,b,c,x[i+ 3],10,-1894986606)
      c = md5ii(c,d,a,b,x[i+10],15,-1051523);     b = md5ii(b,c,d,a,x[i+ 1],21,-2054922799)
      a = md5ii(a,b,c,d,x[i+ 8], 6, 1873313359); d = md5ii(d,a,b,c,x[i+15],10,-30611744)
      c = md5ii(c,d,a,b,x[i+ 6],15,-1560198380);  b = md5ii(b,c,d,a,x[i+13],21, 1309151649)
      a = md5ii(a,b,c,d,x[i+ 4], 6,-145523070);  d = md5ii(d,a,b,c,x[i+11],10,-1120210379)
      c = md5ii(c,d,a,b,x[i+ 2],15, 718787259);   b = md5ii(b,c,d,a,x[i+ 9],21,-343485551)
      a = safeAdd(a, olda); b = safeAdd(b, oldb); c = safeAdd(c, oldc); d = safeAdd(d, oldd)
    }
    return [a, b, c, d]
  }
  const blks = md5blks(inputStr)
  return binl2hex(coreMD5(blks, inputStr.length * 8))
}

// ─── Blue Iris API ──────────────────────────────────────────────────────────
interface BiCamera {
  optionValue: string
  optionDisplay: string
  FPS?: number
  clipsCreated?: number
  noRecord?: boolean
  ptz?: boolean
  online?: number
  width?: number
  height?: number
  isAlerting?: boolean
}

async function biLogin(cfg: BIConfig): Promise<string | null> {
  try {
    const res1 = await fetch(`${BI_PROXY}/json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: 'login' }) })
    if (!res1.ok) return null
    const data1 = await res1.json()
    const session = data1.session
    if (!session) return null
    const responseHash = md5(`${cfg.username}:${session}:${cfg.password}`)
    const res2 = await fetch(`${BI_PROXY}/json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: 'login', user: cfg.username, response: responseHash, session }) })
    if (!res2.ok) return null
    const data2 = await res2.json()
    if (data2.result === 'success' && data2.session) return data2.session as string
    const res3 = await fetch(`${BI_PROXY}/json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: 'login', user: cfg.username, password: cfg.password, session }) })
    if (!res3.ok) return null
    const data3 = await res3.json()
    if (data3.result === 'success' && data3.session) return data3.session as string
    return null
  } catch { return null }
}

async function biCamList(session: string): Promise<BiCamera[]> {
  try {
    const res = await fetch(`${BI_PROXY}/json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: 'camlist', session }) })
    if (!res.ok) return []
    const data = await res.json()
    if (data.result === 'success' && Array.isArray(data.data)) return (data.data as BiCamera[]).filter(c => c.optionValue !== 'index')
    return []
  } catch { return [] }
}

function mjpegUrl(cam: BiCamera, session: string): string {
  return `${BI_PROXY}/mjpg/${cam.optionValue}/video.mjpg?session=${session}`
}
function snapshotUrl(cam: BiCamera, session: string, ts?: number): string {
  return `${BI_PROXY}/image/${cam.optionValue}?q=75&s=100&session=${session}&t=${ts ?? Date.now()}`
}

type ConnState = 'idle' | 'connecting' | 'connected' | 'error'

// ─── AI Alert Log entry ──────────────────────────────────────────────────────
interface AlertLogEntry {
  id: string
  cameraName: string
  alerts: string[]
  objects: DetectedObject[]
  plates: LicensePlate[]
  timestamp: Date
  emailSent: boolean
}

// ─── CameraCell (AI overlay) ─────────────────────────────────────────────────
interface CellProps {
  cam: BiCamera
  session: string
  onClick: () => void
  useMjpeg: boolean
  aiResult?: DetectionResult | null
  isScanning?: boolean
}

const CameraCell: React.FC<CellProps> = ({ cam, session, onClick, useMjpeg, aiResult, isScanning }) => {
  const [imgTs, setImgTs] = useState(Date.now())
  const [err, setErr] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (useMjpeg) return
    timerRef.current = setInterval(() => setImgTs(Date.now()), 3000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [useMjpeg])

  const isOnline = cam.online !== 0
  const hasAlerts = aiResult && (aiResult.objects.length > 0 || aiResult.plates.length > 0)

  return (
    <div
      onClick={onClick}
      className={`relative bg-black rounded-xl overflow-hidden cursor-pointer group border transition-colors ${
        hasAlerts ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : 'border-gray-700 hover:border-blue-500'
      }`}
      style={{ aspectRatio: '16/9' }}
    >
      {isOnline && !err ? (
        <img
          src={useMjpeg ? mjpegUrl(cam, session) : snapshotUrl(cam, session, imgTs)}
          alt={cam.optionDisplay}
          className="w-full h-full object-contain"
          onError={() => setErr(true)}
          onLoad={() => setErr(false)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <CameraIcon className="h-10 w-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-xs">{err ? 'Stream hiba' : 'Offline'}</p>
          </div>
        </div>
      )}

      {/* AI scanning indicator */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border-2 border-blue-400/60 rounded-xl animate-pulse" />
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-400/40 animate-scan-line" />
        </div>
      )}

      {/* AI Detection overlays */}
      {aiResult && aiResult.plates.length > 0 && (
        <div className="absolute top-8 left-2 flex flex-wrap gap-1">
          {aiResult.plates.map((p, i) => (
            <span key={i} className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
              🚗 {p.plate}
            </span>
          ))}
        </div>
      )}

      {/* Object count badges */}
      {aiResult && aiResult.objects.length > 0 && (
        <div className="absolute bottom-8 left-2 flex flex-wrap gap-1">
          {(() => {
            const personCount = aiResult.objects.filter(o => o.label.toLowerCase() === 'person').length
            const vehicleCount = aiResult.objects.filter(o => ['car','truck','bus','motorcycle'].includes(o.label.toLowerCase())).length
            return (
              <>
                {personCount > 0 && (
                  <span className="bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <User className="h-2.5 w-2.5" /> {personCount}
                  </span>
                )}
                {vehicleCount > 0 && (
                  <span className="bg-orange-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Car className="h-2.5 w-2.5" /> {vehicleCount}
                  </span>
                )}
              </>
            )
          })()}
        </div>
      )}

      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500'}`} />
        {cam.clipsCreated && cam.clipsCreated > 0 && !cam.noRecord && (
          <span className="bg-red-600 rounded-full px-1.5 py-0.5 text-[10px] text-white font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />REC
          </span>
        )}
        {cam.isAlerting && <AlertTriangle className="h-4 w-4 text-yellow-400 animate-pulse" />}
      </div>

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="bg-white/90 rounded-full p-2.5"><Maximize2 className="h-5 w-5 text-gray-800" /></div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        <p className="text-white text-xs font-medium truncate">{cam.optionDisplay}</p>
        {cam.FPS && cam.FPS > 0 && (
          <p className="text-gray-400 text-[10px]">{cam.FPS} FPS{cam.width ? ` · ${cam.width}×${cam.height}` : ''}</p>
        )}
      </div>
    </div>
  )
}

// ─── FullscreenViewer ────────────────────────────────────────────────────────
interface ViewerProps {
  cam: BiCamera
  session: string
  onClose: () => void
  useMjpeg: boolean
  aiResult?: DetectionResult | null
}

const FullscreenViewer: React.FC<ViewerProps> = ({ cam, session, onClose, useMjpeg, aiResult }) => {
  const [imgTs, setImgTs] = useState(Date.now())
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (useMjpeg || isPaused) return
    timerRef.current = setInterval(() => setImgTs(Date.now()), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [useMjpeg, isPaused])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isOnline = cam.online !== 0
  const src = useMjpeg ? mjpegUrl(cam, session) : snapshotUrl(cam, session, imgTs)

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <CameraIcon className="h-5 w-5 text-blue-400" />
          <div>
            <h2 className="text-white font-semibold">{cam.optionDisplay}</h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500'}`} />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
              {cam.FPS && cam.FPS > 0 && <span>· {cam.FPS} FPS</span>}
              {cam.clipsCreated && cam.clipsCreated > 0 && !cam.noRecord && <span className="text-red-400 font-bold">● REC</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!useMjpeg && (
            <>
              <button onClick={() => setIsPaused(p => !p)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <button onClick={() => setImgTs(Date.now())} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                <RotateCcw className="h-4 w-4" />
              </button>
            </>
          )}
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        {isOnline ? (
          <img src={src} alt={cam.optionDisplay} className="max-w-full max-h-full object-contain" style={{ width: '100%', height: '100%' }} />
        ) : (
          <div className="text-center">
            <CameraIcon className="h-20 w-20 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Kamera offline</p>
          </div>
        )}

        {/* AI Results overlay in fullscreen */}
        {aiResult && (aiResult.objects.length > 0 || aiResult.plates.length > 0) && (
          <div className="absolute top-4 right-4 bg-gray-900/95 border border-gray-700 rounded-xl p-3 max-w-xs shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300">AI Észlelés</span>
              <span className="text-[10px] text-gray-500">{aiResult.timestamp.toLocaleTimeString('hu-HU')}</span>
            </div>
            {aiResult.plates.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] text-yellow-400 font-semibold mb-1">🚗 Rendszámok:</p>
                {aiResult.plates.map((p, i) => (
                  <span key={i} className="inline-block bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded font-mono mr-1 mb-1">{p.plate}</span>
                ))}
              </div>
            )}
            {aiResult.objects.length > 0 && (
              <div>
                <p className="text-[10px] text-blue-400 font-semibold mb-1">Objektumok:</p>
                {aiResult.objects.slice(0, 5).map((o, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-300">
                    <span>{translateLabel(o.label)}</span>
                    <span className="text-gray-500">{Math.round(o.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AI Alert Log Panel ──────────────────────────────────────────────────────
const AlertLogPanel: React.FC<{ logs: AlertLogEntry[]; onClear: () => void }> = ({ logs, onClear }) => {
  const [expanded, setExpanded] = useState(true)

  if (logs.length === 0) return null

  return (
    <div className="bg-gray-900 border border-yellow-600/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-300">AI Riasztások ({logs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onClear() }} className="text-xs text-gray-500 hover:text-red-400 px-2 py-0.5 rounded">
            Törlés
          </button>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-gray-800 max-h-72 overflow-y-auto">
          {logs.slice(0, 20).map(log => (
            <div key={log.id} className="px-4 py-3 hover:bg-gray-800/30">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-blue-300 truncate">{log.cameraName}</span>
                    <span className="text-[10px] text-gray-600">{log.timestamp.toLocaleTimeString('hu-HU')}</span>
                    {log.emailSent && (
                      <span className="flex items-center gap-1 text-[10px] text-green-400">
                        <Mail className="h-3 w-3" /> Email elküldve
                      </span>
                    )}
                  </div>
                  {log.alerts.map((a, i) => (
                    <p key={i} className="text-xs text-yellow-200">• {a}</p>
                  ))}
                  {log.plates.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {log.plates.map((p, i) => (
                        <span key={i} className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                          {p.plate}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AI Settings Modal ────────────────────────────────────────────────────────
interface AISettingsProps {
  config: AIConfig
  onChange: (cfg: AIConfig) => void
  onClose: () => void
}

const AISettingsModal: React.FC<AISettingsProps> = ({ config, onChange, onClose }) => {
  const [draft, setDraft] = useState<AIConfig>({ ...config })

  const save = () => {
    saveAIConfig(draft)
    onChange(draft)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[10001] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-purple-700/40 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">AI Detektálás beállítások</h2>
              <p className="text-gray-400 text-xs">CodeProject.AI integráció</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          {/* Server URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">CodeProject.AI szerver URL</label>
            <input
              type="text"
              value={draft.serverUrl}
              onChange={e => setDraft(d => ({ ...d, serverUrl: e.target.value }))}
              placeholder="http://localhost:32168"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Alapértelmezett port: 32168</p>
          </div>

          {/* Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Szkennelési időköz: <span className="text-purple-300">{draft.intervalSeconds}s</span>
            </label>
            <input
              type="range"
              min={5} max={120} step={5}
              value={draft.intervalSeconds}
              onChange={e => setDraft(d => ({ ...d, intervalSeconds: Number(e.target.value) }))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>5s (gyors)</span><span>2 perc (lassú)</span>
            </div>
          </div>

          {/* Min confidence */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Min. bizonyosság: <span className="text-purple-300">{Math.round(draft.minConfidence * 100)}%</span>
            </label>
            <input
              type="range"
              min={0.3} max={0.95} step={0.05}
              value={draft.minConfidence}
              onChange={e => setDraft(d => ({ ...d, minConfidence: Number(e.target.value) }))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>30% (érzékeny)</span><span>95% (szigorú)</span>
            </div>
          </div>

          {/* Alert toggles */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-300">Email riasztás küldése ha:</p>
            {[
              { key: 'alertOnPersons', icon: User, label: 'Személy észlelve', color: 'text-red-400' },
              { key: 'alertOnVehicles', icon: Car, label: 'Jármű észlelve', color: 'text-orange-400' },
              { key: 'alertOnPlates', icon: Scan, label: 'Rendszám felismerve', color: 'text-yellow-400' },
            ].map(({ key, icon: Icon, label, color }) => (
              <label key={key} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-sm text-gray-300 flex-1">{label}</span>
                <input
                  type="checkbox"
                  checked={draft[key as keyof AIConfig] as boolean}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.checked }))}
                  className="w-4 h-4 accent-purple-500"
                />
              </label>
            ))}
          </div>

          {/* Admin emails info */}
          <div className="bg-blue-950/40 border border-blue-800/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">Admin értesítési célpontok</span>
            </div>
            {ADMIN_EMAILS.map(email => (
              <p key={email} className="text-xs text-gray-400 font-mono">• {email}</p>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors">Mégse</button>
          <button onClick={save} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-colors">Mentés</button>
        </div>
      </div>
    </div>
  )
}

// ─── Fő Security oldal ────────────────────────────────────────────────────────
export default function Security() {
  const [config, setConfigState] = useState<BIConfig>(loadConfig)
  const [editConfig, setEditConfig] = useState<BIConfig>(config)
  const [showSettings, setShowSettings] = useState(false)

  const [connState, setConnState] = useState<ConnState>('idle')
  const [session, setSession] = useState<string | null>(null)
  const [cameras, setCameras] = useState<BiCamera[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  const [selectedCam, setSelectedCam] = useState<BiCamera | null>(null)
  const [useMjpeg, setUseMjpeg] = useState(true)
  const [cols, setCols] = useState<2 | 3 | 4>(3)

  // ── AI State ──
  const [aiConfig, setAiConfig] = useState<AIConfig>(loadAIConfig)
  const [showAISettings, setShowAISettings] = useState(false)
  const [aiActive, setAiActive] = useState(false)
  const [aiResults, setAiResults] = useState<Record<string, DetectionResult>>({})
  const [scanningCam, setScanningCam] = useState<string | null>(null)
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>([])
  const [showAIPanel, setShowAIPanel] = useState(true)

  // Spam protection: don't re-alert same camera within cooldown
  const lastAlertTime = useRef<Record<string, number>>({})
  const ALERT_COOLDOWN_MS = 60_000 // 1 perc

  const { addNotification } = useNotifications()
  const connectRef = useRef(false)
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Blue Iris connect ──
  const connect = useCallback(async (cfg: BIConfig) => {
    if (connectRef.current) return
    connectRef.current = true
    setConnState('connecting')
    setError(null)
    setDebugInfo(null)
    try {
      const sess = await biLogin(cfg)
      if (!sess) {
        setConnState('error')
        setError('Bejelentkezés sikertelen. Ellenőrizd a felhasználónevet és jelszót.')
        setDebugInfo(`MD5 challenge: md5("${cfg.username}:<session>:<jelszó>")`)
        return
      }
      setSession(sess)
      const cams = await biCamList(sess)
      if (cams.length === 0) {
        setConnState('error')
        setError('Bejelentkeztünk, de nincsenek kamerák.')
        return
      }
      setCameras(cams)
      setLastRefresh(new Date())
      setConnState('connected')
    } catch (e) {
      setConnState('error')
      setError(`Kapcsolódási hiba: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      connectRef.current = false
    }
  }, [])

  useEffect(() => { connect(config) }, [config])

  const refreshCams = async () => {
    if (!session) { connect(config); return }
    try {
      const cams = await biCamList(session)
      if (cams.length > 0) { setCameras(cams); setLastRefresh(new Date()) }
      else { setSession(null); connect(config) }
    } catch { connect(config) }
  }

  // ── AI scanning loop ──
  const runAIScan = useCallback(async (cams: BiCamera[], sess: string, cfg: AIConfig) => {
    const onlineCams = cams.filter(c => c.online !== 0)
    if (onlineCams.length === 0) return

    for (const cam of onlineCams) {
      setScanningCam(cam.optionValue)
      const url = snapshotUrl(cam, sess)
      const result = await analyzeCamera(url, cam.optionDisplay, cfg)

      if (result) {
        setAiResults(prev => ({ ...prev, [cam.optionValue]: result }))

        const alerts = getAlerts(result, cfg)
        if (alerts.length > 0) {
          const now = Date.now()
          const lastAlert = lastAlertTime.current[cam.optionValue] ?? 0
          const canAlert = now - lastAlert > ALERT_COOLDOWN_MS

          // Always add to UI log
          const logEntry: AlertLogEntry = {
            id: `alert-${Date.now()}-${Math.random()}`,
            cameraName: cam.optionDisplay,
            alerts,
            objects: result.objects,
            plates: result.plates,
            timestamp: result.timestamp,
            emailSent: false,
          }

          // Send email if cooldown passed
          let emailSent = false
          if (canAlert) {
            lastAlertTime.current[cam.optionValue] = now
            const emailBody = buildAlertEmail(cam.optionDisplay, alerts, result, cfg)
            const subject = `🚨 Biztonsági riasztás: ${cam.optionDisplay} - ${alerts[0]}`

            // Send to all admin emails in parallel
            try {
              await Promise.all(
                ADMIN_EMAILS.map(email =>
                  sendEmail({ to: email, subject, body: emailBody })
                )
              )
              emailSent = true
            } catch (err) {
              console.error('[AI] Email küldési hiba:', err)
            }

            // In-app notification
            addNotification({
              type: 'warning',
              title: `🎯 ${cam.optionDisplay}: ${alerts[0]}`,
              message: alerts.join(' | '),
            })
          }

          setAlertLog(prev => [{ ...logEntry, emailSent }, ...prev].slice(0, 100))
        }
      }

      // Small delay between cameras to not overload CodeProject.AI
      await new Promise(r => setTimeout(r, 500))
    }
    setScanningCam(null)
  }, [addNotification])

  // ── Start/stop AI scanning ──
  useEffect(() => {
    if (aiTimerRef.current) {
      clearInterval(aiTimerRef.current)
      aiTimerRef.current = null
    }

    if (!aiActive || !session || cameras.length === 0) return

    // Run immediately
    runAIScan(cameras, session, aiConfig)

    // Then on interval
    aiTimerRef.current = setInterval(() => {
      runAIScan(cameras, session, aiConfig)
    }, aiConfig.intervalSeconds * 1000)

    return () => {
      if (aiTimerRef.current) clearInterval(aiTimerRef.current)
    }
  }, [aiActive, session, cameras, aiConfig, runAIScan])

  const saveConfig = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(editConfig))
    setConfigState(editConfig)
    setShowSettings(false)
    setSession(null)
    setCameras([])
    connectRef.current = false
  }

  const directUrl = `${config.serverUrl}/ui3.htm?user=${encodeURIComponent(config.username)}&pw=${encodeURIComponent(config.password)}`
  const onlineCams = cameras.filter(c => c.online !== 0)
  const offlineCams = cameras.filter(c => c.online === 0)

  const totalAlerts = alertLog.length
  const personAlerts = alertLog.flatMap(l => l.objects).filter(o => o.label === 'person').length
  const plateAlerts = alertLog.flatMap(l => l.plates).length

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-950">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-400" />
          <h1 className="text-sm font-bold text-white">Biztonsági Kamerák</h1>
          {connState === 'connected' && lastRefresh && (
            <span className="text-xs text-gray-500 hidden sm:inline">
              {cameras.length} kamera · frissítve {lastRefresh.toLocaleTimeString('hu-HU')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 text-xs font-medium mr-2">
            {connState === 'connecting' ? (
              <><RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" /><span className="text-blue-400">Kapcsolódás…</span></>
            ) : connState === 'connected' ? (
              <><Wifi className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Élő</span></>
            ) : connState === 'error' ? (
              <><WifiOff className="h-3.5 w-3.5 text-red-400" /><span className="text-red-400">Hiba</span></>
            ) : (
              <><CameraIcon className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-400">Szétkapcsolva</span></>
            )}
          </div>

          {/* AI Toggle */}
          {connState === 'connected' && (
            <button
              onClick={() => setAiActive(a => !a)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                aiActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 animate-pulse'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{aiActive ? 'AI Aktív' : 'AI'}</span>
            </button>
          )}

          {/* AI Settings */}
          {connState === 'connected' && (
            <button
              onClick={() => setShowAISettings(true)}
              className="p-2 text-gray-400 hover:text-purple-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="AI beállítások"
            >
              <Scan className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => setUseMjpeg(m => !m)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              useMjpeg ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40' : 'text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{useMjpeg ? 'MJPEG' : 'JPEG'}</span>
          </button>

          <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {([2, 3, 4] as const).map(n => (
              <button key={n} onClick={() => setCols(n)} className={`px-2 py-1 text-xs transition-colors ${cols === n ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {n}×
              </button>
            ))}
          </div>

          <button onClick={refreshCams} disabled={connState === 'connecting'} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${connState === 'connecting' ? 'animate-spin' : ''}`} />
          </button>

          <a href={directUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <ExternalLink className="h-4 w-4" />
          </a>

          <button onClick={() => { setEditConfig(config); setShowSettings(true) }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── AI Status Bar ── */}
      {aiActive && connState === 'connected' && (
        <div className="flex items-center gap-4 px-4 py-2 bg-purple-950/40 border-b border-purple-800/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
            <span className="text-xs text-purple-300 font-medium">AI Aktív</span>
          </div>
          {scanningCam && (
            <div className="flex items-center gap-2">
              <Scan className="h-3.5 w-3.5 text-blue-400 animate-spin" />
              <span className="text-xs text-blue-300">Szkennelés: {cameras.find(c => c.optionValue === scanningCam)?.optionDisplay}</span>
            </div>
          )}
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              <span>Minden {aiConfig.intervalSeconds}s</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <User className="h-3 w-3 text-red-400" />
              <span>{personAlerts} személy</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Car className="h-3 w-3 text-yellow-400" />
              <span>{plateAlerts} rendszám</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Bell className="h-3 w-3 text-orange-400" />
              <span>{totalAlerts} riasztás</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-600">
              <Mail className="h-3 w-3" />
              <span>{ADMIN_EMAILS.join(', ')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tartalom ── */}
      <div className="flex-1 overflow-y-auto p-4">

        {connState === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-red-400" />
            </div>
            <div className="text-center max-w-lg">
              <h2 className="text-white font-bold text-lg mb-2">Kapcsolódási hiba</h2>
              <p className="text-gray-400 text-sm mb-4">{error}</p>
              <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-4 text-left text-xs space-y-2 mb-4">
                <div className="flex items-center gap-2 text-blue-300 font-semibold">
                  <Key className="h-3.5 w-3.5" /><span>MD5 Challenge-Response hitelesítés</span>
                </div>
                <p className="text-gray-400">md5(felhasználó:session:jelszó)</p>
                {debugInfo && <p className="text-gray-500 mt-2">{debugInfo}</p>}
              </div>
              <div className="flex gap-3 justify-center">
                <button onClick={() => connect(config)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                  <RefreshCw className="h-4 w-4" />Újrapróbálás
                </button>
                <button onClick={() => { setEditConfig(config); setShowSettings(true) }} className="flex items-center gap-2 px-4 py-2.5 border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-xl text-sm font-medium">
                  <Settings className="h-4 w-4" />Beállítások
                </button>
              </div>
            </div>
          </div>
        )}

        {connState === 'connecting' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400 font-medium">Kapcsolódás Blue Iris szerverhez…</p>
          </div>
        )}

        {connState === 'connected' && cameras.length > 0 && (
          <div className="space-y-4">

            {/* AI Alert Log */}
            {alertLog.length > 0 && (
              <AlertLogPanel logs={alertLog} onClear={() => setAlertLog([])} />
            )}

            {onlineCams.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <h2 className="text-sm font-semibold text-gray-300">Online ({onlineCams.length})</h2>
                  <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                  {aiActive && (
                    <span className="flex items-center gap-1 text-xs text-purple-400 ml-auto">
                      <Brain className="h-3 w-3" /> AI szkennelés aktív
                    </span>
                  )}
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {onlineCams.map(cam => (
                    <CameraCell
                      key={cam.optionValue}
                      cam={cam}
                      session={session!}
                      onClick={() => setSelectedCam(cam)}
                      useMjpeg={useMjpeg}
                      aiResult={aiResults[cam.optionValue]}
                      isScanning={scanningCam === cam.optionValue}
                    />
                  ))}
                </div>
              </div>
            )}

            {offlineCams.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <h2 className="text-sm font-semibold text-gray-300">Offline ({offlineCams.length})</h2>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cols, offlineCams.length)}, minmax(0, 1fr))` }}>
                  {offlineCams.map(cam => (
                    <CameraCell key={cam.optionValue} cam={cam} session={session!} onClick={() => setSelectedCam(cam)} useMjpeg={useMjpeg} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fullscreen ── */}
      {selectedCam && session && (
        <FullscreenViewer
          cam={selectedCam}
          session={session}
          onClose={() => setSelectedCam(null)}
          useMjpeg={useMjpeg}
          aiResult={aiResults[selectedCam.optionValue]}
        />
      )}

      {/* ── Blue Iris Settings Modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Blue Iris beállítások</h2>
                  <p className="text-gray-400 text-xs">Kamera szerver kapcsolat</p>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Szerver URL</label>
                <input type="text" value={editConfig.serverUrl} onChange={e => setEditConfig(c => ({ ...c, serverUrl: e.target.value }))} placeholder="http://192.168.1.100:81" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Felhasználónév</label>
                  <input type="text" value={editConfig.username} onChange={e => setEditConfig(c => ({ ...c, username: e.target.value }))} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Jelszó</label>
                  <input type="password" value={editConfig.password} onChange={e => setEditConfig(c => ({ ...c, password: e.target.value }))} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors">Mégse</button>
              <button onClick={saveConfig} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">Mentés & Újracsatlakozás</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Settings Modal ── */}
      {showAISettings && (
        <AISettingsModal
          config={aiConfig}
          onChange={cfg => { setAiConfig(cfg); saveAIConfig(cfg) }}
          onClose={() => setShowAISettings(false)}
        />
      )}
    </div>
  )
}
