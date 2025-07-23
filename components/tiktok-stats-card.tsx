"use client"

import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function TikTokStatsCard({ title, value, icon: Icon, color, trend }: StatsCardProps) {
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
    red: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
    purple: "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400",
  }

  return (
    <div className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">
              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
            </p>
          </div>
        </div>
        
        {trend && (
          <div className={`text-xs px-2 py-1 rounded-full ${
            trend.isPositive 
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          }`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </div>
        )}
      </div>
    </div>
  )
}