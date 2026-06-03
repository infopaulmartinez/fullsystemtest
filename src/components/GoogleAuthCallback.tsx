import React, { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Menu, 
  X, 
  ChevronDown, 
  LogOut, 
  Sun, 
  Moon, 
  Bell, 
  User,
  Home,
  ChefHat,
  ShoppingCart,
  ShoppingBag,
  Users,
  Truck,
  Package,
  MapPin,
  Calendar,
  BarChart3,
  FileText,
  Bot,
  Settings,
  Thermometer,
  Cloud,
  Clock,
  Route,
  Building,
  Shield,
  Layers,
  Smartphone,
  Monitor
} from 'lucide-react'
import { MessageSquare } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useRole } from '../contexts/RoleContext'
import { useTheme } from '../contexts/ThemeContext'
import { toast } from 'react-hot-toast'
import NotificationCenter from './Notifications/NotificationCenter'
import { supabase } from '../lib/supabase'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [profile, setProfile] = useState<any>(null)
  const { user, signOut } = useAuth()
  const { role } = useRole()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Close sidebar on mobile when route changes
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    // Fetch user profile when user changes
    const fetchProfile = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (error) {
            console.error('Error fetching profile:', error)
          } else {
            setProfile(data)
          }
        } catch (error) {
          console.error('Error fetching profile:', error)
        }
      } else {
        setProfile(null)
      }
    }

    fetchProfile()
  }, [user])
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
    { path: '/', label: 'Irányítópult', icon: Home, roles: ['admin', 'baker', 'salesperson', 'driver'] },
    { path: '/production', label: 'Termelés', icon: ChefHat, roles: ['admin', 'baker'] },
    { path: '/orders', label: 'Rendelések', icon: ShoppingCart, roles: ['admin', 'baker', 'salesperson'] },
    { path: '/pos', label: 'POS', icon: ShoppingBag, roles: ['admin', 'salesperson'] },
    { path: '/personnel', label: 'Személyzet', icon: Users, roles: ['admin'] },
    { path: '/partners', label: 'Partnerek', icon: Building, roles: ['admin', 'salesperson'] },
    { path: '/fleet', label: 'Flotta', icon: Truck, roles: ['admin', 'driver'] },
    { path: '/recipes', label: 'Receptek', icon: ChefHat, roles: ['admin', 'baker', 'salesperson'] },
    { path: '/inventory', label: 'Készlet', icon: Package, roles: ['admin', 'baker', 'salesperson'] },
    { path: '/locations', label: 'Helyszínek', icon: MapPin, roles: ['admin'] },
    { path: '/schedules', label: 'Beosztások', icon: Calendar, roles: ['admin'] },
    { path: '/reports', label: 'Jelentések', icon: BarChart3, roles: ['admin'] },
    { path: '/documents', label: 'Dokumentumok', icon: FileText, roles: ['admin'] },
    { path: '/ai-assistant', label: 'AI Asszisztens', icon: Bot, roles: ['admin', 'baker'] },
    { path: '/sensors', label: 'Szenzorok', icon: Thermometer, roles: ['admin', 'baker'] },
    { path: '/weather', label: 'Időjárás', icon: Cloud, roles: ['admin', 'driver'] },
    { path: '/ai-schedule', label: 'AI Beosztás', icon: Clock, roles: ['admin'] },
    { path: '/route-optimization', label: 'Útvonal Optimalizálás', icon: Route, roles: ['admin', 'driver'] },
    { path: '/hotel-occupancy', label: 'Szállásfoglalás', icon: Building, roles: ['admin'] },
    { path: '/security', label: 'Biztonság', icon: Shield, roles: ['admin'] },
    { path: '/system-visualization', label: 'Rendszer Vizualizáció', icon: Layers, roles: ['admin'] },
    { path: '/chat', label: 'Chat', icon: MessageSquare, roles: ['admin', 'baker', 'salesperson', 'driver'] },
    { path: '/delivery-notes', label: 'Szállítólevelek', icon: FileText, roles: ['admin', 'driver'] },
    { path: '/remote-control', label: 'Távoli irányítás', icon: Monitor, roles: ['admin'] },
    { path: '/profile', label: 'Felhasználói profil', icon: User, roles: ['admin', 'baker', 'salesperson', 'driver'] },
    { path: '/payments', label: 'Fizetések', icon: ShoppingBag, roles: ['admin'] },
    { path: '/settings', label: 'Beállítások', icon: Settings, roles: ['admin'] }
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(role || 'baker')
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-white dark:bg-gray-800 shadow-lg">
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <ChefHat className="h-8 w-8 text-amber-600" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Szemesi Pékség</span>
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
              {filteredMenuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    location.pathname === item.path
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-400'
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
            <ChefHat className="h-8 w-8 text-amber-600" />
            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Szemesi Pékség</span>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {filteredMenuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    location.pathname === item.path
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-400'
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
                    {filteredMenuItems.find(item => item.path === location.pathname)?.label || 'Irányítópult'}
                  </h1>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setShowNotifications(true)}
                  className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <Bell className="h-6 w-6" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                      {unreadNotifications}
                    </span>
                  )}
                </button>
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
                      onClick={() => navigate('/profile')}
                    >
                      <span className="sr-only">Open user menu</span>
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center text-white">
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

      {/* Notification Center */}
      {showNotifications && (
        <NotificationCenter 
          isOpen={showNotifications} 
          onClose={() => setShowNotifications(false)} 
        />
      )}
    </div>
  )
}