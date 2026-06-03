import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import POSSales from './pages/POSSales'
import POSLogin from './pages/POSLogin'

interface POSSessionData {
  session_id: string
  employee_id: string
  employee_name: string
  location_id: string
  location_name: string
  opened_at: string
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Betöltés...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  const [posSession, setPOSSession] = useState<POSSessionData | null>(() => {
    const stored = localStorage.getItem('pos_session')
    return stored ? JSON.parse(stored) : null
  })
  const [mode, setMode] = useState<'chooser' | 'pos' | 'admin'>(() => {
    const stored = localStorage.getItem('app_mode')
    return (stored as any) || 'chooser'
  })

  const handlePOSLoginSuccess = (session: POSSessionData) => {
    setPOSSession(session)
    setMode('pos')
    localStorage.setItem('app_mode', 'pos')
    console.log(`✅ Kasszamunkamenet nyitva: ${session.employee_name} @ ${session.location_name}`)
  }

  const handlePOSLogout = () => {
    setPOSSession(null)
    setMode('chooser')
    localStorage.removeItem('pos_session')
    localStorage.removeItem('app_mode')
  }

  const handleAdminMode = () => {
    setMode('admin')
    localStorage.setItem('app_mode', 'admin')
  }

  const handleBackToChooser = () => {
    setMode('chooser')
    localStorage.removeItem('app_mode')
  }

  // Mode chooser - választó képernyő
  if (mode === 'chooser') {
    return (
      <Routes>
        <Route path="/" element={<ModeChooser onAdminClick={handleAdminMode} onPOSClick={() => setMode('pos')} user={user} />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // POS kassza mód
  if (mode === 'pos') {
    return (
      <Routes>
        <Route
          path="/"
          element={posSession ? (
            <POSSales onLogout={handlePOSLogout} posSession={posSession} />
          ) : (
            <POSLogin onLoginSuccess={handlePOSLoginSuccess} />
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // Admin mód - teljes fejlesztői hozzáférés
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          user ? (
            <div className="flex h-screen">
              <POSSales onLogout={() => {}} posSession={undefined} />
              <div className="absolute top-4 right-4 z-50">
                <button
                  onClick={handleBackToChooser}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg"
                >
                  ← Választó
                </button>
              </div>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function ModeChooser({ onAdminClick, onPOSClick, user }: { onAdminClick: () => void; onPOSClick: () => void; user: any }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-2">Szemesi Pékség</h1>
          <p className="text-sm text-gray-400">Válassz belépési módot</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* POS Mód */}
          <button
            onClick={onPOSClick}
            className="group p-8 rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-950/20 to-purple-900/10 hover:border-purple-500/60 hover:from-purple-950/40 transition-all shadow-lg"
          >
            <div className="text-4xl mb-4 text-center">🏪</div>
            <h2 className="text-xl font-black text-purple-300 mb-2 group-hover:text-purple-200 transition">
              Kasszamunkamenet
            </h2>
            <p className="text-sm text-gray-400">Értékesítői hozzáférés – Csak kassza funkciók</p>
          </button>

          {/* Admin Mód */}
          {user ? (
            <button
              onClick={onAdminClick}
              className="group p-8 rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-amber-900/10 hover:border-amber-500/60 hover:from-amber-950/40 transition-all shadow-lg"
            >
              <div className="text-4xl mb-4 text-center">⚙️</div>
              <h2 className="text-xl font-black text-amber-300 mb-2 group-hover:text-amber-200 transition">
                Admin / Fejlesztés
              </h2>
              <p className="text-sm text-gray-400">Teljes rendszer – Termelés, kezelés, fejlesztés</p>
            </button>
          ) : (
            <button
              onClick={() => window.location.href = '/login'}
              className="group p-8 rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-amber-900/10 hover:border-amber-500/60 hover:from-amber-950/40 transition-all shadow-lg"
            >
              <div className="text-4xl mb-4 text-center">🔐</div>
              <h2 className="text-xl font-black text-amber-300 mb-2 group-hover:text-amber-200 transition">
                Admin Login
              </h2>
              <p className="text-sm text-gray-400">Adminisztrátor hozzáférés – Kérjük jelentkezzen be</p>
            </button>
          )}
        </div>

        <div className="mt-12 p-4 bg-white/5 border border-white/10 rounded-xl text-center">
          <p className="text-xs text-gray-500">
            {user ? `Bejelentkezve: ${user.email}` : 'Nincs bejelentkezve'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#f9fafb',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#d97706', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
