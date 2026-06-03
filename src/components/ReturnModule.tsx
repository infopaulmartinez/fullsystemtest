import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { RotateCcw, Search, ChevronDown, ChevronUp, Minus, Plus, CheckCircle, Loader2, Package, AlertTriangle } from 'lucide-react'
import { formatHUF } from '../lib/cashmaticApi'
import toast from 'react-hot-toast'

interface DeliveryItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  vat_percentage?: number
  unit?: string
}

interface DeliveryNote {
  id: string
  delivery_note_id: string
  order_number: string
  customer_name: string
  delivered_at: string
  created_at: string
  items: DeliveryItem[]
  location_id: string
}

interface ReturnItem {
  product_id: string
  product_name: string
  unit_price: number
  vat_percentage: number
  unit: string
  delivered: number
  sold: number
  returnable: number
  returnQty: number
}

export function ReturnModule() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState<DeliveryNote[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [returnItems, setReturnItems] = useState<Record<string, ReturnItem[]>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [soldMap, setSoldMap] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => { loadNotes() }, [])

  async function loadNotes() {
    setLoading(true)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('id, delivery_note_id, order_number, customer_name, delivered_at, created_at, items, location_id')
        .eq('status', 'delivered')
        .gte('delivered_at', today.toISOString())
        .order('delivered_at', { ascending: false })
      if (error) throw error
      setNotes((data || []) as DeliveryNote[])
    } catch (err: any) {
      toast.error('Szállítólevelek betöltési hiba: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openNote(note: DeliveryNote) {
    if (expanded === note.id) { setExpanded(null); return }
    setExpanded(note.id)
    if (returnItems[note.id]) return

    // Lekérjük a mai eladott mennyiségeket ehhez a location_id-hoz
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const { data: txItems } = await supabase
        .from('pos_transaction_items')
        .select('product_id, quantity, pos_transactions!inner(location_id, created_at, status)')
        .eq('pos_transactions.status', 'completed')
        .gte('pos_transactions.created_at', today.toISOString())

      const sold: Record<string, number> = {}
      ;(txItems || []).forEach((ti: any) => {
        sold[ti.product_id] = (sold[ti.product_id] ?? 0) + ti.quantity
      })
      setSoldMap(prev => ({ ...prev, [note.id]: sold }))

      const items: ReturnItem[] = (note.items as DeliveryItem[]).map(i => {
        const soldQty = sold[i.product_id] ?? 0
        const returnable = Math.max(0, i.quantity - soldQty)
        return {
          product_id: i.product_id,
          product_name: i.product_name,
          unit_price: i.unit_price ?? 0,
          vat_percentage: i.vat_percentage ?? 27,
          unit: i.unit ?? 'db',
          delivered: i.quantity,
          sold: soldQty,
          returnable,
          returnQty: returnable, // alapból az összes visszáruzható
        }
      }).filter(i => i.delivered > 0)
      setReturnItems(prev => ({ ...prev, [note.id]: items }))
    } catch (err: any) {
      toast.error('Hiba: ' + err.message)
    }
  }

  function setQty(noteId: string, productId: string, delta: number) {
    setReturnItems(prev => ({
      ...prev,
      [noteId]: prev[noteId].map(i =>
        i.product_id === productId
          ? { ...i, returnQty: Math.min(i.returnable, Math.max(0, i.returnQty + delta)) }
          : i
      )
    }))
  }

  async function submitReturn(note: DeliveryNote) {
    const items = returnItems[note.id] ?? []
    const toReturn = items.filter(i => i.returnQty > 0)
    if (toReturn.length === 0) { toast.error('Nincs visszáruzandó tétel!'); return }
    setSubmitting(note.id)
    try {
      // 1. Visszáru bejegyzés a pos_transactions-ba (negative total = visszáru)
      const subtotal = toReturn.reduce((s, i) => s + i.unit_price * i.returnQty, 0)
      const tax = toReturn.reduce((s, i) => s + (i.unit_price * i.returnQty * i.vat_percentage) / (100 + i.vat_percentage), 0)
      const { data: tx, error: txErr } = await supabase
        .from('pos_transactions')
        .insert([{
          cashier_id: user?.id,
          location_id: note.location_id,
          subtotal: -Math.round(subtotal - tax),
          tax_amount: -Math.round(tax),
          total_amount: -Math.round(subtotal),
          payment_method: 'return',
          status: 'returned',
          notes: `Visszáru – ${note.order_number} szállítólevél`,
        }])
        .select().single()
      if (txErr) throw txErr

      // 2. Visszáru tételek
      await supabase.from('pos_transaction_items').insert(
        toReturn.map(i => ({
          transaction_id: tx.id,
          product_id: i.product_id,
          quantity: -i.returnQty,
          unit_price: i.unit_price,
          total_price: -(i.unit_price * i.returnQty),
          discount_amount: 0,
          vat_percentage: i.vat_percentage,
        }))
      )

      // 3. Készlet visszavezetés
      await Promise.all(toReturn.map(i =>
        supabase.rpc('increment_stock', { p_product_id: i.product_id, p_quantity: i.returnQty })
      ))

      toast.success(`✅ Visszáru rögzítve: ${toReturn.length} termék, ${formatHUF(Math.round(subtotal))}`)
      setExpanded(null)
      setReturnItems(prev => { const n = { ...prev }; delete n[note.id]; return n })
      loadNotes()
    } catch (err: any) {
      toast.error('Visszáru hiba: ' + err.message)
    } finally {
      setSubmitting(null)
    }
  }

  const filtered = notes.filter(n =>
    !search ||
    n.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    n.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    n.delivery_note_id?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <RotateCcw className="h-6 w-6 text-amber-600 flex-none" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Visszáru</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Mai szállítólevelek alapján — csak el nem adott termékek</p>
        </div>
        <button onClick={loadNotes} className="ml-auto p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20">
          <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Kereső */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Szállítólevél száma, vevő..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Nincs mai leszállított szállítólevél</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(note => {
            const items = returnItems[note.id]
            const hasReturnable = items?.some(i => i.returnable > 0)
            const totalReturn = items?.filter(i => i.returnQty > 0).reduce((s, i) => s + i.unit_price * i.returnQty, 0) ?? 0
            return (
              <div key={note.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                {/* Fejléc */}
                <div onClick={() => openNote(note)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm text-gray-900 dark:text-white">{note.delivery_note_id || note.order_number}</span>
                      <span className="text-xs text-gray-400">{note.customer_name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Leszállítva: {new Date(note.delivered_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{(note.items as DeliveryItem[]).length} termék
                    </p>
                  </div>
                  {expanded === note.id ? <ChevronUp className="h-4 w-4 text-gray-400 flex-none" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-none" />}
                </div>

                {/* Kibontott nézet */}
                {expanded === note.id && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    {!items ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-amber-600" /></div>
                    ) : (
                      <>
                        {/* Tételek */}
                        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {items.map(item => (
                            <div key={item.product_id} className="px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.product_name}</p>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                  <span>Szállított: <b className="text-gray-700 dark:text-gray-200">{item.delivered}</b></span>
                                  <span>Eladott: <b className="text-green-600">{item.sold}</b></span>
                                  <span>Visszáruzható: <b className={item.returnable > 0 ? 'text-amber-600' : 'text-gray-400'}>{item.returnable}</b></span>
                                </div>
                              </div>
                              {item.returnable > 0 ? (
                                <div className="flex items-center gap-1.5 flex-none">
                                  <button onClick={() => setQty(note.id, item.product_id, -1)}
                                    disabled={item.returnQty <= 0}
                                    className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-red-100 disabled:opacity-30 transition-colors">
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-white">{item.returnQty}</span>
                                  <button onClick={() => setQty(note.id, item.product_id, 1)}
                                    disabled={item.returnQty >= item.returnable}
                                    className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-amber-100 disabled:opacity-30 transition-colors">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                  <span className="text-xs text-gray-400 w-16 text-right">{formatHUF(item.unit_price * item.returnQty)}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600 flex-none flex items-center gap-1">
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Minden eladva
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Figyelmeztetés + összeg + gomb */}
                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 space-y-3">
                          {!hasReturnable && (
                            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                              <CheckCircle className="h-4 w-4 flex-none" />
                              Minden termék el lett adva, nincs visszáruzható tétel.
                            </div>
                          )}
                          {hasReturnable && totalReturn > 0 && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                                <AlertTriangle className="h-4 w-4 flex-none" />
                                Visszáru összege: <b className="ml-1">{formatHUF(Math.round(totalReturn))}</b>
                              </div>
                              <button
                                onClick={() => submitReturn(note)}
                                disabled={submitting === note.id}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold disabled:opacity-50 transition-colors">
                                {submitting === note.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <RotateCcw className="h-4 w-4" />}
                                Visszáru rögzítése
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
