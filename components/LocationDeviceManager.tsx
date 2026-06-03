import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface Device {
  id: string
  location_id: string
  name: string
  ip: string
  port: number
  username: string
  password: string
  protocol: string
}

export function LocationDeviceManager({ locationId, locationName }: { locationId: string; locationName: string }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    ip: '192.168.2.105',
    port: '50301',
    username: 'balint',
    password: '1975',
    protocol: 'https'
  })

  useEffect(() => {
    loadDevices()
  }, [locationId])

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('location_id', locationId)

      if (error) throw error
      setDevices(data || [])
    } catch (e) {
      console.error('Device betöltési hiba:', e)
    }
  }

  const handleSave = async () => {
    if (!formData.name || !formData.ip) {
      toast.error('Név és IP kötelező')
      return
    }

    setLoading(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('devices')
          .update({
            name: formData.name,
            ip: formData.ip,
            port: parseInt(formData.port),
            username: formData.username,
            password: formData.password,
            protocol: formData.protocol
          })
          .eq('id', editing.id)

        if (error) throw error
        toast.success('Device frissítve')
      } else {
        const { data: inserted, error } = await supabase
          .from('devices')
          .insert({
            location_id: locationId,
            name: formData.name,
            ip: formData.ip,
            port: parseInt(formData.port),
            username: formData.username,
            password: formData.password,
            protocol: formData.protocol
          })
          .select()

        if (error) throw error
        const newDevice = inserted?.[0]
        if (newDevice?.id) {
          const { error: mappingError } = await supabase
            .from('pos_device_locations')
            .upsert({ device_id: newDevice.id, location_id: locationId })
          if (mappingError) console.warn('pos_device_locations upsert hiba:', mappingError)
        }
        toast.success('Device hozzáadva')
      }

      setShowForm(false)
      setEditing(null)
      setFormData({
        name: '',
        ip: '192.168.2.105',
        port: '50301',
        username: 'balint',
        password: '1975',
        protocol: 'https'
      })
      loadDevices()
    } catch (e) {
      toast.error('Hiba: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan törlöd?')) return

    try {
      const { error } = await supabase.from('devices').delete().eq('id', id)
      if (error) throw error
      const { error: mappingError } = await supabase.from('pos_device_locations').delete().eq('device_id', id)
      if (mappingError) console.warn('pos_device_locations delete hiba:', mappingError)
      toast.success('Device törölve')
      loadDevices()
    } catch (e) {
      toast.error('Törlési hiba: ' + (e as Error).message)
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">Kasszagépek ({locationName})</h4>
        {!editing && (
          <button
            onClick={() => {
              setShowForm(!showForm)
              setFormData({
                name: '',
                ip: '192.168.2.105',
                port: '50301',
                username: 'balint',
                password: '1975',
                protocol: 'https'
              })
            }}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Új kasszagép
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-gray-900 dark:text-white">
              {editing ? '✏️ Kasszagép szerkesztése' : '➕ Új kasszagép'}
            </h5>
          </div>
          <input
            type="text"
            placeholder="Kasszagép neve"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="IP cím"
              value={formData.ip}
              onChange={e => setFormData({ ...formData, ip: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
            />
            <input
              type="text"
              placeholder="Port"
              value={formData.port}
              onChange={e => setFormData({ ...formData, port: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Felhasználó"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
            />
            <input
              type="password"
              placeholder="Jelszó"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
            />
          </div>
          <select
            value={formData.protocol}
            onChange={e => setFormData({ ...formData, protocol: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 inline mr-1" />
              {editing ? 'Frissítés' : 'Hozzáadás'}
            </button>
            <button
              onClick={() => {
                setShowForm(false)
                setEditing(null)
                setFormData({
                  name: '',
                  ip: '192.168.2.105',
                  port: '50301',
                  username: 'balint',
                  password: '1975',
                  protocol: 'https'
                })
              }}
              className="flex-1 px-3 py-2 text-sm bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              <X className="h-4 w-4 inline mr-1" />
              Mégse
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {devices.map(dev => (
          <div key={dev.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{dev.name}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{dev.ip}:{dev.port}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(dev)
                  setFormData({
                    name: dev.name,
                    ip: dev.ip,
                    port: dev.port.toString(),
                    username: dev.username,
                    password: dev.password,
                    protocol: dev.protocol
                  })
                  setShowForm(true)
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(dev.id)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {devices.length === 0 && !showForm && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nincs kasszagép hozzárendelve</p>
        )}
      </div>
    </div>
  )
}
