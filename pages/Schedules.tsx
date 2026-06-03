import React, { useState, useEffect } from 'react'
import { 
  Calendar, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Clock, 
  Users,
  CheckCircle,
  AlertTriangle,
  Filter,
  Save,
  X,
  MapPin,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks, startOfMonth, endOfMonth, isSameMonth, getDay } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Schedule {
  id: string
  employee_id: string
  employee_name: string
  role: string
  date: string
  shift_type: 'morning' | 'day' | 'afternoon' | 'night'
  start_time: string
  end_time: string
  location_id: string
  location_name: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'absent'
  notes: string | null
}

interface Employee {
  id: string
  name: string
  role: string
}

interface Location {
  id: string
  name: string
}

type ViewMode = 'day' | 'week' | 'month';

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedShift, setSelectedShift] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [formData, setFormData] = useState({
    employee_id: '',
    date: '',
    shift_type: 'day' as Schedule['shift_type'],
    start_time: '',
    end_time: '',
    location_id: '',
    status: 'scheduled' as Schedule['status'],
    notes: ''
  })

  useEffect(() => {
    loadSchedules()
    loadEmployees()
    loadLocations()
  }, [selectedDate, viewMode])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      
      // Dátum tartomány meghatározása a nézet alapján
      let startDate, endDate;
      
      if (viewMode === 'day') {
        startDate = format(selectedDate, 'yyyy-MM-dd');
        endDate = startDate;
      } else if (viewMode === 'week') {
        const start = startOfWeek(selectedDate, { locale: hu });
        const end = endOfWeek(selectedDate, { locale: hu });
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(end, 'yyyy-MM-dd');
      } else { // month
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(end, 'yyyy-MM-dd');
      }
      
      // Adatbázis lekérdezés
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          profiles!schedules_employee_id_fkey(full_name, role),
          locations!schedules_location_id_fkey(name)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date')
        .order('start_time')
      
      if (error) {
        console.error('Database error:', error)
        loadMockSchedules()
        return
      }
      
      if (data && data.length > 0) {
        // Map the data to include employee_name, location_name, and role
        const mappedSchedules = data.map(schedule => ({
          ...schedule,
          employee_name: schedule.profiles?.full_name || 'Ismeretlen alkalmazott',
          location_name: schedule.locations?.name || 'Ismeretlen helyszín',
          role: schedule.profiles?.role || 'Ismeretlen szerepkör'
        }))
        setSchedules(mappedSchedules)
      } else {
        // Mock data if no schedules in database
        loadMockSchedules()
      }
    } catch (error) {
      console.error('Hiba a beosztások betöltésekor:', error)
      toast.error('Hiba a beosztások betöltésekor')
      loadMockSchedules()
    } finally {
      setLoading(false)
    }
  }

  const loadMockSchedules = () => {
    const mockSchedules: Schedule[] = []
    
    setSchedules(mockSchedules)
    toast.success('Üres beosztások betöltve')
  }

  const loadEmployees = async () => {
    try {
      // Adatbázis lekérdezés
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('status', 'active')
        .order('full_name')
      
      if (error) {
        console.error('Database error:', error)
        loadMockEmployees()
        return
      }
      
      if (data && data.length > 0) {
        setEmployees(data.map(emp => ({
          id: emp.id,
          name: emp.full_name,
          role: emp.role
        })))
      } else {
        // Mock employees
        loadMockEmployees()
      }
    } catch (error) {
      console.error('Hiba az alkalmazottak betöltésekor:', error)
      loadMockEmployees()
    }
  }

  const loadMockEmployees = () => {
    const mockEmployees: Employee[] = [
      { id: '1', name: 'Kovács János', role: 'Pék' },
      { id: '2', name: 'Nagy Péter', role: 'Vezető' },
      { id: '3', name: 'Szabó Anna', role: 'Eladó' },
      { id: '4', name: 'Tóth Gábor', role: 'Sofőr' }
    ]
    setEmployees(mockEmployees)
  }

  const loadLocations = async () => {
    try {
      // Adatbázis lekérdezés
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
      
      if (error) {
        console.error('Database error:', error)
        loadMockLocations()
        return
      }
      
      if (data && data.length > 0) {
        setLocations(data.map(loc => ({
          id: loc.id,
          name: loc.name
        })))
      } else {
        // Mock locations
        loadMockLocations()
      }
    } catch (error) {
      console.error('Hiba a helyszínek betöltésekor:', error)
      loadMockLocations()
    }
  }

  const loadMockLocations = () => {
    const mockLocations: Location[] = [
      { id: '1', name: 'Központi Üzlet' },
      { id: '2', name: 'Raktár' },
      { id: '3', name: 'Gyártóüzem' }
    ]
    setLocations(mockLocations)
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      
      const employee = employees.find(e => e.id === formData.employee_id)
      const location = locations.find(l => l.id === formData.location_id)
      
      if (!employee || !location) {
        toast.error('Kérjük válasszon alkalmazottat és helyszínt!')
        return
      }
      
      if (editingSchedule) {
        // Update existing schedule
        const updatedSchedule = {
          ...editingSchedule,
          employee_id: formData.employee_id,
          employee_name: employee.name,
          role: employee.role,
          date: formData.date,
          shift_type: formData.shift_type,
          start_time: formData.start_time,
          end_time: formData.end_time,
          location_id: formData.location_id,
          location_name: location.name,
          status: formData.status,
          notes: formData.notes
        }
        
        // Update in database
        const { error } = await supabase
          .from('schedules')
          .update(updatedSchedule)
          .eq('id', editingSchedule.id)
        
        if (error) {
          console.error('Database error:', error)
          // Still update local state
          setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? updatedSchedule : s))
          toast.success('Beosztás sikeresen frissítve! (Helyi változtatás)')
        } else {
          setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? updatedSchedule : s))
          toast.success('Beosztás sikeresen frissítve!')
        }
      } else {
        // Create new schedule
        const newSchedule: Omit<Schedule, 'id'> = {
          employee_id: formData.employee_id,
          employee_name: employee.name,
          role: employee.role,
          date: formData.date,
          shift_type: formData.shift_type,
          start_time: formData.start_time,
          end_time: formData.end_time,
          location_id: formData.location_id,
          location_name: location.name,
          status: formData.status,
          notes: formData.notes
        }
        
        // Insert into database
        const { data, error } = await supabase
          .from('schedules')
          .insert(newSchedule)
          .select()
        
        if (error) {
          console.error('Database error:', error)
          // Create with mock ID
          const mockSchedule: Schedule = {
            id: Date.now().toString(),
            ...newSchedule
          }
          setSchedules(prev => [...prev, mockSchedule])
          toast.success('Új beosztás sikeresen létrehozva! (Helyi változtatás)')
        } else if (data && data.length > 0) {
          setSchedules(prev => [...prev, data[0] as Schedule])
          toast.success('Új beosztás sikeresen létrehozva!')
        }
      }
      
      setShowAddModal(false)
      setEditingSchedule(null)
      resetForm()
    } catch (error) {
      console.error('Hiba a beosztás mentésekor:', error)
      toast.error('Hiba történt a beosztás mentésekor!')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      employee_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      shift_type: 'day',
      start_time: '08:00',
      end_time: '16:00',
      location_id: '',
      status: 'scheduled',
      notes: ''
    })
  }

  const editSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setFormData({
      employee_id: schedule.employee_id,
      date: schedule.date,
      shift_type: schedule.shift_type,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      location_id: schedule.location_id,
      status: schedule.status,
      notes: schedule.notes || ''
    })
    setShowAddModal(true)
  }

  const deleteSchedule = async (id: string) => {
    if (window.confirm('Biztosan törölni szeretné ezt a beosztást?')) {
      try {
        // Delete from database
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Database error:', error)
          // Still update local state
          setSchedules(prev => prev.filter(s => s.id !== id))
          toast.success('Beosztás sikeresen törölve! (Helyi változtatás)')
        } else {
          setSchedules(prev => prev.filter(s => s.id !== id))
          toast.success('Beosztás sikeresen törölve!')
        }
      } catch (error) {
        console.error('Hiba a beosztás törlésekor:', error)
        toast.error('Hiba történt a beosztás törlésekor!')
      }
    }
  }

  const updateScheduleStatus = async (id: string, status: Schedule['status']) => {
    try {
      // Update in database
      const { error } = await supabase
        .from('schedules')
        .update({ status })
        .eq('id', id)
      
      if (error) {
        console.error('Database error:', error)
        // Still update local state
        setSchedules(prev => prev.map(s => {
          if (s.id === id) {
            return { ...s, status }
          }
          return s
        }))
        toast.success(`Beosztás állapota frissítve: ${getStatusText(status)} (Helyi változtatás)`)
      } else {
        setSchedules(prev => prev.map(s => {
          if (s.id === id) {
            return { ...s, status }
          }
          return s
        }))
        
        toast.success(`Beosztás állapota frissítve: ${getStatusText(status)}`)
      }
    } catch (error) {
      console.error('Hiba a beosztás állapotának frissítésekor:', error)
      toast.error('Hiba történt a beosztás állapotának frissítésekor!')
    }
  }

  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = (schedule.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (schedule.location_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDate = viewMode === 'day' ? schedule.date === format(selectedDate, 'yyyy-MM-dd') : true
    const matchesShift = selectedShift === 'all' || schedule.shift_type === selectedShift
    return matchesSearch && matchesDate && matchesShift
  })

  const getShiftText = (shift: string) => {
    switch (shift) {
      case 'morning': return 'Hajnali'
      case 'day': return 'Nappali'
      case 'afternoon': return 'Délutáni'
      case 'night': return 'Éjszakai'
      default: return shift
    }
  }

  const getShiftColor = (shift: string) => {
    switch (shift) {
      case 'morning': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'day': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'afternoon': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'night': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'absent': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Tervezett'
      case 'confirmed': return 'Megerősítve'
      case 'completed': return 'Befejezett'
      case 'absent': return 'Hiányzott'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return Clock
      case 'confirmed': return CheckCircle
      case 'completed': return CheckCircle
      case 'absent': return AlertTriangle
      default: return Clock
    }
  }

  const handlePrevious = () => {
    if (viewMode === 'day') {
      setSelectedDate(prev => addDays(prev, -1))
    } else if (viewMode === 'week') {
      setSelectedDate(prev => subWeeks(prev, 1))
    } else {
      setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    }
  }

  const handleNext = () => {
    if (viewMode === 'day') {
      setSelectedDate(prev => addDays(prev, 1))
    } else if (viewMode === 'week') {
      setSelectedDate(prev => addWeeks(prev, 1))
    } else {
      setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    }
  }

  const handleToday = () => {
    setSelectedDate(new Date())
  }

  const handleImport = () => {
    // Implementáld az importálás logikáját
    toast('Importálás funkció fejlesztés alatt')
  }

  const handleExport = () => {
    // Implementáld az exportálás logikáját
    toast('Exportálás funkció fejlesztés alatt')
  }

  // Naptár nézet renderelése
  const renderCalendarView = () => {
    if (viewMode === 'day') {
      return renderDayView()
    } else if (viewMode === 'week') {
      return renderWeekView()
    } else {
      return renderMonthView()
    }
  }

  // Napi nézet
  const renderDayView = () => {
    const daySchedules = schedules.filter(s => s.date === format(selectedDate, 'yyyy-MM-dd'))
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {format(selectedDate, 'yyyy. MMMM d., EEEE', { locale: hu })}
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {daySchedules.length === 0 ? (
            <div className="p-6 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">Nincs beosztás erre a napra</p>
            </div>
          ) : (
            daySchedules.map(schedule => (
              <div key={schedule.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mr-4">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{schedule.employee_name}</h4>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {schedule.start_time} - {schedule.end_time}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getShiftColor(schedule.shift_type)}`}>
                      {getShiftText(schedule.shift_type)}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                      {getStatusText(schedule.status)}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 flex justify-between items-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    {schedule.location_name}
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => editSchedule(schedule)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => deleteSchedule(schedule.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Heti nézet
  const renderWeekView = () => {
    const startDate = startOfWeek(selectedDate, { locale: hu })
    const endDate = endOfWeek(selectedDate, { locale: hu })
    const days = []
    
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startDate, i))
    }
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {format(startDate, 'yyyy. MMMM d.', { locale: hu })} - {format(endDate, 'MMMM d.', { locale: hu })}
          </h3>
        </div>
        
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {days.map((day, index) => (
            <div 
              key={index} 
              className={`p-2 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                isSameDay(day, new Date()) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {format(day, 'EEEE', { locale: hu })}
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {format(day, 'MMM d', { locale: hu })}
              </p>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700 min-h-[400px]">
          {days.map((day, dayIndex) => {
            const daySchedules = schedules.filter(s => s.date === format(day, 'yyyy-MM-dd'))
            
            return (
              <div key={dayIndex} className="min-h-full">
                {daySchedules.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-4">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Nincs beosztás</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {daySchedules.map(schedule => (
                      <div 
                        key={schedule.id} 
                        className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => editSchedule(schedule)}
                      >
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {schedule.employee_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                          <Clock className="h-2 w-2 mr-1" />
                          {schedule.start_time}-{schedule.end_time}
                        </div>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${getShiftColor(schedule.shift_type)}`}>
                            {getShiftText(schedule.shift_type).substring(0, 3)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Havi nézet
  const renderMonthView = () => {
    const startOfTheMonth = startOfMonth(selectedDate)
    const endOfTheMonth = endOfMonth(selectedDate)
    const startDate = startOfWeek(startOfTheMonth, { locale: hu })
    const endDate = endOfWeek(endOfTheMonth, { locale: hu })
    
    const days = []
    let day = startDate
    
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {format(selectedDate, 'yyyy. MMMM', { locale: hu })}
          </h3>
        </div>
        
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((day, index) => (
            <div key={index} className="p-2 text-center">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{day}</p>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-gray-200 dark:divide-gray-700">
          {days.map((day, dayIndex) => {
            const daySchedules = schedules.filter(s => s.date === format(day, 'yyyy-MM-dd'))
            const isCurrentMonth = isSameMonth(day, selectedDate)
            const isToday = isSameDay(day, new Date())
            
            return (
              <div 
                key={dayIndex} 
                className={`min-h-[100px] p-1 ${
                  !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/20' : ''
                } ${
                  isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="text-right mb-1">
                  <span className={`text-xs font-medium ${
                    !isCurrentMonth ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {daySchedules.slice(0, 3).map(schedule => (
                    <div 
                      key={schedule.id} 
                      className={`text-xs p-1 rounded ${getShiftColor(schedule.shift_type)} truncate cursor-pointer`}
                      onClick={() => editSchedule(schedule)}
                    >
                      {schedule.employee_name.split(' ')[0]}
                    </div>
                  ))}
                  
                  {daySchedules.length > 3 && (
                    <div className="text-xs text-center text-gray-500 dark:text-gray-400">
                      +{daySchedules.length - 3} több
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
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
            <Calendar className="h-8 w-8 mr-3 text-purple-600" />
            Beosztások
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Munkaidő tervezés és műszak kezelés
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => {
              resetForm()
              setEditingSchedule(null)
              setShowAddModal(true)
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-200 shadow-lg shadow-purple-500/25"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új beosztás
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
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Mai műszakok</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {schedules.filter(s => s.date === format(new Date(), 'yyyy-MM-dd')).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Megerősítve</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {schedules.filter(s => s.date === format(new Date(), 'yyyy-MM-dd') && s.status === 'confirmed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tervezett</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {schedules.filter(s => s.date === format(new Date(), 'yyyy-MM-dd') && s.status === 'scheduled').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-red-500 to-pink-600 p-3">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Hiányzások</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {schedules.filter(s => s.date === format(new Date(), 'yyyy-MM-dd') && s.status === 'absent').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePrevious}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Ma
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {viewMode === 'day' && format(selectedDate, 'yyyy. MMMM d.', { locale: hu })}
              {viewMode === 'week' && (
                <>
                  {format(startOfWeek(selectedDate, { locale: hu }), 'yyyy. MMMM d.', { locale: hu })} - 
                  {format(endOfWeek(selectedDate, { locale: hu }), ' MMMM d.', { locale: hu })}
                </>
              )}
              {viewMode === 'month' && format(selectedDate, 'yyyy. MMMM', { locale: hu })}
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-2 text-sm ${
                  viewMode === 'day' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Nap
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 text-sm ${
                  viewMode === 'week' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Hét
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 text-sm ${
                  viewMode === 'month' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Hónap
              </button>
            </div>
            
            <div className="relative">
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
        
        {viewMode === 'day' && (
          <div className="mt-4 flex items-center">
            <label className="text-sm text-gray-700 dark:text-gray-300 mr-2">Műszak:</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">Összes műszak</option>
              <option value="morning">Hajnali</option>
              <option value="day">Nappali</option>
              <option value="afternoon">Délutáni</option>
              <option value="night">Éjszakai</option>
            </select>
            
            <div className="ml-4 relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Keresés név vagy helyszín alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Calendar View */}
      {renderCalendarView()}

      {/* Add/Edit Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingSchedule ? 'Beosztás szerkesztése' : 'Új beosztás'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
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
                    value={formData.employee_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Válasszon alkalmazottat</option>
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Helyszín *
                  </label>
                  <select
                    value={formData.location_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, location_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Válasszon helyszínt</option>
                    {locations.map(location => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dátum *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Műszak típusa *
                  </label>
                  <select
                    value={formData.shift_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, shift_type: e.target.value as Schedule['shift_type'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="morning">Hajnali</option>
                    <option value="day">Nappali</option>
                    <option value="afternoon">Délutáni</option>
                    <option value="night">Éjszakai</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kezdés *
                    </label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Befejezés *
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Állapot
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Schedule['status'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="scheduled">Tervezett</option>
                    <option value="confirmed">Megerősítve</option>
                    <option value="completed">Befejezett</option>
                    <option value="absent">Hiányzott</option>
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
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
                  disabled={loading || !formData.employee_id || !formData.location_id || !formData.date || !formData.start_time || !formData.end_time}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : editingSchedule ? 'Frissítés' : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}