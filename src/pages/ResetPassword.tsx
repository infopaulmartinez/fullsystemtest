import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, Eye, EyeOff, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Ellenőrizzük, hogy a felhasználó jelszó-visszaállítási folyamatban van-e
    const checkResetSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      
      if (error || !data.session) {
        setError('Érvénytelen vagy lejárt jelszó-visszaállítási link. Kérjük, próbálja újra.')
      }
    }
    
    checkResetSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    if (password !== confirmPassword) {
      setError('A jelszavak nem egyeznek')
      setLoading(false)
      return
    }
    
    if (password.length < 6) {
      setError('A jelszónak legalább 6 karakter hosszúnak kell lennie')
      setLoading(false)
      return
    }
    
    try {
      const { error } = await supabase.auth.updateUser({ password })
      
      if (error) throw error
      
      setSuccess(true)
      
      // Sikeres jelszóváltoztatás után átirányítás a bejelentkezési oldalra
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (error: any) {
      setError('Hiba történt a jelszó frissítése során: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <ChefHat className="h-16 w-16 text-amber-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Jelszó visszaállítása
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Adjon meg egy új jelszót a fiókjához
          </p>
        </div>

        {success ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <Lock className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Jelszó sikeresen frissítve!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                A jelszavát sikeresen megváltoztattuk. Átirányítjuk a bejelentkezési oldalra...
              </p>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Új jelszó
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Jelszó megerősítése
                </label>
                <div className="mt-1 relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Feldolgozás...' : 'Jelszó megváltoztatása'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}