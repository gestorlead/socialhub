'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase-auth-helpers'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    console.log('Callback page - User:', user?.email, 'Loading:', loading)
    
    if (!loading) {
      if (user) {
        console.log('User authenticated, redirecting to home')
        router.push('/')
      } else {
        console.log('No user found, redirecting to login')
        router.push('/login')
      }
    }
  }, [user, loading, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-muted-foreground">Please wait while we log you in.</p>
      </div>
    </div>
  )
}