import React, { useState, useEffect } from 'react'
import {
  Scale, CheckCircle, Circle, AlertTriangle,
  ChevronRight, ChevronDown, ChevronUp,
  Package, Printer, RefreshCw, Info
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

interface WeighingStepProps {
  batchId: string
  batchSize: number
  recipeId: string
  recipeName: string
  onComplete: () => void
}

interface WeighingItem {
  id: string
  name: string
  requiredAmount: number
  unit: string
  weighed: boolean
  inStock: boolean
  stockAmount?: number
}

// ── Formázás: max 3 tizedes, magyar locale ──────────────
function fmtAmt(n: number): string {
  if (!isFinite(n) || n === 0) return '0'
  return n.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

// ── Biztonságos JSON.parse: ha string, parse-olja ───────
function safeParseIngredients(raw: any): any[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

// ── Ár kiolvasása a products táblából (egységesített) ───
export function getProductPrice(product: any): { retail: number; wholesale: number; display: number } {
  const retail    = parseFloat(product?.retail_price ?? product?.price ?? 0) || 0
  const wholesale = parseFloat(product?.wholesale_price ?? 0) || 0
  const display   = retail || wholesale || 0
  return { retail, wholesale, display }
}

export default function WeighingStep({
  batchId, batchSize, recipeId, recipeName, onComplete
}: WeighingStepProps) {
  const [items, setItems]         = useState<WeighingItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [yieldInfo, setYieldInfo] = useState<{ baseYield: number; recipeFor: number } | null>(null)

  const allWeighed   = items.length > 0 && items.every(i => i.weighed)
  const hasShortage  = items.some(i => !i.inStock)
  const weighedCount = items.filter(i => i.weighed).length

  useEffect(() => { loadIngredients() }, [batchId, batchSize, recipeId])

  // ── Fő betöltés ──────────────────────────────────────
  const loadIngredients = async () => {
    setLoading(true)
    setError(null)
    try {
      let ingredientsList: any[] = []
      let baseYield = 1

      // 1. Termék lekérése – ingredients (lehet JSON string!), yield_amount
      const { data: productData, error: prodErr } = await supabase
        .from('products')
        .select('ingredients, yield_amount, retail_price, wholesale_price, price')
        .eq('id', recipeId)
        .maybeSingle()

      if (prodErr) console.error('WeighingStep product fetch error:', prodErr)

      if (productData) {
        // ★ FONTOS: ingredients lehet JSON string – mindig parse-olni kell!
        ingredientsList = safeParseIngredients(productData.ingredients)
        // yield_amount: hány db-ra szól a receptúra (pl. 80 kenyérre)
        baseYield = (productData.yield_amount && productData.yield_amount > 0)
          ? productData.yield_amount
          : 1
      }

      // 2. Fallback: recipes tábla
      if (!ingredientsList.length) {
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('ingredients, yield_amount')
          .eq('id', recipeId)
          .maybeSingle()
        if (recipeData) {
          ingredientsList = safeParseIngredients(recipeData.ingredients)
          baseYield = (recipeData.yield_amount && recipeData.yield_amount > 0)
            ? recipeData.yield_amount
            : baseYield
        }
      }

      if (!ingredientsList.length) {
        setError('A recepthez nem találhatók hozzávalók')
        setLoading(false)
        return
      }

      setYieldInfo({ baseYield, recipeFor: baseYield })

      // 3. Arányos kiszámítás: (recept_mennyiség / baseYield) × batchSize
      //    Pl. 46.4 kg liszt / 80 db × 110 db = 63.8 kg
      const calculated: WeighingItem[] = ingredientsList
        // Szűrjük ki az "összesen" sorokat (kalkulációs segédsorok)
        .filter((ing: any) => {
          const nm = (ing.name || '').toLowerCase()
          // Kiszűrjük az összesítő sorokat amelyek nem valódi alapanyagok
          return !nm.startsWith('össz') && nm !== 'összesen:' && nm !== 'összesen'
        })
        .map((ing: any, idx: number) => {
          const baseAmount = parseFloat(ing.amount ?? ing.quantity ?? 0) || 0
          const requiredAmount = baseYield > 0
            ? Math.round((baseAmount / baseYield) * batchSize * 1000) / 1000
            : baseAmount
          return {
            id: `${idx}`,
            name: ing.name || ing.ingredient_name || 'Ismeretlen',
            requiredAmount,
            unit: ing.unit || 'kg',
            weighed: false,
            inStock: true,
            stockAmount: undefined,
          }
        })

      // 4. Készlet ellenőrzés (opcionális – ha a tábla nem létezik, szilensen kihagyja)
      try {
        const names = calculated.map(i => i.name)
        const { data: stockData } = await supabase
          .from('store_inventory')
          .select('name, current_stock, unit')
          .in('name', names)
        if (stockData && stockData.length > 0) {
          const stockMap: Record<string, number> = {}
          stockData.forEach((s: any) => { stockMap[s.name] = s.current_stock })
          setItems(calculated.map(item => {
            const stock = stockMap[item.name]
            if (stock !== undefined) {
              return { ...item, stockAmount: stock, inStock: stock >= item.requiredAmount }
            }
            return item
          }))
        } else {
          setItems(calculated)
        }
      } catch {
        setItems(calculated)
      }

    } catch (err) {
      console.error('WeighingStep loadIngredients error:', err)
      setError('Hiba a hozzávalók betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  // ── Egy tétel ki/bejelölése ──────────────────────────
  const toggleWeighed = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, weighed: !item.weighed } : item
    ))
  }

  // ── Kimérés véglegesítése ───────────────────────────
  // Dual-write: DB oszlopok (ha léteznek) ÉS notes JSON (garantált)
  const handleConfirm = async () => {
    if (!allWeighed) {
      toast.error('Kérjük erősítse meg az összes alapanyag kimérését!')
      return
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()

      // A) Elsőre próbáljuk az újonnan hozzáadott oszlopokba menteni (SQL migration után)
      const { error: colErr } = await supabase
        .from('production_batches')
        .update({
          weighing_confirmed:    true,
          weighing_completed_at: now,
        })
        .eq('id', batchId)

      if (colErr) {
        // Ha az oszlop nem létezik, a notes JSON-ba mentjük (fallback)
        console.warn('weighing_confirmed oszlop nincs – notes JSON fallback:', colErr.message)
      }

      // B) Mindenképpen frissítjük a notes JSON-t is (így a parseWeighingConfirmed() megtalálja)
      // Lekérjük az aktuális notes-t, hogy ne írjuk felül a runtime state-et
      const { data: currentBatch } = await supabase
        .from('production_batches')
        .select('notes')
        .eq('id', batchId)
        .single()

      if (currentBatch?.notes) {
        try {
          const parsed = typeof currentBatch.notes === 'string'
            ? JSON.parse(currentBatch.notes)
            : currentBatch.notes
          // Beillesztjük a weighing_confirmed-et a meglévő JSON-ba
          const updated = {
            ...parsed,
            weighing_confirmed: true,
            weighing_completed_at: now,
          }
          if (updated.rt) {
            updated.rt.weighing_confirmed = true
          }
          await supabase
            .from('production_batches')
            .update({ notes: JSON.stringify(updated) })
            .eq('id', batchId)
        } catch (parseErr) {
          // Ha a notes nem valid JSON, stringként tároljuk kiegészítve
          await supabase
            .from('production_batches')
            .update({
              notes: JSON.stringify({
                weighing_confirmed: true,
                weighing_completed_at: now,
                _orig: currentBatch.notes,
              })
            })
            .eq('id', batchId)
        }
      } else {
        // Üres notes mező esetén
        await supabase
          .from('production_batches')
          .update({
            notes: JSON.stringify({
              weighing_confirmed: true,
              weighing_completed_at: now,
            })
          })
          .eq('id', batchId)
      }

      setConfirmed(true)
      toast.success('✅ Kimérés kész! Gyártási lépések indítása...')
      setCollapsed(true)
      setTimeout(onComplete, 600)

    } catch (err: any) {
      console.error('handleConfirm error:', err)
      toast.error('Mentési hiba: ' + (err.message || 'ismeretlen hiba'))
      setSaving(false)
    }
  }

  // ── Nyomtatás ────────────────────────────────────────
  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kimérési lista – ${recipeName}</title>
  <style>
    body { font-family: 'Courier New', monospace; padding: 30px; max-width: 600px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    .info { background: #f5f5f5; padding: 10px; border-radius: 6px; margin-bottom: 16px; font-size: 12px; }
    hr { border: none; border-top: 1px dashed #999; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; color: #666; padding: 4px 8px; border-bottom: 2px solid #000; }
    td { padding: 8px; font-size: 14px; border-bottom: 1px solid #eee; }
    td.amt { font-size: 18px; font-weight: bold; text-align: right; }
    .check { width: 24px; height: 24px; border: 2px solid #000; display: inline-block; margin-right: 8px; vertical-align: middle; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <h1>KIMÉRÉSI LISTA</h1>
  <div class="meta">${recipeName} | ${batchSize} db | ${new Date().toLocaleString('hu-HU')}</div>
  ${yieldInfo ? `<div class="info">⚖️ Recept alap: ${yieldInfo.baseYield} db | Szorzó: ${(batchSize / yieldInfo.baseYield).toFixed(3)}×</div>` : ''}
  <hr>
  <table>
    <thead>
      <tr>
        <th>□</th>
        <th>Alapanyag</th>
        <th style="text-align:right">Mennyiség</th>
        <th style="text-align:right">Egység</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(i => `
        <tr>
          <td><span class="check"></span></td>
          <td>${i.name}</td>
          <td class="amt">${fmtAmt(i.requiredAmount)}</td>
          <td style="text-align:right;color:#666">${i.unit}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <hr>
  <div style="font-size:12px;color:#666;margin-top:16px">
    Pék aláírása: _________________________ &nbsp;&nbsp; Dátum: _____________
  </div>
</body>
</html>`)
    win.document.close()
    win.print()
  }

  // ── Loading / Error állapotok ────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-32 bg-gray-900 border border-white/8 rounded-2xl">
      <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
      <span className="ml-3 text-gray-400 text-sm">Hozzávalók betöltése...</span>
    </div>
  )

  if (error) return (
    <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
      <p className="text-red-300 font-medium text-sm">{error}</p>
      <button
        onClick={loadIngredients}
        className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
      >
        Újrapróbálás
      </button>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* ── Fejléc ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className={`w-full rounded-2xl p-5 flex items-center justify-between transition-all ${
          confirmed
            ? 'bg-emerald-950/40 border border-emerald-500/30'
            : 'bg-gradient-to-r from-amber-900/60 to-orange-900/60 border border-amber-500/30'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            confirmed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`}>
            {confirmed
              ? <CheckCircle className="h-7 w-7 text-emerald-400" />
              : <Scale className="h-7 w-7 text-amber-400" />
            }
          </div>
          <div className="text-left">
            <h2 className="text-base font-black text-white">
              {confirmed ? '✅ Kimérés kész' : '⚖️ 1. Lépés: Kimérés'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {recipeName} — {batchSize} egység
              {yieldInfo && yieldInfo.baseYield > 1
                ? ` (recept ${yieldInfo.baseYield} db-ra, szorzó: ×${(batchSize / yieldInfo.baseYield).toFixed(2)})`
                : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-2xl font-black ${confirmed ? 'text-emerald-400' : 'text-amber-300'}`}>
              {weighedCount}/{items.length}
            </div>
            <div className="text-xs text-gray-500">kimérve</div>
          </div>
          {collapsed
            ? <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
            : <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
          }
        </div>
      </button>

      {/* Progress bar – mindig látható */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mx-1">
        <div
          className={`h-full rounded-full transition-all duration-500 ${confirmed ? 'bg-emerald-500' : 'bg-amber-400'}`}
          style={{ width: `${items.length ? (weighedCount / items.length) * 100 : 0}%` }}
        />
      </div>

      {/* ── Tartalom ── */}
      {!collapsed && (
        <>
          {/* Recept info */}
          {yieldInfo && (
            <div className="flex items-start gap-2 bg-blue-950/30 border border-blue-500/20 rounded-xl p-3">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-300">
                A receptúra <strong className="text-white">{yieldInfo.baseYield} darabra</strong> szól.
                Ehhez a gyártáshoz <strong className="text-white">{batchSize} db</strong> kell,
                szorzó: <strong className="text-amber-300">×{(batchSize / yieldInfo.baseYield).toFixed(3)}</strong>.
                A mennyiségek már arányosan vannak átszámítva.
              </p>
            </div>
          )}

          {/* Hiány figyelmeztetés */}
          {hasShortage && (
            <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300">Figyelem: egyes alapanyagokból nincs elegendő készlet!</p>
            </div>
          )}

          {/* Kimérési lista */}
          <div className="bg-gray-900 border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-bold text-gray-300">Alapanyag lista</span>
                <span className="text-xs text-gray-600">({items.length} tétel)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-white/10 rounded-lg text-gray-400 hover:bg-white/5 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" /> Nyomtatás
                </button>
                <button
                  onClick={() => setItems(prev => prev.map(i => ({ ...i, weighed: true })))}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-900/30 border border-amber-500/30 rounded-lg text-amber-300 hover:bg-amber-900/50 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Mind kimérve
                </button>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleWeighed(item.id)}
                  className={`px-4 py-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                    item.weighed ? 'bg-emerald-950/20' : 'hover:bg-white/3'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 transition-colors ${item.weighed ? 'text-emerald-400' : 'text-gray-600'}`}>
                      {item.weighed
                        ? <CheckCircle className="h-5 w-5" />
                        : <Circle className="h-5 w-5" />
                      }
                    </div>
                    <div>
                      <p className={`text-sm font-semibold transition-all ${
                        item.weighed ? 'line-through text-gray-500' : 'text-white'
                      }`}>
                        {item.name}
                      </p>
                      {item.stockAmount !== undefined && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          Készleten: {fmtAmt(item.stockAmount)} {item.unit}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-2xl font-black tabular-nums ${
                        !item.inStock ? 'text-red-400'
                        : item.weighed ? 'text-emerald-400'
                        : 'text-amber-300'
                      }`}>
                        {fmtAmt(item.requiredAmount)}
                      </div>
                      <div className="text-xs text-gray-500">{item.unit}</div>
                    </div>
                    {!item.inStock && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900/40 text-red-400 border border-red-500/30">
                        Hiány!
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Összesítő */}
          <div className="bg-gray-900/60 border border-white/8 rounded-xl p-3">
            <div className="grid grid-cols-4 gap-3 text-center text-xs">
              <div>
                <div className="text-gray-500">Batch méret</div>
                <div className="font-black text-white mt-0.5">{batchSize} db</div>
              </div>
              <div>
                <div className="text-gray-500">Alapanyagok</div>
                <div className="font-black text-white mt-0.5">{items.length} féle</div>
              </div>
              <div>
                <div className="text-gray-500">Kimérve</div>
                <div className={`font-black mt-0.5 ${weighedCount === items.length ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {weighedCount}/{items.length}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Készlet</div>
                <div className={`font-black mt-0.5 ${hasShortage ? 'text-red-400' : 'text-emerald-400'}`}>
                  {hasShortage ? 'Hiány!' : 'OK'}
                </div>
              </div>
            </div>
          </div>

          {/* Kimérés kész gomb */}
          <button
            onClick={handleConfirm}
            disabled={!allWeighed || confirmed || saving}
            className={`w-full py-4 px-6 rounded-xl font-black text-base flex items-center justify-center gap-3 transition-all duration-200 ${
              allWeighed && !confirmed && !saving
                ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-lg shadow-emerald-900/40 active:scale-[0.98]'
                : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <><RefreshCw className="h-5 w-5 animate-spin" /><span>Mentés...</span></>
            ) : confirmed ? (
              <><CheckCircle className="h-5 w-5" /><span>Kimérés kész ✓</span></>
            ) : (
              <><CheckCircle className="h-5 w-5" /><span>Kimérés kész — Gyártás megkezdése</span><ChevronRight className="h-5 w-5" /></>
            )}
          </button>

          {!allWeighed && !confirmed && (
            <p className="text-center text-xs text-gray-600">
              Jelöljön be minden alapanyagot a folytatáshoz ({items.length - weighedCount} maradt)
            </p>
          )}
        </>
      )}
    </div>
  )
}