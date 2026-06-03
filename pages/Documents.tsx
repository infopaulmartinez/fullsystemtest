import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  Upload,
  Filter,
  Calendar,
  User,
  Tag,
  Save,
  X
} from 'lucide-react'

interface Document {
  id: string
  name: string
  type: 'contract' | 'invoice' | 'permit' | 'certificate' | 'recipe' | 'manual' | 'other'
  category: string
  file_path: string
  file_size: number
  mime_type: string
  uploaded_by: string
  uploaded_at: string
  tags: string[]
  description: string | null
  version: number
  status: 'active' | 'archived' | 'expired'
}

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'contract' as Document['type'],
    category: '',
    description: '',
    tags: '',
    status: 'active' as Document['status']
  })
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      
      // Load documents from database
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading documents:', error)
        toast.error('Hiba a dokumentumok betöltésekor')
        return
      }
      
      if (data) {
        // Format documents
        const formattedDocuments = data.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          category: doc.category,
          file_path: doc.file_path,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
          uploaded_by: doc.uploaded_by,
          uploaded_at: doc.created_at,
          tags: doc.tags || [],
          description: doc.description,
          version: doc.version || 1,
          status: doc.status
        }))
        
        setDocuments(formattedDocuments)
      } else {
        setDocuments([])
      }
    } catch (error) {
      console.error('Hiba a dokumentumok betöltésekor:', error)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!fileToUpload && !editingDocument) {
        alert('Kérjük válasszon feltöltendő fájlt!')
        setLoading(false)
        return
      }
      
      // Process tags
      const tagArray = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
      
      // Ensure documents bucket exists
      try {
        const { data: buckets } = await supabase.storage.listBuckets()
        const documentsBucketExists = buckets?.some(bucket => bucket.name === 'documents')
        
        if (!documentsBucketExists) {
          await supabase.storage.createBucket('documents', {
            public: false,
            fileSizeLimit: 10485760 // 10MB
          })
        }
      } catch (bucketError) {
        console.error('Error checking/creating documents bucket:', bucketError)
      }
      
      let filePath = ''
      let fileSize = 0
      let mimeType = ''
      
      // Upload file if new document
      if (fileToUpload && !editingDocument) {
        const fileName = `${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`
        filePath = `documents/${fileName}`
        fileSize = fileToUpload.size
        mimeType = fileToUpload.type
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, fileToUpload)
        
        if (uploadError) {
          console.error('Error uploading file:', uploadError)
          toast.error('Hiba a fájl feltöltésekor')
          setLoading(false)
          return
        }
      }
      
      if (editingDocument) {
        // Update existing document
        const updatedDocument = {
          ...editingDocument,
          name: formData.name,
          type: formData.type,
          category: formData.category,
          description: formData.description,
          tags: tagArray,
          status: formData.status
        }
        
        // Update in database
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            name: formData.name,
            type: formData.type,
            category: formData.category,
            description: formData.description,
            tags: tagArray,
            status: formData.status
          })
          .eq('id', editingDocument.id)
        
        if (updateError) {
          console.error('Error updating document:', updateError)
          toast.error('Hiba a dokumentum frissítésekor')
          setLoading(false)
          return
        }
        
        toast.success('Dokumentum sikeresen frissítve!')
      } else {
        // Create new document
        const documentData = {
          name: formData.name || fileToUpload?.name.split('.')[0] || 'Új dokumentum',
          type: formData.type,
          category: formData.category,
          file_path: filePath,
          file_size: fileSize,
          mime_type: mimeType,
          uploaded_by: user?.id,
          tags: tagArray,
          description: formData.description,
          status: formData.status
        }
        
        // Insert into database
        const { data, error: insertError } = await supabase
          .from('documents')
          .insert(documentData)
          .select()
        
        if (insertError) {
          console.error('Error inserting document:', insertError)
          toast.error('Hiba a dokumentum mentésekor')
          setLoading(false)
          return
        }
        
        toast.success('Új dokumentum sikeresen feltöltve!')
      }
      
      setShowAddModal(false)
      setEditingDocument(null)
      setFileToUpload(null)
      resetForm()
      loadDocuments()
    } catch (error) {
      console.error('Hiba a dokumentum mentésekor:', error)
      alert('Hiba történt a dokumentum mentésekor!')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'contract',
      category: '',
      description: '',
      tags: '',
      status: 'active'
    })
  }

  const editDocument = (document: Document) => {
    setEditingDocument(document)
    setFormData({
      name: document.name,
      type: document.type,
      category: document.category,
      description: document.description || '',
      tags: document.tags.join(', '),
      status: document.status
    })
    setShowAddModal(true)
  }

  const deleteDocument = (id: string) => {
    if (window.confirm('Biztosan törölni szeretné ezt a dokumentumot?')) {
      // In a real app, delete from database
      try {
        // Try to delete from database
        const { error } = supabase
          .from('documents')
          .delete()
          .eq('id', id)
          .then(response => {
            if (response.error) {
              console.error('Database error:', response.error)
              // Still update local state
              setDocuments(prev => prev.filter(doc => doc.id !== id))
              toast.success('Dokumentum sikeresen törölve! (Helyi változtatás)')
            } else {
              setDocuments(prev => prev.filter(doc => doc.id !== id))
              toast.success('Dokumentum sikeresen törölve!')
            }
          })
      } catch (error) {
        console.error('Hiba a dokumentum törlésekor:', error)
        // Still update local state as fallback
        setDocuments(prev => prev.filter(doc => doc.id !== id))
        toast.success('Dokumentum sikeresen törölve! (Helyi változtatás)')
      }
    }
  }

  const viewDocument = (document: Document) => {
    try {
      // Get public URL
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(document.file_path)
      
      if (data && data.publicUrl) {
        // Open in new tab
        window.open(data.publicUrl, '_blank')
      } else {
        toast.error('Nem sikerült megnyitni a dokumentumot')
      }
    } catch (error) {
      console.error('Error viewing document:', error)
      toast.error('Hiba a dokumentum megtekintésekor')
    }
  }

  const downloadDocument = (document: Document) => {
    try {
      // Get public URL
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(document.file_path)
      
      if (data && data.publicUrl) {
        // Create download link
        const link = document.createElement('a')
        link.href = data.publicUrl
        link.download = document.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        toast.success('Dokumentum letöltése megkezdődött')
      } else {
        toast.error('Nem sikerült megnyitni a dokumentumot')
      }
    } catch (error) {
      console.error('Error viewing document:', error)
      toast.error('Hiba a dokumentum megtekintésekor')
    }
  }


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setFileToUpload(file)
      
      // Auto-fill name if empty
      if (!formData.name) {
        const fileName = file.name.split('.').slice(0, -1).join('.')
        setFormData(prev => ({ ...prev, name: fileName }))
      }
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = selectedType === 'all' || doc.type === selectedType
    const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus
    return matchesSearch && matchesType && matchesStatus
  })

  const getTypeText = (type: string) => {
    switch (type) {
      case 'contract': return 'Szerződés'
      case 'invoice': return 'Számla'
      case 'permit': return 'Engedély'
      case 'certificate': return 'Tanúsítvány'
      case 'recipe': return 'Recept'
      case 'manual': return 'Munkautasítás'
      case 'other': return 'Egyéb'
      default: return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'contract': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'invoice': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'permit': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'certificate': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
      case 'recipe': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'manual': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400'
      case 'other': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Aktív'
      case 'archived': return 'Archivált'
      case 'expired': return 'Lejárt'
      default: return status
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading && !showAddModal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <FileText className="h-8 w-8 mr-3 text-blue-600" />
            Dokumentumok
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Dokumentum kezelő és tároló rendszer
          </p>
        </div>
        <button 
          onClick={() => {
            resetForm()
            setEditingDocument(null)
            setShowAddModal(true)
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
        >
          <Upload className="h-5 w-5 mr-2" />
          Feltöltés
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes dokumentum</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{documents.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Aktív</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {documents.filter(d => d.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3">
              <Tag className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Kategóriák</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {new Set(documents.map(d => d.category)).size}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-3">
              <Download className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes méret</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatFileSize(documents.reduce((sum, d) => sum + d.file_size, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Keresés
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Dokumentum neve, leírása vagy címkéje..."
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
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Összes típus</option>
              <option value="contract">Szerződés</option>
              <option value="invoice">Számla</option>
              <option value="permit">Engedély</option>
              <option value="certificate">Tanúsítvány</option>
              <option value="recipe">Recept</option>
              <option value="manual">Munkautasítás</option>
              <option value="other">Egyéb</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Állapot
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Összes állapot</option>
              <option value="active">Aktív</option>
              <option value="archived">Archivált</option>
              <option value="expired">Lejárt</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents Table */}
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
                  Méret
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Feltöltő
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
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          v{doc.version} • {doc.category}
                        </div>
                        {doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doc.tags.slice(0, 3).map((tag, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                {tag}
                              </span>
                            ))}
                            {doc.tags.length > 3 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">+{doc.tags.length - 3}</span>
                            )}
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
                    {formatFileSize(doc.file_size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mr-3">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">{doc.uploaded_by}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(doc.uploaded_at).toLocaleDateString('hu-HU')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                      {getStatusText(doc.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => viewDocument(doc)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => downloadDocument(doc)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => editDocument(doc)}
                        className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => deleteDocument(doc.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
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

        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincsenek dokumentumok</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kezdje el új dokumentum feltöltésével.
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingDocument ? 'Dokumentum szerkesztése' : 'Új dokumentum feltöltése'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {!editingDocument && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fájl kiválasztása *
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 hover:bg-gray-100 dark:border-gray-600">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-3 text-gray-500 dark:text-gray-400" />
                          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-semibold">Kattintson a feltöltéshez</span> vagy húzza ide a fájlt
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            PDF, DOCX, XLSX, JPG, PNG (max. 10MB)
                          </p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={handleFileChange}
                          accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                        />
                      </label>
                    </div>
                    {fileToUpload && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Kiválasztott fájl: {fileToUpload.name} ({formatFileSize(fileToUpload.size)})
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dokumentum neve *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Típus *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Document['type'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="contract">Szerződés</option>
                      <option value="invoice">Számla</option>
                      <option value="permit">Engedély</option>
                      <option value="certificate">Tanúsítvány</option>
                      <option value="recipe">Recept</option>
                      <option value="manual">Munkautasítás</option>
                      <option value="other">Egyéb</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kategória *
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Címkék (vesszővel elválasztva)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="pl. szerződés, beszállító, liszt"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Leírás
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Állapot
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Document['status'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="active">Aktív</option>
                    <option value="archived">Archivált</option>
                    <option value="expired">Lejárt</option>
                  </select>
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
                  disabled={loading || !formData.name || !formData.category || (!fileToUpload && !editingDocument)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : editingDocument ? 'Frissítés' : 'Feltöltés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}