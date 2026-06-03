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
  Coins,
  Tag,
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
  Monitor,
  ChevronLeft,
  ChevronRight,
  Mail,
  Play,
  Pause,
  Square,
  Timer
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [profile, setProfile] = useState<any>(null)
  
  // MUNKAIDŐ ÁLLAPOTOK
  const [workStatus, setWorkStatus] = useState<'idle' | 'running'>('idle')
  const [workSeconds, setWorkSeconds] = useState(0)
  const [activeLogId, setActiveWorkLogId] = useState<string | null>(null)

  const { user, signOut } = useAuth()
  const { role } = useRole()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  // AKTÍV MUNKAIDŐ BETÖLTÉSE (F5 ELLENI VÉDELEM)
  useEffect(() => {
    const fetchActiveWorkLog = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('work_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'running')
          .maybeSingle();

        if (error) {
          console.error('Munkaidő lekérdezési hiba:', error);
          return;
        }

        if (data) {
          setActiveWorkLogId(data.id);
          setWorkStatus('running');
          // Idő kiszámítása a szerver start_time alapján
          const start = new Date(data.start_time).getTime();
          const now = new Date().getTime();
          setWorkSeconds(Math.floor((now - start) / 1000));
        }
      } catch (err) {
        console.error('Hálózat hiba:', err);
      }
    };

    fetchActiveWorkLog();
  }, [user]);

  // SZÁMLÁLÓ LÉPTETÉSE
  useEffect(() => {
    let interval: any;
    if (workStatus === 'running') {
      interval = setInterval(() => {
        setWorkSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [workStatus]);

  // IDŐ FORMÁZÁSA (HH:MM:SS)
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // MUNKAIDŐ GOMBOK KEZELÉSE
  const handleWorkAction = async (action: 'start' | 'stop') => {
    if (!user?.id) return;

    try {
      if (action === 'start') {
        const { data, error } = await supabase
          .from('work_logs')
          .insert([{ user_id: user.id, status: 'running' }])
          .select()
          .single();
        
        if (error) throw error;
        setActiveWorkLogId(data.id);
        setWorkStatus('running');
        toast.success('Munkaidő elindítva');
      } 
      else if (action === 'stop') {
        if (!activeLogId) return;
        if (!confirm('Leállítod a munkaidő mérést?')) return;

        const { error } = await supabase
          .from('work_logs')
          .update({ status: 'completed', end_time: new Date().toISOString() })
          .eq('id', activeLogId);

        if (error) throw error;
        setWorkStatus('idle');
        setWorkSeconds(0);
        setActiveWorkLogId(null);
        toast.error('Munkaidő leállítva és mentve');
      }
    } catch (err: any) {
      toast.error('Adatbázis hiba: ' + err.message);
    }
  };

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
    // Főmenü
    { path: '/', label: 'Irányítópult', icon: Home, roles: ['admin', 'baker', 'salesperson', 'driver'], group: 'main' },
    { path: '/ai-assistant', label: 'AI Asszisztens', icon: Bot, roles: ['admin', 'baker', 'salesperson', 'driver'], group: 'main', highlight: true },
    
    // Termelés és Készlet
    { path: '/production', label: 'Termelés', icon: ChefHat, roles: ['admin', 'baker'], group: 'production' },
    { path: '/recipes', label: 'Receptek', icon: ChefHat, roles: ['admin', 'baker', 'salesperson'], group: 'production' },
    { path: '/inventory', label: 'Készlet', icon: Package, roles: ['admin', 'baker', 'salesperson'], group: 'production' },
    { path: '/product-codes', label: 'Termék kódok', icon: Tag, roles: ['admin', 'baker', 'salesperson'], group: 'production' },
    { path: '/product-pricing', label: 'Egyedi árak', icon: Tag, roles: ['admin'], group: 'production' },
    { path: '/email-system', label: 'Email rendszer', icon: Mail, roles: ['admin'], group: 'sales' },
    
    // Értékesítés
    { path: '/orders', label: 'Rendelések', icon: ShoppingCart, roles: ['admin', 'baker', 'salesperson'], group: 'sales' },
    { path: '/store-order', label: 'Bolti rendelés', icon: ShoppingCart, roles: ['admin', 'salesperson'], group: 'sales' },
    { path: '/cashmatic', label: 'Cashmatic', icon: Coins, roles: ['admin', 'salesperson'], group: 'sales' },
    { path: '/partners', label: 'Partnerek', icon: Building, roles: ['admin', 'salesperson'], group: 'sales' },
    { path: '/delivery-notes', label: 'Szállítólevelek', icon: FileText, roles: ['admin', 'driver'], group: 'sales' },
    { path: '/payments', label: 'Fizetések', icon: ShoppingBag, roles: ['admin'], group: 'sales' },
    { path: '/invoices', label: 'Számlák', icon: FileText, roles: ['admin', 'salesperson'], group: 'sales' },
    
    // Logisztika
    { path: '/fleet', label: 'Flotta', icon: Truck, roles: ['admin', 'driver'], group: 'logistics' },
    { path: '/route-optimization', label: 'Útvonal Optimalizálás', icon: Route, roles: ['admin', 'driver'], group: 'logistics' },
    { path: '/weather', label: 'Időjárás', icon: Cloud, roles: ['admin', 'driver'], group: 'logistics' },
    
    // Adminisztráció
    { path: '/personnel', label: 'Személyzet', icon: Users, roles: ['admin'], group: 'admin' },
    { path: '/employees', label: 'Alkalmazottak', icon: Users, roles: ['admin'], group: 'admin' },
    { path: '/work-logs', label: 'Munkaidő', icon: Clock, roles: ['admin'], group: 'admin' },
    { path: '/locations', label: 'Helyszínek', icon: MapPin, roles: ['admin'], group: 'admin' },
    { path: '/schedules', label: 'Beosztások', icon: Calendar, roles: ['admin'], group: 'admin' },
    { path: '/documents', label: 'Dokumentumok', icon: FileText, roles: ['admin'], group: 'admin' },
    
    // Monitoring
    { path: '/sensors', label: 'Szenzorok', icon: Thermometer, roles: ['admin', 'baker'], group: 'monitoring' },
    { path: '/reports', label: 'Jelentések', icon: BarChart3, roles: ['admin'], group: 'monitoring' },
    { path: '/system-visualization', label: 'Rendszer Vizualizáció', icon: Layers, roles: ['admin'], group: 'monitoring' },
    { path: '/security', label: 'Biztonság', icon: Shield, roles: ['admin'], group: 'monitoring' },
    { path: '/remote-control', label: 'Távoli irányítás', icon: Monitor, roles: ['admin'], group: 'monitoring' },
    
    // AI és Kommunikáció
    { path: '/ai-schedule', label: 'AI Beosztás', icon: Clock, roles: ['admin'], group: 'ai' },
    { path: '/hotel-occupancy', label: 'Szállásfoglalás', icon: Building, roles: ['admin'], group: 'ai' },
    { path: '/chat', label: 'Chat', icon: MessageSquare, roles: ['admin', 'baker', 'salesperson', 'driver'], group: 'ai' },
    
    { path: '/profile', label: 'Felhasználói profil', icon: User, roles: ['admin', 'baker', 'salesperson', 'driver'], group: 'settings' },
    { path: '/settings', label: 'Beállítások', icon: Settings, roles: ['admin'], group: 'settings' }
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(role || 'baker')
  )
  
  // Group menu items
  const groupedMenuItems = filteredMenuItems.reduce((groups, item) => {
    const group = item.group || 'other';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {} as Record<string, typeof menuItems>);
  
  // Group labels
  const groupLabels: Record<string, string> = {
    main: 'Főmenü',
    production: 'Termelés és Készlet',
    sales: 'Értékesítés',
    logistics: 'Logisztika',
    admin: 'Adminisztráció',
    monitoring: 'Monitoring',
    ai: 'AI és Kommunikáció',
    settings: 'Beállítások',
    other: 'Egyéb'
  };

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
              {Object.entries(groupedMenuItems).map(([group, items]) => (
                <div key={group} className="mb-6">
                  {group !== 'main' && (
                    <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      {groupLabels[group]}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {items.map((item) => (
                      <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                        location.pathname === item.path
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      } ${item.highlight ? 'border-l-4 border-amber-500 pl-3' : ''}`}
                    >
                      <item.icon className={`h-5 w-5 ${item.highlight ? 'text-amber-500' : ''} mr-3`} />
                      {item.label}
                    </Link>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Copyright */}
              <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="px-3 text-xs text-gray-500 dark:text-gray-400">
                  <p>© 2025 Szemesi Pékség</p>
                  <p className="mt-1">Powered by <a href="https://aiprocesspilot.eu" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300">AIProcessPilot.eu</a></p>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:flex-col transition-all duration-300`}>
        <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <ChefHat className="h-8 w-8 text-amber-600" />
              {!sidebarCollapsed && <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Szemesi Pékség</span>}
            </div>
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto sidebar-menu">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {Object.entries(groupedMenuItems).map(([group, items]) => (
                <div key={group} className="mb-6">
                  {group !== 'main' && !sidebarCollapsed && (
                    <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      {groupLabels[group]}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {items.map((item) => (
                      <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'px-4'} py-2 text-sm font-medium rounded-lg ${
                        location.pathname === item.path
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      } ${item.highlight && !sidebarCollapsed ? 'border-l-4 border-amber-500 pl-3' : ''}`}
                    >
                      <item.icon className={`h-5 w-5 ${item.highlight ? 'text-amber-500' : ''} ${sidebarCollapsed ? '' : 'mr-3'}`} />
                      {!sidebarCollapsed && item.label}
                    </Link>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Copyright */}
              <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                {!sidebarCollapsed && (
                  <div className="px-3 text-xs text-gray-500 dark:text-gray-400">
                    <p>© 2025 Szemesi Pékség</p>
                    <p className="mt-1">Powered by <a href="https://aiprocesspilot.eu" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300">AIProcessPilot.eu</a></p>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'} flex flex-col min-h-screen transition-all duration-300`}>
        {/* Top navigation */}
        <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <button
                  type="button"
                  className="lg:hidden -ml-0.5 -mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
                  onClick={() => {
                    if (window.innerWidth >= 1024) {
                      setSidebarCollapsed(!sidebarCollapsed);
                    } else {
                      setSidebarOpen(true);
                    }
                  }}
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
              <div className="flex items-center space-x-2">
                
                {/* MUNKAIDŐ VEZÉRLŐ PANEL */}
                <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1 mr-2 border border-gray-200 dark:border-gray-600">
                  <div className={`h-2 w-2 rounded-full mr-3 ${workStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200 mr-4">
                    {formatTime(workSeconds)}
                  </span>
                  <div className="flex space-x-1">
                    {workStatus !== 'running' ? (
                      <button 
                        onClick={() => handleWorkAction('start')} 
                        className="p-1.5 hover:bg-green-100 text-green-600 rounded-full transition-colors" 
                        title="Indítás"
                      >
                        <Play className="h-4 w-4 fill-current" />
                      </button>
                    ) : (
                      <button 
                        disabled 
                        className="p-1.5 text-gray-300 rounded-full cursor-not-allowed"
                      >
                        <Play className="h-4 w-4 fill-current opacity-50" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleWorkAction('stop')} 
                      className="p-1.5 hover:bg-red-100 text-red-600 rounded-full transition-colors" 
                      title="Leállítás"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                </div>

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
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center text-white overflow-hidden border-2 border-white dark:border-gray-700">
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