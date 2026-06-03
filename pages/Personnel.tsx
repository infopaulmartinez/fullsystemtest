import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  DollarSign,
  Shield,
  Save,
  Eye,
  EyeOff,
  X,
  User,
  FileText,
  Upload,
  Clock,
  Filter,
  Menu,
  ChefHat,
  ShoppingCart,
  ShoppingBag,
  Truck,
  Package,
  BarChart3,
  Bot,
  Thermometer,
  Cloud
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { sendContractSigningEmail } from '../lib/emailService'
import { useAuth } from '../contexts/AuthContext'
import ContractUploadModal from '../components/Personnel/ContractUploadModal'
import MenuPermissionsModal from '../components/Personnel/MenuPermissionsModal'
import RequestDataModal from '../components/Personnel/RequestDataModal'
import ContractSigningModal from '../components/Personnel/ContractSigningModal'
import EmployeeWorkLocationsModal from '../components/Personnel/EmployeeWorkLocationsModal'

interface Employee {
  id: string
  full_name: string
  email: string
  phone: string | null
  address: string | null
  role: 'admin' | 'baker' | 'salesperson' | 'driver' | 'partner'
  hourly_wage: number | null
  hire_date: string | null
  status: 'active' | 'inactive'
  emergency_contact: string | null
  emergency_phone: string | null
  tax_number?: string | null
  social_security_number?: string | null
  mother_name?: string | null
  bank_account?: string | null
  permissions?: string[]
}

