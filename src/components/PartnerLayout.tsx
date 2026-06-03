import React, { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Menu, 
  X, 
  ChevronDown, 
  LogOut, 
  Sun, 
  Moon, 
  User,
  Building,
  ShoppingCart,
  Package,
  FileText,
  Users,
  MessageSquare,
  Bot
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function PartnerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [partnerCompany, setPartnerCompany] = useState<any>(null)
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Close sidebar on mobile when route changes
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    // Fetch user profile and partner company when user changes
    const fetchProfileAndPartner = async () => {
      if (user?.id) {
        try {
          // Get user profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (profileError) {
            console.error('Error fetching profile:', profileError)
          } else {
            setProfile(profileData)
          }
          
          // Get partner company
          const { data: partnerData, error: partnerError } = await supabase
            .from('partner_users')
            .select('partner_companies(*)')
            .eq('user_id', user.id)
            .single()
          
          if (partnerError) {
            console.error('Error fetching partner company:', partnerError)
            // If no partner association, redirect to login
            if (partnerError.code === 'PGRST116') {
              toast.error('Nincs hozzárendelve partner céghez')
              navigate('/login')
            }
          } else if (partnerData && partnerData.partner_companies) {
            setPartnerCompany(partnerData.partner_companies)
          }
        } catch (error) {
          console.error('Error fetching profile and partner:', error)
        }
      } else {
        setProfile(null)
        setPartnerCompany(null)
      }
    }

    fetchProfileAndPartner()
  }, [user, navigate])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Hiba a kijelentkezés során')
    }
  }

  const menuItems = [
    { path: '/partner', label: 'Irányítópult', icon: Building },
    { path: '/partner/orders', label: 'Rendelések', icon: ShoppingCart },
    { path: '/partner/products', label: 'Termékek', icon: Package },
    { path: '/partner/documents', label: 'Dokumentumok', icon: FileText },
    { path: '/partner/team', label: 'Csapattagok', icon: Users },
    { path: '/partner/chat', label: 'Chat', icon: MessageSquare },
    { path: '/partner/ai-assistant', label: 'AI Asszisztens', icon: Bot }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-white dark:bg-gray-800 shadow-lg">
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Building className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                {partnerCompany?.name || 'Partner Portál'}
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <nav className="px-2 py-4 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-gray-200 dark:border-gray-700">
            <Building className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white truncate">
              {partnerCompany?.name || 'Partner Portál'}
            </span>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top navigation */}
        <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <button
                  type="button"
                  className="lg:hidden -ml-0.5 -mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
                  onClick={() => setSidebarOpen(true)}
                >
                  <span className="sr-only">Open sidebar</span>
                  <Menu className="h-6 w-6" aria-hidden="true" />
                </button>
                <div className="ml-4 lg:ml-0">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {menuItems.find(item => item.path === location.pathname)?.label || 'Irányítópult'}
                  </h1>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="ml-2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {theme === 'dark' ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
                </button>
                <div className="ml-2 relative">
                  <div>
                    <button
                      type="button"
                      className="flex items-center max-w-xs text-sm rounded-full focus:outline-none"
                      id="user-menu-button"
                    >
                      <span className="sr-only">Open user menu</span>
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white">
                        {user?.user_metadata?.avatar_url || profile?.avatar_url ? (
                          <img 
                            src={user?.user_metadata?.avatar_url || profile?.avatar_url || ''} 
                            alt={user?.user_metadata?.full_name || user?.email || 'Felhasználó'} 
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </div>
                      <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                        {user?.user_metadata?.full_name || profile?.full_name || user?.email || 'Felhasználó'}
                      </span>
                      <ChevronDown className="ml-1 h-4 w-4 text-gray-500 dark:text-gray-400 hidden sm:block" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <LogOut className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}