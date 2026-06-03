import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  User, 
  Mail, 
  Shield, 
  Save, 
  X, 
  ArrowLeft,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

interface PartnerUser {
  id: string
  user_id: string
  partner_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  is_admin: boolean
  created_at: string
  user_details: {
    full_name: string
    email: string
    avatar_url?: string
  }
}

export default function PartnerTeam() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<PartnerUser[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<PartnerUser | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    role: 'member' as PartnerUser['role'],
    is_admin: false
  })

  useEffect(() => {
    if (user) {
      checkPartnerAssociation()
    }
  }, [user])

  useEffect(() => {
    if (partnerId && isAdmin) {
      loadTeamMembers()
    }
  }, [partnerId, isAdmin])

  const checkPartnerAssociation = async () => {
    try {
      // Check if user is associated with a partner company
      const { data, error } = await supabase
        .from('partner_users')
        .select('partner_id, is_admin')
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
        setIsAdmin(data.is_admin)
        
        if (!data.is_admin) {
          toast.error('Nincs jogosultsága a csapattagok kezeléséhez')
          navigate('/partner')
        }
      }
    } catch (error) {
      console.error('Hiba a partner ellenőrzésekor:', error)
      toast.error('Hiba a partner ellenőrzésekor')
    }
  }

  const loadTeamMembers = async () => {
    try {
      setLoading(true)
      
      // Load team members
      const { data, error } = await supabase
        .from('partner_users')
        .select(`
          *,
          user_details:profiles!partner_users_user_id_fkey(full_name, email, avatar_url)
        `)
        .eq('partner_id', partnerId)
        .order('created_at')
      
      if (error) throw error
      
      if (data) {
        setTeamMembers(data as PartnerUser[])
      }
    } catch (error) {
      console.error('Hiba a csapattagok betöltésekor:', error)
      toast.error('Hiba a csapattagok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      
      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from('partner_users')
          .update({
            role: formData.role,
            is_admin: formData.is_admin
          })
          .eq('id', editingUser.id)
        
        if (error) throw error
        
        toast.success('Csapattag sikeresen frissítve!')
        loadTeamMembers()
      } else {
        // Check if user exists
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.email)
          .single()
        
        if (userError) {
          if (userError.code === 'PGRST116') {
            toast.error('Nem található felhasználó ezzel az email címmel')
          } else {
            throw userError
          }
          return
        }
        
        // Check if user is already a team member
        const { data: existingUser, error: existingError } = await supabase
          .from('partner_users')
          .select('id')
          .eq('user_id', userData.id)
          .eq('partner_id', partnerId)
          .maybeSingle()
        
        if (existingUser) {
          toast.error('Ez a felhasználó már csapattag')
          return
        }
        
        // Add new team member
        const { error } = await supabase
          .from('partner_users')
          .insert({
            user_id: userData.id,
            partner_id: partnerId,
            role: formData.role,
            is_admin: formData.is_admin
          })
        
        if (error) throw error
        
        toast.success('Csapattag sikeresen hozzáadva!')
        loadTeamMembers()
      }
      
      setShowAddModal(false)
      setEditingUser(null)
      resetForm()
    } catch (error) {
      console.error('Hiba a csapattag mentésekor:', error)
      toast.error('Hiba a csapattag mentésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan el szeretné távolítani ezt a csapattagot?')) return
    
    try {
      const { error } = await supabase
        .from('partner_users')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Csapattag sikeresen eltávolítva!')
      loadTeamMembers()
    } catch (error) {
      console.error('Hiba a csapattag törlésekor:', error)
      toast.error('Hiba a csapattag törlésekor')
    }
  }

  const editUser = (user: PartnerUser) => {
    setEditingUser(user)
    setFormData({
      email: user.user_details.email,
      role: user.role,
      is_admin: user.is_admin
    })
    setShowAddModal(true)
  }

  const resetForm = () => {
    setFormData({
      email: '',
      role: 'member',
      is_admin: false
    })
  }

  const getRoleText = (role: string) => {
    switch (role) {
      case 'owner': return 'Tulajdonos'
      case 'admin': return 'Adminisztrátor'
      case 'member': return 'Tag'
      case 'viewer': return 'Megfigyelő'
      default: return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'member': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const filteredTeamMembers = teamMembers.filter(member => 
    member.user_details.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.user_details.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading && !showAddModal) {
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
        <div className="flex items-center">
          <Link to="/partner" className="mr-4">
            <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Users className="h-8 w-8 mr-3 text-blue-600" />
              Csapattagok
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Kezelje a partner cég felhasználóit és jogosultságaikat
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadTeamMembers}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Frissítés
          </button>
          <button
            onClick={() => {
              resetForm()
              setEditingUser(null)
              setShowAddModal(true)
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új csapattag
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Keresés név vagy email alapján..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Felhasználó
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Szerepkör
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Csatlakozott
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTeamMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
                        {member.user_details.avatar_url ? (
                          <img 
                            src={member.user_details.avatar_url} 
                            alt={member.user_details.full_name} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-600">
                            <span className="text-white font-medium">
                              {member.user_details.full_name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.user_details.full_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {member.user_details.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                      {getRoleText(member.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      member.is_admin 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                    }`}>
                      {member.is_admin ? 'Igen' : 'Nem'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(member.created_at).toLocaleDateString('hu-HU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => editUser(member)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
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

        {filteredTeamMembers.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nincsenek csapattagok</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kezdje el új csapattag hozzáadásával.
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  resetForm()
                  setEditingUser(null)
                  setShowAddModal(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Új csapattag
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingUser ? 'Csapattag szerkesztése' : 'Új csapattag hozzáadása'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingUser(null)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email cím *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={!!editingUser}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      editingUser ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-700'
                    } text-gray-900 dark:text-white`}
                    required
                  />
                  {!editingUser && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      A felhasználónak már regisztrálva kell lennie a rendszerben.
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Szerepkör *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as PartnerUser['role'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="owner">Tulajdonos</option>
                    <option value="admin">Adminisztrátor</option>
                    <option value="member">Tag</option>
                    <option value="viewer">Megfigyelő</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_admin"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_admin: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="is_admin" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Admin jogosultság (csapattagok kezelése)
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingUser(null)
                    resetForm()
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || (!editingUser && !formData.email)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : editingUser ? 'Frissítés' : 'Hozzáadás'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}