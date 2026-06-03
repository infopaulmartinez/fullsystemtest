import React, { useState, useEffect } from 'react'
import { 
  CreditCard, 
  DollarSign, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  FileText,
  Edit,
  Trash2,
  Save,
  X,
  RefreshCw,
  Eye
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import 'jspdf-autotable'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

interface Payment {
  id: string
  user_id: string
  user_name?: string
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  payment_method: 'cash' | 'card' | 'transfer' | 'other'
  description: string | null
  reference_id: string | null
  created_at: string
  updated_at: string
  items?: PaymentItem[]
}

interface PaymentItem {
  id: string
  payment_id: string
  name: string
  amount: number
  quantity: number
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showWorkLogPaymentModal, setShowWorkLogPaymentModal] = useState(false)
  const [employees, setEmployees] = useState<any[]>([])
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [workLogPaymentData, setWorkLogPaymentData] = useState({
    employee_id: '',
    start_date: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end_date: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    payment_method: 'transfer' as Payment['payment_method'],
    description: 'Munkabér kifizetés'
  })
  const [formData, setFormData] = useState({
    amount: 0,
    currency: 'HUF',
    payment_method: 'cash' as Payment['payment_method'],
    description: '',
    reference_id: '',
    items: [{ name: '', amount: 0, quantity: 1 }]
  })
  const [advanceData, setAdvanceData] = useState({
    user_id: '',
    amount: 0,
    description: 'Fizetési előleg',
    payment_method: 'cash' as Payment['payment_method']
  })
  const { user } = useAuth()

  useEffect(() => {
    loadPayments()
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, hourly_wage')
        .order('full_name')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setEmployees(data)
      }
    } catch (error) {
      console.error('Hiba az alkalmazottak betöltésekor:', error)
    }
  }

  const loadPayments = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          profiles!payments_user_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Database error:', error)
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          setPayments([])
          return
        }
        toast.error('Hiba a fizetések betöltésekor')
        return
      }
      
      if (data && data.length > 0) {
        const formattedPayments: Payment[] = data.map(payment => ({
          ...payment,
          user_name: payment.profiles?.full_name || 'Ismeretlen felhasználó'
        }))
        
        for (const payment of formattedPayments) {
          try {
            const { data: itemsData, error: itemsError } = await supabase
              .from('payment_items')
              .select('*')
              .eq('payment_id', payment.id)
          
            if (!itemsError && itemsData) {
              payment.items = itemsData
            }
          } catch (itemsError) {
            console.error('Error loading payment items:', itemsError)
          }
        }
        
        setPayments(formattedPayments)
      } else {
        setPayments([])
      }
    } catch (error) {
      console.error('Hiba a fizetések betöltésekor:', error)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  // JAVÍTOTT FÜGGVÉNY
  const calculatePaymentFromWorkLogs = async () => {
    try {
      setLoading(true)
      
      if (!workLogPaymentData.employee_id) {
        toast.error('Válasszon alkalmazottat')
        setLoading(false); // Fontos: állítsuk le a töltést hiba esetén
        return
      }
      
      const { data, error } = await supabase.rpc(
        'calculate_payment_from_work_logs',
        {
          // A biztonság kedvéért mindkét verziót kipróbáljuk, hátha a DB függvény így várja a paramétert
          employee_id: workLogPaymentData.employee_id,
          start_date: workLogPaymentData.start_date,
          end_date: workLogPaymentData.end_date
        }
      )
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a fizetés kiszámításakor. Ellenőrizze az adatbázis-függvényt.')
        setLoading(false);
        return
      }

      // *** IDE KERÜLT A JAVÍTÁS ***
      // Kinyerjük a számot a visszakapott adatból.
      let calculatedAmount = 0;
      if (typeof data === 'number') {
        calculatedAmount = data;
      } else if (data && Array.isArray(data) && data.length > 0 && typeof data[0].total_amount === 'number') {
        calculatedAmount = data[0].total_amount;
      } else if (data && typeof data.total_amount === 'number') {
        calculatedAmount = data.total_amount;
      } else {
        toast.error('A fizetés kiszámítása nem adott vissza érvényes összeget.');
        console.warn('Nem sikerült kinyerni a fizetési összeget a RPC válaszból:', data);
        setLoading(false);
        return;
      }
      
      const employee = employees.find(e => e.id === workLogPaymentData.employee_id)
      
      const paymentData = {
        user_id: workLogPaymentData.employee_id,
        amount: calculatedAmount, // A kinyert, tiszta számot használjuk
        currency: 'HUF',
        payment_method: workLogPaymentData.payment_method,
        description: `${workLogPaymentData.description} (${workLogPaymentData.start_date} - ${workLogPaymentData.end_date})`,
        reference_id: `PAY-${Date.now()}`,
        status: 'pending' as const
      }
      
      const { data: paymentResult, error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
      
      if (paymentError) {
        console.error('Database error:', paymentError)
        toast.error('Hiba a fizetés létrehozásakor.')
        setLoading(false);
        return
      }
      
      toast.success(`Fizetés sikeresen létrehozva ${employee?.full_name || 'alkalmazott'} részére: ${calculatedAmount.toLocaleString('hu-HU')} Ft`)
      setShowWorkLogPaymentModal(false)
      loadPayments()
    } catch (err) {
      console.error('Hiba a fizetés kiszámításakor:', err)
      toast.error('Hiba történt a fizetés kiszámításakor.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdvancePayment = async () => {
    try {
      setLoading(true)
      
      if (!advanceData.user_id) {
        toast.error('Válasszon alkalmazottat')
        return
      }
      
      if (advanceData.amount <= 0) {
        toast.error('Az összeg nem lehet nulla vagy negatív')
        return
      }
      
      const paymentData = {
        user_id: advanceData.user_id,
        amount: advanceData.amount,
        currency: 'HUF',
        status: 'completed',
        payment_method: advanceData.payment_method,
        description: `Fizetési előleg: ${advanceData.description}`,
        reference_id: `ADV-${Date.now()}`
      }
      
      const { data, error } = await supabase
        .from('payments')
        .insert(paymentData)
        .select('*, profiles!payments_user_id_fkey(full_name)')
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba az előleg létrehozásakor')
        return
      }
      
      if (data && data.length > 0) {
        const newPayment: Payment = {
          ...data[0],
          user_name: data[0].profiles?.full_name
        }
        
        setPayments(prev => [newPayment, ...prev])
        toast.success('Előleg sikeresen létrehozva!')
        
        generatePayslipPDF(newPayment)
      }
      
      setShowAdvanceModal(false)
      setAdvanceData({
        user_id: '',
        amount: 0,
        description: 'Fizetési előleg',
        payment_method: 'cash'
      })
    } catch (error) {
      console.error('Hiba az előleg létrehozásakor:', error)
      toast.error('Hiba történt az előleg létrehozásakor!')
    } finally {
      setLoading(false)
    }
  }

  const generatePayslipPDF = (payment: Payment) => {
    try {
      const employee = employees.find(e => e.id === payment.user_id);
      if (!employee) {
        toast.error('Alkalmazott nem található');
        return;
      }
      
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text('Fizetési bizonylat', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text('Szemesi Pékség Kft.', 20, 40);
      doc.text('8636 Balatonszemes, Fő utca 50.', 20, 48);
      doc.text('Adószám: 12345678-1-42', 20, 56);
      
      doc.text('Alkalmazott:', 20, 70);
      doc.text(employee.full_name || 'Ismeretlen', 70, 70);
      doc.text('Fizetés dátuma:', 20, 78);
      doc.text(new Date(payment.created_at).toLocaleDateString('hu-HU'), 70, 78);
      
      doc.text('Fizetés részletei', 105, 100, { align: 'center' });
      
      const tableColumn = ["Tétel", "Összeg"];
      const tableRows = [
        [payment.description || "Fizetés", `${payment.amount.toLocaleString('hu-HU')} ${payment.currency}`]
      ];
      
      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 110,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 5 },
        headStyles: { fillColor: [66, 135, 245] }
      });
      
      doc.text('Aláírás: ____________________________', 20, 180);
      
      doc.save(`fizetesi_bizonylat_${payment.id}.pdf`);
      
      toast.success('Fizetési bizonylat letöltve');
    } catch (error) {
      console.error('Error generating payslip:', error);
      toast.error('Hiba a fizetési bizonylat generálásakor');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true)
      
      const totalAmount = formData.items.reduce((sum, item) => sum + (item.amount * item.quantity), 0)
      
      const paymentData = {
        user_id: user?.id,
        amount: totalAmount,
        currency: formData.currency,
        payment_method: formData.payment_method,
        description: formData.description,
        reference_id: formData.reference_id || `PAY-${Date.now()}`,
        status: 'pending' as const
      }
      
      const { data: paymentResult, error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
      
      if (paymentError) {
        console.error('Database error:', paymentError)
        toast.error('Hiba a fizetés létrehozásakor. Ellenőrizze, hogy a payments tábla létezik-e.')
        return
      }
      
      if (paymentResult && paymentResult.length > 0) {
        const paymentId = paymentResult[0].id
        
        const paymentItems = formData.items.map(item => ({
          payment_id: paymentId,
          name: item.name,
          amount: item.amount,
          quantity: item.quantity
        }))
        
        const { error: itemsError } = await supabase
          .from('payment_items')
          .insert(paymentItems)
        
        if (itemsError) {
          console.error('Database error:', itemsError)
          toast.error('Hiba a fizetési tételek létrehozásakor. Ellenőrizze, hogy a payment_items tábla létezik-e.')
          return
        }
        
        toast.success('Fizetés sikeresen létrehozva!')
        setShowAddModal(false)
        resetForm()
        loadPayments()
      }
    } catch (error) {
      console.error('Hiba a fizetés létrehozásakor:', error)
      toast.error('Hiba a fizetés létrehozásakor')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      amount: 0,
      currency: 'HUF',
      payment_method: 'cash',
      description: '',
      reference_id: '',
      items: [{ name: '', amount: 0, quantity: 1 }]
    })
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', amount: 0, quantity: 1 }]
    }))
  }

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const updateItem = (index: number, field: keyof PaymentItem, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items]
      newItems[index] = {
        ...newItems[index],
        [field]: field === 'amount' || field === 'quantity' ? Number(value) : value
      }
      return { ...prev, items: newItems }
    })
  }

  const viewPayment = (payment: Payment) => {
    setSelectedPayment(payment)
    setShowViewModal(true)
  }

  const updatePaymentStatus = async (id: string, status: Payment['status']) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status })
        .eq('id', id)
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a fizetés állapotának frissítésekor. Ellenőrizze, hogy a payments tábla létezik-e.')
        return
      }
      
      setPayments(prev => prev.map(payment => 
        payment.id === id ? { ...payment, status } : payment
      ))
      
      if (selectedPayment && selectedPayment.id === id) {
        setSelectedPayment({ ...selectedPayment, status })
      }
      
      toast.success(`Fizetés állapota frissítve: ${getStatusText(status)}`)
    } catch (error) {
      console.error('Hiba a fizetés állapotának frissítésekor:', error)
      toast.error('Hiba történt a fizetés állapotának frissítésekor!')
    }
  }

  const deletePayment = async (id: string) => {
    if (!confirm('Biztosan törölni szeretné ezt a fizetést?')) return
    
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a fizetés törlésekor. Ellenőrizze, hogy a payments tábla létezik-e.')
        return
      }
      
      setPayments(prev => prev.filter(payment => payment.id !== id))
      
      if (showViewModal && selectedPayment?.id === id) {
        setShowViewModal(false)
        setSelectedPayment(null)
      }
      
      toast.success('Fizetés sikeresen törölve!')
    } catch (error) {
      console.error('Hiba a fizetés törlésekor:', error)
      toast.error('Hiba a fizetés törlésekor')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'refunded': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Függőben'
      case 'completed': return 'Teljesítve'
      case 'failed': return 'Sikertelen'
      case 'refunded': return 'Visszatérítve'
      default: return status
    }
  }

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'Készpénz'
      case 'card': return 'Bankkártya'
      case 'transfer': return 'Átutalás'
      case 'other': return 'Egyéb'
      default: return method
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return DollarSign
      case 'card': return CreditCard
      case 'transfer': return FileText
      case 'other': return CreditCard
      default: return CreditCard
    }
  }

  const filteredPayments = payments.filter(payment => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (payment.user_name && payment.user_name.toLowerCase().includes(searchLower)) ||
      (payment.description && payment.description.toLowerCase().includes(searchLower)) ||
      (payment.reference_id && payment.reference_id.toLowerCase().includes(searchLower))
    
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
    
    const matchesDateRange = 
      (!dateRange.start || new Date(payment.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.created_at) <= new Date(dateRange.end))
    
    return matchesSearch && matchesStatus && matchesDateRange
  })

  const totalAmount = filteredPayments.reduce((sum, payment) => 
    payment.status === 'completed' ? sum + payment.amount : sum, 0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <CreditCard className="h-8 w-8 mr-3 text-blue-600" />
            Fizetések
          </h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadPayments}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Frissítés
          </button>
          <button
            onClick={() => setShowWorkLogPaymentModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Clock className="h-5 w-5 mr-2" />
            Munkaidő alapú fizetés
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új fizetés
          </button>
          <button
            onClick={() => setShowAdvanceModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transition-all duration-200 shadow-lg shadow-amber-500/25"
          >
            <DollarSign className="h-5 w-5 mr-2" />
            Előleg kifizetése
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes kifizetés</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalAmount.toLocaleString('hu-HU')} Ft
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Teljesített</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {payments.filter(p => p.status === 'completed').length}
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
                {payments.filter(p => p.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-red-500 to-pink-600 p-3">
              <XCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sikertelen</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {payments.filter(p => p.status === 'failed' || p.status === 'refunded').length}
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
                placeholder="Név, leírás vagy azonosító..."
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
              <option value="pending">Függőben</option>
              <option value="completed">Teljesítve</option>
              <option value="failed">Sikertelen</option>
              <option value="refunded">Visszatérítve</option>
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

      {/* Payments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Azonosító
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Felhasználó
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Összeg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Fizetési mód
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Állapot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dátum
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPayments.map((payment) => {
                const PaymentMethodIcon = getPaymentMethodIcon(payment.payment_method)
                return (
                  <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {payment.reference_id || payment.id.substring(0, 8)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {payment.description || 'Nincs leírás'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-3">
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {payment.user_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {payment.amount.toLocaleString('hu-HU')} {payment.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <PaymentMethodIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {getPaymentMethodText(payment.payment_method)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        {getStatusText(payment.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(payment.created_at).toLocaleDateString('hu-HU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => viewPayment(payment)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Részletek"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => deletePayment(payment.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => generatePayslipPDF(payment)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 ml-2"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredPayments.length === 0 && (
          <div className="text-center py-12">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nincsenek fizetések</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Még nem történt fizetési tranzakció, vagy a szűrési feltételeknek nem felel meg egy sem.
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  resetForm()
                  setShowAddModal(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Új fizetés létrehozása
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Payment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Új fizetés létrehozása
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fizetési mód *
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value as Payment['payment_method'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="cash">Készpénz</option>
                      <option value="card">Bankkártya</option>
                      <option value="transfer">Átutalás</option>
                      <option value="other">Egyéb</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pénznem
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="HUF">Magyar Forint (HUF)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="USD">US Dollar (USD)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Leírás
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Fizetés célja, megjegyzés..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Referencia azonosító
                  </label>
                  <input
                    type="text"
                    value={formData.reference_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Opcionális egyedi azonosító"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tételek *
                    </label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex space-x-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          placeholder="Tétel neve"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateItem(index, 'amount', e.target.value)}
                          placeholder="Összeg"
                          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          placeholder="Db"
                          className="w-16 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="1"
                          required
                        />
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center text-lg font-medium text-gray-900 dark:text-white">
                    <span>Végösszeg:</span>
                    <span>
                      {formData.items.reduce((sum, item) => sum + (item.amount * item.quantity), 0).toLocaleString('hu-HU')} {formData.currency}
                    </span>
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
                  disabled={loading || formData.items.some(item => !item.name || item.amount <= 0)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : 'Fizetés létrehozása'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Payment Modal */}
      {showViewModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Fizetés részletei
                </h2>
                <button
                  onClick={() => {
                    setShowViewModal(false)
                    setSelectedPayment(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Azonosító</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {selectedPayment.reference_id || selectedPayment.id}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedPayment.status)}`}>
                    {getStatusText(selectedPayment.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Felhasználó</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {selectedPayment.user_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Dátum</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {new Date(selectedPayment.created_at).toLocaleDateString('hu-HU', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Fizetési mód</p>
                    <div className="flex items-center">
                      {React.createElement(getPaymentMethodIcon(selectedPayment.payment_method), { 
                        className: "h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" 
                      })}
                      <p className="text-base font-medium text-gray-900 dark:text-white">
                        {getPaymentMethodText(selectedPayment.payment_method)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Összeg</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {selectedPayment.amount.toLocaleString('hu-HU')} {selectedPayment.currency}
                    </p>
                  </div>
                </div>

                {selectedPayment.description && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Leírás</p>
                    <p className="text-base text-gray-900 dark:text-white">
                      {selectedPayment.description}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Tételek</h3>
                  
                  {selectedPayment.items && selectedPayment.items.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPayment.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {item.quantity} x {item.amount.toLocaleString('hu-HU')} {selectedPayment.currency}
                            </p>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {(item.amount * item.quantity).toLocaleString('hu-HU')} {selectedPayment.currency}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">Nincsenek részletes tételek</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Műveletek</h3>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedPayment.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updatePaymentStatus(selectedPayment.id, 'completed')}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Teljesítés
                        </button>
                        <button
                          onClick={() => updatePaymentStatus(selectedPayment.id, 'failed')}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Sikertelen
                        </button>
                      </>
                    )}
                    
                    {selectedPayment.status === 'completed' && (
                      <button
                        onClick={() => updatePaymentStatus(selectedPayment.id, 'refunded')}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Visszatérítés
                      </button>
                    )}
                    
                    <button
                      onClick={() => deletePayment(selectedPayment.id)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Törlés
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Log Payment Modal */}
      {showWorkLogPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Munkaidő alapú fizetés
                </h2>
                <button
                  onClick={() => setShowWorkLogPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Alkalmazott *
                  </label>
                  <select
                    value={workLogPaymentData.employee_id}
                    onChange={(e) => setWorkLogPaymentData(prev => ({ ...prev, employee_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Válasszon alkalmazottat</option>
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name} ({employee.hourly_wage ? `${employee.hourly_wage} Ft/óra` : 'Nincs órabér'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kezdő dátum *
                    </label>
                    <input
                      type="date"
                      value={workLogPaymentData.start_date}
                      onChange={(e) => setWorkLogPaymentData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Záró dátum *
                    </label>
                    <input
                      type="date"
                      value={workLogPaymentData.end_date}
                      onChange={(e) => setWorkLogPaymentData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fizetési mód *
                  </label>
                  <select
                    value={workLogPaymentData.payment_method}
                    onChange={(e) => setWorkLogPaymentData(prev => ({ ...prev, payment_method: e.target.value as Payment['payment_method'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="cash">Készpénz</option>
                    <option value="card">Bankkártya</option>
                    <option value="transfer">Átutalás</option>
                    <option value="other">Egyéb</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Leírás
                  </label>
                  <input
                    type="text"
                    value={workLogPaymentData.description}
                    onChange={(e) => setWorkLogPaymentData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    A rendszer automatikusan kiszámítja a fizetendő összeget a munkaidő nyilvántartás alapján, figyelembe véve az alkalmazott órabérét.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowWorkLogPaymentModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={calculatePaymentFromWorkLogs}
                  disabled={loading || !workLogPaymentData.employee_id || !workLogPaymentData.start_date || !workLogPaymentData.end_date}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Számítás...' : 'Fizetés létrehozása'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Advance Payment Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Fizetési előleg
                </h2>
                <button
                  onClick={() => setShowAdvanceModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Alkalmazott *
                  </label>
                  <select
                    value={advanceData.user_id}
                    onChange={(e) => setAdvanceData(prev => ({ ...prev, user_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Válasszon alkalmazottat</option>
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Összeg (HUF) *
                  </label>
                  <input
                    type="number"
                    value={advanceData.amount}
                    onChange={(e) => setAdvanceData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fizetési mód
                  </label>
                  <select
                    value={advanceData.payment_method}
                    onChange={(e) => setAdvanceData(prev => ({ ...prev, payment_method: e.target.value as Payment['payment_method'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="cash">Készpénz</option>
                    <option value="card">Bankkártya</option>
                    <option value="transfer">Átutalás</option>
                    <option value="other">Egyéb</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Megjegyzés
                  </label>
                  <textarea
                    value={advanceData.description}
                    onChange={(e) => setAdvanceData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleAdvancePayment}
                  disabled={loading || !advanceData.user_id || advanceData.amount <= 0}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Feldolgozás...' : 'Előleg kifizetése'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}