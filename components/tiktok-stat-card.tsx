'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { ReactNode } from 'react'

interface TikTokStatCardProps {
  icon: ReactNode
  title: string
  value: number
  previousValue?: number
  change?: 'up' | 'down' | 'same'
  difference?: number
  colorClass: string
  formatValue?: (value: number) => string
}

export function TikTokStatCard({
  icon,
  title,
  value,
  previousValue,
  change,
  difference,
  colorClass,
  formatValue
}: TikTokStatCardProps) {
  const formatNumber = (num: number): string => {
    if (formatValue) return formatValue(num)
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return num.toLocaleString('pt-BR')
  }

  const formatDifference = (diff: number): string => {
    const prefix = diff > 0 ? '+' : ''
    return prefix + formatNumber(Math.abs(diff))
  }

  return (
    <div className={`bg-card border rounded-lg p-6 hover:shadow-lg transition-all duration-300 ${colorClass} group`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${colorClass.includes('blue') ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 
                                       colorClass.includes('red') ? 'bg-gradient-to-br from-red-500 to-pink-500' : 
                                       colorClass.includes('purple') ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 
                                       'bg-gradient-to-br from-emerald-500 to-teal-500'} 
                         rounded-xl flex items-center justify-center shadow-lg transition-shadow`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {formatNumber(value)}
              </p>
              {change && change !== 'same' && difference !== undefined && (
                <div className={`flex items-center gap-1 text-sm font-medium
                  ${change === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {change === 'up' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>{formatDifference(difference)}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {value.toLocaleString('pt-BR')} {title.toLowerCase().includes('seguidores') ? 'pessoas' : 
                                               title.toLowerCase().includes('curtidas') ? 'reações' :
                                               title.toLowerCase().includes('vídeos') ? 'conteúdos' : 'contas'}
            </p>
          </div>
        </div>
        <div className={`text-xs text-muted-foreground px-3 py-1 rounded-full font-medium
          ${colorClass.includes('blue') ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
            colorClass.includes('red') ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300' :
            colorClass.includes('purple') ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300' :
            'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'}`}>
          {title.includes('Seguidores') ? 'Audiência' :
           title.includes('Curtidas') ? 'Engajamento' :
           title.includes('Vídeos') ? 'Conteúdo' : 'Rede'}
        </div>
      </div>
    </div>
  )
}