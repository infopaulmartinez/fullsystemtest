import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Receipt, Download, ChevronDown, ChevronUp, Calendar, Banknote, CreditCard, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ReceiptHistoryItem {
  id: string
  receipt_number: string
  cashier_id: string
  payment_method: 'cash' | 'card'
  amount_total: number
  success: boolean
  created_at: string
  receipt_data: any
}

export function ReceiptHistory() {
  const { user } = useAuth()
  const [receipts, setReceipts] = useState<ReceiptHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'cash' | 'card'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('today') // today, week, month, all

  useEffect(() => {
    loadReceipts()
  }, [user, filter, dateFilter])

  async function loadReceipts() {
    if (!user?.id) return
    setLoading(true)
    try {
      let query = supabase
        .from('receipt_history')
        .select('*')
        .eq('cashier_id', user.id)

      if (filter !== 'all') {
        query = query.eq('payment_method', filter)
      }

      // Date filter
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      if (dateFilter === 'today') {
        query = query.gte('created_at', startOfDay.toISOString())
      } else if (dateFilter === 'week') {
        query = query.gte('created_at', startOfWeek.toISOString())
      } else if (dateFilter === 'month') {
        query = query.gte('created_at', startOfMonth.toISOString())
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      setReceipts(data || [])
    } catch (err) {
      console.error('Blokk-történet betöltési hiba:', err)
      toast.error('Nem sikerült betölteni a blokkokat')
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    total: receipts.length,
    successful: receipts.filter(r => r.success).length,
    failed: receipts.filter(r => !r.success).length,
    totalAmount: receipts.filter(r => r.success).reduce((sum, r) => sum + r.amount_total, 0),
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Receipt className="h-6 w-6 text-amber-600" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Blokk-története</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase">Össz blokk</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase">Sikeres</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.successful}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase">Sikertelen</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.failed}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase">Bevétel</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {new Intl.NumberFormat('hu-HU').format(Math.round(stats.totalAmount))} Ft
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === 'all'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            Összes
          </button>
          <button
            onClick={() => setFilter('cash')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5 ${
              filter === 'cash'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <Banknote className="h-4 w-4" /> Készpénz
          </button>
          <button
            onClick={() => setFilter('card')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5 ${
              filter === 'card'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <CreditCard className="h-4 w-4" /> Bankkártya
          </button>
        </div>

        <div className="ml-auto flex gap-2">
          {(['today', 'week', 'month', 'all'] as const).map(period => (
            <button
              key={period}
              onClick={() => setDateFilter(period)}
              className={`px-3 py-2 rounded-lg font-medium text-xs transition-colors ${
                dateFilter === period
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {period === 'today' && 'Ma'}
              {period === 'week' && 'Hét'}
              {period === 'month' && 'Hónap'}
              {period === 'all' && 'Összes'}
            </button>
          ))}
        </div>
      </div>

      {/* Receipt list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 text-amber-600 border-4 border-gray-200 border-t-amber-600 rounded-full" />
        </div>
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Receipt className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Nincs blokk ebben az időszakban</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {receipts.map(receipt => (
            <div
              key={receipt.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                receipt.success
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                  : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
              }`}
            >
              <button
                onClick={() => setExpandedId(expandedId === receipt.id ? null : receipt.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  <div className="flex-shrink-0">
                    {receipt.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white font-mono text-sm">
                        {receipt.receipt_number}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          receipt.payment_method === 'cash'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}
                      >
                        {receipt.payment_method === 'cash' ? (
                          <>
                            <Banknote className="h-3 w-3" /> Készpénz
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3 w-3" /> Kártya
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(receipt.created_at).toLocaleString('hu-HU')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-lg text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('hu-HU').format(Math.round(receipt.amount_total))} Ft
                    </p>
                  </div>
                </div>
                {expandedId === receipt.id ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedId === receipt.id && receipt.receipt_data && (
                <div className="border-t border-inherit px-4 py-3 bg-opacity-50 space-y-2 text-xs">
                  {receipt.receipt_data.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>{item.name} × {item.quantity}</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat('hu-HU').format(Math.round(item.subtotal))} Ft
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-300 dark:border-gray-600 flex justify-between font-bold text-gray-900 dark:text-white">
                    <span>Végösszeg</span>
                    <span>{new Intl.NumberFormat('hu-HU').format(Math.round(receipt.receipt_data.total))} Ft</span>
                  </div>
                  {receipt.receipt_data.failReason && (
                    <div className="pt-2 text-red-600 dark:text-red-400">
                      <strong>Hiba:</strong> {receipt.receipt_data.failReason}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
