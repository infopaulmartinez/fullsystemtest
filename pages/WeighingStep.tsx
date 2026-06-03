import React, { useState, useEffect } from 'react'
import {
  Scale,
  CheckCircle,
  Circle,
  AlertTriangle,
  ChevronRight,
  Package,
  Calculator,
  Printer,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

interface WeighingStepProps {
  batchId: string
  batchSize: number          // pl. 300 (kenyér darab)
  recipeId: string
  recipeName: string
  onComplete: () => void     // visszahívás: kimérés kész, jöhetnek a lépések
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

export default function WeighingStep({
  batchId,
  batchSize,
  recipeId,
  recipeName,
  onComplete
}: WeighingStepProps) {
  const [items, setItems] = useState<WeighingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const allWeighed = items.length > 0 && items.every(i => i.weighed)
  const hasShortage = items.some(i => !i.inStock)

  useEffect(() => {
    loadIngredients()
  }, [batchId, batchSize, recipeId])

  const loadIngredients = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Recept betöltése (products VAGY recipes táblából)
      let ingredientsList: any[] = []

      const { data: productData } = await supabase
        .from('products')
        .select('ingredients')
        .eq('id', recipeId)
        .maybeSingle()

      if (productData?.ingredients && Array.isArray(productData.ingredients)) {
        ingredientsList = productData.ingredients
      } else {
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('ingredients')
          .eq('id', recipeId)
          .maybeSingle()

        if (recipeData?.ingredients && Array.isArray(recipeData.ingredients)) {
          ingredientsList = recipeData.ingredients
        }
      }

      if (!ingredientsList.length) {
        setError('A recepthez nem találhatók hozzávalók')
        return
      }

      // 2. Arányos kiszámítás a batch méretéhez
      //    Ha a recept 1 egységre szól, szorozunk batchSize-szal
      //    Ha a recept egy adott "base_yield" értékre szól, azzal osztunk, majd szorzunk
      const baseYield = ingredientsList[0]?.base_yield ?? 1

      const calculated = ingredientsList.map((ing: any, idx: number) => {
        const baseAmount = ing.amount ?? ing.quantity ?? 0
        const requiredAmount = (baseAmount / baseYield) * batchSize

        return {
          id: `${idx}`,
          name: ing.name || ing.ingredient_name || 'Ismeretlen',
          requiredAmount: Math.round(requiredAmount * 100) / 100,
          unit: ing.unit || 'kg',
          weighed: false,
          inStock: true,
          stockAmount: undefined as number | undefined,
        } as WeighingItem
      })

      // 3. Készlet ellenőrzés
      const names = calculated.map(i => i.name)
      const { data: stockData } = await supabase
        .from('store_inventory')
        .select('name, current_stock, unit')
        .in('name', names)

      const stockMap: Record<string, { amount: number; unit: string }> = {}
      if (stockData) {
        stockData.forEach(s => {
          stockMap[s.name] = { amount: s.current_stock, unit: s.unit }
        })
      }

      const withStock = calculated.map(item => {
        const stock = stockMap[item.name]
        if (stock) {
          return {
            ...item,
            stockAmount: stock.amount,
            inStock: stock.amount >= item.requiredAmount,
          }
        }
        return item
      })

      setItems(withStock)
    } catch (err) {
      console.error('WeighingStep loadIngredients error:', err)
      setError('Hiba a hozzávalók betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const toggleWeighed = (id: string) => {
    setItems(prev =>
      prev.map(item => item.id === id ? { ...item, weighed: !item.weighed } : item)
    )
  }

  const handleConfirm = async () => {
    if (!allWeighed) {
      toast.error('Kérjük erősítse meg az összes alapanyag kimérését!')
      return
    }
    setConfirmed(true)

    // Mentjük a kimérés tényét a batch-hez
    try {
      await supabase
        .from('production_batches')
        .update({
          weighing_completed_at: new Date().toISOString(),
          weighing_confirmed: true,
        })
        .eq('id', batchId)
    } catch {
      // Ha a mező nem létezik, nem blokkolja a folytatást
    }

    toast.success('Kimérés kész! Gyártási lépések indítása...')
    setTimeout(onComplete, 500)
  }

  const handlePrint = () => {
    const printContent = `
      KIMÉRÉSI LISTA — ${recipeName}
      Mennyiség: ${batchSize} egység
      Dátum: ${new Date().toLocaleString('hu-HU')}
      ${'─'.repeat(40)}
      ${items.map(i =>
        `${i.name.padEnd(25)} ${i.requiredAmount.toFixed(3)} ${i.unit}`
      ).join('\n')}
      ${'─'.repeat(40)}
    `
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<pre style="font-family:monospace;font-size:14px;padding:20px">${printContent}</pre>`)
      win.document.close()
      win.print()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Hozzávalók betöltése...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
        <button
          onClick={loadIngredients}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Újrapróbálás
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Fejléc */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <Scale className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">1. Lépés: Kimérés</h2>
              <p className="text-amber-100 text-sm mt-1">
                {recipeName} — {batchSize} egység
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {items.filter(i => i.weighed).length}/{items.length}
            </div>
            <div className="text-amber-200 text-sm">kimérve</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 bg-white/20 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-500"
            style={{ width: `${items.length ? (items.filter(i => i.weighed).length / items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Figyelmeztetés ha hiány van */}
      {hasShortage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Figyelem: Egyes alapanyagokból nincs elegendő készlet!
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Rendezze a hiányt a gyártás megkezdése előtt.
            </p>
          </div>
        </div>
      )}

      {/* Kimérési lista */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Alapanyag lista</h3>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Nyomtatás
            </button>
            <button
              onClick={() => setItems(prev => prev.map(i => ({ ...i, weighed: true })))}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Mind kimérve
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map(item => (
            <div
              key={item.id}
              onClick={() => toggleWeighed(item.id)}
              className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                item.weighed
                  ? 'bg-green-50 dark:bg-green-900/10'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center space-x-4">
                {/* Checkbox */}
                <div className={`flex-shrink-0 ${item.weighed ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-gray-600'}`}>
                  {item.weighed
                    ? <CheckCircle className="h-6 w-6" />
                    : <Circle className="h-6 w-6" />
                  }
                </div>

                {/* Név */}
                <div>
                  <p className={`font-medium text-sm ${item.weighed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                    {item.name}
                  </p>
                  {item.stockAmount !== undefined && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Készleten: {item.stockAmount.toFixed(2)} {item.unit}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Szükséges mennyiség — NAGY és feltűnő */}
                <div className="text-right">
                  <div className={`text-xl font-bold ${item.inStock ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                    {item.requiredAmount.toFixed(3)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.unit}</div>
                </div>

                {/* Készlet állapot */}
                {!item.inStock && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    Hiány!
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Összesítő */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-2 mb-2">
          <Calculator className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Összesítés</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Batch méret</div>
            <div className="font-bold text-gray-900 dark:text-white">{batchSize} egység</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Alapanyagok</div>
            <div className="font-bold text-gray-900 dark:text-white">{items.length} féle</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Kimérve</div>
            <div className="font-bold text-green-600 dark:text-green-400">
              {items.filter(i => i.weighed).length}/{items.length}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Készlet</div>
            <div className={`font-bold ${hasShortage ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {hasShortage ? 'Hiány!' : 'OK'}
            </div>
          </div>
        </div>
      </div>

      {/* Tovább gomb */}
      <button
        onClick={handleConfirm}
        disabled={!allWeighed || confirmed}
        className={`w-full py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center space-x-3 transition-all duration-200 ${
          allWeighed && !confirmed
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 scale-100 hover:scale-[1.01]'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
        }`}
      >
        {confirmed ? (
          <>
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Gyártási lépések betöltése...</span>
          </>
        ) : (
          <>
            <CheckCircle className="h-6 w-6" />
            <span>Kimérés kész — Gyártás megkezdése</span>
            <ChevronRight className="h-6 w-6" />
          </>
        )}
      </button>

      {!allWeighed && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Jelöljön be minden alapanyagot a folytatáshoz
        </p>
      )}
    </div>
  )
}
