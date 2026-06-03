import React, { useState, useEffect, useRef } from 'react'
import {
  ChefHat, Clock, TrendingUp, Package, CheckCircle, AlertTriangle,
  Thermometer, Droplets, Flame, Timer, Activity, Zap, Coffee,
  ArrowUp, ArrowRight, RefreshCw, Bell, Wind
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Típusok ──────────────────────────────────────────────────────────────────

interface Batch {
  id: string
  status: 'planned' | 'in_progress' | 'completed' | 'failed'
  batch_size: number
  created_at: string
  products?: { name: string; category: string }
}

interface SensorData {
  oven1Temp: number
  oven2Temp: number
  storeTemp: number
  storeHumidity: number
}

// ─── Animált szám ─────────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(value)
  useEffect(() => {
    const start = ref.current
    const end = value
    const dur = 800
    const startTime = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / dur, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (t < 1) requestAnimationFrame(tick)
      else ref.current = end
    }
    requestAnimationFrame(tick)
  }, [value])
  return <>{display}{suffix}</>
}

// ─── Pulzáló blob háttér ──────────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, #f97316, transparent)',
          top: '-100px', left: '-100px',
          animation: 'pulse 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(circle, #3b82f6, transparent)',
          bottom: '10%', right: '5%',
          animation: 'pulse 10s ease-in-out infinite 3s',
        }}
      />
    </div>
  )
}

// ─── Fő Stat Kártya ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  sub: string
  icon: React.ElementType
  accent: string
  pulse?: boolean
  index: number
}

function StatCard({ label, value, sub, icon: Icon, accent, pulse, index }: StatCardProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 100)
    return () => clearTimeout(t)
  }, [index])

  return (
    <div
      className="relative overflow-hidden rounded-2xl border transition-all duration-700 group cursor-default"
      style={{
        background: 'rgba(15,15,20,0.8)',
        borderColor: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        opacity: visible ? 1 : 0,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 20px 40px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Accent glow top */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      {/* Hover shimmer */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}12, transparent 70%)` }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
          >
            <Icon
              size={18}
              style={{ color: accent }}
              className={pulse ? 'animate-pulse' : ''}
            />
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}25` }}>
            Live
          </span>
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0', fontVariantNumeric: 'tabular-nums' }}>
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </div>
          <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</div>
        </div>

        <div className="mt-3 pt-3 flex items-center gap-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <ArrowUp size={10} style={{ color: accent }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Hőmérő kártya ───────────────────────────────────────────────────────────

