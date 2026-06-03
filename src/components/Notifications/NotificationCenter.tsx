import React, { useState, useEffect, useCallback } from 'react'
import { 
  X,
  Bell, 
  CheckCircle,
  Info,
  AlertTriangle,
  RefreshCw,
  Send
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { useRole } from '../../contexts/RoleContext'

interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  read: boolean
  action_url: string | null
  metadata: any
  expires_at: string | null
  created_at: string
}

interface NotificationCenterProps {
  isOpen: boolean
  unreadCount?: number
  onClose: () => void
  onMarkAsRead?: () => void
}

export default function NotificationCenter({ isOpen, unreadCount = 0, onClose, onMarkAsRead }: NotificationCenterProps) {
  const { user } = useAuth()
  const { role } = useRole()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showSendForm, setShowSendForm] = useState(false)
  const [messageData, setMessageData] = useState({
    title: '',
    message: '',
    type: 'info' as Notification['type'],
    priority: 'normal' as Notification['priority']
  })

  useEffect(() => {
    if (isOpen && user) {
      loadNotifications()
      
      // Set up real-time subscription for new notifications
      const notificationSubscription = supabase
        .channel('notifications-center')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        }, () => {
          loadNotifications()
        })
        .subscribe()
      
      return () => {
        notificationSubscription.unsubscribe()
      }
    }
  }, [isOpen, user])

  const loadNotifications = async () => {
    try {
      setLoading(true)

      // Fetch notifications for the current user
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Database error:', error)
        return
      }

      if (data) {
        setNotifications(data)
      }
    } catch (error) {
      console.error('Hiba az értesítések betöltésekor:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = useCallback(async (id: string) => {
    try {
      // Update the notification to mark it as read
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .select()

      if (error) {
        console.error('Database error:', error)
        return
      }

      // If the notification has an action_url, navigate to it
      if (data && data.length > 0 && data[0].action_url) {
        window.location.href = data[0].action_url
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id ? { ...notification, read: true } : notification
        )
      )
    } catch (error) {
      console.error('Hiba az értesítés olvasottként jelölésekor:', error)
    }
  }, [])

  const markAllAsRead = async () => {
    try {
      // Update all unread notifications for the current user
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false)

      if (error) {
        console.error('Database error:', error)
        return
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => {
          if (!notification.read) {
            return { ...notification, read: true }
          }
          return notification
        })
      )

      toast.success('Minden értesítés olvasottként jelölve')
      
      // Call the callback if provided
      if (onMarkAsRead) {
        onMarkAsRead()
      }
    } catch (error) {
      console.error('Hiba az értesítések olvasottként jelölésekor:', error)
    }
  }

  const sendGlobalNotification = async () => {
    try {
      if (!messageData.title || !messageData.message) {
        toast.error('Cím és üzenet megadása kötelező');
        return;
      }
      
      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id');
      
      if (usersError) {
        console.error('Database error:', usersError);
        toast.error('Hiba a felhasználók lekérdezésekor');
        return;
      }
      
      if (!users || users.length === 0) {
        toast.error('Nincsenek felhasználók a rendszerben');
        return;
      }
      
      // Create notifications for all users
      const notifications = users.map(u => ({
        user_id: u.id,
        title: messageData.title,
        message: messageData.message,
        type: messageData.type,
        priority: messageData.priority,
        read: false,
        action_url: null,
        metadata: {},
        expires_at: null
      }));
      
      // Insert notifications in batches to avoid payload size limits
      const batchSize = 10;
      let successCount = 0;
      
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('notifications')
          .insert(batch);
        
        if (error) {
          console.error(`Error sending batch ${i/batchSize + 1}:`, error);
        } else {
          successCount += batch.length;
        }
      }
      
      if (successCount === 0) {
        toast.error('Hiba az értesítések küldésekor');
        return;
      } else if (successCount < notifications.length) {
        toast.warning(`Csak ${successCount}/${notifications.length} értesítés lett elküldve`);
      } else {
        toast.success('Körüzenet sikeresen elküldve!');
      }
      
      // Test notification by sending a direct one to the current user
      if (user) {
        try {
          // Send a test email to verify notifications
          const { error: testError } = await supabase.functions.invoke('send-email', {
            body: {
              to: user.email,
              subject: 'Teszt értesítés: ' + messageData.title,
              body: `<h1>${messageData.title}</h1><p>${messageData.message}</p><p>Ez egy teszt értesítés.</p>`,
              smtpSettings: {
                host: 'mail.szemesipekseg.com',
                port: 465,
                user: 'admin@szemesipekseg.com',
                pass: '',
                fromName: 'Szemesi Pékség'
              }
            }
          });
          
          if (testError) {
            console.error('Error sending test email:', testError);
            toast.error('Hiba a teszt email küldésekor, de az értesítések elmentve');
          } else {
            toast.success('Teszt email elküldve: ' + user.email);
          }
        } catch (emailError) {
          console.error('Error sending test email:', emailError);
          toast.error('Hiba a teszt email küldésekor, de az értesítések elmentve');
        }
      }
      
      toast.success('Körüzenet sikeresen elküldve!')
      setShowSendForm(false)
      setMessageData({
        title: '',
        message: '',
        type: 'info',
        priority: 'normal'
      })
      
      // Reload notifications
      loadNotifications()
    } catch (error) {
      console.error('Hiba a körüzenet küldésekor:', error)
      toast.error('Hiba a körüzenet küldésekor')
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="h-5 w-5 text-blue-500" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case 'error': return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />
      default: return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      case 'error': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      default: return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      case 'normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'high': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Értesítések</h2>
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                {unreadCount}
              </span>
            )}
            {role === 'admin' && !showSendForm && (
              <button
                onClick={() => setShowSendForm(true)}
                className="ml-4 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Körüzenet küldése
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadNotifications}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Frissítés"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Bezárás"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Notification List */}
        <div className={`${showSendForm ? 'hidden' : 'flex-1 overflow-y-auto'}`}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <Bell className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Nincsenek értesítések</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`p-4 ${notification.read ? 'opacity-70' : ''}`}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id)
                    }
                    if (notification.action_url) {
                      window.location.href = notification.action_url
                    }
                  }}
                >
                  <div className={`rounded-lg p-3 border ${getTypeColor(notification.type)}`}>
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mt-0.5">
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {notification.message}
                        </p>
                        <div className="mt-2 flex justify-between items-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(notification.created_at).toLocaleString('hu-HU')}
                          </p>
                          {!notification.read && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              Új
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Send Global Notification Form */}
        {showSendForm && (
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Ez az üzenet minden felhasználónak el lesz küldve. Használja felelősséggel!
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cím *
                </label>
                <input
                  type="text"
                  value={messageData.title}
                  onChange={(e) => setMessageData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Értesítés címe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Üzenet *
                </label>
                <textarea
                  value={messageData.message}
                  onChange={(e) => setMessageData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Értesítés szövege"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Típus
                  </label>
                  <select
                    value={messageData.type}
                    onChange={(e) => setMessageData(prev => ({ ...prev, type: e.target.value as Notification['type'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="info">Információ</option>
                    <option value="warning">Figyelmeztetés</option>
                    <option value="error">Hiba</option>
                    <option value="success">Siker</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prioritás
                  </label>
                  <select
                    value={messageData.priority}
                    onChange={(e) => setMessageData(prev => ({ ...prev, priority: e.target.value as Notification['priority'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="low">Alacsony</option>
                    <option value="normal">Normál</option>
                    <option value="high">Magas</option>
                    <option value="urgent">Sürgős</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowSendForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={sendGlobalNotification}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Küldés mindenkinek
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        {notifications.length > 0 && !showSendForm && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={markAllAsRead}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Összes olvasottként jelölése
            </button>
          </div>
        )}
      </div>
    </div>
  )
}