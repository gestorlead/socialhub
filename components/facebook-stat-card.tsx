import { ReactNode } from 'react'

interface FacebookStatCardProps {
  icon: ReactNode
  title: string
  value: number | string
  change?: number
  colorClass?: string
}

export function FacebookStatCard({ 
  icon, 
  title, 
  value, 
  change,
  colorClass = "hover:border-[#1877f2]"
}: FacebookStatCardProps) {
  const formatNumber = (num: number | string): string => {
    if (typeof num === 'string') return num
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (num >= 10000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return num.toLocaleString('pt-BR')
  }

  return (
    <div className={`bg-card border rounded-lg p-4 ${colorClass} transition-all duration-200`}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-[#1877f2] rounded-lg">
          {icon}
        </div>
        {change !== undefined && (
          <span className={`text-xs ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {change > 0 && '+'}
            {change}%
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold">{formatNumber(value)}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
    </div>
  )
}