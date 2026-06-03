import React, { useState, useEffect } from 'react'
import { LogIn, MapPin, AlertCircle, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Employee {
  id: string
  full_name: string
  email: string
  role: string
  assigned_location_id: string | null
}

interface Location {
  id: string
  name: string
  address: string
  city: string
}

interface SessionData {
  session_id: string
  employee_id: string
  employee_name: string
  location_id: string
  location_name: string
  opened_at: string
}

export default function POSLogin({ onLoginSuccess }: { onLoginSuccess: (session: SessionData) => void }) {
  const [step, setStep] = useState<'identify' | 'location-select' | 'verifying'>('identify')
  const [locations, setLocations] = useState<Location[]>([])
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [identifier, setIdentifier] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // prefetch locations for selection if needed
    const fetchLocations = async () => {
      try {
        const proxy = getProxyUrl()
        const response = await fetch(`${proxy}/api/locations`)
        const data = await response.json()
        if (data.success) setLocations(data.locations || [])
      } catch (e) { console.warn('locations load failed', e) }
    }
    fetchLocations()
  }, [])

  const fetchDeviceLocation = async () => {
    const proxy = getProxyUrl()
    try {
      const defaultRes = await fetch(`${proxy}/api/default-device`)
      const defaultJson = await defaultRes.json()
      if (!defaultJson.success || !defaultJson.device?.id) return null
      const locationRes = await fetch(`${proxy}/api/location-by-device/${encodeURIComponent(defaultJson.device.id)}`)
      const locationJson = await locationRes.json()
      if (!locationJson.success || !locationJson.location) return null
      return locationJson.location
    } catch (e) {
      console.warn('Device location lookup failed:', (e as Error).message)
      return null
    }
  }

  const getProxyUrl = () => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const protocol = window.location.protocol
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `${protocol}//${host}:3002`
      }
    }
    return import.meta.env.VITE_CASHMATIC_PROXY_URL || 'http://localhost:3002'
  }

  const handleIdentify = async () => {
    setLoading(true)
    setError('')
    try {
      const proxy = getProxyUrl()
      const res = await fetch(`${proxy}/api/identify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() })
      })
      const data = await res.json()
      if (!data.success) {
        // Ha nincs az employees táblában, próbáljuk meg felhasználói (Supabase) email alapján adminként beengedni
        try {
          const userRes = await supabase.auth.getUser()
          const supaUserEmail = userRes?.data?.user?.email
          if (supaUserEmail && supaUserEmail === identifier.trim()) {
            const adminEmp: Employee = {
              id: `admin-${supaUserEmail}`,
              full_name: supaUserEmail.split('@')[0],
              email: supaUserEmail,
              role: 'admin',
              assigned_location_id: null,
            }
            setEmployee(adminEmp)
            // próbáljuk automatikusan hozzárendelni a készülékhez tartozó helyet
            const mappedLocation = await fetchDeviceLocation()
            if (mappedLocation) {
              await handleOpenSession(mappedLocation.id, adminEmp)
              return
            }
            // ha már betöltődtek a helyek, válasszuk az elsőt automatikusan
            if (locations && locations.length > 0) {
              await handleOpenSession(locations[0].id, adminEmp)
              return
            }
            // egyébként mutassuk a helyválasztót
            setStep('location-select')
            setLoading(false)
            return
          }
        } catch (e) {
          console.warn('Supabase user lookup failed', e)
        }

        setError(data.error || 'Alkalmazott nem található')
        setLoading(false)
        return
      }
      setEmployee(data.employee)
      // if assigned location exists, open session immediately
      if (data.employee.assigned_location_id) {
        await handleOpenSession(data.employee.assigned_location_id, data.employee)
        return
      }
      const mappedLocation = await fetchDeviceLocation()
      if (mappedLocation) {
        await handleOpenSession(mappedLocation.id, data.employee)
        return
      }
      // otherwise show location select
      setStep('location-select')
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const handleLocationVerify = async (confirmed: boolean) => {
    if (!employee) return
    if (!confirmed) { setStep('location-select'); return }
    await handleOpenSession(employee.assigned_location_id!, employee)
  }

  const handleLocationSelect = async () => {
    if (!employee || !selectedLocation) { setError('Kérlek válassz ki egy helyet!'); return }
    await handleOpenSession(selectedLocation.id, employee)
  }

  const handleOpenSession = async (locationId: string, emp?: Employee) => {
    setLoading(true)
    setError('')
    try {
      const proxy = getProxyUrl()
      const response = await fetch(`${proxy}/api/open-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: (emp || employee)!.id,
          location_id: locationId,
        }),
      })

      const data = await response.json()
      if (data.success) {
        // localStorage-ba mentjük az aktuális sessiont
        const session: SessionData = {
          session_id: data.session_id,
          employee_id: (emp || employee)!.id,
          employee_name: data.employee_name,
          location_id: locationId,
          location_name: data.location_name,
          opened_at: data.opened_at,
        }
        // Try to lookup devices for this location and attach first device id if present
        try {
          const proxy = getProxyUrl()
          const devRes = await fetch(`${proxy}/api/devices/${locationId}`)
          const devJson = await devRes.json()
          if (devJson?.success && Array.isArray(devJson.devices) && devJson.devices.length > 0) {
            // Attach device id to session for cashmaticApi usage
            // server devices table expected to have 'id' column
            // Use first device by default
            // @ts-ignore
            session['device_id'] = devJson.devices[0].id || 'default'
          }
        } catch (e) {
          console.warn('Device lookup failed:', (e as Error).message)
        }

        localStorage.setItem('pos_session', JSON.stringify(session))

        // Notifikáció
        console.log(`✅ Kasszamunkamenet megnyitva: ${data.employee_name} @ ${data.location_name}`)

        // Sikeres bejelentkezés
        onLoginSuccess(session)
      } else {
        setError(data.error || 'Hiba a kasszamunkamenet megnyitásakor.')
      }
    } catch (e) {
      setError(`Csatlakozási hiba: ${(e as Error).message}`)
    }
    setLoading(false)
  }

  const assignedLocation = employee && employee.assigned_location_id
    ? locations.find(l => l.id === employee.assigned_location_id)
    : null

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-slate-800 border border-purple-500/20 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <LogIn className="h-8 w-8 text-purple-400 mr-3" />
          <h1 className="text-2xl font-bold text-white">Kasszabejegyzés</h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* STEP 1: Azonosítás egyszerű mezővel (email) */}
        {step === 'identify' && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-300">Email cím</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="pl. elado@bolt.hu"
              className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white"
            />
            <div className="flex gap-3">
              <button onClick={handleIdentify} disabled={loading || !identifier.trim()} className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white">{loading ? '...' : 'Bejelentkezés'}</button>
            </div>
            <p className="text-sm text-gray-400">Az e-mail cím alapján azonosítva. A hely automatikusan feltöltődik, ha a géphez hozzárendelve van.</p>
          </div>
        )}

        {/* STEP 2: Hely verifikáció (ha van beosztott helye) */}
        {step === 'location-verify' && employee && assignedLocation && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">Üdvözlünk,</p>
              <p className="text-xl font-bold text-white">{employee.full_name}</p>
            </div>

            <div className="bg-slate-700 p-4 rounded-lg border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-purple-400" />
                <span className="text-sm text-gray-300">Beosztott hely:</span>
              </div>
              <p className="text-lg font-bold text-white ml-7">{assignedLocation.name}</p>
              <p className="text-sm text-gray-400 ml-7">{assignedLocation.address}</p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-300 mb-4">
                Ez a bolt, ahova be vagy osztva? 🏪
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleLocationVerify(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                >
                  Nem
                </button>
                <button
                  onClick={() => handleLocationVerify(true)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? '...' : <>
                    <Check className="h-4 w-4" />
                    Igen, nyit!
                  </>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Hely kiválasztása (ha nincs beosztott helye vagy "Nem"-re kattintott) */}
        {step === 'location-select' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Válassz egy helyet
              </label>
              <select
                value={selectedLocation?.id || ''}
                onChange={(e) => {
                  const loc = locations.find(l => l.id === e.target.value)
                  setSelectedLocation(loc || null)
                }}
                className="w-full p-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">-- Válassz helyet --</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleLocationSelect}
              disabled={!selectedLocation || loading}
              className="w-full px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {loading ? 'Nyitás...' : 'Kasszanyitás'}
            </button>

            <button
              onClick={() => {
                setStep('employee')
                setSelectedEmployee(null)
              }}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              Vissza
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
