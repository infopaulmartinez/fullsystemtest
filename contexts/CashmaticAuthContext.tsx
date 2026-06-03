import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { cashmaticLogin } from '../lib/cashmaticApi'
import toast from 'react-hot-toast'

interface CashmaticAuthContextType {
  cashmaticToken: string | null
  isCashmaticAuthenticated: boolean
  isLoading: boolean
  cashmaticLogin: (username: string, password: string) => Promise<boolean>
  cashmaticLogout: () => void
}

const CashmaticAuthContext = createContext<CashmaticAuthContextType | undefined>(undefined)

const CASHMATIC_TOKEN_KEY = 'cashmatic_token'
const CASHMATIC_USERNAME_KEY = 'cashmatic_username'
const TOKEN_RENEWAL_INTERVAL = 14 * 60 * 1000 // 14 minutes

export function CashmaticAuthProvider({ children }: { children: React.ReactNode }) {
  const [cashmaticToken, setCashmaticToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const tokenRenewalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize token from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(CASHMATIC_TOKEN_KEY)
    if (storedToken) {
      setCashmaticToken(storedToken)
    }
  }, [])

  // Setup token renewal interval when token exists
  useEffect(() => {
    if (!cashmaticToken) {
      if (tokenRenewalRef.current) {
        clearInterval(tokenRenewalRef.current)
        tokenRenewalRef.current = null
      }
      return
    }

    // Token renewal disabled - using auto-login instead

    return () => {
      if (tokenRenewalRef.current) {
        clearInterval(tokenRenewalRef.current)
        tokenRenewalRef.current = null
      }
    }
  }, [cashmaticToken])

  const handleCashmaticLogin = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      console.log('🔑 Bejelentkezési kísérlet...')
      console.log('📍 Szerver: ' + (import.meta.env.VITE_CASHMATIC_API_URL || 'http://localhost:3000'))
      console.log('👤 Felhasználó: ' + username)

      const response = await cashmaticLogin(username, password)
      const token = typeof response === 'string' ? response : response.token
      
      if (!token) {
        toast.error('Bejelentkezés sikertelen: Nincs token a válaszban')
        return false
      }

      console.log('✅ API válasz: Sikeres')
      setCashmaticToken(token)
      localStorage.setItem(CASHMATIC_TOKEN_KEY, token)
      localStorage.setItem(CASHMATIC_USERNAME_KEY, username)
      
      toast.success('✓ Sikeres bejelentkezés!')
      return true
    } catch (error: any) {
      const errorMessage = error?.message || 'Ismeretlen hiba'
      console.error('Bejelentkezési hiba:', errorMessage)
      toast.error(`Bejelentkezés sikertelen: ${errorMessage}`)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const cashmaticLogout = () => {
    setCashmaticToken(null)
    localStorage.removeItem(CASHMATIC_TOKEN_KEY)
    localStorage.removeItem(CASHMATIC_USERNAME_KEY)
    
    // Clean up renewal interval
    if (tokenRenewalRef.current) {
      clearInterval(tokenRenewalRef.current)
      tokenRenewalRef.current = null
    }
    
    toast.success('Kijelentkezés sikeres')
  }

  return (
    <CashmaticAuthContext.Provider
      value={{
        cashmaticToken,
        isCashmaticAuthenticated: !!cashmaticToken,
        isLoading,
        cashmaticLogin: handleCashmaticLogin,
        cashmaticLogout,
      }}
    >
      {children}
    </CashmaticAuthContext.Provider>
  )
}

export function useCashmaticAuth() {
  const context = useContext(CashmaticAuthContext)
  if (context === undefined) {
    throw new Error('useCashmaticAuth must be used within CashmaticAuthProvider')
  }
  return context
}
