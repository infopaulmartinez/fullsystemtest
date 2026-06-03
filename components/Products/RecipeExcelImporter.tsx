import React, { useState, useRef } from 'react'
import {
  Upload,
  X,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ChevronDown
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'

interface RecipeExcelImporterProps {
  onImportComplete: () => void
  onCancel: () => void
}

// ===== PONTOSAN UGYANOLYAN formData típus mint Recipes.tsx =====
interface FormData {
  name: string
  description: string
  ingredients: { name: string; amount: string; unit: string }[]
  instructions: string[]
  prep_time: number
  bake_time: number
  difficulty: string
  category: string
  yield_amount: number
  cost_per_unit: number
  wholesale_price: number
  retail_price: number
  vat_percentage: number
  display_name: string
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  ingredients: [{ name: '', amount: '', unit: 'g' }],
  instructions: [''],
  prep_time: 0,
  bake_time: 0,
  difficulty: 'medium',
  category: '',
  yield_amount: 1,
  cost_per_unit: 0,
  wholesale_price: 0,
  retail_price: 0,
  vat_percentage: 18,
  display_name: ''
}

// ===== Excel parser =====
// Két formátumot kezel:
//
// FORMÁTUM 1 – Kulcs-érték + összetevő-táblázat (ajánlott):
//   A1: Recept neve       B1: [érték]
//   A2: Kategória         B2: [érték]
//   A3: Mennyiség (db)    B3: [érték]
//   A4: Előkészítés (perc) B4: [érték]
//   A5: Sütési idő (perc) B5: [érték]
//   A6: Nehézség          B6: easy | medium | hard (vagy: könnyű | közepes | nehéz)
//   A7: Önköltség (Ft/db) B7: [érték]
//   A8: Nagyker ár        B8: [érték]
//   A9: Kisker ár         B9: [érték]
//   A10: ÁFA (%)          B10: [érték]
//   A11: Leírás           B11: [érték]
//   A12: Display név      B12: [érték]
//   (üres sor)
//   A14: Hozzávalók  (fejléc-cimke)
//   A15: Név   B15: Mennyiség   C15: Egység   (oszlopfejlécek)
//   A16+: sorok ...
//
// FORMÁTUM 2 – Csak összetevő-táblázat (az első sor fejléc):
//   A1: Név/Hozzávaló   B1: Mennyiség   C1: Egység
//   A2+: sorok ...

function normalizeKey(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
}

function parseExcel(file: File): Promise<FormData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Fájl olvasási hiba'))
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // sheet_to_json: raw=false -> minden szöveg, defval=''
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: false,
          defval: ''
        }) as string[][]

        if (!rows.length) throw new Error('Üres munkalap')

        const formData: FormData = { ...EMPTY_FORM, ingredients: [] }

        // ---- Detect format ----
        const firstCell = normalizeKey(rows[0]?.[0])
        const isKvFormat =
          firstCell.includes('recept') ||
          firstCell.includes('termék') ||
          firstCell.includes('neve') ||
          firstCell.includes('name') ||
          firstCell.includes('kategoria') ||
          firstCell.includes('kategória')

        if (isKvFormat) {
          // === FORMÁTUM 1: kulcs-érték ===
          let ingredientHeaderRow = -1

          for (let i = 0; i < rows.length; i++) {
            const key = normalizeKey(rows[i][0])
            const val = String(rows[i][1] ?? '').trim()

            if (
              key.includes('recept neve') ||
              key.includes('termék neve') ||
              key === 'neve' ||
              key === 'name'
            ) {
              formData.name = val
            } else if (key.includes('kategor')) {
              formData.category = val
            } else if (key.includes('menny') && key.includes('db')) {
              formData.yield_amount = parseFloat(val) || 1
            } else if (
              (key.includes('előkész') || key.includes('elokesz') || key.includes('prep')) &&
              key.includes('perc')
            ) {
              formData.prep_time = parseInt(val) || 0
            } else if (
              (key.includes('sütés') || key.includes('sutes') || key.includes('bak')) &&
              key.includes('perc')
            ) {
              formData.bake_time = parseInt(val) || 0
            } else if (key.includes('nehézség') || key.includes('nehézseg') || key.includes('difficulty')) {
              const v = val.toLowerCase()
              if (v === 'easy' || v === 'könnyű' || v === 'konnyu') formData.difficulty = 'easy'
              else if (v === 'hard' || v === 'nehéz' || v === 'nehez') formData.difficulty = 'hard'
              else formData.difficulty = 'medium'
            } else if (key.includes('önkölt') || key.includes('onkolt') || key.includes('cost')) {
              formData.cost_per_unit = parseFloat(val) || 0
            } else if (key.includes('nagyker') || key.includes('wholesale')) {
              formData.wholesale_price = parseFloat(val) || 0
            } else if (key.includes('kisker') || key.includes('retail')) {
              formData.retail_price = parseFloat(val) || 0
            } else if (key.includes('áfa') || key.includes('afa') || key.includes('vat')) {
              formData.vat_percentage = parseFloat(val) || 18
            } else if (key.includes('leírás') || key.includes('leiras') || key.includes('description')) {
              formData.description = val
            } else if (key.includes('display') || key.includes('számlán') || key.includes('szamlan')) {
              formData.display_name = val
            } else if (
              key.includes('hozzávaló') ||
              key.includes('hozzavalo') ||
              key.includes('ingredient') ||
              key.includes('összetevő')
            ) {
              // Ez a fejléc-sor; a következő sor az oszlopfejléc
              ingredientHeaderRow = i + 1
              break
            }
          }

          // Ha megtaláltuk a hozzávalók szekció fejlécét, olvassuk a sorokat
          if (ingredientHeaderRow >= 0) {
            // Keressük az oszlopfejléceket (Név | Mennyiség | Egység)
            let nameCol = 0, amountCol = 1, unitCol = 2
            const headerRow = rows[ingredientHeaderRow]
            if (headerRow) {
              for (let c = 0; c < headerRow.length; c++) {
                const h = normalizeKey(headerRow[c])
                if (h.includes('név') || h.includes('nev') || h.includes('name') || h.includes('hozzávaló') || h.includes('hozzavalo')) nameCol = c
                else if (h.includes('menny') || h.includes('amount') || h.includes('qty')) amountCol = c
                else if (h.includes('egység') || h.includes('egyseg') || h.includes('unit')) unitCol = c
              }
              // adatsorok
              for (let i = ingredientHeaderRow + 1; i < rows.length; i++) {
                const row = rows[i]
                const ingName = String(row[nameCol] ?? '').trim()
                const ingAmt = String(row[amountCol] ?? '').trim()
                const ingUnit = String(row[unitCol] ?? '').trim() || 'kg'
                if (ingName && ingAmt) {
                  formData.ingredients.push({ name: ingName, amount: ingAmt.replace(',', '.'), unit: ingUnit })
                }
              }
            }
          }
        } else {
          // === FORMÁTUM 2: Csak összetevő-táblázat ===
          // Az első sor fejléc
          const headerRow = rows[0]
          let nameCol = 0, amountCol = 1, unitCol = 2

          for (let c = 0; c < headerRow.length; c++) {
            const h = normalizeKey(headerRow[c])
            if (h.includes('név') || h.includes('nev') || h.includes('name') || h.includes('hozzávaló') || h.includes('hozzavalo')) nameCol = c
            else if (h.includes('menny') || h.includes('amount') || h.includes('qty') || h.includes('szám')) amountCol = c
            else if (h.includes('egység') || h.includes('egyseg') || h.includes('unit')) unitCol = c
          }

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const ingName = String(row[nameCol] ?? '').trim()
            const ingAmt = String(row[amountCol] ?? '').trim()
            const ingUnit = String(row[unitCol] ?? '').trim() || 'kg'
            if (ingName && ingAmt) {
              formData.ingredients.push({ name: ingName, amount: ingAmt.replace(',', '.'), unit: ingUnit })
            }
          }
        }

        // Fallback: ha nincs hozzávaló, adjuk meg az üres sort
        if (formData.ingredients.length === 0) {
          formData.ingredients = [{ name: '', amount: '', unit: 'g' }]
        }

        // Ha nem sikerült nevet kiolvasni, használjuk a fájlnevet
        if (!formData.name) {
          formData.name = file.name.replace(/\.[^.]+$/, '')
        }

        resolve(formData)
      } catch (err: any) {
        reject(new Error('Excel feldolgozási hiba: ' + (err.message || '')))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ===== Fő komponens =====
export default function RecipeExcelImporter({ onImportComplete, onCancel }: RecipeExcelImporterProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [loading, setLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ===== Segédfüggvények (PONTOSAN mint Recipes.tsx) =====
  const handleAddIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', amount: '', unit: 'g' }]
    }))
  }

  const handleRemoveIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }))
  }

  const handleIngredientChange = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ingredient, i) =>
        i === index ? { ...ingredient, [field]: value } : ingredient
      )
    }))
  }

  const handleAddInstruction = () => {
    setFormData(prev => ({
      ...prev,
      instructions: [...prev.instructions, '']
    }))
  }

  const handleRemoveInstruction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index)
    }))
  }

  const handleInstructionChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.map((instruction, i) =>
        i === index ? value : instruction
      )
    }))
  }

  // ===== Excel fájl feldolgozása =====
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls') {
      setParseError('Csak .xlsx vagy .xls fájlok támogatottak')
      return
    }

    setParseError(null)
    setLoading(true)
    try {
      const parsed = await parseExcel(file)
      setFormData(parsed)
      setStep('preview')
    } catch (err: any) {
      setParseError(err.message || 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }

  // ===== Mentés – PONTOSAN mint Recipes.tsx handleSubmit =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)

      if (!formData.name) {
        toast.error('Kérjük adja meg a recept nevét')
        setLoading(false)
        return
      }

      // === PONTOSAN mint Recipes.tsx ===
      const formattedIngredients = formData.ingredients.map(ing => ({
        name: ing.name,
        amount: parseFloat(ing.amount.replace(',', '.')),
        unit: ing.unit
      }))

      const recipeData = {
        name: formData.name,
        description: formData.description || null,
        ingredients: formattedIngredients,
        instructions: formData.instructions.filter(Boolean),
        prep_time: formData.prep_time,
        bake_time: formData.bake_time,
        difficulty: formData.difficulty,
        category: formData.category || 'egyéb',
        yield_amount: formData.yield_amount,
        cost_per_unit: formData.cost_per_unit || null,
        wholesale_price: formData.wholesale_price || null,
        retail_price: formData.retail_price || null,
        vat_percentage: formData.vat_percentage ?? 18,
        display_name: formData.display_name?.trim() || null,
        image_url: null,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }

      const { data, error } = await supabase
        .from('products')
        .insert(recipeData)
        .select()

      if (error) throw error

      // === Alapértelmezett gyártási lépések (PONTOSAN mint Recipes.tsx) ===
      if (data && data.length > 0) {
        const recipeId = data[0].id
        const defaultSteps = [
          { recipe_id: recipeId, step_number: 1, title: 'Előkészítés', description: 'Alapanyagok kimérése', duration_minutes: 15 },
          { recipe_id: recipeId, step_number: 2, title: 'Dagasztás', description: 'Összekeverés', duration_minutes: 20 },
          { recipe_id: recipeId, step_number: 3, title: 'Kelesztés', description: 'Pihentetés', duration_minutes: 60, temperature: 30, humidity: 80 },
          { recipe_id: recipeId, step_number: 4, title: 'Formázás', description: 'Tészta formázása', duration_minutes: 15 },
          { recipe_id: recipeId, step_number: 5, title: 'Sütés', description: 'Sütés', duration_minutes: 30, temperature: 220 }
        ]
        await supabase.from('recipe_steps').insert(defaultSteps)
      }

      toast.success('Recept Excel-ből létrehozva!')
      onImportComplete()
    } catch (error: any) {
      console.error('Mentési hiba:', error)
      toast.error('Hiba a mentéskor: ' + (error.message || ''))
    } finally {
      setLoading(false)
    }
  }

  // ===== UI =====
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="p-6">

          {/* Fejléc */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {step === 'upload' ? 'Excel recept importálása' : 'Recept ellenőrzése'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {step === 'upload'
                    ? 'Tölts fel egy .xlsx vagy .xls receptfájlt'
                    : 'Ellenőrizd az adatokat, majd kattints az „OK – Mentés" gombra'}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* ===== FELTÖLTÉS LÉPÉS ===== */}
          {step === 'upload' && (
            <div className="space-y-6">

              {/* Feltöltő zóna */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-green-400 dark:border-green-600 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all"
              >
                {loading ? (
                  <RefreshCw className="h-12 w-12 text-green-500 animate-spin mb-4" />
                ) : (
                  <Upload className="h-12 w-12 text-green-500 mb-4" />
                )}
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  {loading ? 'Feldolgozás...' : 'Kattints a feltöltéshez'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  .xlsx vagy .xls fájl
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                />
              </div>

              {/* Hiba */}
              {parseError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Feldolgozási hiba</p>
                    <p className="text-sm text-red-600 dark:text-red-300">{parseError}</p>
                  </div>
                </div>
              )}

              {/* Formátum segítség */}
              <details className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" /> Elvárt Excel formátum (kattints a részletekért)
                </summary>
                <div className="mt-3 space-y-3 text-xs text-gray-600 dark:text-gray-400">
                  <p className="font-bold text-gray-800 dark:text-gray-200">FORMÁTUM 1 – Kulcs-érték + Hozzávalók tábla (ajánlott):</p>
                  <div className="font-mono bg-white dark:bg-gray-800 rounded-lg p-3 space-y-0.5 border border-gray-200 dark:border-gray-600">
                    <p>A oszlop           | B oszlop</p>
                    <p>────────────────────────────────</p>
                    <p>Recept neve        | 1/1 Kenyér</p>
                    <p>Kategória          | Kenyér</p>
                    <p>Mennyiség (db)     | 80</p>
                    <p>Előkészítés (perc) | 30</p>
                    <p>Sütési idő (perc)  | 45</p>
                    <p>Nehézség           | medium</p>
                    <p>Önköltség (Ft/db)  | 112</p>
                    <p>Nagyker ár         | 495</p>
                    <p>Kisker ár          | 540</p>
                    <p>ÁFA (%)            | 18</p>
                    <p>Leírás             | Termék 80 darabhoz</p>
                    <p>Display név        | Kenyér 1kg</p>
                    <p>(üres sor)</p>
                    <p>Hozzávalók</p>
                    <p>Név      | Mennyiség | Egység</p>
                    <p>liszt:   | 46.4      | kg</p>
                    <p>só:      | 1.415     | kg</p>
                    <p>víz:     | 27.84     | liter</p>
                  </div>
                  <p className="font-bold text-gray-800 dark:text-gray-200 pt-1">FORMÁTUM 2 – Csak hozzávalók tábla:</p>
                  <div className="font-mono bg-white dark:bg-gray-800 rounded-lg p-3 space-y-0.5 border border-gray-200 dark:border-gray-600">
                    <p>Hozzávaló | Mennyiség | Egység</p>
                    <p>liszt:    | 46.4      | kg</p>
                    <p>só:       | 1.415     | kg</p>
                  </div>
                  <p className="italic">
                    Nehézség értékek: easy / medium / hard (vagy: könnyű / közepes / nehéz)
                  </p>
                </div>
              </details>
            </div>
          )}

          {/* ===== ELŐNÉZET + SZERKESZTÉS LÉPÉS ===== */}
          {step === 'preview' && (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Sikerjelzés */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Excel sikeresen beolvasva – ellenőrizd az adatokat, majd mentsd el!
                </p>
              </div>

              {/* === UGYANAZOK A MEZŐK MINT Recipes.tsx === */}

              {/* Alap mezők */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recept neve *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display név (számlákon, szállítólevélen)
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategória *
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Leírás
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Idők & nehézség */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Előkészítési idő (perc) *
                  </label>
                  <input
                    type="number"
                    value={formData.prep_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, prep_time: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sütési idő (perc) *
                  </label>
                  <input
                    type="number"
                    value={formData.bake_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, bake_time: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nehézség *
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="easy">Könnyű</option>
                    <option value="medium">Közepes</option>
                    <option value="hard">Nehéz</option>
                  </select>
                </div>
              </div>

              {/* Árak & mennyiség */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mennyiség (db) *
                  </label>
                  <input
                    type="number"
                    value={formData.yield_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, yield_amount: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Önköltség (Ft/db)
                  </label>
                  <input
                    type="number"
                    value={formData.cost_per_unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_per_unit: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nagykereskedelmi ár (Ft/db)
                  </label>
                  <input
                    type="number"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, wholesale_price: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kiskereskedelmi ár (Ft/db)
                  </label>
                  <input
                    type="number"
                    value={formData.retail_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, retail_price: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* ÁFA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ÁFA (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.vat_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, vat_percentage: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Hozzávalók */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hozzávalók *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 text-sm flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Hozzávaló hozzáadása
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.ingredients.map((ingredient, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={ingredient.name}
                        onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                        placeholder="Hozzávaló neve"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                      <input
                        type="text"
                        value={ingredient.amount}
                        onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                        placeholder="Mennyiség"
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                      <select
                        value={ingredient.unit}
                        onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="liter">liter</option>
                        <option value="db">db</option>
                        <option value="ek">ek</option>
                        <option value="tk">tk</option>
                        <option value="csipet">csipet</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(index)}
                        className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Elkészítés lépések */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Elkészítési utasítások
                  </label>
                  <button
                    type="button"
                    onClick={handleAddInstruction}
                    className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 text-sm flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Lépés hozzáadása
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.instructions.map((instruction, index) => (
                    <div key={index} className="flex space-x-2">
                      <div className="flex-shrink-0 w-8 h-10 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center text-amber-800 dark:text-amber-400 font-medium text-sm">
                        {index + 1}
                      </div>
                      <input
                        type="text"
                        value={instruction}
                        onChange={(e) => handleInstructionChange(index, e.target.value)}
                        placeholder={`${index + 1}. lépés leírása`}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveInstruction(index)}
                        className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-300 font-medium">
                  💡 A gyártási lépéseket a recept mentése után, a <strong>„Lépések"</strong> gombbal tudod hozzáadni külön.
                </p>
              </div>

              {/* Gombok */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Másik fájl
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Mégse
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-semibold shadow-lg shadow-green-600/20"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Mentés...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        ✅ OK – Mentés adatbázisba
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
