import { ReactNode } from 'react'

interface ThreadsStatCardProps {
  icon: ReactNode
  title: string
  value: number | string
  colorClass?: string
}

export function ThreadsStatCard({ icon, title, value, colorClass = '' }: ThreadsStatCardProps) {
  // Function to format large numbers elegantly
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val
    
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (val >= 10000) {
      return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return val.toLocaleString('pt-BR')
  }

  return (
    <div className={`bg-card border rounded-lg p-4 transition-all duration-200 ${colorClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-black rounded-lg text-white">
          {icon}
        </div>
        <span className="text-xs text-muted-foreground">{title}</span>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold">{formatValue(value)}</p>
        <p className="text-xs text-muted-foreground">Total de {title.toLowerCase()}</p>
      </div>
    </div>
  )
}