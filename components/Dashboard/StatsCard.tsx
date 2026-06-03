import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: LucideIcon
  gradient: string
}

export default function StatsCard({ title, value, change, changeType, icon: IconComponent, gradient }: StatsCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`}></div>
      
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            {change && (
              <p className={`text-sm mt-1 ${
                changeType === 'positive' ? 'text-green-600 dark:text-green-400' :
                changeType === 'negative' ? 'text-red-600 dark:text-red-400' :
                'text-gray-600 dark:text-gray-400'
              }`}>
                {change}
              </p>
            )}
          </div>
          <div className={`rounded-xl p-3 bg-gradient-to-br ${gradient}`}>
            <IconComponent className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}