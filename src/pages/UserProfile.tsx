import React, { useState, useEffect, useRef } from 'react'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Save, 
  Upload, 
  Camera, 
  X, 
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  Lock,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'

export default function UserProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    hire_date: '',
    hourly_wage: '',
    bank_account: '',
    tax_number: '',
    social_security_number: '',
    mother_name: ''
  })
  const [workLogs, setWorkLogs] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('profile')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      loadProfile()
      loadWorkLogs()
      loadDocuments()
    }
  }, [user])

  const loadProfile = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()
      
      if (error) {
        console.error('Error loading profile:', error)
        return
      }
      
      if (data) {
        setProfile(data)
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          emergency_contact: data.emergency_contact || '',
          emergency_phone: data.emergency_phone || '',
          hire_date: data.hire_date || '',
          hourly_wage: data.hourly_wage ? data.hourly_wage.toString() : '',
          bank_account: data.bank_account || '',
          tax_number: data.tax_number || '',
          social_security_number: data.social_security_number || '',
          mother_name: data.mother_name || ''
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      toast.error('Hiba a profil betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadWorkLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .eq('employee_id', user?.id)
        .order('start_time', { ascending: false })
        .limit(10)
      
      if (error) {
        console.error('Error loading work logs:', error)
        return
      }
      
      setWorkLogs(data || [])
    } catch (error) {
      console.error('Error loading work logs:', error)
    }
  }

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('uploaded_by', user?.id)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading documents:', error)
        return
      }
      
      setDocuments(data || [])
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address,
          emergency_contact: formData.emergency_contact,
          emergency_phone: formData.emergency_phone,
          bank_account: formData.bank_account,
          tax_number: formData.tax_number,
          social_security_number: formData.social_security_number,
          mother_name: formData.mother_name
        })
        .eq('id', user?.id)
      
      if (error) {
        throw error
      }
      
      toast.success('Profil sikeresen frissítve!')
      loadProfile()
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Hiba a profil frissítésekor')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        toast.error("Nem választott ki fájlt");
        return
      }
      
      const file = e.target.files[0]
      
      // Ellenőrizzük a fájl méretét (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A fájl túl nagy (maximum 5MB)");
        return;
      }
      
      // Ellenőrizzük a fájl típusát
      if (!file.type.startsWith('image/')) {
        toast.error("Csak képfájlok tölthetők fel");
        return;
      }
      
      const fileExt = file.name.split('.').pop()
      const filePath = `${user?.id}/${user?.id}.${fileExt}`
      
      setUploadingAvatar(true)
      toast.loading("Profilkép feltöltése...");
      
      try {
        // Upload file to the avatars bucket with proper folder structure
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });
        
        if (uploadError) {
          throw uploadError;
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        if (error.message?.includes('row-level security policy') || error.message?.includes('Unauthorized') || error.message?.includes('403')) {
          toast.error('Hiba a profilkép feltöltésekor. Kérjük, próbálja újra vagy vegye fel a kapcsolatot az adminisztrátorral.');
        } else {
          toast.error('Hiba a fájl feltöltésekor');
        }
        toast.dismiss();
        setUploadingAvatar(false);
        return;
      }
      
      // Get public URL
      const { data: urlData } = await supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
      
      if (!urlData || !urlData.publicUrl) {
        throw new Error('Failed to get public URL')
      }
      
      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user?.id)
      
      if (updateError) {
        throw updateError
      }
      
      toast.success('Profilkép sikeresen frissítve!')
      toast.dismiss();
      loadProfile()
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error('Hiba a profilkép feltöltésekor')
      toast.dismiss();
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.new !== passwordData.confirm) {
      toast.error('Az új jelszavak nem egyeznek')
      return
    }
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new
      })
      
      if (error) {
        throw error
      }
      
      toast.success('Jelszó sikeresen frissítve!')
      setShowPasswordModal(false)
      setPasswordData({
        current: '',
        new: '',
        confirm: ''
      })
    } catch (error) {
      console.error('Error updating password:', error)
      toast.error('Hiba a jelszó frissítésekor')
    }
  }

  const calculateTotalHours = () => {
    return workLogs.reduce((total, log) => {
      if (log.duration) {
        return total + log.duration / 60 // Convert minutes to hours
      } else if (log.start_time && log.end_time) {
        const start = new Date(log.start_time)
        const end = new Date(log.end_time)
        return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      }
      return total
    }, 0)
  }

  const calculateTotalEarnings = () => {
    const hourlyWage = parseFloat(formData.hourly_wage) || 0
    return calculateTotalHours() * hourlyWage
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('hu-HU')
  }

  const formatTime = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getDocumentTypeText = (type: string) => {
    switch (type) {
      case 'contract': return 'Szerződés'
      case 'invoice': return 'Számla'
      case 'permit': return 'Engedély'
      case 'certificate': return 'Tanúsítvány'
      case 'recipe': return 'Recept'
      case 'manual': return 'Munkautasítás'
      default: return type
    }
  }

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'contract': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'invoice': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'permit': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'certificate': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
      case 'recipe': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'manual': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <User className="h-8 w-8 mr-3 text-blue-600" />
            Felhasználói profil
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Személyes adatok és beállítások kezelése
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-6 text-sm font-medium whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2" />
                <span>Profil</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('work')}
              className={`py-4 px-6 text-sm font-medium whitespace-nowrap ${
                activeTab === 'work'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                <span>Munkaidő</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-4 px-6 text-sm font-medium whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                <span>Dokumentumok</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`py-4 px-6 text-sm font-medium whitespace-nowrap ${
                activeTab === 'security'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Lock className="h-4 w-4 mr-2" />
                <span>Biztonság</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Avatar and Basic Info */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                        {profile.avatar_url ? (
                          <img 
                            src={profile.avatar_url + '?t=' + new Date().getTime()} 
                            alt={profile.full_name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="h-16 w-16 text-gray-400" />
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.click()
                          } else {
                            console.error("File input ref is null")
                            toast.error("Nem sikerült megnyitni a fájl tallózót")
                          }
                        }}
                        className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
                      >
                        {uploadingAvatar ? (
                          <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Camera className="h-5 w-5" />
                        )}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                      />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {profile.full_name || 'Névtelen felhasználó'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {profile.role === 'admin' ? 'Adminisztrátor' : 
                       profile.role === 'baker' ? 'Pék' : 
                       profile.role === 'salesperson' ? 'Eladó' : 
                       profile.role === 'driver' ? 'Sofőr' : profile.role}
                    </p>
                    
                    <div className="w-full mt-6 space-y-4">
                      <div className="flex items-center">
                        <Mail className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-gray-600 dark:text-gray-400">{profile.email}</span>
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-gray-600 dark:text-gray-400">{profile.phone || 'Nincs megadva'}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-gray-600 dark:text-gray-400">{profile.address || 'Nincs megadva'}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-gray-600 dark:text-gray-400">
                          Belépés dátuma: {profile.hire_date ? new Date(profile.hire_date).toLocaleDateString('hu-HU') : 'Nincs megadva'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-gray-600 dark:text-gray-400">
                          Órabér: {profile.hourly_wage ? `${profile.hourly_wage.toLocaleString('hu-HU')} Ft/óra` : 'Nincs megadva'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Edit Profile Form */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profil szerkesztése</h3>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Teljes név
                        </label>
                        <input
                          type="text"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email cím
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Telefonszám
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Cím
                        </label>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Vészhelyzeti kapcsolattartó
                        </label>
                        <input
                          type="text"
                          name="emergency_contact"
                          value={formData.emergency_contact}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Vészhelyzeti telefonszám
                        </label>
                        <input
                          type="tel"
                          name="emergency_phone"
                          value={formData.emergency_phone}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Pénzügyi és személyes adatok</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Bankszámlaszám
                          </label>
                          <input
                            type="text"
                            name="bank_account"
                            value={formData.bank_account}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Adóazonosító jel
                          </label>
                          <input
                            type="text"
                            name="tax_number"
                            value={formData.tax_number}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            TAJ szám
                          </label>
                          <input
                            type="text"
                            name="social_security_number"
                            value={formData.social_security_number}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Anyja neve
                          </label>
                          <input
                            type="text"
                            name="mother_name"
                            value={formData.mother_name}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                      >
                        {saving ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Mentés...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Mentés
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          
          {/* Work Tab */}
          {activeTab === 'work' && (
            <div className="space-y-6">
              {/* Work Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes munkaóra</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {calculateTotalHours().toFixed(1)} óra
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes kereset</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {calculateTotalEarnings().toLocaleString('hu-HU')} Ft
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <div className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-3">
                      <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Munkaidő bejegyzések</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {workLogs.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Work Logs */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Munkaidő bejegyzések</h3>
                
                {workLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">Nincsenek munkaidő bejegyzések</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Dátum
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Kezdés
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Befejezés
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Időtartam
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Állapot
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {workLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {formatDate(log.start_time)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {formatTime(log.start_time)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {log.end_time ? formatTime(log.end_time) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {log.duration ? formatDuration(log.duration) : log.end_time ? (
                                (() => {
                                  const start = new Date(log.start_time)
                                  const end = new Date(log.end_time)
                                  const diffMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
                                  return formatDuration(diffMinutes)
                                })()
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                log.status === 'completed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                                  : log.status === 'active'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                              }`}>
                                {log.status === 'completed' ? 'Befejezve' : 
                                 log.status === 'active' ? 'Aktív' : log.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dokumentumok</h3>
                
                {documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">Nincsenek dokumentumok</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
                        <div className="flex items-start">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-3">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">{doc.name}</h4>
                            <div className="flex items-center mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDocumentTypeColor(doc.type)}`}>
                                {getDocumentTypeText(doc.type)}
                              </span>
                              <span className="mx-2 text-gray-400">•</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(doc.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm">
                            Letöltés
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Biztonság</h3>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Jelszó</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Utolsó módosítás: {profile.updated_at ? formatDate(profile.updated_at) : 'Ismeretlen'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Módosítás
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Kétfaktoros hitelesítés</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Nincs bekapcsolva
                      </p>
                    </div>
                    <button
                      onClick={() => toast.info('Ez a funkció jelenleg fejlesztés alatt áll')}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Bekapcsolás
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Bejelentkezési előzmények</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Utolsó bejelentkezés: {profile.last_active ? formatDate(profile.last_active) + ' ' + formatTime(profile.last_active) : 'Ismeretlen'}
                      </p>
                    </div>
                    <button
                      onClick={() => toast.info('Ez a funkció jelenleg fejlesztés alatt áll')}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Részletek
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Jelszó módosítása
                </h2>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Jelenlegi jelszó
                  </label>
                  <input
                    type="password"
                    value={passwordData.current}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, current: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Új jelszó
                  </label>
                  <input
                    type="password"
                    value={passwordData.new}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Új jelszó megerősítése
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirm}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Mégse
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Mentés
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}