function ThermoCard({ label, value, target, unit = '°C', icon: Icon, accent, warning }: {
  label: string; value: number; target: number; unit?: string
  icon: React.ElementType; accent: string; warning?: boolean
}) {
  const pct = Math.min(Math.max((value / (target * 1.3)) * 100, 0), 100)
  const isHot = value > target * 1.1

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 group"
      style={{
        background: 'rgba(12,12,18,0.9)',
        border: `1px solid ${isHot ? '#ef444430' : 'rgba(255,255,255,0.05)'}`,
        transition: 'border-color 0.5s',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${accent}15` }}>
            <Icon size={14} style={{ color: accent }} />
          </div>
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        </div>
        {isHot && (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md animate-pulse"
            style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
            MAGAS
          </span>
        )}
      </div>

      <div className="flex items-end gap-1 mb-3">
        <span className="text-3xl font-bold tabular-nums" style={{ color: isHot ? '#f97316' : '#f0f0f0' }}>
          <AnimatedNumber value={value} />
        </span>
        <span className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{unit}</span>
      </div>

      {/* Progress sáv */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: isHot
              ? 'linear-gradient(90deg, #f97316, #ef4444)'
              : `linear-gradient(90deg, ${accent}80, ${accent})`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>0{unit}</span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Cél: {target}{unit}</span>
      </div>
    </div>
  )
}

// ─── Gyártási tétel sor ───────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  planned:     { label: 'Tervezett',    color: '#3b82f6', dot: '#3b82f6' },
  in_progress: { label: 'Folyamatban', color: '#f97316', dot: '#f97316' },
  completed:   { label: 'Kész',         color: '#22c55e', dot: '#22c55e' },
  failed:      { label: 'Sikertelen',  color: '#ef4444', dot: '#ef4444' },
}

function BatchRow({ batch, index }: { batch: Batch; index: number }) {
  const [visible, setVisible] = useState(false)
  const meta = STATUS_META[batch.status] || STATUS_META.planned

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 70)
    return () => clearTimeout(t)
  }, [index])

  return (
    <div
      className="flex items-center gap-4 p-3.5 rounded-xl group hover:bg-white/[0.03] transition-all duration-300"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        transform: visible ? 'translateX(0)' : 'translateX(-16px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s ease, opacity 0.4s ease, background 0.2s',
      }}
    >
      {/* Ikon */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}>
        <ChefHat size={15} style={{ color: meta.color }} />
      </div>

      {/* Név */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {batch.products?.name || 'Ismeretlen termék'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {batch.batch_size} db · {new Date(batch.created_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Státusz badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full"
          style={{
            background: meta.dot,
            boxShadow: `0 0 6px ${meta.dot}`,
            animation: batch.status === 'in_progress' ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
        />
        <span className="text-[11px] font-medium" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>
    </div>
  )
}

// ─── Idő sáv ─────────────────────────────────────────────────────────────────

function WorkProgressBar({ worked, total }: { worked: number; total: number }) {
  const pct = Math.min((worked / total) * 100, 100)
  const hours = Array.from({ length: total }, (_, i) => i + 4) // 4:00-tól

  return (
    <div>
      <div className="flex justify-between text-xs mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
        <span>04:00</span>
        <span>Ledolgozva: {worked} óra</span>
        <span>16:00</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #f97316, #fb923c)',
            boxShadow: '0 0 12px #f9731660',
          }}
        />
        {/* Marker jelenlegi pozíció */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#f97316] bg-[#1a1a24] transition-all duration-1000"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        {hours.map((h, i) => (
          h % 4 === 0 ? (
            <span key={i} className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {h}:00
            </span>
          ) : null
        ))}
      </div>
    </div>
  )
}

// ─── Fő komponens ─────────────────────────────────────────────────────────────

export default function BakerDashboard() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [sensor, setSensor] = useState<SensorData>({ oven1Temp: 215, oven2Temp: 175, storeTemp: 22, storeHumidity: 52 })
  const [now, setNow] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  const startHour = 4, endHour = 16
  const hoursWorked = Math.max(0, Math.min(now.getHours() - startHour, endHour - startHour))
  const totalHours = endHour - startHour
  const earnings = hoursWorked * 2500

  useEffect(() => {
    loadData()
    const clk = setInterval(() => setNow(new Date()), 1000)
    const sensInterval = setInterval(tickSensors, 8000)
    return () => { clearInterval(clk); clearInterval(sensInterval) }
  }, [])

  const tickSensors = () => setSensor(s => ({
    oven1Temp: Math.round(s.oven1Temp + (Math.random() - 0.5) * 4),
    oven2Temp: Math.round(s.oven2Temp + (Math.random() - 0.5) * 6),
    storeTemp: Math.round(s.storeTemp + (Math.random() - 0.5) * 1),
    storeHumidity: Math.round(s.storeHumidity + (Math.random() - 0.5) * 2),
  }))

  const loadData = async () => {
    setRefreshing(true)
    try {
      const { data } = await supabase
        .from('production_batches')
        .select('*, products:recipe_id (name, category)')
        .order('created_at', { ascending: false })
        .limit(8)
      if (data) setBatches(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const completed = batches.filter(b => b.status === 'completed').length
  const inProgress = batches.filter(b => b.status === 'in_progress').length
  const planned = batches.filter(b => b.status === 'planned').length

  const greet = now.getHours() < 10 ? 'Jó reggelt' : now.getHours() < 14 ? 'Jó napot' : 'Jó munkát'

  return (
    <div className="relative min-h-screen" style={{ background: '#0a0a12', color: '#f0f0f0' }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.7; transform:scale(1.05) } }
        @keyframes slideIn { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      <AmbientBackground />

      <div className="relative z-10 p-6 max-w-7xl mx-auto space-y-6">

        {/* ── Fejléc ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between"
          style={{ animation: 'slideIn 0.5s ease' }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#f9731615', border: '1px solid #f9731630' }}>
                <ChefHat size={16} style={{ color: '#f97316' }} />
              </div>
              <span className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                Gyártásirányítás
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>
              {greet}, pék! 🥐
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {now.toLocaleDateString('hu-HU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Valós idejű óra */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums tracking-tight"
                style={{ color: '#f0f0f0', fontVariantNumeric: 'tabular-nums' }}>
                {now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Helyi idő
              </div>
            </div>
            <button
              onClick={loadData}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <RefreshCw size={14}
                style={{ color: 'rgba(255,255,255,0.4)' }}
                className={refreshing ? 'spin' : ''}
              />
            </button>
          </div>
        </div>

        {/* ── Stat kártyák ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard index={0} label="Mai tételek" value={batches.length} sub={`${completed} befejezve`} icon={Package} accent="#f97316" />
          <StatCard index={1} label="Folyamatban" value={inProgress} sub={`${planned} tervezett`} icon={Activity} accent="#3b82f6" pulse={inProgress > 0} />
          <StatCard index={2} label="Ledolgozott óra" value={hoursWorked} sub={`${totalHours - hoursWorked} óra hátravan`} icon={Timer} accent="#22c55e" />
          <StatCard index={3} label="Mai kereset" value={`${earnings.toLocaleString('hu-HU')} Ft`} sub="2 500 Ft/óra" icon={TrendingUp} accent="#a855f7" />
        </div>

        {/* ── Munkaidő sáv ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(15,15,20,0.8)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={15} style={{ color: '#f97316' }} />
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Munkaidő előrehaladás</span>
            </div>
            <span className="text-xs px-2 py-1 rounded-lg"
              style={{ background: '#f9731615', color: '#f97316', border: '1px solid #f9731625' }}>
              {Math.round((hoursWorked / totalHours) * 100)}%
            </span>
          </div>
          <WorkProgressBar worked={hoursWorked} total={totalHours} />
        </div>

        {/* ── Szenzorok + Gyártás ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Szenzorok */}
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(15,15,20,0.8)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap size={15} style={{ color: '#f97316' }} />
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Élő szenzorok</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Élő</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ThermoCard label="Sütő #1" value={sensor.oven1Temp} target={220} icon={Flame} accent="#ef4444" />
              <ThermoCard label="Sütő #2" value={sensor.oven2Temp} target={180} icon={Flame} accent="#f97316" />
              <ThermoCard label="Üzlet hőm." value={sensor.storeTemp} target={24} icon={Thermometer} accent="#3b82f6" />
              <ThermoCard label="Páratartalom" value={sensor.storeHumidity} target={60} unit="%" icon={Droplets} accent="#06b6d4" />
            </div>
          </div>

          {/* Gyártási tételek */}
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(15,15,20,0.8)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-2 mb-4">
              <ChefHat size={15} style={{ color: '#f97316' }} />
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Gyártási tételek</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                {batches.length} db
              </span>
            </div>

            <div className="space-y-0.5 overflow-hidden" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                </div>
              ) : batches.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <Coffee size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Nincs aktív gyártás</p>
                </div>
              ) : (
                batches.map((batch, i) => <BatchRow key={batch.id} batch={batch} index={i} />)
              )}
            </div>
          </div>
        </div>

        {/* ── Figyelmeztetések ─────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(15,15,20,0.8)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Bell size={15} style={{ color: '#f97316' }} />
            <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Értesítések</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Figyelmeztetés */}
            <div className="flex gap-3 p-3.5 rounded-xl"
              style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(234,179,8,0.12)' }}>
                <AlertTriangle size={14} style={{ color: '#eab308' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#fde047' }}>Alacsony lisztkészlet</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(253,224,71,0.6)' }}>
                  BL-55 készlet 15 kg alatt. Javasolt újrarendelés.
                </p>
              </div>
            </div>

            {/* Minden OK */}
            <div className="flex gap-3 p-3.5 rounded-xl"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(34,197,94,0.12)' }}>
                <CheckCircle size={14} style={{ color: '#22c55e' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#86efac' }}>Minden berendezés OK</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.6)' }}>
                  Az összes sütő és kelesztő rendben működik.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
