'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LoadingFallbackProps {
  isLoading: boolean
  onRetry?: () => void
  timeoutMs?: number
}

export function LoadingFallback({ 
  isLoading, 
  onRetry, 
  timeoutMs = 10000 
}: LoadingFallbackProps) {
  const [showTimeout, setShowTimeout] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Monitor network status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Check initial network status
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!isLoading) {
      setShowTimeout(false)
      return
    }

    const timer = setTimeout(() => {
      setShowTimeout(true)
    }, timeoutMs)

    return () => clearTimeout(timer)
  }, [isLoading, timeoutMs])

  if (!isLoading) return null

  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <div className="text-center space-y-4 max-w-md mx-auto p-6">
        {/* Loading Animation */}
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          {!isOnline && (
            <div className="absolute -top-1 -right-1">
              <WifiOff className="w-5 h-5 text-red-500" />
            </div>
          )}
        </div>

        {/* Status Messages */}
        {!isOnline ? (
          <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              <strong>Sem conexão</strong><br />
              Verifique sua conexão com a internet e tente novamente.
            </AlertDescription>
          </Alert>
        ) : showTimeout ? (
          <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              <strong>Carregando mais que o esperado</strong><br />
              Isso pode indicar um problema de conexão ou servidor.
            </AlertDescription>
          </Alert>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-2">Carregando...</h3>
            <p className="text-muted-foreground text-sm">
              Inicializando o sistema de autenticação
            </p>
          </div>
        )}

        {/* Retry Button */}
        {(showTimeout || !isOnline) && onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </Button>
        )}

        {/* Network Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-green-500" />
              <span>Conectado</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-500" />
              <span>Desconectado</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}