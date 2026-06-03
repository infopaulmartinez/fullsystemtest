import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChefHat, Eye, EyeOff, Mail } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { sendPasswordResetEmail } from '../../lib/emailService'
import { toast } from 'react-hot-toast'
import GoogleAuthButton from './GoogleAuthButton'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await signIn(email, password)
      if (error) throw error
      navigate('/dashboard')
    } catch (error: any) {
      console.error('Login error:', error)
      setError('Hibás email vagy jelszó')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const success = await sendPasswordResetEmail(resetEmail)
      
      if (!success) throw new Error('Hiba a jelszó visszaállítás során')
      
      setResetSent(true)
      toast.success('Jelszó visszaállítási email elküldve!')
    } catch (error: any) {
      setError('Hiba a jelszó visszaállítás során')
      toast.error('Hiba a jelszó visszaállítás során')
    } finally {
      setLoading(false)
    }
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center">
              <ChefHat className="h-16 w-16 text-amber-600" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
              Jelszó visszaállítás
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Add meg az email címed a jelszó visszaállításához
            </p>
          </div>

          {resetSent ? (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <Mail className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Email elküldve!
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Elküldtünk egy linket a {resetEmail} címre a jelszó visszaállításához.
                </p>
                <button
                  onClick={() => {
                    setShowForgotPassword(false)
                    setResetSent(false)
                    setResetEmail('')
                  }}
                  className="text-amber-600 hover:text-amber-500 text-sm font-medium"
                >
                  Vissza a bejelentkezéshez
                </button>
              </div>
            </div>
          ) : (
            <form className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700" onSubmit={handleForgotPassword}>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email cím
                </label>
                <input
                  id="resetEmail"
                  name="resetEmail"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="pelda@email.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Küldés...' : 'Jelszó visszaállítás'}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="text-amber-600 hover:text-amber-500 text-sm font-medium"
                >
                  Vissza a bejelentkezéshez
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <ChefHat className="h-16 w-16 text-amber-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Szemesi Pékség
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Jelentkezz be a fiókodba
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email cím
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="pelda@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Jelszó
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-amber-600 hover:text-amber-500"
            >
              Elfelejtett jelszó?
            </button>
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Bejelentkezés...' : 'Bejelentkezés'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">vagy</span>
              </div>
            </div>

            <GoogleAuthButton mode="signin" />
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Nincs még fiókod?{' '}
              <Link to="/register" className="font-medium text-amber-600 hover:text-amber-500 transition-colors">
                Regisztrálj itt
              </Link>
              <span className="mx-2">|</span>
              <Link to="/partner-register" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                Partneri regisztráció
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}