export default function Personnel() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showRequestDataModal, setShowRequestDataModal] = useState(false)
  const [showContractSigningModal, setShowContractSigningModal] = useState(false)
  const [showMenuPermissionsModal, setShowMenuPermissionsModal] = useState(false)
  const [showWorkLogModal, setShowWorkLogModal] = useState(false)
  const [showWorkLocationsModal, setShowWorkLocationsModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [menuPermissions, setMenuPermissions] = useState<string[]>([])
  const [formData, setFormData] = useState({
    id: '',
    full_name: '',
    email: '',
    phone: '',
    address: '',
    role: 'baker' as Employee['role'],
    hourly_wage: 0,
    hire_date: '',
    status: 'active' as Employee['status'],
    emergency_contact: '',
    emergency_phone: '',
    permissions: [] as string[],
    tax_number: '',
    social_security_number: '',
    mother_name: '',
    bank_account: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const [menuItems, setMenuItems] = useState<{path: string, label: string}[]>([])
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

  // Work log editing form data
  const [workLogFormData, setWorkLogFormData] = useState({
    employee_id: '',
    start_time: '',
    end_time: '',
    status: 'completed' as 'active' | 'completed' | 'cancelled',
    notes: ''
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  useEffect(() => {
    // Load menu items for permissions
    const items = [
      { path: 'production', label: 'Termelés' },
      { path: 'orders', label: 'Rendelések' },
      { path: 'pos', label: 'POS' },
      { path: 'personnel', label: 'Személyzet' },
      { path: 'partners', label: 'Partnerek' },
      { path: 'fleet', label: 'Flotta' },
      { path: 'recipes', label: 'Receptek' },
      { path: 'inventory', label: 'Készlet' },
      { path: 'locations', label: 'Helyszínek' },
      { path: 'schedules', label: 'Beosztások' },
      { path: 'reports', label: 'Jelentések' },
      { path: 'documents', label: 'Dokumentumok' },
      { path: 'ai-assistant', label: 'AI Asszisztens' },
      { path: 'sensors', label: 'Szenzorok' },
      { path: 'weather', label: 'Időjárás' },
      { path: 'ai-schedule', label: 'AI Beosztás' },
      { path: 'route-optimization', label: 'Útvonal Optimalizálás' },
      { path: 'hotel-occupancy', label: 'Szállásfoglalás' },
      { path: 'security', label: 'Biztonság' },
      { path: 'system-visualization', label: 'Rendszer Vizualizáció' },
      { path: 'chat', label: 'Chat' },
      { path: 'delivery-notes', label: 'Szállítólevelek' },
      { path: 'remote-control', label: 'Távoli irányítás' },
      { path: 'invoices', label: 'Számlák' },
      { path: 'payments', label: 'Fizetések' },
      { path: 'settings', label: 'Beállítások' }
    ]
    setMenuItems(items)
  }, [])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      
      // Load all employees
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
      
      if (error) {
        console.error('Error loading employees:', error)
        toast.error('Hiba az alkalmazottak betöltésekor')
        return
      }
      
      if (data) {
        setEmployees(data)
      }
    } catch (error) {
      console.error('Hiba az alkalmazottak betöltésekor:', error)
      toast.error('Hiba az alkalmazottak betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)

      if (editingEmployee) {
        // Prepare update data
        const updateData = {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          role: formData.role,
          hourly_wage: formData.hourly_wage,
          hire_date: formData.hire_date,
          status: formData.status,
          emergency_contact: formData.emergency_contact,
          emergency_phone: formData.emergency_phone,
          tax_number: formData.tax_number,
          social_security_number: formData.social_security_number,
          mother_name: formData.mother_name,
          bank_account: formData.bank_account
        }
        
        // Update in database
        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', editingEmployee.id)
        
        if (error) {
          console.error('Database error:', error)
          toast.error('Hiba az alkalmazott frissítésekor')
          return
        }
        
        // Update local state
        setEmployees(prev => prev.map(emp => emp.id === editingEmployee.id ? {...emp, ...updateData} : emp))
        toast.success('Alkalmazott sikeresen frissítve!')
      } else {
        // Create new employee
        const newEmployee: Partial<Employee> = {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          role: formData.role,
          hourly_wage: formData.hourly_wage,
          hire_date: formData.hire_date,
          status: formData.status,
          emergency_contact: formData.emergency_contact,
          emergency_phone: formData.emergency_phone,
          tax_number: formData.tax_number,
          social_security_number: formData.social_security_number,
          mother_name: formData.mother_name,
          bank_account: formData.bank_account
        }
        
        try {
          // Új felhasználó létrehozása Supabase Auth-ban
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: formData.email,
            password: Math.random().toString(36).slice(-8), // Ideiglenes jelszó
            options: {
              data: { 
                full_name: formData.full_name,
                role: formData.role
              }
            },
            email_confirm: true
          })
          
          if (authError) throw authError
          
          if (authData.user) {
            // Profil létrehozása az adatbázisban
            const { error } = await supabase
              .from('profiles')
              .insert({
                id: authData.user.id,
                ...newEmployee
              })
            
            if (error) {
              console.error('Database error:', error)
              toast.error('Hiba az alkalmazott létrehozásakor')
              return
            }
            
            // Új alkalmazott hozzáadása a listához
            const createdEmployee = {
              id: authData.user.id,
              ...newEmployee as Employee
            }
            setEmployees(prev => [...prev, createdEmployee as Employee])
            
            // Meghívó email küldése
            toast.success('Alkalmazott sikeresen létrehozva! Meghívó email elküldve.')
          }
        } catch (authError) {
          console.error('Auth error:', authError)
          toast.error('Hiba a felhasználó létrehozásakor')
          return
        }
      }
      
      setShowAddModal(false)
      setEditingEmployee(null)
      resetForm()
    } catch (error) {
      console.error('Hiba az alkalmazott mentésekor:', error)
      toast.error('Hiba történt az alkalmazott mentésekor!')
    } finally {
      setLoading(false)
    }
  }

  const handlePermissions = (employee: Employee) => {
    setSelectedEmployee(employee);
    setMenuPermissions(employee.permissions || []);
    setShowPermissionsModal(true);
  }

  const handleEditPermissions = (employee: any) => {
    setSelectedEmployee(employee)
    setSelectedPermissions(employee.permissions || [])
    setShowPermissionsModal(true)
  }

  const savePermissions = async () => {
    if (!selectedEmployee) return;
    
    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('profiles')
        .update({ permissions: selectedPermissions })
        .eq('id', selectedEmployee.id)
      
      if (error) throw error
      
      toast.success('Jogosultságok sikeresen frissítve!')
      setShowPermissionsModal(false)
      loadEmployees() // Reload to get updated data
    } catch (error) {
      console.error('Error updating permissions:', error)
      toast.error('Hiba a jogosultságok frissítésekor')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      id: '',
      full_name: '',
      email: '',
      phone: '',
      address: '',
      role: 'baker',
      hourly_wage: 0,
      hire_date: '',
      status: 'active',
      emergency_contact: '',
      emergency_phone: '',
      permissions: [],
      tax_number: '',
      social_security_number: '',
      mother_name: '',
      bank_account: ''
    })
  }

  const editEmployee = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormData({
      id: employee.id,
      full_name: employee.full_name,
      permissions: employee.permissions || [],
      email: employee.email,
      phone: employee.phone || '',
      address: employee.address || '',
      role: employee.role,
      hourly_wage: employee.hourly_wage || 0,
      hire_date: employee.hire_date || '',
      status: employee.status,
      emergency_contact: employee.emergency_contact || '',
      emergency_phone: employee.emergency_phone || '',
      tax_number: employee.tax_number || '',
      social_security_number: employee.social_security_number || '',
      mother_name: employee.mother_name || '',
      bank_account: employee.bank_account || ''
    })
    setShowAddModal(true)
  }

  const deleteEmployee = async (id: string) => {
    if (window.confirm('Biztosan törölni szeretné ezt az alkalmazottat?')) {
      try {
        // Delete from database
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Database error:', error)
          toast.error('Hiba az alkalmazott törlésekor')
          return
        }
        
        // Update local state
        setEmployees(prev => prev.filter(emp => emp.id !== id))
        toast.success('Alkalmazott sikeresen törölve!')
      } catch (error) {
        console.error('Hiba az alkalmazott törlésekor:', error)
        toast.error('Hiba történt az alkalmazott törlésekor!')
      }
    }
  }

  const requestMissingData = async (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowRequestDataModal(true)
  }

  const openContractModal = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowContractModal(true)
  }

  const openContractSigningModal = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowContractSigningModal(true)
  }

  const editWorkLog = (employeeId: string) => {
    setWorkLogFormData({
      employee_id: employeeId,
      start_time: new Date().toISOString().slice(0, 16),
      end_time: new Date().toISOString().slice(0, 16),
      status: 'completed',
      notes: ''
    })
    setShowWorkLogModal(true)
  }

  const openWorkLocationsModal = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowWorkLocationsModal(true)
  }

  const handleWorkLogSubmit = async () => {
    try {
      setLoading(true)
      
      // JAVÍTÁS: user_id (nem employee_id), nincs duration mező
      const workLogData = {
        user_id: workLogFormData.employee_id,
        start_time: workLogFormData.start_time,
        end_time: workLogFormData.end_time,
        status: workLogFormData.status === 'completed' ? 'completed' : 'running'
      }
      
      const { error } = await supabase
        .from('work_logs')
        .insert(workLogData)
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a munkaidő rögzítésekor')
        return
      }
      
      toast.success('Munkaidő sikeresen rögzítve!')
      setShowWorkLogModal(false)
    } catch (error) {
      console.error('Hiba a munkaidő rögzítésekor:', error)
      toast.error('Hiba történt a munkaidő rögzítésekor!')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    toast.success('Importálás funkció fejlesztés alatt')
  }

  const handleExport = () => {
    toast.success('Exportálás funkció fejlesztés alatt')
  }

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Adminisztrátor'
      case 'baker': return 'Pék'
      case 'salesperson': return 'Eladó'
      case 'driver': return 'Sofőr'
      case 'partner': return 'Partner'
      default: return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'baker': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
      case 'salesperson': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'driver': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'partner': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const hasMissingData = (employee: Employee) => {
    return !employee.tax_number || !employee.social_security_number || !employee.mother_name
  }

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'all' || employee.role === selectedRole
    return matchesSearch && matchesRole
  })

  if (loading && !showAddModal && !showContractModal && !showRequestDataModal && !showContractSigningModal && !showWorkLogModal) {
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
            <Users className="h-8 w-8 mr-3 text-blue-600" />
            Személyzet
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Alkalmazottak kezelése és munkaviszony információk
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              resetForm()
              setEditingEmployee(null)
              setShowAddModal(true)
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új alkalmazott
          </button>
          <button
            onClick={handleImport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FileText className="h-5 w-5 mr-2" />
            Importálás
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FileText className="h-5 w-5 mr-2" />
            Exportálás
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes dolgozó</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Aktív</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {employees.filter(e => e.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Átlag órabér</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {employees.length > 0 ? 
                  Math.round(
                    employees.reduce((sum, e) => sum + (e.hourly_wage || 0), 0) / 
                    employees.filter(e => e.hourly_wage !== null && e.hourly_wage !== undefined).length
                  ) + ' Ft' : 
                  '0 Ft'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-3">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Új dolgozók</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {employees.filter(e => e.hire_date && new Date(e.hire_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
              </p>
            </div>
          </div>
        </div>
      </div>

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
                placeholder="Név vagy email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Szerepkör
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Összes szerepkör</option>
              <option value="admin">Adminisztrátor</option>
              <option value="baker">Pék</option>
              <option value="salesperson">Eladó</option>
              <option value="driver">Sofőr</option>
              <option value="partner">Partner</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Alkalmazott
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Szerepkör
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Kapcsolat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Órabér
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
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-4">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {employee.full_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('hu-HU') : 'N/A'}
                        </div>
                        {hasMissingData(employee) && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Hiányos adatok
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(employee.role)}`}>
                      {getRoleText(employee.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center mb-1">
                        <Mail className="h-3 w-3 mr-1 text-gray-400" />
                        {employee.email}
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-3 w-3 mr-1 text-gray-400" />
                        {employee.phone || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {employee.hourly_wage ? employee.hourly_wage.toLocaleString('hu-HU') + ' Ft' : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      employee.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {employee.status === 'active' ? 'Aktív' : 'Inaktív'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => openContractModal(employee)}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                        title="Szerződés"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handlePermissions(employee)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Jogosultságok"
                      >
                        <Shield className="h-4 w-4" />
                      </button>
                      {hasMissingData(employee) && (
                        <button 
                          onClick={() => requestMissingData(employee)}
                          className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                          title="Adatok bekérése"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleEditPermissions(employee)}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                        title="Menü jogosultságok"
                      >
                        <Menu className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowMenuPermissionsModal(true);
                        }}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                        title="Menü jogosultságok"
                      >
                        <Menu className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => editWorkLog(employee.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Munkaidő szerkesztése"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => openWorkLocationsModal(employee)}
                        className="text-cyan-600 hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300"
                        title="Munkahelyek kezelése"
                      >
                        <MapPin className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => editEmployee(employee)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Szerkesztés"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => deleteEmployee(employee.id)}
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

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincsenek alkalmazottak</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kezdje el új alkalmazott hozzáadásával.
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingEmployee ? 'Alkalmazott szerkesztése' : 'Új alkalmazott'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Személyes adatok */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Személyes adatok</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Teljes név *
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Telefon *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Anyja neve
                    </label>
                    <input
                      type="text"
                      value={formData.mother_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, mother_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Adóazonosító jel
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
                      TAJ szám
                    </label>
                    <input
                      type="text"
                      value={formData.social_security_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, social_security_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bankszámlaszám
                    </label>
                    <input
                      type="text"
                      value={formData.bank_account}
                      onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Munkaviszony adatok */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Munkaviszony adatok</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Szerepkör *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as Employee['role'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="admin">Adminisztrátor</option>
                      <option value="baker">Pék</option>
                      <option value="salesperson">Eladó</option>
                      <option value="driver">Sofőr</option>
                      <option value="partner">Partner</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Órabér (Ft) *
                    </label>
                    <input
                      type="number"
                      value={formData.hourly_wage}
                      onChange={(e) => setFormData(prev => ({ ...prev, hourly_wage: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Felvétel dátuma *
                    </label>
                    <input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Állapot
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Employee['status'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="active">Aktív</option>
                      <option value="inactive">Inaktív</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Vészhelyzeti kapcsolattartó
                    </label>
                    <input
                      type="text"
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Vészhelyzeti telefon
                    </label>
                    <input
                      type="tel"
                      value={formData.emergency_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, emergency_phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-400">
                      <User className="h-5 w-5" />
                      <span className="text-sm">
                        Az alkalmazott fiókja automatikusan létrejön a megadott email címmel.
                      </span>
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
                  disabled={loading || !formData.full_name || !formData.email || !formData.phone || !formData.hire_date}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : editingEmployee ? 'Frissítés' : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contract Upload Modal */}
      {showContractModal && selectedEmployee && (
        <ContractUploadModal
          employee={selectedEmployee}
          onClose={() => {
            setShowContractModal(false)
            setSelectedEmployee(null)
          }}
          onUploaded={() => {
            // Simulate contract signing by opening the signing modal
            setTimeout(() => {
              openContractSigningModal(selectedEmployee)
            }, 1000)
          }}
        />
      )}

      {/* Request Data Modal */}
      {showRequestDataModal && selectedEmployee && (
        <RequestDataModal
          employee={selectedEmployee}
          onClose={() => {
            setShowRequestDataModal(false)
            setSelectedEmployee(null)
          }}
          onSent={() => {
            // Refresh employee data
            loadEmployees()
          }}
        />
      )}

      {/* Contract Signing Modal */}
      {showContractSigningModal && selectedEmployee && (
        <ContractSigningModal
          contractId="1" // In a real app, this would be the actual contract ID
          employeeName={selectedEmployee.full_name}
          onClose={() => {
            setShowContractSigningModal(false)
            setSelectedEmployee(null)
          }}
          onSigned={() => {
            // Refresh employee data
            loadEmployees()
          }}
        />
      )}

      {/* Work Log Modal */}
      {showWorkLogModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Munkaidő rögzítése
                </h2>
                <button
                  onClick={() => setShowWorkLogModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kezdés időpontja *
                  </label>
                  <input
                    type="datetime-local"
                    value={workLogFormData.start_time}
                    onChange={(e) => setWorkLogFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Befejezés időpontja *
                  </label>
                  <input
                    type="datetime-local"
                    value={workLogFormData.end_time}
                    onChange={(e) => setWorkLogFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Állapot
                  </label>
                  <select
                    value={workLogFormData.status}
                    onChange={(e) => setWorkLogFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="completed">Befejezett</option>
                    <option value="active">Aktív</option>
                    <option value="cancelled">Megszakítva</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Megjegyzések
                  </label>
                  <textarea
                    value={workLogFormData.notes}
                    onChange={(e) => setWorkLogFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowWorkLogModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleWorkLogSubmit}
                  disabled={loading || !workLogFormData.start_time || !workLogFormData.end_time}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Permissions Modal */}
      {showPermissionsModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Menü jogosultságok: {selectedEmployee.full_name}
                </h2>
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Alapértelmezett szerepkör: <span className="font-medium">{selectedEmployee.role}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Válassza ki azokat a menüpontokat, amelyekhez a felhasználónak hozzáférést szeretne adni az alapértelmezett szerepkörén túl.
                </p>
              </div>

              <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {menuItems.map((item) => (
                    <label key={item.path} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(item.path)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions(prev => [...prev, item.path])
                          } else {
                            setSelectedPermissions(prev => prev.filter(p => p !== item.path))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={savePermissions}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Menu Permissions Modal */}
      {showMenuPermissionsModal && selectedEmployee && (
        <MenuPermissionsModal
          employee={selectedEmployee}
          onClose={() => setShowMenuPermissionsModal(false)}
          onSaved={() => {
            setShowMenuPermissionsModal(false);
            loadEmployees();
          }}
        />
      )}

      {/* Employee Work Locations Modal */}
      {showWorkLocationsModal && selectedEmployee && (
        <EmployeeWorkLocationsModal
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.full_name}
          isOpen={showWorkLocationsModal}
          onClose={() => {
            setShowWorkLocationsModal(false)
            setSelectedEmployee(null)
          }}
        />
      )}
    </div>
  )
}