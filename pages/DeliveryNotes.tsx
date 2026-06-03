import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import {
  Truck, X, CheckCircle,
  Package, RefreshCw, Search,
  MapPin, User, Calendar,
  Printer, Navigation, ArrowLeft,
  Loader2, Eye, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface DeliveryItem {
  product_id: string
  product_name?: string
  name?: string
  quantity: number
  unit_price?: number
  total_price?: number
}

function getItemDisplayName(item: DeliveryItem, products: Product[]) {
  const product = products.find(p => p.id === item.product_id)
  return product?.display_name || item.product_name || item.name || product?.name || 'Ismeretlen'
}

interface DeliveryNote {
  id: string
  order_id: string
  order_number: string
  batch_id?: string
  
status:'pending'|'in_progress'|'delivered'|'cancelled'
  customer_name: string
  customer_address: string | null
  items: DeliveryItem[]
  notes: string | null
  driver_id?: string | null
  driver_name?: string | null
  created_at: string
  delivered_at?: string | null
}

interface Product {
  id: string
  name: string
  display_name?: string
  retail_price?: number
  wholesale_price?: number
  price?: number
}

// ── Ár kiolvasás egységesítve a products táblából ─────────
function getPrice(item: DeliveryItem, products: Product[]): number {
  if (item.unit_price !== undefined && item.unit_price !== null) return item.unit_price
  const p = products.find(x => x.id === item.product_id)
  if (!p) return 0
  return parseFloat(String(p.retail_price ?? p.price ?? 0)) || 0
}

function getTotalPrice(note: DeliveryNote, products: Product[]): number {
  return note.items.reduce((sum, item) => {
    const price = item.total_price !== undefined && item.total_price !== null
      ? item.total_price
      : item.quantity * getPrice(item, products)
    return sum + price
  }, 0)
}

// ── Státusz config ─────────────────────────────────────────
const STATUS_CONFIG = {
  pending:     { label: 'Függőben',    color: 'text-amber-400',  bg: 'bg-amber-950/40 border-amber-500/30',  dot: 'bg-amber-400'  },
  in_progress: { label: 'Úton',        color: 'text-blue-400',   bg: 'bg-blue-950/40 border-blue-500/30',    dot: 'bg-blue-400 animate-pulse' },
  delivered:   { label: 'Kézbesítve',  color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-500/30', dot: 'bg-emerald-400' },
  cancelled:   { label: 'Törölve',     color: 'text-red-400',    bg: 'bg-red-950/40 border-red-500/30',     dot: 'bg-red-400'    },
}

function fmt(n: number) {
  return n.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' Ft'
}

// ═══════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════
function DetailModal({
  note, products, onClose, onStatusChange, onDelete
}: {
  note: DeliveryNote
  products: Product[]
  onClose: () => void
  onStatusChange: (id: string, status: DeliveryNote['status']) => void
  onDelete: (id: string) => void
}) {
  const cfg = STATUS_CONFIG[note.status] || STATUS_CONFIG.pending
  const total = getTotalPrice(note, products)
  const [showPrices, setShowPrices] = React.useState(true)

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Szállítólevél – ${note.order_number}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0; } .sub { color: #666; font-size: 13px; margin: 4px 0 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .box { background: #f9f9f9; padding: 16px; border-radius: 8px; }
  .box h3 { font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 8px; letter-spacing: 1px; }
  .box p { margin: 2px 0; font-size: 14px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 12px; color: #666; padding: 8px; border-bottom: 2px solid #000; }
  td { padding: 10px 8px; font-size: 14px; border-bottom: 1px solid #eee; }
  td.right { text-align: right; }
  .total { font-size: 18px; font-weight: bold; text-align: right; padding-top: 16px; }
  .sig { display: flex; gap: 40px; margin-top: 40px; }
  .sig div { flex: 1; border-top: 1px solid #999; padding-top: 8px; font-size: 12px; color: #666; }
  @media print { body { padding: 10px; } }
</style></head><body>
<h1>SZÁLLÍTÓLEVÉL</h1>
<div class="sub">${note.order_number} · ${new Date(note.created_at).toLocaleDateString('hu-HU')}</div>
<div class="grid">
  <div class="box"><h3>Vevő</h3><p>${note.customer_name}</p>${note.customer_address ? `<p style="font-weight:normal;color:#666">${note.customer_address}</p>` : ''}</div>
  <div class="box"><h3>Állapot</h3><p>${cfg.label}</p>${note.driver_name ? `<p style="font-weight:normal">Sofőr: ${note.driver_name}</p>` : ''}</div>
</div>
<table>
  <thead><tr><th>Termék</th><th class="right">Mennyiség</th>${showPrices ? '<th class="right">Egységár</th><th class="right">Összeg</th>' : ''}</tr></thead>
  <tbody>
    ${note.items.map(item => {
      const displayName = getItemDisplayName(item, products)
      const up = item.unit_price !== undefined && item.unit_price !== null ? item.unit_price : getPrice(item, products)
      const tp = item.total_price !== undefined && item.total_price !== null ? item.total_price : item.quantity * up
      return `${showPrices ? `<tr><td>${displayName}</td><td class="right">${item.quantity} db</td><td class="right">${fmt(up)}</td><td class="right">${fmt(tp)}</td></tr>` : `<tr><td>${displayName}</td><td class="right">${item.quantity} db</td></tr>`}`
    }).join('')}
  </tbody>
</table>
<div class="total">Összesen: ${fmt(total)}</div>
${note.notes ? `<p style="margin-top:16px;color:#666;font-size:13px">Megjegyzés: ${note.notes}</p>` : ''}
<div class="sig">
  <div>Átadó aláírása</div>
  <div>Átvevő aláírása</div>
  <div>Dátum: ${new Date().toLocaleDateString('hu-HU')}</div>
</div>
</body></html>`)
    win.document.close()
    win.print()
  }

  const handleNavigate = () => {
    if (!note.customer_address) { toast.error('Nincs cím megadva!'); return }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(note.customer_address)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-950 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Szállítólevél</p>
            <h2 className="text-xl font-black text-white">{note.order_number}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}/>
              {cfg.label}
            </span>
            <button
              onClick={() => setShowPrices(s => !s)}
              className="ml-2 px-3 py-1 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-gray-200"
            >{showPrices ? 'Árak elrejtése' : 'Árak mutatása'}</button>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-colors">
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900 border border-white/8 rounded-2xl p-4">
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center gap-1"><User size={10}/> Vevői adatok</p>
              <p className="text-sm font-black text-white">{note.customer_name}</p>
              {note.customer_address && (
                <p className="text-xs text-gray-400 mt-1 flex items-start gap-1">
                  <MapPin size={10} className="mt-0.5 flex-shrink-0"/>
                  {note.customer_address}
                </p>
              )}
            </div>
            <div className="bg-gray-900 border border-white/8 rounded-2xl p-4">
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center gap-1"><Truck size={10}/> Logisztika</p>
              <p className="text-sm font-bold text-gray-300">{note.driver_name || <span className="text-gray-600">Nincs sofőr</span>}</p>
              <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                <Calendar size={10}/> {new Date(note.created_at).toLocaleDateString('hu-HU')}
              </p>
              {note.delivered_at && (
                <p className="text-xs text-emerald-400 mt-0.5">
                  Kézbesítve: {new Date(note.delivered_at).toLocaleDateString('hu-HU')}
                </p>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="bg-gray-900 border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Tételek</p>
            </div>
            <div className="divide-y divide-white/5">
              {note.items.map((item, i) => {
                const unitPrice = item.unit_price !== undefined && item.unit_price !== null ? item.unit_price : getPrice(item, products)
                const totalPrice = item.total_price !== undefined && item.total_price !== null ? item.total_price : (item.quantity * unitPrice)
                const displayName = getItemDisplayName(item, products)
                return (
                  <div key={i} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package size={14} className="text-gray-600 flex-shrink-0"/>
                      <div>
                        <p className="text-sm font-semibold text-white">{displayName}</p>
                        <p className="text-xs text-gray-500">{item.quantity} db{showPrices ? ` × ${fmt(unitPrice)}` : ''}</p>
                      </div>
                    </div>
                    {showPrices && <p className="text-sm font-black text-amber-300">{fmt(totalPrice)}</p>}
                  </div>
                )
              })}
            </div>
            <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between bg-white/3">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Végösszeg</p>
              <p className="text-xl font-black text-white">{fmt(total)}</p>
            </div>
          </div>

          {note.notes && (
            <div className="bg-gray-900 border border-white/8 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Megjegyzés</p>
              <p className="text-xs text-gray-400">{note.notes}</p>
            </div>
          )}

          {/* Status change */}
          <div>
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Állapot módosítása</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(STATUS_CONFIG) as [DeliveryNote['status'], typeof STATUS_CONFIG.pending][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => onStatusChange(note.id, key)}
                  disabled={note.status === key}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    note.status === key
                      ? `${cfg.bg} ${cfg.color} opacity-100`
                      : 'bg-white/3 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}/>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold transition-all">
              <Printer size={15}/> Nyomtatás
            </button>
            {note.customer_address && (
              <button onClick={handleNavigate}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all">
                <Navigation size={15}/> Navigáció
              </button>
            )}
            <button onClick={() => { if (confirm('Törli ezt a szállítólevelet?')) { onDelete(note.id); onClose() } }}
              className="px-4 py-3 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-all">
              <Trash2 size={15}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function DeliveryNotes() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()

  const [notes, setNotes]           = useState<DeliveryNote[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState<DeliveryNote['status'] | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving]         = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: notesData }, { data: productsData }] = await Promise.all([
        supabase
          .from('delivery_notes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id,name,retail_price,wholesale_price,price')
          .order('name'),
      ])
      setNotes((notesData || []).map((n: any) => ({
        ...n,
        items: Array.isArray(n.items) ? n.items : [],
      })))
      setProducts(productsData || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('delivery-notes-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_notes' }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadAll])

  const handleStatusChange = async (id: string, status: DeliveryNote['status']) => {
    setSaving(id)
    const { error } = await supabase
      .from('delivery_notes')
      .update({
        status,
        ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
      })
      .eq('id', id)
    if (error) { toast.error('Hiba: ' + error.message) }
    else {
      toast.success(`Állapot módosítva: ${STATUS_CONFIG[status].label}`)
      // Auto-generate invoice when delivered
      if (status === 'delivered') {
        await autoGenerateInvoice(id)
      }
      loadAll()
    }
    setSaving(null)
  }

  const autoGenerateInvoice = async (deliveryNoteId: string) => {
    try {
      const note = notes.find(n => n.id === deliveryNoteId)
      if (!note) return

      const total = getTotalPrice(note, products)
      const subtotal = note.items.reduce((s, i) => {
        const unitPrice = i.unit_price !== undefined && i.unit_price !== null ? i.unit_price : 0
        return s + i.quantity * unitPrice
      }, 0)
      const taxAmount = total - subtotal

      const invoiceNumber = `SZLA-${new Date().getFullYear().toString().slice(-2)}-${Date.now().toString().slice(-5)}`
      const issueDate = new Date().toISOString().split('T')[0]
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Create invoice
      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber,
        customer_name: note.customer_name,
        customer_address: note.customer_address,
        order_id: note.order_id,
        order_number: note.order_number,
        delivery_note_id: deliveryNoteId,
        issue_date: issueDate,
        due_date: dueDate,
        payment_method: 'transfer',
        payment_status: 'pending',
        subtotal: subtotal || total,
        tax_amount: taxAmount || 0,
        discount_amount: 0,
        total_amount: total,
        notes: `Automatikusan generált számla – ${note.order_number}`,
      }).select().single()

      if (invErr) { console.error('Invoice error:', invErr); return }

      // Create invoice items
      if (inv && note.items.length > 0) {
        const itemInserts = note.items.map(item => ({
          invoice_id: inv.id,
          product_id: item.product_id || null,
          description: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          tax_rate: 27,
          tax_amount: (item.unit_price || 0) * item.quantity * 0.27,
          total_amount: (item.unit_price || 0) * item.quantity * 1.27,
        }))
        await supabase.from('invoice_items').insert(itemInserts)
      }

      // Find partner and notify
      const { data: partner } = await supabase
        .from('partner_companies')
        .select('id, name')
        .ilike('name', `%${note.customer_name}%`)
        .single()

      // Notify admin about new invoice
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      if (admins) {
        for (const admin of admins) {
          await supabase.from('notifications').insert({
            user_id: admin.id,
            title: '🧾 Új számla generálva',
            message: `${invoiceNumber} – ${note.customer_name} – ${total.toLocaleString('hu-HU')} Ft. Fizetési határidő: ${dueDate}`,
            type: 'success',
            priority: 'normal',
            read: false,
            action_url: '/invoices',
            metadata: { invoice_id: inv.id },
            expires_at: null,
          })
        }
      }

      // Notify partner users if found
      if (partner) {
        const { data: partnerProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('partner_id', partner.id)
        if (partnerProfiles) {
          for (const pp of partnerProfiles) {
            await supabase.from('notifications').insert({
              user_id: pp.id,
              title: '🧾 Új számla érkezett',
              message: `${invoiceNumber} – Összeg: ${total.toLocaleString('hu-HU')} Ft. Fizetési határidő: ${dueDate}`,
              type: 'info',
              priority: 'normal',
              read: false,
              action_url: '/partner/documents',
              metadata: { invoice_id: inv.id, invoice_number: invoiceNumber },
              expires_at: null,
            })
          }
        }
      }

      toast.success(`✅ Számla automatikusan generálva: ${invoiceNumber}`)
    } catch(e: any) {
      console.error('Auto-invoice error:', e)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('delivery_notes').delete().eq('id', id)
    if (error) toast.error('Törlési hiba: ' + error.message)
    else { toast.success('Szállítólevél törölve'); loadAll() }
  }

  // Filtering
  const filtered = notes.filter(n => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      n.customer_name?.toLowerCase().includes(q) ||
      n.order_number?.toLowerCase().includes(q) ||
      n.customer_address?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || n.status === filterStatus
    return matchSearch && matchStatus
  })

  // Stats
  const stats = {
    total:     notes.length,
    pending:   notes.filter(n => n.status === 'pending').length,
    inTransit: notes.filter(n => n.status === 'in_progress').length,
    delivered: notes.filter(n => n.status === 'delivered').length,
  }

  const selectedNote = notes.find(n => n.id === selectedId)

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950 text-white' : 'bg-slate-50 text-slate-900'}`}>

      {/* ─── HEADER ─── */}
      <header className={`sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b ${
        isDark ? 'border-white/5 bg-gray-950/95 backdrop-blur' : 'border-slate-200 bg-white shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-colors">
            <ArrowLeft size={16}/>
          </button>
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Truck className="h-5 w-5 text-blue-400"/>
          </div>
          <div>
            <h1 className="text-lg font-black">Szállítólevelek</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {notes.length} szállítólevél összesen
            </p>
          </div>
        </div>
        <button onClick={loadAll}
          className="p-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl text-gray-400 transition-all">
          <RefreshCw size={15} className={loading ? 'animate-spin text-blue-400' : ''}/>
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ─── STAT CARDS ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Összes',      val: stats.total,     color: 'text-white',         border: 'border-white/8' },
            { label: 'Függőben',    val: stats.pending,   color: 'text-amber-400',     border: 'border-amber-500/20' },
            { label: 'Úton',        val: stats.inTransit, color: 'text-blue-400',      border: 'border-blue-500/20' },
            { label: 'Kézbesítve',  val: stats.delivered, color: 'text-emerald-400',   border: 'border-emerald-500/20' },
          ].map(s => (
            <div key={s.label} className={`${isDark ? 'bg-gray-900' : 'bg-white'} border ${s.border} rounded-2xl p-4`}>
              <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ─── FILTERS ─── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className={`relative flex-1 ${isDark ? '' : ''}`}>
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
            <input
              type="text"
              placeholder="Keresés vevő, rendelésszám..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border transition-all outline-none ${
                isDark
                  ? 'bg-gray-900 border-white/8 text-white placeholder:text-gray-600 focus:border-white/20'
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400'
              }`}
            />
          </div>
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {([['all', 'Összes'], ['pending', 'Függőben'], ['in_progress', 'Úton'], ['delivered', 'Kézbesítve'], ['cancelled', 'Törölve']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val as any)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  filterStatus === val
                    ? 'bg-white text-black border-white'
                    : isDark
                      ? 'bg-gray-900 border-white/8 text-gray-400 hover:text-white hover:border-white/20'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── LIST ─── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-400" size={28}/>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-20 ${isDark ? 'bg-gray-900 border-white/8' : 'bg-white border-slate-200'} border rounded-2xl`}>
            <Truck className="h-12 w-12 text-gray-600 mb-3"/>
            <p className="text-gray-400 font-bold">Nincs szállítólevél</p>
            <p className="text-gray-600 text-sm mt-1">
              {search || filterStatus !== 'all' ? 'Próbáljon más szűrőt' : 'A gyártás befejezésekor automatikusan keletkeznek'}
            </p>
          </div>
        ) : (
          <div className={`${isDark ? 'bg-gray-900 border-white/8' : 'bg-white border-slate-200'} border rounded-2xl overflow-hidden`}>
            {/* Table header */}
            <div className={`grid grid-cols-12 gap-4 px-5 py-3 border-b text-[10px] font-black uppercase tracking-widest ${
              isDark ? 'border-white/5 text-gray-600' : 'border-slate-100 text-slate-400'
            }`}>
              <div className="col-span-1">#</div>
              <div className="col-span-3">Vevő</div>
              <div className="col-span-2">Rendelésszám</div>
              <div className="col-span-2">Tételek</div>
              <div className="col-span-1 text-right">Összeg</div>
              <div className="col-span-1">Állapot</div>
              <div className="col-span-1 text-center">Dátum</div>
              <div className="col-span-1 text-right">Műveletek</div>
            </div>

            {/* Rows */}
            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {filtered.map((note, idx) => {
                const cfg = STATUS_CONFIG[note.status] || STATUS_CONFIG.pending
                const total = getTotalPrice(note, products)
                const isSaving = saving === note.id
                return (
                  <div
                    key={note.id}
                    className={`grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-white/3' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedId(note.id)}
                  >
                    {/* Index */}
                    <div className="col-span-1">
                      <span className={`text-xs font-mono ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>
                        {(idx + 1).toString().padStart(3, '0')}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="col-span-3 min-w-0">
                      <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {note.customer_name}
                      </p>
                      {note.customer_address && (
                        <p className={`text-xs truncate mt-0.5 flex items-center gap-1 ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>
                          <MapPin size={9}/> {note.customer_address}
                        </p>
                      )}
                    </div>

                    {/* Order number */}
                    <div className="col-span-2">
                      <span className={`text-xs font-mono px-2 py-1 rounded-lg ${isDark ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-600'}`}>
                        {note.order_number}
                      </span>
                    </div>

                    {/* Items summary */}
                    <div className="col-span-2">
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        {note.items.length} tétel,{' '}
                        {note.items.reduce((s, i) => s + i.quantity, 0)} db
                      </p>
                      <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>
                        {note.items.slice(0, 2).map(i => getItemDisplayName(i, products)).join(', ')}
                        {note.items.length > 2 ? ` +${note.items.length - 2}` : ''}
                      </p>
                    </div>

                    {/* Total */}
                    <div className="col-span-1 text-right">
                      <span className={`text-sm font-black ${total > 0 ? (isDark ? 'text-amber-300' : 'text-amber-600') : (isDark ? 'text-gray-600' : 'text-slate-400')}`}>
                        {total > 0 ? fmt(total) : '—'}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="col-span-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
                        <span className={`h-1 w-1 rounded-full ${cfg.dot}`}/>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="col-span-1 text-center">
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                        {new Date(note.created_at).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {/* Quick status buttons */}
                      {note.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(note.id, 'in_progress')}
                          disabled={!!isSaving}
                          title="Indítás"
                          className="p-1.5 bg-blue-900/30 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-900/50 transition-all disabled:opacity-40"
                        >
                          {isSaving ? <Loader2 size={12} className="animate-spin"/> : <Truck size={12}/>}
                        </button>
                      )}
                      {note.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusChange(note.id, 'delivered')}
                          disabled={!!isSaving}
                          title="Kézbesítve"
                          className="p-1.5 bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-900/50 transition-all disabled:opacity-40"
                        >
                          {isSaving ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle size={12}/>}
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedId(note.id)}
                        title="Részletek"
                        className={`p-1.5 rounded-lg transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
                      >
                        <Eye size={12}/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t flex items-center justify-between ${
              isDark ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50'
            }`}>
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>
                {filtered.length} találat / {notes.length} összesen
              </p>
              <p className={`text-xs font-bold ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
                Végösszeg: {fmt(filtered.reduce((s, n) => s + getTotalPrice(n, products), 0))}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── DETAIL MODAL ─── */}
      {selectedNote && (
        <DetailModal
          note={selectedNote}
          products={products}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}