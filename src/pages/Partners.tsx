import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Search,
  Truck,
  AlertTriangle,
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin,
  DollarSign,
  Calendar,
  Save,
  X,
  RefreshCw,
  FileText,
  Download,
  Upload,
  Building,
  Store,
  TrendingUp
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

interface Partner {
  id: string
  name: string
  tax_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  phone: string | null
  email: string | null
  contact_person: string | null
  status: 'active' | 'inactive' | 'suspended'
  discount_percentage: number | null
  payment_terms: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [ownStores, setOwnStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [activeTab, setActiveTab] = useState<'partners' | 'stores'>('partners')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [deletingPartner, setDeletingPartner] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    tax_number: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Hungary',
    phone: '',
    email: '',
    contact_person: '',
    status: 'active' as Partner['status'],
    discount_percentage: 0,
    payment_terms: 'immediate' as string,
    notes: ''
  })
  
  const [locationFormData, setLocationFormData] = useState({
    name: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Hungary',
    type: 'partner' as const,
    status: 'active' as const
  })
  
  const [deliveryFormData, setDeliveryFormData] = useState({
    partner_id: '',
    delivery_address: '',
    delivery_contact: '',
    delivery_phone: '',
    delivery_email: '',
    delivery_notes: '',
    is_default: false
  })

  useEffect(() => {
    loadPartners()
    loadLocations()
    loadOwnStores()
  }, [])

  const loadPartners = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('partner_companies')
        .select('*')
        .order('name')
      
      if (error) {
        console.error('Database error:', error)
        setError('Hiba a partnerek betöltésekor: ' + error.message)
        return
      }
      
      if (data) {
        setPartners(data)
      }
    } catch (error) {
      console.error('Hiba a partnerek betöltésekor:', error)
      toast.error('Hiba a partnerek betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('type', 'partner')
        .order('name')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setLocations(data)
      }
    } catch (error) {
      console.error('Hiba a helyszínek betöltésekor:', error)
    }
  }

  const loadOwnStores = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('type', 'store')
        .order('name')
      
      if (error) throw error
      setOwnStores(data || [])
    } catch (error) {
      console.error('Error loading own stores:', error)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      
      // Generate a unique ID for the partner
      const partnerId = crypto.randomUUID();
      
      if (editingPartner) {
        // Update existing partner
        const updatedPartner = {
          ...editingPartner,
          name: formData.name,
          tax_number: formData.tax_number || null,
          address: formData.address || null,
          city: formData.city || null,
          postal_code: formData.postal_code || null,
          country: formData.country,
          phone: formData.phone || null,
          email: formData.email || null,
          contact_person: formData.contact_person || null,
          status: formData.status,
          discount_percentage: formData.discount_percentage,
          payment_terms: formData.payment_terms,
          notes: formData.notes || null
        }
        
        // Update in database
        const { error } = await supabase
          .from('partner_companies')
          .update(updatedPartner)
          .eq('id', editingPartner.id)
        
        if (error) {
          console.error('Database error:', error)
          toast.error('Hiba a partner frissítésekor')
          return
        }
        
        // Update local state
        setPartners(prev => prev.map(p => p.id === editingPartner.id ? updatedPartner : p))
        toast.success('Partner sikeresen frissítve!')
      } else {
        // Create new partner
        const newPartner: Omit<Partner, 'id' | 'created_at' | 'updated_at'> = {
          id: partnerId,
          name: formData.name,
          tax_number: formData.tax_number || null,
          address: formData.address || null,
          city: formData.city || null,
          postal_code: formData.postal_code || null,
          country: formData.country,
          phone: formData.phone || null,
          email: formData.email || null,
          contact_person: formData.contact_person || null,
          status: formData.status,
          discount_percentage: formData.discount_percentage,
          payment_terms: formData.payment_terms,
          notes: formData.notes || null
        }
        
        // Insert into database
        const { data, error } = await supabase
          .from('partner_companies');
        
        // First create the partner company
        const { data: partnerData, error: partnerError } = await supabase
          .from('partner_companies')
          .insert({
            ...newPartner
          })
          .select();
          
        if (partnerError) {
          console.error('Database error:', partnerError);
          toast.error('Hiba a partner létrehozásakor');
          return;
        }
        
        // Then create a partner user for the admin
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (!userError && userData.user) {
          const { error: partnerUserError } = await supabase
            .from('partner_users')
            .insert({
              user_id: userData.user.id,
              partner_id: partnerId,
              role: 'owner',
              is_admin: true
            });
            
          if (partnerUserError) {
            console.error('Database error:', partnerUserError);
            toast.error('Hiba a partner felhasználó létrehozásakor');
          }
        }
        
        if (error) {
          console.error('Database error:', error)
          toast.error('Hiba a partner létrehozásakor')
          return
        }
        
        if (data && data.length > 0) {
          // Update local state
          setPartners(prev => [...prev, data[0]])
          toast.success('Új partner sikeresen létrehozva!')
        }
      }
      
      setShowAddModal(false)
      setEditingPartner(null)
      resetForm()
    } catch (error) {
      console.error('Hiba a partner mentésekor:', error)
      toast.error('Hiba történt a partner mentésekor!')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLocation = (partner: Partner) => {
    setSelectedPartner(partner)
    setLocationFormData({
      name: partner.name,
      address: partner.address || '',
      city: partner.city || '',
      postal_code: partner.postal_code || '',
      country: partner.country || 'Hungary',
      type: 'partner',
      status: 'active'
    })
    setShowLocationModal(true)
  }

  const handleSubmitLocation = async () => {
    if (!selectedPartner) return
    
    try {
      setLoading(true)
      
      // Create location for partner
      const { error } = await supabase
        .from('locations')
        .insert({
          name: locationFormData.name,
          type: 'partner',
          address: locationFormData.address,
          city: locationFormData.city,
          postal_code: locationFormData.postal_code,
          country: locationFormData.country,
          status: locationFormData.status,
          partner_id: selectedPartner.id // Link to partner
        })
      
      if (error) {
        console.error('Error creating location:', error)
        toast.error('Hiba a helyszín létrehozásakor: ' + error.message)
        return
      }
      
      toast.success('Helyszín sikeresen hozzáadva a partnerhez!')
      setShowLocationModal(false)
      loadLocations()
    } catch (error) {
      console.error('Hiba a helyszín létrehozásakor:', error)
      toast.error('Hiba történt a helyszín létrehozásakor!')
    } finally {
      setLoading(false)
    }
  }

  const handleAddDeliveryAddress = (partner: Partner) => {
    setSelectedPartner(partner)
    setDeliveryFormData({
      partner_id: partner.id,
      delivery_address: partner.address || '',
      delivery_contact: partner.contact_person || '',
      delivery_phone: partner.phone || '',
      delivery_email: partner.email || '',
      delivery_notes: '',
      is_default: false
    })
    setShowDeliveryModal(true)
  }

  const handleSubmitDeliveryAddress = async () => {
    if (!selectedPartner) return
    
    try {
      setLoading(true)
      
      // Create delivery address for partner
      const { error } = await supabase
        .from('partner_delivery_addresses')
        .insert({
          partner_id: selectedPartner.id,
          address: deliveryFormData.delivery_address,
          contact_person: deliveryFormData.delivery_contact,
          phone: deliveryFormData.delivery_phone,
          email: deliveryFormData.delivery_email,
          notes: deliveryFormData.delivery_notes,
          is_default: deliveryFormData.is_default
        })
      
      if (error) {
        console.error('Error creating delivery address:', error)
        toast.error('Hiba a szállítási cím létrehozásakor: ' + error.message)
        return
      }
      
      toast.success('Szállítási cím sikeresen hozzáadva a partnerhez!')
      setShowDeliveryModal(false)
    } catch (error) {
      console.error('Hiba a szállítási cím létrehozásakor:', error)
      toast.error('Hiba történt a szállítási cím létrehozásakor!')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      tax_number: '',
      address: '',
      city: '',
      postal_code: '',
      country: 'Hungary',
      phone: '',
      email: '',
      contact_person: '',
      status: 'active',
      discount_percentage: 0,
      payment_terms: 'immediate',
      notes: ''
    })
  }

  const editPartner = (partner: Partner) => {
    setEditingPartner(partner)
    setFormData({
      name: partner.name,
      tax_number: partner.tax_number || '',
      address: partner.address || '',
      city: partner.city || '',
      postal_code: partner.postal_code || '',
      country: partner.country || 'Hungary',
      phone: partner.phone || '',
      email: partner.email || '',
      contact_person: partner.contact_person || '',
      status: partner.status,
      discount_percentage: partner.discount_percentage || 0,
      payment_terms: partner.payment_terms || 'immediate',
      notes: partner.notes || ''
    })
    setShowAddModal(true)
  }

  const deletePartner = async (id: string) => {
    if (window.confirm('Biztosan törölni szeretné ezt a partnert?')) {
      try {
        setDeletingPartner(id);
        
        // First check if there are any orders associated with this partner
        const { data: ordersData, error: ordersCheckError } = await supabase
          .from('orders')
          .select('id')
          .eq('customer_id', id);
        
        if (ordersCheckError) {
          console.error('Error checking orders:', ordersCheckError);
          toast.error('Hiba az ellenőrzés során');
          return;
        }
        
        if (ordersData && ordersData.length > 0) {
          // Instead of preventing deletion, update the partner status to inactive
          const { error: updateError } = await supabase
            .from('partner_companies')
            .update({ status: 'inactive' })
            .eq('id', id);
            
          if (updateError) {
            console.error('Error updating partner status:', updateError);
            toast.error('Hiba a partner státuszának frissítésekor');
            return;
          }
          
          toast.success('A partner státusza inaktívra állítva, mert vannak hozzá kapcsolódó rendelések!');
          
          // Update local state
          setPartners(prev => prev.map(p => 
            p.id === id ? { ...p, status: 'inactive' } : p
          ));
          
          setDeletingPartner(null);
          return;
        }
        
        // Delete associated locations first
        const { error: locationError } = await supabase
          .from('locations')
          .delete()
          .eq('partner_id', id);
        
        if (locationError) {
          console.error('Error deleting partner locations:', locationError);
          // Continue with partner deletion even if location deletion fails
          toast.warning('Figyelmeztetés: Nem sikerült törölni a partner helyszíneit');
        }
        
        // Delete partner_users
        const { error: userError } = await supabase
          .from('partner_users')
          .delete()
          .eq('partner_id', id);
        
        if (userError) {
          console.error('Error deleting partner users:', userError);
          toast.error('Hiba a partner felhasználók törlésekor');
          return;
        }
        
        // Delete from database
        const { error } = await supabase
          .from('partner_companies')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error('Database error:', error);
          if (error.message && error.message.includes('violates foreign key constraint')) {
            // If we can't delete due to foreign key constraints, update status to inactive
            const { error: updateError } = await supabase
              .from('partner_companies')
              .update({ status: 'inactive' })
              .eq('id', id);
              
            if (updateError) {
              console.error('Error updating partner status:', updateError);
              toast.error('Hiba a partner státuszának frissítésekor');
              return;
            }
            
            toast.success('A partner státusza inaktívra állítva, mert nem törölhető!');
            
            // Update local state
            setPartners(prev => prev.map(p => 
              p.id === id ? { ...p, status: 'inactive' } : p
            ));
          } else {
            toast.error('Hiba a partner törlésekor: ' + error.message);
          }
          return;
        }
        
        // Update local state
        setPartners(prev => prev.filter(p => p.id !== id));
        toast.success('Partner sikeresen törölve!');
      } catch (error) {
        console.error('Hiba a partner törlésekor:', error);
        toast.error('Hiba történt a partner törlésekor!');
      }
      finally {
        setDeletingPartner(null);
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Aktív'
      case 'inactive': return 'Inaktív'
      case 'suspended': return 'Felfüggesztve'
      default: return status
    }
  }

  const getPaymentTermsText = (terms: string) => {
    switch (terms) {
      case 'immediate': return 'Azonnali'
      case 'net15': return 'Net 15 nap'
      case 'net30': return 'Net 30 nap'
      case 'net60': return 'Net 60 nap'
      default: return terms
    }
  }

  // Filter partners
  const filteredPartners = partners.filter(partner => {
    const matchesSearch = 
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (partner.tax_number && partner.tax_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (partner.city && partner.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (partner.contact_person && partner.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = selectedStatus === 'all' || partner.status === selectedStatus
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Users className="h-8 w-8 mr-3 text-blue-600" />
            Partnerek és üzletek
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Külső partnerek és saját üzletek kezelése
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Navigation Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('partners')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'partners'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Building className="w-4 h-4 mr-2" />
              Külső partnerek
            </button>
            <button
              onClick={() => setActiveTab('stores')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'stores'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Store className="w-4 h-4 mr-2" />
              Saját üzletek
            </button>
          </div>
          
          {activeTab === 'partners' && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Új partner
            </button>
          )}
          
          <button
            onClick={loadPartners}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Frissítés
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Keresés
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Név, adószám, város vagy kapcsolattartó..."
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
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Összes állapot</option>
              <option value="active">Aktív</option>
              <option value="inactive">Inaktív</option>
              <option value="suspended">Felfüggesztve</option>
            </select>
          </div>
        </div>
      </div>

      {/* Partners List */}
      {activeTab === 'partners' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Partner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kapcsolat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cím
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kedvezmény
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
                {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-4">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {partner.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {partner.tax_number || 'Nincs adószám'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {partner.contact_person || 'Nincs megadva'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {partner.email || 'Nincs email'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <Phone className="h-3 w-3 mr-1" />
                        {partner.phone || 'Nincs telefon'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {partner.city || 'Nincs város'}{partner.address ? `, ${partner.address}` : ''}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {partner.postal_code || ''} {partner.country || 'Hungary'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {partner.discount_percentage}%
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {getPaymentTermsText(partner.payment_terms || 'immediate')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(partner.status)}`}>
                        {getStatusText(partner.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => handleAddLocation(partner)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="Telephely hozzáadása"
                        >
                          <MapPin className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleAddDeliveryAddress(partner)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Szállítási cím hozzáadása"
                        >
                          <Truck className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => editPartner(partner)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => deletePartner(partner.id)}
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

          {filteredPartners.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincsenek partnerek</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Kezdje el új partner hozzáadásával.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => {
                    resetForm()
                    setEditingPartner(null)
                    setShowAddModal(true)
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Új partner
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Own Stores List */}
      {activeTab === 'stores' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : ownStores.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Nincsenek saját üzletek
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Adjon hozzá üzleteket a Helyszínek menüpontban.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Üzlet
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cím
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Kapcsolat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      POS Terminál
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
                  {ownStores.map((store) => (
                    <tr key={store.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mr-3">
                            <Store className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {store.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Saját üzlet
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {store.address}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {store.city}, {store.postal_code}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {store.phone}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {store.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          store.has_pos_terminal
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                        }`}>
                          {store.has_pos_terminal ? 'Van' : 'Nincs'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          store.status === 'active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {store.status === 'active' ? 'Aktív' : 'Inaktív'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => {
                              // Navigate to orders for this store
                              window.location.href = `/orders?store=${store.id}`
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Rendelések megtekintése"
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => {
                              // Navigate to store inventory
                              window.location.href = `/inventory?location=${store.id}`
                            }}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="Készlet megtekintése"
                          >
                            <TrendingUp className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Partner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingPartner ? 'Partner szerkesztése' : 'Új partner'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bal oldal - Alapadatok */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Alapadatok</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cégnév *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Adószám
                    </label>
                    <input
                      type="text"
                      value={formData.tax_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, tax_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kapcsolattartó neve
                    </label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Állapot
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Partner['status'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="active">Aktív</option>
                      <option value="inactive">Inaktív</option>
                      <option value="suspended">Felfüggesztve</option>
                    </select>
                  </div>
                </div>
                
                {/* Jobb oldal - Cím és pénzügyi adatok */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Cím és pénzügyi adatok</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cím
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Város
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Irányítószám
                      </label>
                      <input
                        type="text"
                        value={formData.postal_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ország
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kedvezmény (%)
                    </label>
                    <input
                      type="number"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData(prev => ({ ...prev, discount_percentage: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fizetési feltételek
                    </label>
                    <select
                      value={formData.payment_terms}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="immediate">Azonnali</option>
                      <option value="net15">Net 15 nap</option>
                      <option value="net30">Net 30 nap</option>
                      <option value="net60">Net 60 nap</option>
                    </select>
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
                  disabled={loading || !formData.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : editingPartner ? 'Frissítés' : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showLocationModal && selectedPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Helyszín hozzáadása: {selectedPartner.name}
                </h2>
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Helyszín név *
                  </label>
                  <input
                    type="text"
                    value={locationFormData.name}
                    onChange={(e) => setLocationFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cím *
                  </label>
                  <input
                    type="text"
                    value={locationFormData.address}
                    onChange={(e) => setLocationFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Város *
                  </label>
                  <input
                    type="text"
                    value={locationFormData.city}
                    onChange={(e) => setLocationFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Irányítószám
                  </label>
                  <input
                    type="text"
                    value={locationFormData.postal_code}
                    onChange={(e) => setLocationFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ország
                  </label>
                  <input
                    type="text"
                    value={locationFormData.country}
                    onChange={(e) => setLocationFormData(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleSubmitLocation}
                  disabled={loading || !locationFormData.name || !locationFormData.address || !locationFormData.city}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : 'Helyszín hozzáadása'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Delivery Address Modal */}
      {showDeliveryModal && selectedPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Szállítási cím hozzáadása: {selectedPartner.name}
                </h2>
                <button
                  onClick={() => setShowDeliveryModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Szállítási cím *
                  </label>
                  <input
                    type="text"
                    value={deliveryFormData.delivery_address}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kapcsolattartó
                  </label>
                  <input
                    type="text"
                    value={deliveryFormData.delivery_contact}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, delivery_contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={deliveryFormData.delivery_phone}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, delivery_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={deliveryFormData.delivery_email}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, delivery_email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Megjegyzések
                  </label>
                  <textarea
                    value={deliveryFormData.delivery_notes}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, delivery_notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={deliveryFormData.is_default}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Alapértelmezett szállítási cím
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDeliveryModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleSubmitDeliveryAddress}
                  disabled={loading || !deliveryFormData.delivery_address}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : 'Szállítási cím hozzáadása'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}