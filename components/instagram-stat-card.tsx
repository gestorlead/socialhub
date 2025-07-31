import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface InstagramStatCardProps {
  icon: ReactNode
  title: string
  value: number
  previousValue?: number
  change?: 'increase' | 'decrease' | 'same'
  difference?: number
  colorClass: string
}

export function InstagramStatCard({
  icon,
  title,
  value,
  previousValue,
  change,
  difference,
  colorClass
}: InstagramStatCardProps) {
  // Function to format large numbers elegantly
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (num >= 10000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return num.toLocaleString('pt-BR')
  }

  const getChangeIcon = () => {
    switch (change) {
      case 'increase':
        return <TrendingUp className="w-3 h-3 text-green-500" />
      case 'decrease':
        return <TrendingDown className="w-3 h-3 text-red-500" />
      case 'same':
        return <Minus className="w-3 h-3 text-gray-500" />
      default:
        return null
    }
  }

  const getChangeColor = () => {
    switch (change) {
      case 'increase':
        return 'text-green-600 dark:text-green-400'
      case 'decrease':
        return 'text-red-600 dark:text-red-400'
      case 'same':
        return 'text-gray-600 dark:text-gray-400'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className={`bg-card border rounded-lg p-4 transition-all duration-200 ${colorClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg text-white">
          {icon}
        </div>
        <span className="text-xs text-muted-foreground">{title}</span>
      </div>
      
      <div className="space-y-1">
        <p 
          className="text-2xl font-bold cursor-help" 
          title={`Valor exato: ${value.toLocaleString('pt-BR')}`}
        >
          {formatNumber(value)}
        </p>
        
        {change && difference !== undefined && (
          <div className="flex items-center gap-1">
            {getChangeIcon()}
            <span className={`text-xs font-medium ${getChangeColor()}`}>
              {difference > 0 ? '+' : ''}{difference.toLocaleString('pt-BR')}
            </span>
            {previousValue !== undefined && (
              <span className="text-xs text-muted-foreground">
                (anterior: {formatNumber(previousValue)})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}