import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  Search, 
  Download, 
  Eye, 
  ArrowLeft, 
  Calendar, 
  Filter,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

interface Document {
  id: string
  name: string
  type: string
  file_path: string
  file_size: number
  created_at: string
  description: string | null
}

export default function PartnerDocuments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [partnerId, setPartnerId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      checkPartnerAssociation()
    }
  }, [user])

  useEffect(() => {
    if (partnerId) {
      loadDocuments()
    }
  }, [partnerId, typeFilter, dateRange])

  const checkPartnerAssociation = async () => {
    try {
      // Check if user is associated with a partner company
      const { data, error } = await supabase
        .from('partner_users')
        .select('partner_id')
        .eq('user_id', user?.id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No partner association found
          toast.error('Nincs hozzárendelve partner céghez')
          navigate('/login')
          return
        }
        throw error
      }
      
      if (data) {
        setPartnerId(data.partner_id)
      }
    } catch (error) {
      console.error('Hiba a partner ellenőrzésekor:', error)
      toast.error('Hiba a partner ellenőrzésekor')
    }
  }

  const loadDocuments = async () => {
    try {
      setLoading(true)
      
      // In a real implementation, this would load documents related to the partner
      // For now, we'll use mock data
      const mockDocuments: Document[] = [
        {
          id: '1',
          name: 'Számla - 2025/001',
          type: 'invoice',
          file_path: '/documents/invoice-001.pdf',
          file_size: 1024 * 1024 * 0.5, // 0.5 MB
          created_at: '2025-07-01T10:00:00Z',
          description: 'Júliusi rendelés számla'
        },
        {
          id: '2',
          name: 'Szerződés - 2025',
          type: 'contract',
          file_path: '/documents/contract-2025.pdf',
          file_size: 1024 * 1024 * 1.2, // 1.2 MB
          created_at: '2025-01-15T14:30:00Z',
          description: 'Éves együttműködési szerződés'
        },
        {
          id: '3',
          name: 'Szállítólevél - SZL-20250705-1234',
          type: 'delivery',
          file_path: '/documents/delivery-note-1234.pdf',
          file_size: 1024 * 1024 * 0.3, // 0.3 MB
          created_at: '2025-07-05T08:45:00Z',
          description: 'Júliusi szállítás'
        }
      ]
      
      setDocuments(mockDocuments)
    } catch (error) {
      console.error('Hiba a dokumentumok betöltésekor:', error)
      toast.error('Hiba a dokumentumok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (document: Document) => {
    toast.success(`${document.name} letöltése folyamatban...`)
  }
  
  const handleView = async (document: Document) => {
    // Check if it's an invoice
    if (document.id.startsWith('invoice-')) {
      const invoiceId = document.id.replace('invoice-', '');
      const invoice = invoices.find(inv => inv.id === invoiceId);
      
      if (invoice) {
        setSelectedInvoice(invoice);
        setShowInvoicePreview(true);
      }
    } else {
      // For other documents
      toast.success(`Dokumentum megtekintése: ${document.name}`);
    }
  };

  const downloadInvoice = async () => {
    if (!invoiceRef.current || !selectedInvoice) return;
    
    try {
      toast.success('Számla sikeresen letöltve!');
    } catch (error) {
      console.error('Hiba a számla letöltésekor:', error);
      toast.error('Hiba történt a számla letöltésekor!');
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'invoice': return 'Számla'
      case 'contract': return 'Szerződés'
      case 'delivery': return 'Szállítólevél'
      default: return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'invoice': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'contract': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'delivery': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = typeFilter === 'all' || doc.type === typeFilter
    const matchesDateRange = 
      (!dateRange.start || new Date(doc.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(doc.created_at) <= new Date(dateRange.end))
    
    return matchesSearch && matchesType && matchesDateRange
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link to="/partner" className="mr-4">
            <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <FileText className="h-8 w-8 mr-3 text-blue-600" />
              Dokumentumok
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Tekintse meg és töltse le a számlákat és egyéb dokumentumokat
            </p>
          </div>
        </div>
        <button
          onClick={loadDocuments}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Frissítés
        </button>
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
                placeholder="Dokumentum neve vagy leírása..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Típus
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Összes típus</option>
              <option value="invoice">Számla</option>
              <option value="contract">Szerződés</option>
              <option value="delivery">Szállítólevél</option>
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

      {/* Documents */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dokumentum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Típus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dátum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Méret
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-4">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {doc.name}
                        </div>
                        {doc.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {doc.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(doc.type)}`}>
                      {getTypeText(doc.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(doc.created_at).toLocaleDateString('hu-HU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatFileSize(doc.file_size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleView(doc)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincsenek dokumentumok</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Nem találhatók dokumentumok a megadott szűrési feltételekkel.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}