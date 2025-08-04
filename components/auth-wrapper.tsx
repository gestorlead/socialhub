'use client'

import { useAuth } from '@/lib/supabase-auth-helpers'
import { LoadingFallback } from './loading-fallback'

interface AuthWrapperProps {
  children: React.ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { loading, forceRetry } = useAuth()

  if (loading) {
    return (
      <LoadingFallback 
        isLoading={loading} 
        onRetry={forceRetry}
        timeoutMs={8000} // 8 seconds timeout
      />
    )
  }

  return <>{children}</>
}