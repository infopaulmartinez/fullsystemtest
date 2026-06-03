import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  DollarSign,
  Calendar,
  Building,
  Save,
  X,
  Printer,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

interface Invoice {
  id: string
  invoice_number: string
  partner_id: string | null
  partner_name?: string
  customer_name: string
  customer_address: string | null
  customer_tax_number: string | null
  order_id: string | null
  order_number?: string
  issue_date: string
  due_date: string
  payment_method: string
  payment_status: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  notes: string | null
  created_at: string
}

interface InvoiceItem {
  id: string
  invoice_id: string
  product_id: string | null
  product_name?: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total_amount: number
}

interface Partner {
  id: string
  name: string
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_address: string | null
  items: any[]
  total_amount: number
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [formData, setFormData] = useState({
    partner_id: '',
    delivery_note_id: '',
    customer_name: '',
    customer_address: '',
    customer_tax_number: '',
    order_id: '',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    payment_method: 'transfer',
    payment_status: 'pending',
    notes: '',
    items: [{ 
      description: '', 
      quantity: 1, 
      unit_price: 0, 
      tax_rate: 27 
    }]
  })

  useEffect(() => {
    loadInvoices()
    loadPartners()
    loadOrders()
    loadProducts()
    loadDeliveryNotes()
  }, [])

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('id,name,display_name,retail_price').order('name')
      if (error) throw error
      setProducts(data || [])
    } catch (e: any) { console.error('Products load error:', e) }
  }

  const loadInvoices = async () => {
    try {
      setLoading(true)
      
      // Build query with filters
      let query = supabase
        .from('invoices')
        .select(`
          *,
          partner:partner_id(name),
          order:order_id(order_number)
        `)
        .order('created_at', { ascending: false })
      
      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('payment_status', statusFilter)
      }
      
      // Apply date range filter
      if (dateRange.start) {
        query = query.gte('issue_date', dateRange.start)
      }
      
      if (dateRange.end) {
        query = query.lte('issue_date', dateRange.end)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a számlák betöltésekor')
        return
      }
      
      if (data) {
        const formattedInvoices: Invoice[] = data.map(invoice => ({
          ...invoice,
          partner_name: invoice.partner?.name,
          order_number: invoice.order?.order_number
        }))
        
        setInvoices(formattedInvoices)
      }
    } catch (error) {
      console.error('Hiba a számlák betöltésekor:', error)
      toast.error('Hiba a számlák betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_companies')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setPartners(data)
      }
    } catch (error) {
      console.error('Hiba a partnerek betöltésekor:', error)
    }
  }

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_address, items, total_amount')
        .in('status', ['confirmed', 'completed'])
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setOrders(data)
      }
    } catch (error) {
      console.error('Hiba a rendelések betöltésekor:', error)
    }
  }

  const loadDeliveryNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('id, order_number, customer_name, customer_address, items, status, created_at')
        .in('status', ['pending', 'in_progress', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(200)
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setDeliveryNotes(data)
      }
    } catch (error) {
      console.error('Hiba a szállítólevelek betöltésekor:', error)
    }
  }

  const loadInvoiceItems = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('id')
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a számlatételek betöltésekor')
        return
      }
      
      if (data) {
        const formattedItems: InvoiceItem[] = data.map(item => ({
          ...item,
          product_name: item.product?.name
        }))
        
        setInvoiceItems(formattedItems)
      }
    } catch (error) {
      console.error('Hiba a számlatételek betöltésekor:', error)
      toast.error('Hiba a számlatételek betöltésekor')
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      
      // Calculate totals
      const items = formData.items.map(item => {
        const quantity = parseFloat(item.quantity.toString())
        const unitPrice = parseFloat(item.unit_price.toString())
        const taxRate = parseFloat(item.tax_rate.toString())
        
        const taxAmount = (quantity * unitPrice) * (taxRate / 100)
        const totalAmount = (quantity * unitPrice) + taxAmount
        
        return {
          ...item,
          quantity,
          unit_price: unitPrice,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total_amount: totalAmount
        }
      })
      
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
      const taxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0)
      const totalAmount = subtotal + taxAmount
      
      if (editingInvoice) {
        // Update existing invoice
        const { error } = await supabase
          .from('invoices')
          .update({
            partner_id: formData.partner_id || null,
            customer_name: formData.customer_name,
            customer_address: formData.customer_address || null,
            customer_tax_number: formData.customer_tax_number || null,
            order_id: formData.order_id || null,
            issue_date: formData.issue_date,
            due_date: formData.due_date,
            payment_method: formData.payment_method,
            payment_status: formData.payment_status,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: 0,
            total_amount: totalAmount,
            notes: formData.notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingInvoice.id)
        
        if (error) {
          console.error('Database error:', error)
          toast.error('Hiba a számla frissítésekor')
          return
        }
        
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', editingInvoice.id)
        
        if (deleteError) {
          console.error('Database error:', deleteError)
          toast.error('Hiba a számlatételek törlésekor')
          return
        }
        
        // Insert new items
        const { error: insertError } = await supabase
          .from('invoice_items')
          .insert(items.map(item => ({
            invoice_id: editingInvoice.id,
            product_id: null, // Would be set in a real implementation
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            tax_amount: item.tax_amount,
            total_amount: item.total_amount
          })))
        
        if (insertError) {
          console.error('Database error:', insertError)
          toast.error('Hiba a számlatételek hozzáadásakor')
          return
        }
        
        toast.success('Számla sikeresen frissítve!')
      } else {
        // Create new invoice
        const { data, error } = await supabase
          .from('invoices')
          .insert({
            partner_id: formData.partner_id || null,
            customer_name: formData.customer_name,
            customer_address: formData.customer_address || null,
            customer_tax_number: formData.customer_tax_number || null,
            order_id: formData.order_id || null,
            issue_date: formData.issue_date,
            due_date: formData.due_date,
            payment_method: formData.payment_method,
            payment_status: formData.payment_status,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: 0,
            total_amount: totalAmount,
            notes: formData.notes || null,
            created_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
        
        if (error) {
          console.error('Database error:', error)
          toast.error('Hiba a számla létrehozásakor')
          return
        }
        
        if (data && data.length > 0) {
          const invoiceId = data[0].id
          
          // Insert items
          const { error: insertError } = await supabase
            .from('invoice_items')
            .insert(items.map(item => ({
              invoice_id: invoiceId,
              product_id: null, // Would be set in a real implementation
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              tax_amount: item.tax_amount,
              total_amount: item.total_amount
            })))
          
          if (insertError) {
            console.error('Database error:', insertError)
            toast.error('Hiba a számlatételek hozzáadásakor')
            return
          }
          
          toast.success('Számla sikeresen létrehozva!')
        }
      }
      
      setShowAddModal(false)
      setEditingInvoice(null)
      resetForm()
      loadInvoices()
    } catch (error) {
      console.error('Hiba a számla mentésekor:', error)
      toast.error('Hiba történt a számla mentésekor!')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      partner_id: '',
      customer_name: '',
      customer_address: '',
      customer_tax_number: '',
      order_id: '',
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      payment_method: 'transfer',
      payment_status: 'pending',
      notes: '',
      items: [{ 
        description: '', 
        quantity: 1, 
        unit_price: 0, 
        tax_rate: 27 
      }]
    })
  }

  const editInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    
    // Load invoice items
    loadInvoiceItems(invoice.id).then(() => {
      // Set form data
      setFormData({
        partner_id: invoice.partner_id || '',
        customer_name: invoice.customer_name,
        customer_address: invoice.customer_address || '',
        customer_tax_number: invoice.customer_tax_number || '',
        order_id: invoice.order_id || '',
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        payment_method: invoice.payment_method,
        payment_status: invoice.payment_status,
        notes: invoice.notes || '',
        items: invoiceItems.length > 0 ? invoiceItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate
        })) : [{ 
          description: '', 
          quantity: 1, 
          unit_price: 0, 
          tax_rate: 27 
        }]
      })
      
      setShowAddModal(true)
    })
  }

  const viewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice)
    loadInvoiceItems(invoice.id)
    setShowViewModal(true)
  }

  const deleteInvoice = async (id: string) => {
    if (window.confirm('Biztosan törölni szeretné ezt a számlát?')) {
      try {
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Database error:', error)
          toast.error('Hiba a számla törlésekor')
          return
        }
        
        toast.success('Számla sikeresen törölve!')
        loadInvoices()
      } catch (error) {
        console.error('Hiba a számla törlésekor:', error)
        toast.error('Hiba történt a számla törlésekor!')
      }
    }
  }

  const handleOrderSelect = (orderId: string) => {
    const selectedOrder = orders.find(o => o.id === orderId)
    if (selectedOrder) {
      setFormData(prev => ({
        ...prev,
        order_id: selectedOrder.id,
        customer_name: selectedOrder.customer_name,
        customer_address: selectedOrder.customer_address || '',
        items: selectedOrder.items.map((item: any) => {
          const prod = products.find(p => p.id === item.product_id)
          return {
            description: prod?.display_name || item.product_name || item.name || prod?.name || 'Termék',
            quantity: item.quantity,
            unit_price: item.price,
            tax_rate: 27
          }
        })
      }))
    }
  }

  const handlePartnerSelect = (partnerId: string) => {
    const selectedPartner = partners.find(p => p.id === partnerId)
    if (selectedPartner) {
      // In a real implementation, we would fetch partner details
      setFormData(prev => ({
        ...prev,
        partner_id: selectedPartner.id,
        customer_name: selectedPartner.name,
        // These would be populated from partner details
        customer_address: '',
        customer_tax_number: ''
      }))
    }
  }

  const handleDeliveryNoteSelect = (deliveryNoteId: string) => {
    const selectedNote = deliveryNotes.find(n => n.id === deliveryNoteId)
    if (selectedNote) {
      setFormData(prev => ({
        ...prev,
        delivery_note_id: selectedNote.id,
        customer_name: selectedNote.customer_name,
        customer_address: selectedNote.customer_address || '',
        items: (selectedNote.items || []).map((item: any) => {
          const prod = products.find(p => p.id === item.product_id)
          const desc = prod?.display_name || item.product_name || item.name || item.description || prod?.name || 'Termék'
          const qty = item.quantity || 1
          const price = item.unit_price || item.price || 0
          const taxRate = item.tax_rate || 27
          const net = qty * price
          const tax = net * (taxRate / 100)
          return {
            description: desc,
            quantity: qty,
            unit_price: price,
            tax_rate: taxRate,
            tax_amount: parseFloat(tax.toFixed(2)),
            total_amount: parseFloat((net + tax).toFixed(2))
          }
        })
      }))
    }
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { 
        description: '', 
        quantity: 1, 
        unit_price: 0, 
        tax_rate: 27 
      }]
    }))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items]
      newItems[index] = { ...newItems[index], [field]: value }
      return { ...prev, items: newItems }
    })
  }

  const removeItem = (index: number) => {
    setFormData(prev => {
      const newItems = [...prev.items]
      newItems.splice(index, 1)
      return { ...prev, items: newItems.length > 0 ? newItems : [{ 
        description: '', 
        quantity: 1, 
        unit_price: 0, 
        tax_rate: 27 
      }] }
    })
  }

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity.toString()) || 0
      const unitPrice = parseFloat(item.unit_price.toString()) || 0
      return sum + (quantity * unitPrice)
    }, 0)
  }

  const calculateTaxAmount = () => {
    return formData.items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity.toString()) || 0
      const unitPrice = parseFloat(item.unit_price.toString()) || 0
      const taxRate = parseFloat(item.tax_rate.toString()) || 0
      return sum + ((quantity * unitPrice) * (taxRate / 100))
    }, 0)
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Fizetve'
      case 'pending': return 'Függőben'
      case 'overdue': return 'Lejárt'
      case 'cancelled': return 'Törölve'
      default: return status
    }
  }

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'Készpénz'
      case 'card': return 'Bankkártya'
      case 'transfer': return 'Átutalás'
      default: return method
    }
  }

  const printInvoice = () => {
    if (!viewingInvoice) return
    const inv = viewingInvoice
    const items = invoiceItems
    const win = window.open('', '_blank')
    if (!win) { toast.error('Engedélyezze a felugró ablakokat!'); return }
    const fmt = (n: number) => n.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' Ft'
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Számla – ${inv.invoice_number}</title>
<style>
body{font-family:Arial,sans-serif;padding:30px;max-width:750px;margin:0 auto;color:#111}
h1{font-size:24px;margin:0;font-weight:900} .sub{color:#666;font-size:13px;margin:4px 0 24px}
.row{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}
.box{flex:1;background:#f9f9f9;padding:16px;border-radius:8px}
.box h3{font-size:11px;text-transform:uppercase;color:#999;margin:0 0 6px;letter-spacing:1px}
.box p{margin:2px 0;font-size:14px;font-weight:bold}
table{width:100%;border-collapse:collapse;margin-top:20px}
th{text-align:left;font-size:12px;color:#666;padding:8px;border-bottom:2px solid #000}
td{padding:10px 8px;font-size:13px;border-bottom:1px solid #eee}
td.right{text-align:right}
.total-row td{font-weight:bold;font-size:15px;border-bottom:none;border-top:2px solid #000}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold}
.pending{background:#fef3cd;color:#856404} .paid{background:#d4edda;color:#155724}
@media print{body{padding:10px}}
</style></head><body>
<div class="row">
  <div><h1>SZÁMLA</h1><div class="sub">${inv.invoice_number}</div></div>
  <div style="text-align:right">
    <span class="badge ${inv.payment_status === 'paid' ? 'paid' : 'pending'}">${inv.payment_status === 'paid' ? 'FIZETVE' : 'FIZETÉSRE VÁR'}</span>
  </div>
</div>
<div class="row">
  <div class="box"><h3>Kiállítva</h3><p>${inv.issue_date}</p></div>
  <div class="box"><h3>Fizetési határidő</h3><p>${inv.due_date}</p></div>
  <div class="box"><h3>Fizetési mód</h3><p>${inv.payment_method === 'transfer' ? 'Átutalás' : inv.payment_method === 'cash' ? 'Készpénz' : inv.payment_method}</p></div>
</div>
<div class="row">
  <div class="box"><h3>Vevő</h3><p>${inv.customer_name}</p>${inv.customer_address ? `<p style="font-weight:normal">${inv.customer_address}</p>` : ''}${inv.customer_tax_number ? `<p style="font-weight:normal;color:#666">Adószám: ${inv.customer_tax_number}</p>` : ''}</div>
  <div class="box"><h3>Kiállító</h3><p>Szemesi Pékség</p><p style="font-weight:normal">8636 Balatonszemes</p></div>
</div>
<table>
  <thead><tr><th>Megnevezés</th><th class="right">Mennyiség</th><th class="right">Egységár</th><th class="right">ÁFA%</th><th class="right">Összeg</th></tr></thead>
  <tbody>
    ${items.map(i => `<tr><td>${i.description}</td><td class="right">${i.quantity} db</td><td class="right">${fmt(i.unit_price)}</td><td class="right">${i.tax_rate}%</td><td class="right">${fmt(i.total_amount)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="4">Végösszeg</td><td class="right">${fmt(inv.total_amount)}</td></tr>
  </tbody>
</table>
${inv.notes ? `<p style="margin-top:20px;color:#666;font-size:13px">Megjegyzés: ${inv.notes}</p>` : ''}
<div style="margin-top:40px;display:flex;gap:40px">
  <div style="flex:1;border-top:1px solid #999;padding-top:8px;font-size:12px;color:#666">Kiállító aláírása</div>
  <div style="flex:1;border-top:1px solid #999;padding-top:8px;font-size:12px;color:#666">Átvevő aláírása</div>
</div>
</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  const downloadInvoice = () => {
    if (!viewingInvoice) return
    printInvoice()
    toast.success('Nyomtatási ablak megnyílt – mentse PDF-ként!')
  }

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ payment_status: 'paid' })
        .eq('id', id)
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a számla állapotának frissítésekor')
        return
      }
      
      toast.success('Számla sikeresen fizetettre állítva!')
      loadInvoices()
    } catch (error) {
      console.error('Hiba a számla állapotának frissítésekor:', error)
      toast.error('Hiba történt a számla állapotának frissítésekor!')
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.partner_name && invoice.partner_name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || invoice.payment_status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <FileText className="h-8 w-8 mr-3 text-blue-600" />
            Számlák
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Számlák kezelése és nyomon követése
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadInvoices}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Frissítés
          </button>
          <button
            onClick={() => {
              resetForm()
              setEditingInvoice(null)
              setShowAddModal(true)
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új számla
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes számla</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{invoices.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Fizetve</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {invoices.filter(i => i.payment_status === 'paid').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 p-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Függőben</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {invoices.filter(i => i.payment_status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-red-500 to-pink-600 p-3">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Lejárt</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {invoices.filter(i => i.payment_status === 'overdue').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Keresés
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Számlaszám, ügyfél vagy partner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Állapot
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Összes állapot</option>
              <option value="paid">Fizetve</option>
              <option value="pending">Függőben</option>
              <option value="overdue">Lejárt</option>
              <option value="cancelled">Törölve</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kezdő dátum
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Záró dátum
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Számla
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ügyfél
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dátum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Összeg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Állapot
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {invoice.invoice_number}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {invoice.order_number && (
                        <span>Rendelés: {invoice.order_number}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {invoice.customer_name}
                    </div>
                    {invoice.partner_name && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Partner: {invoice.partner_name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      Kiállítva: {new Date(invoice.issue_date).toLocaleDateString('hu-HU')}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Fizetési határidő: {new Date(invoice.due_date).toLocaleDateString('hu-HU')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {invoice.total_amount.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.payment_status)}`}>
                      {getStatusText(invoice.payment_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => viewInvoice(invoice)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Megtekintés"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editInvoice(invoice)}
                        className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                        title="Szerkesztés"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {invoice.payment_status === 'pending' && (
                        <button
                          onClick={() => markAsPaid(invoice.id)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="Fizetettre állítás"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteInvoice(invoice.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Törlés"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincsenek számlák</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kezdje el új számla létrehozásával.
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  resetForm()
                  setEditingInvoice(null)
                  setShowAddModal(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Új számla
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Invoice Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingInvoice ? 'Számla szerkesztése' : 'Új számla'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Invoice Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Számla adatok</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Rendelés
                    </label>
                    <select
                      value={formData.order_id}
                      onChange={(e) => handleOrderSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Válasszon rendelést</option>
                      {orders.map(order => (
                        <option key={order.id} value={order.id}>
                          {order.order_number} - {order.customer_name} ({order.total_amount.toLocaleString('hu-HU')} Ft)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Szállítólevél alapján számla
                    </label>
                    <select
                      value={formData.delivery_note_id}
                      onChange={(e) => handleDeliveryNoteSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Válasszon szállítólevelet</option>
                      {deliveryNotes.map(note => {
                        const total = (note.items || []).reduce((sum: number, item: any) => {
                          const qty = item.quantity || 1
                          const price = item.unit_price || item.price || 0
                          return sum + qty * price
                        }, 0)
                        const statusLabel = note.status === 'delivered' ? '✅' : note.status === 'in_progress' ? '🚚' : '⏳'
                        return (
                          <option key={note.id} value={note.id}>
                            {statusLabel} {note.order_number} – {note.customer_name} ({total > 0 ? total.toLocaleString('hu-HU') + ' Ft' : 'ár nincs'})
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Partner
                    </label>
                    <select
                      value={formData.partner_id}
                      onChange={(e) => handlePartnerSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Válasszon partnert</option>
                      {partners.map(partner => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ügyfél neve *
                    </label>
                    <input
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ügyfél címe
                    </label>
                    <input
                      type="text"
                      value={formData.customer_address}
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_address: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Adószám
                    </label>
                    <input
                      type="text"
                      value={formData.customer_tax_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_tax_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kiállítás dátuma *
                      </label>
                      <input
                        type="date"
                        value={formData.issue_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fizetési határidő *
                      </label>
                      <input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fizetési mód *
                      </label>
                      <select
                        value={formData.payment_method}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      >
                        <option value="transfer">Átutalás</option>
                        <option value="cash">Készpénz</option>
                        <option value="card">Bankkártya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fizetési állapot *
                      </label>
                      <select
                        value={formData.payment_status}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_status: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      >
                        <option value="pending">Függőben</option>
                        <option value="paid">Fizetve</option>
                        <option value="overdue">Lejárt</option>
                        <option value="cancelled">Törölve</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Megjegyzések
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Right Column - Invoice Items */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tételek</h3>
                    <button
                      onClick={addItem}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Tétel hozzáadása
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Tétel #{index + 1}</h4>
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Megnevezés *
                            </label>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              required
                            />
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Mennyiség *
                              </label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                min="0"
                                step="0.01"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Egységár (Ft) *
                              </label>
                              <input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                min="0"
                                step="0.01"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                ÁFA (%) *
                              </label>
                              <select
                                value={item.tax_rate}
                                onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                required
                              >
                                <option value="27">27%</option>
                                <option value="18">18%</option>
                                <option value="5">5%</option>
                                <option value="0">0%</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                            Nettó: {((item.quantity || 0) * (item.unit_price || 0)).toLocaleString('hu-HU')} Ft | 
                            ÁFA: {((item.quantity || 0) * (item.unit_price || 0) * (item.tax_rate || 0) / 100).toLocaleString('hu-HU')} Ft | 
                            Bruttó: {((item.quantity || 0) * (item.unit_price || 0) * (1 + (item.tax_rate || 0) / 100)).toLocaleString('hu-HU')} Ft
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Nettó összesen:</span>
                      <span className="text-gray-900 dark:text-white">{calculateSubtotal().toLocaleString('hu-HU')} Ft</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">ÁFA összesen:</span>
                      <span className="text-gray-900 dark:text-white">{calculateTaxAmount().toLocaleString('hu-HU')} Ft</span>
                    </div>
                    <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-white">Bruttó összesen:</span>
                      <span className="text-gray-900 dark:text-white">{calculateTotal().toLocaleString('hu-HU')} Ft</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !formData.customer_name || formData.items.some(item => !item.description)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : editingInvoice ? 'Frissítés' : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {showViewModal && viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Számla megtekintése: {viewingInvoice.invoice_number}
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={printInvoice}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Nyomtatás"
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                  <button
                    onClick={downloadInvoice}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Letöltés"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Bezárás"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
                <div className="flex justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">SZÁMLA</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Számlaszám: {viewingInvoice.invoice_number}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Kiállítás dátuma: {new Date(viewingInvoice.issue_date).toLocaleDateString('hu-HU')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Fizetési határidő: {new Date(viewingInvoice.due_date).toLocaleDateString('hu-HU')}
                    </p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Szemesi Pékség</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">8636 Balatonszemes, Fő u. 12.</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Adószám: 12345678-1-42</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">info@szemesipekseg.hu</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vevő</h4>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{viewingInvoice.customer_name}</p>
                    {viewingInvoice.customer_address && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{viewingInvoice.customer_address}</p>
                    )}
                    {viewingInvoice.customer_tax_number && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">Adószám: {viewingInvoice.customer_tax_number}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fizetési információk</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Fizetési mód: {getPaymentMethodText(viewingInvoice.payment_method)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Állapot: <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(viewingInvoice.payment_status)}`}>
                        {getStatusText(viewingInvoice.payment_status)}
                      </span>
                    </p>
                    {viewingInvoice.order_number && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Rendelésszám: {viewingInvoice.order_number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tételek</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Megnevezés</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Mennyiség</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Egységár</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">ÁFA %</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">ÁFA</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Összesen</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {invoiceItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {item.description}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                              {item.unit_price.toLocaleString('hu-HU')} Ft
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                              {item.tax_rate}%
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                              {item.tax_amount.toLocaleString('hu-HU')} Ft
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                              {item.total_amount.toLocaleString('hu-HU')} Ft
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="w-64">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Nettó összesen:</span>
                      <span className="text-gray-900 dark:text-white">{viewingInvoice.subtotal.toLocaleString('hu-HU')} Ft</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">ÁFA összesen:</span>
                      <span className="text-gray-900 dark:text-white">{viewingInvoice.tax_amount.toLocaleString('hu-HU')} Ft</span>
                    </div>
                    {viewingInvoice.discount_amount > 0 && (
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Kedvezmény:</span>
                        <span className="text-gray-900 dark:text-white">-{viewingInvoice.discount_amount.toLocaleString('hu-HU')} Ft</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-white">Bruttó összesen:</span>
                      <span className="text-gray-900 dark:text-white">{viewingInvoice.total_amount.toLocaleString('hu-HU')} Ft</span>
                    </div>
                  </div>
                </div>

                {viewingInvoice.notes && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Megjegyzések</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{viewingInvoice.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Bezárás
                </button>
                {viewingInvoice.payment_status === 'pending' && (
                  <button
                    onClick={() => {
                      markAsPaid(viewingInvoice.id)
                      setShowViewModal(false)
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Fizetettre állítás
                  </button>
                )}
                <button
                  onClick={printInvoice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Nyomtatás
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}