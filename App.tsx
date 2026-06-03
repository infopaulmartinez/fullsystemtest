import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RoleProvider } from './contexts/RoleContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { CashmaticAuthProvider } from './contexts/CashmaticAuthContext'
import './styles/scrollbar.css'
import Layout from './components/Layout'
import LoginForm from './components/auth/LoginForm'
import RegisterForm from './components/auth/RegisterForm'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import PartnerLayout from './components/PartnerLayout'
import Production from './pages/Production'
import Orders from './pages/Orders'
import Cashmatic from './pages/Cashmatic'
import Personnel from './pages/Personnel'
import Employees from './pages/Employees'
import WorkLogs from './pages/WorkLogs'
import Fleet from './pages/Fleet'
import Recipes from './pages/Recipes'
import Inventory from './pages/Inventory'
import ProductCodeManager from './pages/ProductCodeManager'
import ProductPricing from './pages/ProductPricing'
import EmailSystem from './pages/EmailSystem'
import Schedules from './pages/Schedules'
import Reports from './pages/Reports'
import Documents from './pages/Documents'
import Settings from './pages/Settings'
import Sensors from './pages/Sensors'
import Weather from './pages/Weather'
import AIWorkSchedule from './pages/AIWorkSchedule'
import RouteOptimization from './pages/RouteOptimization'
import HotelOccupancy from './pages/HotelOccupancy'
import Security from './pages/Security'
import GoogleAuthCallback from './components/GoogleAuthCallback'
import SystemVisualization from './pages/SystemVisualization'
import UserProfile from './pages/UserProfile'
import Payments from './pages/Payments'
import RemoteControl from './pages/RemoteControl'
import Chat from './pages/Chat'
import AIAssistant from './pages/AIAssistant'
import PartnerDashboard from './pages/PartnerDashboard'
import Invoices from './pages/Invoices'
import PartnerOrders from './pages/PartnerOrders'
import PartnerNewOrder from './pages/PartnerNewOrder'
import PartnerOrderDetail from './pages/PartnerOrderDetail'
import PartnerProducts from './pages/PartnerProducts'
import PartnerTeam from './pages/PartnerTeam'
import PartnerDocuments from './pages/PartnerDocuments'
import DeliveryNotes from './pages/DeliveryNotes'
import Partners from './pages/Partners'
import Locations from './pages/Locations'
import StoreOrder from './pages/StoreOrder'


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <ThemeProvider>
      <CashmaticAuthProvider>
        <Router>
          <AuthProvider>
            <NotificationProvider>
              <RoleProvider>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginForm />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <RegisterForm />
                  </PublicRoute>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <ResetPassword />
                }
              />
              <Route
                path="/auth/callback"
                element={<GoogleAuthCallback />}
              />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="production" element={<Production />} />
                <Route path="orders" element={<Orders />} />
                <Route path="cashmatic" element={<Cashmatic />} />
                <Route path="personnel" element={<Personnel />} />
                <Route path="employees" element={<Navigate to="/personnel" replace />} />
                <Route path="work-logs" element={<WorkLogs />} />
                <Route path="fleet" element={<Fleet />} />
                <Route path="recipes" element={<Recipes />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="locations" element={<Locations />} />
                <Route path="store-order" element={<StoreOrder />} />
                <Route path="email-system" element={<EmailSystem />} />
                <Route path="product-codes" element={<ProductCodeManager />} />
                <Route path="product-pricing" element={<ProductPricing />} />
                <Route path="schedules" element={<Schedules />} />
                <Route path="reports" element={<Reports />} />
                <Route path="documents" element={<Documents />} />
                <Route path="sensors" element={<Sensors />} />
                <Route path="weather" element={<Weather />} />
                <Route path="ai-schedule" element={<AIWorkSchedule />} />
                <Route path="route-optimization" element={<RouteOptimization />} />
                <Route path="hotel-occupancy" element={<HotelOccupancy />} />
                <Route path="settings" element={<Settings />} />
                <Route path="security" element={<Security />} />
                <Route path="system-visualization" element={<SystemVisualization />} />
                <Route path="profile" element={<UserProfile />} />
                <Route path="payments" element={<Payments />} />
                <Route path="chat" element={<Chat />} />
                <Route path="delivery-notes" element={<DeliveryNotes />} />
                <Route path="remote-control" element={<RemoteControl />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="partners" element={<Partners />} />
              </Route>
              
              {/* Partner Routes with Partner Layout */}
              <Route
                path="/partner/*"
                element={
                  <ProtectedRoute>
                    <PartnerLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<PartnerDashboard />} />
                <Route path="orders" element={<PartnerOrders />} />
                <Route path="orders/new" element={<PartnerNewOrder />} />
                <Route path="orders/:id" element={<PartnerOrderDetail />} />
                <Route path="products" element={<PartnerProducts />} />
                <Route path="team" element={<PartnerTeam />} />
                <Route path="documents" element={<PartnerDocuments />} />
              </Route>
              
              {/* Redirect to partner dashboard if role is partner */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </RoleProvider>
              </NotificationProvider>
          </AuthProvider>
        </Router>
      </CashmaticAuthProvider>
    </ThemeProvider>
  )
}

export default App