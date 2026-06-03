import React, { useState } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } = useNotifications()
  const [open, setOpen] = useState(false)

  const iconColors = {
    info: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20',
    success: 'bg-green-100 text-green-600 dark:bg-green-900/20',
    error: 'bg-red-100 text-red-600 dark:bg-red-900/20',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20',
  }

  return (
    <div className="relative">
      {/* Harang ikon */}
      <button
        onClick={() => {
          setOpen(!open)
          if (!open && unreadCount > 0) markAllAsRead()
        }}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
        title={`${unreadCount} új értesítés`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Értesítések</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                <CheckCheck className="h-4 w-4" />
                Összes olvasottá
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nincsenek értesítések</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    notif.read ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded-lg flex-shrink-0 ${iconColors[notif.type]}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                          {notif.message}
                        </p>
                      )}
                      <p className="text-gray-400 text-xs mt-1">
                        {notif.timestamp.toLocaleTimeString('hu-HU')}
                      </p>
                    </div>
                    <button
                      onClick={() => clearNotification(notif.id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
