'use client'

import { CheckCircle, Clock, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'

interface TokenStatusIndicatorProps {
  status: 'valid' | 'expiring' | 'expired' | 'refresh_expired' | 'not_found'
  timeUntilExpiry?: { hours: number, minutes: number }
  needsRefresh?: boolean
  needsReconnect?: boolean
  onRefresh?: () => void
  refreshing?: boolean
}

export function TokenStatusIndicator({ 
  status, 
  timeUntilExpiry, 
  needsRefresh, 
  needsReconnect,
  onRefresh,
  refreshing 
}: TokenStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'valid':
        return {
          icon: CheckCircle,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950',
          borderColor: 'border-green-200 dark:border-green-800',
          text: 'Token Válido',
          description: timeUntilExpiry 
            ? `Expira em ${timeUntilExpiry.hours}h ${timeUntilExpiry.minutes}m`
            : 'Token ativo'
        }
      case 'expiring':
        return {
          icon: Clock,
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          text: 'Token Expirando',
          description: timeUntilExpiry 
            ? `Expira em ${timeUntilExpiry.hours}h ${timeUntilExpiry.minutes}m`
            : 'Renovação necessária em breve'
        }
      case 'expired':
        return {
          icon: AlertTriangle,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950',
          borderColor: 'border-orange-200 dark:border-orange-800',
          text: 'Token Expirado',
          description: 'Será renovado automaticamente na próxima operação'
        }
      case 'refresh_expired':
        return {
          icon: XCircle,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950',
          borderColor: 'border-red-200 dark:border-red-800',
          text: 'Reconnect Necessário',
          description: 'Refresh token expirado (365 dias). Conecte novamente.'
        }
      case 'not_found':
        return {
          icon: XCircle,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950',
          borderColor: 'border-gray-200 dark:border-gray-800',
          text: 'Não Conectado',
          description: 'Conta do TikTok não está conectada'
        }
      default:
        return {
          icon: XCircle,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950',
          borderColor: 'border-gray-200 dark:border-gray-800',
          text: 'Status Desconhecido',
          description: 'Não foi possível verificar o status'
        }
    }
  }

  const config = getStatusConfig()
  const IconComponent = config.icon

  return (
    <div className={`rounded-lg border p-3 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent className={`w-4 h-4 ${config.color}`} />
          <div>
            <p className={`text-sm font-medium ${config.color}`}>
              {config.text}
            </p>
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>
          </div>
        </div>
        
        {(needsRefresh && onRefresh && !needsReconnect) && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${config.color} hover:opacity-80 disabled:opacity-50`}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Renovando...' : 'Renovar'}
          </button>
        )}
      </div>
    </div>
  )
}