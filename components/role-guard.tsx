'use client'

import { useAuth } from '@/lib/supabase-auth-helpers'
import { UserRole } from '@/lib/types/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RoleGuardProps {
  requiredRole: UserRole
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
}

export function RoleGuard({ 
  requiredRole, 
  children, 
  fallback,
  redirectTo = '/unauthorized' 
}: RoleGuardProps) {
  const { hasRole, loading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && !hasRole(requiredRole) && redirectTo) {
      router.push(redirectTo)
    }
  }, [loading, user, hasRole, requiredRole, redirectTo, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  if (!hasRole(requiredRole)) {
    if (fallback) {
      return <>{fallback}</>
    }
    
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You don't have permission to access this resource.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Convenience components for common roles
export function AdminGuard({ children, fallback }: Omit<RoleGuardProps, 'requiredRole'>) {
  return (
    <RoleGuard requiredRole={UserRole.ADMIN} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export function SuperAdminGuard({ children, fallback }: Omit<RoleGuardProps, 'requiredRole'>) {
  return (
    <RoleGuard requiredRole={UserRole.SUPER_ADMIN} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}