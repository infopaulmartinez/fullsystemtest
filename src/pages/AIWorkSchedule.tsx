import React, { useState, useEffect } from 'react'
import { 
  Calendar, 
  Users, 
  Clock,
  DollarSign,
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Filter, 
  Save, 
  X, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  Brain,
  Calendar as CalendarIcon,
  User,
  MapPin, 
  FileText
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

interface Employee {
  id: string
  name: string
  role: string
  skills: string[]
  preferences: {
    preferred_days: string[]
    preferred_shifts: string[]
    max_hours_per_week: number
  }
}

interface Schedule {
  id: string
  employee_id: string
  employee_name: string
  date: string
  shift_type: 'morning' | 'day' | 'afternoon' | 'night'
  start_time: string
  end_time: string
  location_id: string
  location_name: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'absent'
  notes: string | null
}

interface Location {
  id: string
  name: string
}

export default function AIWorkSchedule() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(
    new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]
  )
  const [selectedLocation, setSelectedLocation] = useState('')
  const [optimizationCriteria, setOptimizationCriteria] = useState<'balanced' | 'cost' | 'employee_satisfaction'>('balanced')
  const [generatedSchedules, setGeneratedSchedules] = useState<Schedule[]>([])
  const [showConfirmation, setShowConfirmation] = useState(false) 
  const [employeeLocations, setEmployeeLocations] = useState<Record<string, string>>({})

  useEffect(() => {
    loadEmployees()
    loadLocations()
    loadExistingSchedules()
    loadEmployeeLocations()
  }, [])

  const loadEmployeeLocations = async () => {
    try {
      // Load employee default locations
      const { data, error } = await supabase
        .from('profiles')
        .select('id, default_location_id')
        .not('default_location_id', 'is', null)
      
      if (error) {
        console.error('Error loading employee locations:', error)
        return
      }
      
      if (data) {
        const locations: Record<string, string> = {}
        data.forEach(employee => {
          if (employee.default_location_id) {
            locations[employee.id] = employee.default_location_id
          }
        })
        setEmployeeLocations(locations)
      }
    } catch (error) {
      console.error('Error loading employee locations:', error)
    }
  }

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, default_location_id')
        .eq('status', 'active')
        .order('full_name')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        const formattedEmployees: Employee[] = data.map(emp => ({
          id: emp.id || '',
          name: emp.full_name || 'Ismeretlen',
          role: emp.role || 'baker',
          default_location_id: emp.default_location_id || null,
          skills: [],
          preferences: {
            preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            preferred_shifts: ['day'],
            max_hours_per_week: 40
          }
        }))
        
        setEmployees(formattedEmployees)
        
        // Update employee locations
        const locations: Record<string, string> = {}
        data.forEach(employee => {
          if (employee.default_location_id) {
            locations[employee.id] = employee.default_location_id
          }
        })
        setEmployeeLocations(locations)
      }
      
      // If no employees found, add mock data
      if (!data || data.length === 0) {
        const mockEmployees: Employee[] = [
          {
            id: '1',
            name: 'Kovács János',
            role: 'baker',
            default_location_id: null,
            skills: ['bread', 'pastry'],
            preferences: {
              preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
              preferred_shifts: ['morning'],
              max_hours_per_week: 40
            }
          },
          {
            id: '2',
            name: 'Nagy Péter',
            role: 'baker',
            default_location_id: null,
            skills: ['bread', 'cake'],
            preferences: {
              preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
              preferred_shifts: ['day'],
              max_hours_per_week: 40
            }
          },
          {
            id: '3',
            name: 'Szabó Anna',
            role: 'salesperson',
            default_location_id: null,
            skills: ['customer_service'],
            preferences: {
              preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
              preferred_shifts: ['day'],
              max_hours_per_week: 40
            }
          },
          {
            id: '4',
            name: 'Tóth Gábor',
            role: 'driver',
            default_location_id: null,
            skills: ['delivery'],
            preferences: {
              preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
              preferred_shifts: ['day'],
              max_hours_per_week: 40
            }
          }
        ];
        
        setEmployees(mockEmployees);
      }
    } catch (error) {
      console.error('Hiba az alkalmazottak betöltésekor:', error)
      
      // Add mock data on error
      const mockEmployees: Employee[] = [
        {
          id: '1',
          name: 'Kovács János',
          role: 'baker',
          default_location_id: null,
          skills: ['bread', 'pastry'],
          preferences: {
            preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            preferred_shifts: ['morning'],
            max_hours_per_week: 40
          }
        },
        {
          id: '2',
          name: 'Nagy Péter',
          role: 'baker',
          default_location_id: null,
          skills: ['bread', 'cake'],
          preferences: {
            preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            preferred_shifts: ['day'],
            max_hours_per_week: 40
          }
        }
      ];
      
      setEmployees(mockEmployees);
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setLocations(data)
        if (data.length > 0) {
          setSelectedLocation(data[0].id)
        }
      }
    } catch (error) {
      console.error('Hiba a helyszínek betöltésekor:', error)
    }
  }

  const loadExistingSchedules = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          profiles:employee_id (id, full_name),
          locations:location_id (id, name)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date')
        .order('start_time')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        const formattedSchedules: Schedule[] = data.map(schedule => ({
          id: schedule.id,
          employee_id: schedule.employee_id,
          employee_name: schedule.profiles?.full_name || 'Ismeretlen',
          date: schedule.date,
          shift_type: schedule.shift_type,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          location_id: schedule.location_id,
          location_name: schedule.locations?.name || 'Ismeretlen',
          status: schedule.status,
          notes: schedule.notes
        }))
        
        setSchedules(formattedSchedules)
      }
    } catch (error) {
      console.error('Hiba a beosztások betöltésekor:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateSchedule = async () => {
    try {
      setGenerating(true)
      
      // In a real implementation, this would call an AI service
      // For demo purposes, we'll generate a simple schedule
      
      // Get the date range
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = []
      
      // Generate array of dates
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        days.push(new Date(date))
      }
      
      // Generate schedules
      const newSchedules: Schedule[] = []
      
      // Filter employees by role
      const bakers = employees.filter(emp => emp.role === 'baker')
      const salespeople = employees.filter(emp => emp.role === 'salesperson') 
      const drivers = employees.filter(emp => emp.role === 'driver') 
      
      // Csak azokat az alkalmazottakat vesszük figyelembe, akiknek ez az alapértelmezett helyszíne
      const locationBakers = bakers.filter(baker => employeeLocations[baker.id] === selectedLocation || !employeeLocations[baker.id])
      const locationSalespeople = salespeople.filter(sp => employeeLocations[sp.id] === selectedLocation || !employeeLocations[sp.id])
      const locationDrivers = drivers.filter(driver => employeeLocations[driver.id] === selectedLocation || !employeeLocations[driver.id])
      
      // For each day, assign employees to shifts
      days.forEach(day => {
        const dayStr = day.toISOString().split('T')[0]
        
        // Morning shift (4:00 - 12:00) - Bakers
        if (locationBakers.length > 0) {
          locationBakers.forEach((baker, index) => {
            if (index < 2) { // Limit to 2 bakers per morning shift
              newSchedules.push({
                id: `generated-${dayStr}-morning-${baker.id}`,
                employee_id: baker.id,
                employee_name: baker.name,
                date: dayStr,
                shift_type: 'morning',
                start_time: '04:00',
                end_time: '12:00',
                location_id: selectedLocation,
                location_name: locations.find(loc => loc.id === selectedLocation)?.name || 'Ismeretlen',
                status: 'scheduled',
                notes: 'AI által generált beosztás'
              })
            }
          })
        }
        
        // Day shift (8:00 - 16:00) - Salespeople
        if (locationSalespeople.length > 0) {
          locationSalespeople.forEach((salesperson, index) => {
            if (index < 2) { // Limit to 2 salespeople per day shift
              newSchedules.push({
                id: `generated-${dayStr}-day-${salesperson.id}`,
                employee_id: salesperson.id,
                employee_name: salesperson.name,
                date: dayStr,
                shift_type: 'day',
                start_time: '08:00',
                end_time: '16:00',
                location_id: selectedLocation,
                location_name: locations.find(loc => loc.id === selectedLocation)?.name || 'Ismeretlen',
                status: 'scheduled',
                notes: 'AI által generált beosztás'
              })
            }
          })
        }
        
        // Afternoon shift (12:00 - 20:00) - Mix of roles
        const afternoonEmployees = [...locationBakers, ...locationSalespeople].slice(0, 2)
        if (afternoonEmployees.length > 0) {
          afternoonEmployees.forEach((employee, index) => {
            if (index < 2) { // Limit to 2 employees per afternoon shift
              newSchedules.push({
                id: `generated-${dayStr}-afternoon-${employee.id}`,
                employee_id: employee.id,
                employee_name: employee.name,
                date: dayStr,
                shift_type: 'afternoon',
                start_time: '12:00',
                end_time: '20:00',
                location_id: selectedLocation,
                location_name: locations.find(loc => loc.id === selectedLocation)?.name || 'Ismeretlen',
                status: 'scheduled',
                notes: 'AI által generált beosztás'
              })
            }
          })
        }
        
        // Delivery shifts for drivers
        if (locationDrivers.length > 0) {
          locationDrivers.forEach((driver, index) => {
            if (index < 1) { // Limit to 1 driver per day
              newSchedules.push({
                id: `generated-${dayStr}-day-${driver.id}`,
                employee_id: driver.id,
                employee_name: driver.name,
                date: dayStr,
                shift_type: 'day',
                start_time: '06:00',
                end_time: '14:00',
                location_id: selectedLocation,
                location_name: locations.find(loc => loc.id === selectedLocation)?.name || 'Ismeretlen',
                status: 'scheduled',
                notes: 'AI által generált szállítási beosztás'
              })
            }
          })
        }
      })
      
      setGeneratedSchedules(newSchedules)
      setShowConfirmation(true)
      
      toast.success('Beosztás generálása sikeres!')
    } catch (error) {
      console.error('Hiba a beosztás generálásakor:', error)
      toast.error('Hiba történt a beosztás generálásakor!')
    } finally {
      setGenerating(false)
    }
  }

  const saveGeneratedSchedules = async () => {
    try {
      setLoading(true)
      
      // Format schedules for database
      const schedulesToSave = generatedSchedules.map(schedule => ({
        employee_id: schedule.employee_id,
        date: schedule.date,
        shift_type: schedule.shift_type,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        location_id: schedule.location_id,
        status: schedule.status,
        notes: schedule.notes
      }))
      
      // Insert into database
      const { data, error } = await supabase
        .from('schedules')
        .insert(schedulesToSave)
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a beosztások mentésekor')
        return
      }
      
      toast.success('Beosztások sikeresen mentve!')
      setShowConfirmation(false)
      setGeneratedSchedules([])
      
      // Reload existing schedules
      loadExistingSchedules()
    } catch (error) {
      console.error('Hiba a beosztások mentésekor:', error)
      toast.error('Hiba történt a beosztások mentésekor!')
    } finally {
      setLoading(false)
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

  const getShiftText = (shift: string) => {
    switch (shift) {
      case 'morning': return 'Hajnali'
      case 'day': return 'Nappali'
      case 'afternoon': return 'Délutáni'
      case 'night': return 'Éjszakai'
      default: return shift
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Brain className="h-8 w-8 mr-3 text-purple-600" />
            AI Beosztás Generátor
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Automatikus beosztás generálás mesterséges intelligenciával
          </p>
        </div>
        <button
          onClick={loadExistingSchedules}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Frissítés
        </button>
      </div>

      {/* Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Beosztás generálás beállításai</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kezdő dátum
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Záró dátum
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Helyszín
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Optimalizálási kritérium
            </label>
            <select
              value={optimizationCriteria}
              onChange={(e) => setOptimizationCriteria(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="balanced">Kiegyensúlyozott</option>
              <option value="cost">Költséghatékony</option>
              <option value="employee_satisfaction">Dolgozói elégedettség</option>
            </select>
          </div>
        </div>
        
        {/* Employee Location Settings */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">Alkalmazottak alapértelmezett helyszíne</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map(employee => (
              <div key={employee.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">{employee.name}</p>
                <select
                  value={employeeLocations[employee.id] || ''}
                  onChange={(e) => {
                    setEmployeeLocations(prev => ({
                      ...prev,
                      [employee.id]: e.target.value
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Nincs alapértelmezett helyszín</option>
                  {locations.map(location => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={generateSchedule}
            disabled={generating || loading || !selectedLocation || !startDate || !endDate}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-purple-500/25"
          >
            <Brain className="h-5 w-5 mr-2" />
            {generating ? 'Generálás...' : 'Beosztás generálása'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Generált beosztás áttekintése
                </h2>
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        Az AI {generatedSchedules.length} beosztást generált {new Date(startDate).toLocaleDateString('hu-HU')} és {new Date(endDate).toLocaleDateString('hu-HU')} között.
                      </p>
                      <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                        Kérjük, ellenőrizze a generált beosztásokat, mielőtt mentené őket.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Alkalmazott
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Dátum
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Műszak
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Idő
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Helyszín
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {generatedSchedules.map((schedule) => (
                        <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {schedule.employee_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {new Date(schedule.date).toLocaleDateString('hu-HU')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getShiftColor(schedule.shift_type)}`}>
                              {getShiftText(schedule.shift_type)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {schedule.start_time} - {schedule.end_time}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {schedule.location_name}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Mégse
                  </button>
                  <button
                    onClick={saveGeneratedSchedules}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Mentés...' : 'Beosztások mentése'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Schedules */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Jelenlegi beosztások</h2>
        
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-10">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nincsenek beosztások
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Még nincsenek beosztások a kiválasztott időszakra.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Alkalmazott
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Dátum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Műszak
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Idő
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Helyszín
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Állapot
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {schedule.employee_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(schedule.date).toLocaleDateString('hu-HU')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getShiftColor(schedule.shift_type)}`}>
                        {getShiftText(schedule.shift_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {schedule.start_time} - {schedule.end_time}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {schedule.location_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                        {getStatusText(schedule.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Insights */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Elemzés és Javaslatok</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-purple-800 dark:text-purple-400">Műszak optimalizálás</h3>
              <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              A jelenlegi beosztás alapján a reggeli műszakban túl kevés pék dolgozik. Javasolt legalább 3 pék beosztása a reggeli műszakba.
            </p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-blue-800 dark:text-blue-400">Költséghatékonyság</h3>
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              A túlórák optimalizálásával 15% bérköltség megtakarítás érhető el. Javasolt a műszakok egyenletesebb elosztása.
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-green-800 dark:text-green-400">Dolgozói elégedettség</h3>
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              A dolgozói preferenciák figyelembevételével 25%-kal javítható a dolgozói elégedettség. Javasolt a preferenciák felmérése.
            </p>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">AI Asszisztens javaslata</h3>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-gray-700 dark:text-gray-300">
              Az AI elemzés alapján a következő heti beosztásban javasolt a reggeli műszakok megerősítése, különösen hétfőn és pénteken. A hétvégi műszakokat érdemes egyenletesebben elosztani a dolgozók között a túlterheltség elkerülése érdekében. A szállítási útvonalak optimalizálásával csökkenthető a sofőrök munkaterhelése.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}