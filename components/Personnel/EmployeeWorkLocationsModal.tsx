import React, { useState, useEffect } from 'react'
import { X, MapPin, Plus, Trash2, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

interface WorkLocation {
  id: string
  employee_id: string
  location_id: string
  is_primary: boolean
  assigned_at: string
  locations?: {
    id: string
    name: string
    address: string
    city: string
  }
}

interface Location {
  id: string
  name: string
  address: string
  city: string
  status: string
}

interface EmployeeWorkLocationsModalProps {
  employeeId: string
  employeeName: string
  isOpen: boolean
  onClose: () => void
}

export default function EmployeeWorkLocationsModal({
  employeeId,
  employeeName,
  isOpen,
  onClose,
}: EmployeeWorkLocationsModalProps) {
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([])
  const [availableLocations, setAvailableLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadWorkLocations()
      loadAvailableLocations()
    }
  }, [isOpen, employeeId])

  const loadWorkLocations = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employee_work_locations')
        .select('*, locations(id, name, address, city)')
        .eq('employee_id', employeeId)
        .order('is_primary', { ascending: false })

      if (error) {
        console.error('Munkahelyek lekérési hiba:', error)
        toast.error('Hiba a munkahelyek betöltésekor')
        return
      }

      setWorkLocations(data || [])
    } catch (error) {
      console.error('Munkahelyek betöltési hiba:', error)
      toast.error('Hiba a munkahelyek betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address, city, status')
        .eq('status', 'active')

      if (error) {
        console.error('Helyek lekérési hiba:', error)
        return
      }

      setAvailableLocations(data || [])
    } catch (error) {
      console.error('Helyek betöltési hiba:', error)
    }
  }

  const handleAddLocation = async () => {
    if (!selectedLocation) {
      toast.error('Válassz ki egy helyet!')
      return
    }

    // Ellenőrizz duplikációt
    if (workLocations.some(wl => wl.location_id === selectedLocation)) {
      toast.error('Ez a hely már hozzárendelve van!')
      return
    }

    try {
      setSaving(true)
      const { data, error } = await supabase
        .from('employee_work_locations')
        .insert({
          employee_id: employeeId,
          location_id: selectedLocation,
          is_primary: workLocations.length === 0, // Első hely alapértelmezetten elsőleges
          assigned_at: new Date().toISOString(),
        })
        .select('*, locations(id, name, address, city)')

      if (error) {
        console.error('Hozzárendelési hiba:', error)
        toast.error('Hiba a munkahelyek hozzárendelésekor')
        return
      }

      setWorkLocations([...workLocations, data[0]])
      setSelectedLocation('')
      toast.success('Munkahelyek sikeresen hozzárendelve!')
    } catch (error) {
      console.error('Hozzárendelési hiba:', error)
      toast.error('Hiba a munkahelyek hozzárendelésekor')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveLocation = async (locationAssignmentId: string) => {
    if (window.confirm('Biztosan eltávolítod ezt a munkahelyet?')) {
      try {
        setSaving(true)
        const { error } = await supabase
          .from('employee_work_locations')
          .delete()
          .eq('id', locationAssignmentId)

        if (error) {
          console.error('Eltávolítási hiba:', error)
          toast.error('Hiba az eltávolítás során')
          return
        }

        setWorkLocations(workLocations.filter(wl => wl.id !== locationAssignmentId))
        toast.success('Munkahelyek sikeresen eltávolítva!')
      } catch (error) {
        console.error('Eltávolítási hiba:', error)
        toast.error('Hiba az eltávolítás során')
      } finally {
        setSaving(false)
      }
    }
  }

  const handleSetPrimary = async (locationAssignmentId: string) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('employee_work_locations')
        .update({ is_primary: true })
        .eq('id', locationAssignmentId)

      if (error) {
        console.error('Frissítési hiba:', error)
        toast.error('Hiba az elsőleges munkahelyek beállítása során')
        return
      }

      // Frissítsd lokálisan az adatokat
      setWorkLocations(workLocations.map(wl => ({
        ...wl,
        is_primary: wl.id === locationAssignmentId ? true : false
      })))
      toast.success('Elsőleges munkahelyek sikeresen beállítva!')
    } catch (error) {
      console.error('Frissítési hiba:', error)
      toast.error('Hiba az elsőleges munkahelyek beállítása során')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const assignedLocationIds = new Set(workLocations.map(wl => wl.location_id))
  const unassignedLocations = availableLocations.filter(
    loc => !assignedLocationIds.has(loc.id)
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <MapPin className="h-6 w-6 mr-2 text-blue-600" />
              Munkahelyek
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Add new location */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Munkahelyek hozzáadása
            </h3>
            <div className="flex gap-3">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                disabled={unassignedLocations.length === 0}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
              >
                <option value="">Válassz egy helyet...</option>
                {unassignedLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddLocation}
                disabled={!selectedLocation || saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:bg-gray-400 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Hozzáadás
              </button>
            </div>
            {unassignedLocations.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Nincs további hely elérhető
              </p>
            )}
          </div>

          {/* Current locations */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Jelenlegi munkahelyek ({workLocations.length})
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : workLocations.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  Még nincsenek munkahelyek hozzárendelve
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {workLocations.map(workLocation => (
                  <div
                    key={workLocation.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      workLocation.is_primary
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {workLocation.locations?.name}
                          </h4>
                          {workLocation.is_primary && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-xs font-semibold rounded-full">
                              <Star className="h-3 w-3" />
                              Elsőleges
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {workLocation.locations?.address}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {workLocation.locations?.city}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Hozzárendelve: {new Date(workLocation.assigned_at).toLocaleDateString('hu-HU')}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {!workLocation.is_primary && (
                          <button
                            onClick={() => handleSetPrimary(workLocation.id)}
                            disabled={saving}
                            className="p-2 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg transition-colors disabled:opacity-50"
                            title="Elsőlegesre állítás"
                          >
                            <Star className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveLocation(workLocation.id)}
                          disabled={saving}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                          title="Munkahelyek eltávolítása"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Bezárás
          </button>
        </div>
      </div>
    </div>
  )
}
