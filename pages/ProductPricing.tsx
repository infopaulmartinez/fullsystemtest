import React, { useState, useEffect } from 'react'
import {
  Tag,
  Plus,
  Trash2,
  Save,
  Search,
  Building2,
  Users,
  Package,
  Edit,
  X,
  ChevronDown
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

interface PriceRule {
  id: string
  product_id: string
  location_id: string | null
  partner_id: string | null
  price_type: 'retail' | 'wholesale' | 'custom'
  price: number
  vat_percentage: number
  notes: string | null
  is_active: boolean
  products?: { name: string; retail_price: number; wholesale_price: number }
  locations?: { name: string }
  partner_companies?: { name: string }
}

export default function ProductPricing() {
  const [products, setProducts] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [priceRules, setPriceRules] = useState<PriceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null)
  const [targetType, setTargetType] = useState<'location' | 'partner'>('location')
  const [formData, setFormData] = useState({
    product_id: '',
    location_id: '',
    partner_id: '',
    price_type: 'retail' as 'retail' | 'wholesale' | 'custom',
    price: 0,
    vat_percentage: 18,
    notes: ''
  })

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [
        { data: prods },
        { data: locs },
        { data: parts },
        { data: rules }
      ] = await Promise.all([
        supabase.from('products').select('id, name, retail_price, wholesale_price, category').order('name'),
        supabase.from('locations').select('id, name, type').eq('status', 'active').order('name'),
        supabase.from('partner_companies').select('id, name').eq('status', 'active').order('name'),
        supabase.from('product_location_prices')
          .select(`
            *,
            products(name, retail_price, wholesale_price),
            locations(name),
            partner_companies(name)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      ])
      setProducts(prods || [])
      setLocations(locs || [])
      setPartners(parts || [])
      setPriceRules(rules || [])
    } catch (e: any) {
      toast.error('Betöltési hiba: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Quick edit handlers for product price/vat inline edits
  const [quickEdits, setQuickEdits] = useState<Record<string, { retail_price: number; wholesale_price: number; vat_percentage: number }>>({})

  useEffect(() => {
    // initialize quick edits from products
    const map: Record<string, { retail_price: number; wholesale_price: number; vat_percentage: number }> = {}
    products.forEach(p => {
      // Default VAT: pékáru (bakery) category = 18%, else 27%
      const defaultVat = (p.category && p.category.toLowerCase().includes('pékáru')) ? 18 : p.vat_percentage ?? 27
      map[p.id] = { retail_price: p.retail_price || 0, wholesale_price: p.wholesale_price || 0, vat_percentage: defaultVat }
    })
    setQuickEdits(map)
  }, [products])

  const saveQuickEdit = async (productId: string) => {
    const v = quickEdits[productId]
    if (!v) return
    try {
      const { error } = await supabase.from('products').update({ retail_price: v.retail_price, wholesale_price: v.wholesale_price, vat_percentage: v.vat_percentage }).eq('id', productId)
      if (error) throw error
      toast.success('Termék frissítve')
      loadAll()
    } catch (e: any) { toast.error('Frissítési hiba: ' + e.message) }
  }

  const openAdd = () => {
    setEditingRule(null)
    // Default VAT: 18% for partner/store custom prices
    setFormData({ product_id: '', location_id: '', partner_id: '', price_type: 'retail', price: 0, vat_percentage: 18, notes: '' })
    setTargetType('location')
    setShowAddModal(true)
  }

  const openEdit = (rule: PriceRule) => {
    setEditingRule(rule)
    setTargetType(rule.location_id ? 'location' : 'partner')
    setFormData({
      product_id: rule.product_id,
      location_id: rule.location_id || '',
      partner_id: rule.partner_id || '',
      price_type: rule.price_type,
      price: rule.price,
      vat_percentage: rule.vat_percentage || 18,
      notes: rule.notes || ''
    })
    setShowAddModal(true)
  }

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      const defaultPrice = formData.price_type === 'wholesale'
        ? (product.wholesale_price || 0)
        : (product.retail_price || 0)
      setFormData(prev => ({ ...prev, product_id: productId, price: defaultPrice }))
    } else {
      setFormData(prev => ({ ...prev, product_id: productId }))
    }
  }

  const handlePriceTypeChange = (type: 'retail' | 'wholesale' | 'custom') => {
    const product = products.find(p => p.id === formData.product_id)
    let price = formData.price
    if (product) {
      if (type === 'retail') price = product.retail_price || 0
      else if (type === 'wholesale') price = product.wholesale_price || 0
    }
    setFormData(prev => ({ ...prev, price_type: type, price }))
  }

  const handleSave = async () => {
    if (!formData.product_id) return toast.error('Válassz terméket!')
    if (targetType === 'location' && !formData.location_id) return toast.error('Válassz helyszínt!')
    if (targetType === 'partner' && !formData.partner_id) return toast.error('Válassz partnert!')
    if (formData.price <= 0) return toast.error('Az ár legyen nagyobb mint 0!')

    const payload = {
      product_id: formData.product_id,
      location_id: targetType === 'location' ? formData.location_id : null,
      partner_id: targetType === 'partner' ? formData.partner_id : null,
      price_type: formData.price_type,
      price: formData.price,
      vat_percentage: formData.vat_percentage,
      notes: formData.notes || null,
      is_active: true
    }

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('product_location_prices')
          .update(payload)
          .eq('id', editingRule.id)
        if (error) throw error
        toast.success('Ár frissítve!')
      } else {
        const { error } = await supabase
          .from('product_location_prices')
          .insert(payload)
        if (error) throw error
        toast.success('Egyedi ár hozzáadva!')
      }
      setShowAddModal(false)
      loadAll()
    } catch (e: any) {
      toast.error('Mentési hiba: ' + e.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt az árat?')) return
    try {
      await supabase.from('product_location_prices').delete().eq('id', id)
      toast.success('Ár törölve')
      loadAll()
    } catch (e: any) {
      toast.error('Törlési hiba')
    }
  }

  const filtered = priceRules.filter(r => {
    const pName = (r.products as any)?.name?.toLowerCase() || ''
    const lName = (r.locations as any)?.name?.toLowerCase() || ''
    const partName = (r.partner_companies as any)?.name?.toLowerCase() || ''
    const q = searchTerm.toLowerCase()
    return pName.includes(q) || lName.includes(q) || partName.includes(q)
  })

  const getDefaultPrice = (rule: PriceRule) => {
    const product = products.find(p => p.id === rule.product_id)
    return rule.price_type === 'wholesale'
      ? (product?.wholesale_price || 0)
      : (product?.retail_price || 0)
  }

  const diffPercent = (rule: PriceRule) => {
    const base = getDefaultPrice(rule)
    if (!base) return null
    const diff = ((rule.price - base) / base) * 100
    return diff.toFixed(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Tag className="h-8 w-8 text-amber-600" />
            Egyedi árkezelés
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Állíts be különböző árakat helyszínenként vagy partnerenként
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Új ár hozzáadása
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Egyedi árak</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{priceRules.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Partner árak</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {priceRules.filter(r => r.partner_id).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Building2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Helyszín árak</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {priceRules.filter(r => r.location_id).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick product price editor */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-bold mb-3">Gyors szerkesztés: termék ár és ÁFA</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th className="px-4 py-2 text-left">Termék</th>
                <th className="px-4 py-2 text-right">Kisker ár (Ft)</th>
                <th className="px-4 py-2 text-right">Nagyker ár (Ft)</th>
                <th className="px-4 py-2 text-right">ÁFA %</th>
                <th className="px-4 py-2 text-right">Művelet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" className="w-28 text-right px-2 py-1 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={quickEdits[p.id]?.retail_price ?? 0}
                      onChange={e => setQuickEdits(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || { retail_price: 0, wholesale_price: 0, vat_percentage: 27 }), retail_price: parseFloat(e.target.value || '0') } }))}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" className="w-28 text-right px-2 py-1 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={quickEdits[p.id]?.wholesale_price ?? 0}
                      onChange={e => setQuickEdits(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || { retail_price: 0, wholesale_price: 0, vat_percentage: 27 }), wholesale_price: parseFloat(e.target.value || '0') } }))}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <select className="w-20 px-2 py-1 rounded-lg border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={quickEdits[p.id]?.vat_percentage ?? 27}
                      onChange={e => setQuickEdits(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || { retail_price: 0, wholesale_price: 0, vat_percentage: 27 }), vat_percentage: parseFloat(e.target.value || '0') } }))}
                    >
                      <option value={27}>27%</option>
                      <option value={18}>18%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => saveQuickEdit(p.id)} className="px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Mentés</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Search & Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Termék, helyszín vagy partner keresése..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Betöltés...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Nincs egyedi ár beállítva</p>
            <button onClick={openAdd} className="mt-3 text-amber-600 hover:text-amber-700 text-sm font-semibold">
              + Első ár hozzáadása
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-750">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Termék</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Célpont</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Típus</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Alap ár</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Egyedi ár</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Különbség</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(rule => {
                  const base = getDefaultPrice(rule)
                  const diff = diffPercent(rule)
                  const diffNum = diff ? parseFloat(diff) : 0
                  return (
                    <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {(rule.products as any)?.name || '–'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {rule.location_id ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {(rule.locations as any)?.name || '–'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-purple-600" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {(rule.partner_companies as any)?.name || '–'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          rule.price_type === 'wholesale' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          rule.price_type === 'retail' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {rule.price_type === 'wholesale' ? 'Nagykereskedelem' :
                           rule.price_type === 'retail' ? 'Kiskereskedelem' : 'Egyéni'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-500 dark:text-gray-400">
                        {base.toLocaleString('hu-HU')} Ft
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white">
                        {Number(rule.price).toLocaleString('hu-HU')} Ft
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        {diff !== null && (
                          <span className={`font-semibold ${diffNum < 0 ? 'text-red-600' : diffNum > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {diffNum > 0 ? '+' : ''}{diff}%
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(rule)}
                            className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingRule ? 'Ár szerkesztése' : 'Új egyedi ár'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Termék *</label>
                <select
                  value={formData.product_id}
                  onChange={e => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Válassz terméket...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (kisker: {(p.retail_price || 0).toLocaleString('hu-HU')} Ft)
                    </option>
                  ))}
                </select>
              </div>

              {/* Target type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Célpont típusa *</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTargetType('location')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      targetType === 'location'
                        ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-900/20 dark:border-amber-600 dark:text-amber-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Building2 className="h-4 w-4" /> Helyszín
                  </button>
                  <button
                    onClick={() => setTargetType('partner')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      targetType === 'partner'
                        ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-900/20 dark:border-amber-600 dark:text-amber-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Users className="h-4 w-4" /> Partner
                  </button>
                </div>
              </div>

              {/* Location or Partner select */}
              {targetType === 'location' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Helyszín *</label>
                  <select
                    value={formData.location_id}
                    onChange={e => setFormData(prev => ({ ...prev, location_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Válassz helyszínt...</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Partner *</label>
                  <select
                    value={formData.partner_id}
                    onChange={e => setFormData(prev => ({ ...prev, partner_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Válassz partnert...</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Price type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ár típusa</label>
                <select
                  value={formData.price_type}
                  onChange={e => handlePriceTypeChange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="retail">Kiskereskedelmi ár</option>
                  <option value="wholesale">Nagykereskedelmi ár</option>
                  <option value="custom">Egyéni ár</option>
                </select>
              </div>

              {/* Price & VAT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ár (Ft) *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={e => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ÁFA (%)</label>
                  <select
                    value={formData.vat_percentage}
                    onChange={e => setFormData(prev => ({ ...prev, vat_percentage: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={27}>27%</option>
                    <option value={18}>18%</option>
                    <option value={5}>5%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Megjegyzés</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="pl. Nyári akció, szerződéses ár..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                {editingRule ? 'Mentés' : 'Hozzáadás'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}