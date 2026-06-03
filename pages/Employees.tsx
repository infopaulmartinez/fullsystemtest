import React, { useState, useEffect } from 'react'
import { Users, Mail, Phone, MapPin, Star, Calendar, Badge } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { toast } from 'react-hot-toast'

interface Employee {
  id: string
  full_name: string
  email: string
  phone?: string
  department?: string
  position?: string
  hire_date?: string
  performance_rating?: number
  status?: string
  address?: string
  manager_id?: string
}

export default function Employees() {
  const { theme } = useTheme()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      // FIX: removed hourly_wage (does not exist), use profiles:id() join
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          department,
          position,
          hire_date,
          performance_rating,
          manager_id,
          profiles:id (
            id,
            full_name,
            email,
            phone,
            status,
            address
          )
        `)
        .order('id')

      if (error) throw error

      const formatted = (data || []).map(emp => {
        const profile = Array.isArray(emp.profiles) ? emp.profiles[0] : emp.profiles
        return {
          id: emp.id,
          full_name: profile?.full_name || 'Ismeretlen',
          email: profile?.email || '',
          phone: profile?.phone,
          department: emp.department,
          position: emp.position,
          hire_date: emp.hire_date,
          performance_rating: emp.performance_rating,
          status: profile?.status,
          address: profile?.address,
          manager_id: emp.manager_id
        }
      })

      setEmployees(formatted)
    } catch (error) {
      console.error('Error loading employees:', error)
      toast.error('Hiba az alkalmazottak betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'inactive': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
      case 'on_leave': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    }
  }

  const getStatusText = (status?: string) => {
    const statusMap: Record<string, string> = { active: 'Aktív', inactive: 'Inaktív', on_leave: 'Szabadságon' }
    return statusMap[status || ''] || status || 'Aktív'
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Users className="h-8 w-8 mr-3 text-blue-600" />
            Alkalmazottak
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{employees.length} alkalmazott</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map(employee => (
          <div
            key={employee.id}
            className={`rounded-2xl p-6 shadow-sm border transition-all duration-200 cursor-pointer hover:shadow-md ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
            onClick={() => { setSelectedEmployee(employee); setShowModal(true) }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{employee.full_name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{employee.position || 'Pozíció nincs megadva'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(employee.status)}`}>
                {getStatusText(employee.status)}
              </span>
            </div>

            <div className="space-y-2 mb-4 text-sm">
              {employee.email && (
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Mail className="h-4 w-4 mr-2" />{employee.email}
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Phone className="h-4 w-4 mr-2" />{employee.phone}
                </div>
              )}
              {employee.department && (
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Badge className="h-4 w-4 mr-2" />{employee.department}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {employee.hire_date && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Felvétel</p>
                  <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(employee.hire_date).toLocaleDateString('hu-HU')}
                  </p>
                </div>
              )}
              {employee.performance_rating && (
                <div className="col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <Star className="h-3 w-3" /> Teljesítmény
                    </p>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < Math.round(employee.performance_rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
              Részletek megtekintése
            </button>
          </div>
        ))}
      </div>

      {employees.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Nincsenek alkalmazottak</p>
        </div>
      )}
    </div>
  )
}