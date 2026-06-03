import React, { useState, useEffect } from 'react'
import { Clock, LogIn, LogOut, Calendar, User, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { toast } from 'react-hot-toast'

interface WorkLog {
  id: string
  employee_id: string
  employee_name?: string
  start_time: string
  end_time?: string
  duration?: number
  status: string
  notes?: string
  created_at: string
}

interface Employee {
  id: string
  full_name: string
  department?: string
}

export default function WorkLogs() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [clockedInEmployees, setClockedInEmployees] = useState<Map<string, WorkLog>>(new Map())

  useEffect(() => {
    loadEmployees()
    loadWorkLogs()
    loadClockedIn()
  }, [])

  const loadEmployees = async () => {
    try {
      // FIX: avoid ambiguous 'profiles' relationship - query profiles separately
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, department, profile_id')
        .order('id')

      if (empError) {
        // Fallback: try without profile_id
        const { data: empData2, error: empError2 } = await supabase
          .from('employees')
          .select('id, department')
          .order('id')
        if (empError2) throw empError2

        // Load profiles by id match
        const ids = (empData2 || []).map(e => e.id)
        if (ids.length === 0) { setEmployees([]); return }
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids)

        const profMap = new Map((profData || []).map(p => [p.id, p.full_name]))
        const formatted = (empData2 || []).map(emp => ({
          id: emp.id,
          full_name: profMap.get(emp.id) || 'Ismeretlen',
          department: emp.department
        }))
        setEmployees(formatted)
        return
      }

      // Load profiles
      const profileIds = (empData || []).map(e => e.profile_id || e.id).filter(Boolean)
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds)

      const profMap = new Map((profData || []).map(p => [p.id, p.full_name]))
      const formatted = (empData || []).map(emp => ({
        id: emp.id,
        full_name: profMap.get(emp.profile_id || emp.id) || 'Ismeretlen',
        department: emp.department
      }))
      setEmployees(formatted)
    } catch (error) {
      console.error('Error loading employees:', error)
      toast.error('Hiba az alkalmazottak betöltésekor')
    }
  }

  const loadWorkLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(50)

      if (error) throw error
      setWorkLogs(data || [])
    } catch (error) {
      console.error('Error loading work logs:', error)
      toast.error('Hiba a munkaidő naplók betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadClockedIn = async () => {
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .is('end_time', null)
        .order('start_time', { ascending: false })

      if (error) throw error

      const clockedInMap = new Map()
      data?.forEach(log => {
        clockedInMap.set(log.employee_id, log)
      })
      setClockedInEmployees(clockedInMap)
    } catch (error) {
      console.error('Error loading clocked in:', error)
    }
  }

  const handleClockIn = async (employeeId: string) => {
    try {
      const { error } = await supabase
        .from('work_logs')
        .insert({
          employee_id: employeeId,
          start_time: new Date().toISOString(),
          status: 'active'
        })

      if (error) throw error

      toast.success('Bejelentkezés sikeres!')
      loadWorkLogs()
      loadClockedIn()
      setSelectedEmployeeId('')
    } catch (error) {
      console.error('Error clocking in:', error)
      toast.error('Hiba a bejelentkezéskor')
    }
  }

  const handleClockOut = async (logId: string) => {
    try {
      const now = new Date().toISOString()
      const { data: log } = await supabase
        .from('work_logs')
        .select('start_time')
        .eq('id', logId)
        .single()

      if (log) {
        const startTime = new Date(log.start_time)
        const endTime = new Date(now)
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

        const { error } = await supabase
          .from('work_logs')
          .update({
            end_time: now,
            duration: durationMinutes,
            status: 'completed'
          })
          .eq('id', logId)

        if (error) throw error

        toast.success('Kijelentkezés sikeres!')
        loadWorkLogs()
        loadClockedIn()
      }
    } catch (error) {
      console.error('Error clocking out:', error)
      toast.error('Hiba a kijelentkezéskor')
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('hu-HU')
  }

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Clock className="h-8 w-8 mr-3 text-blue-600" />
            Munkaidő Nyomon Követés
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Alkalmazotti bejelentkezés és kijelentkezés</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <LogIn className="h-5 w-5 mr-2 text-green-600" />
          Bejelentkezés
        </h2>
        <div className="flex gap-4">
          <select
            value={selectedEmployeeId}
            onChange={e => setSelectedEmployeeId(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">- Alkalmazott kiválasztása -</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} {emp.department ? `(${emp.department})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedEmployeeId && handleClockIn(selectedEmployeeId)}
            disabled={!selectedEmployeeId}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
          >
            <LogIn className="h-4 w-4" /> Bejelentkezés
          </button>
        </div>
      </div>

      {clockedInEmployees.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Jelenleg bent ({clockedInEmployees.size})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(clockedInEmployees.values()).map(log => {
              const employee = employees.find(e => e.id === log.employee_id)
              const startTime = new Date(log.start_time)
              const minutesWorked = Math.round((new Date().getTime() - startTime.getTime()) / 60000)

              return (
                <div key={log.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <User className="h-5 w-5 text-blue-600 mr-2" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{employee?.full_name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{employee?.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold">Online</span>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4 mr-2" />{formatTime(log.start_time)} óta
                    </div>
                    <div className="flex items-center text-sm font-semibold text-blue-600">
                      <span>{minutesWorked} perc eltelt</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleClockOut(log.id)}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Kijelentkezés
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Munkaidő Napló</h2>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : workLogs.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">Nincsenek munkaidő naplók</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Dátum</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Alkalmazott</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Kezdés</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Befejezés</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Időtartam</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Státusz</th>
                </tr>
              </thead>
              <tbody>
                {workLogs.map(log => {
                  const employee = employees.find(e => e.id === log.employee_id)
                  return (
                    <tr key={log.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="py-3 px-4 text-gray-900 dark:text-white">{formatDate(log.start_time)}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white">{employee?.full_name || log.employee_id}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white">{formatTime(log.start_time)}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white">{log.end_time ? formatTime(log.end_time) : '-'}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-semibold">{formatDuration(log.duration)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${log.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                          {log.status === 'completed' ? 'Befejezett' : 'Aktív'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}