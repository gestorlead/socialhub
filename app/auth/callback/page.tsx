'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { user, loading, profile } = useAuth()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    console.log('Callback page - User:', user?.email, 'Loading:', loading, 'Profile:', profile?.id)
    
    // Aguarda o carregamento completo antes de redirecionar
    if (!loading && !isRedirecting) {
      if (user && profile) {
        console.log('User authenticated, redirecting to home')
        setIsRedirecting(true)
        
        // Set cookies for middleware detection (mesmo padrão do email/senha)
        document.cookie = `sh-login-success=true; path=/; max-age=60`
        document.cookie = `sh-login-timestamp=${Date.now()}; path=/; max-age=60`
        
        // Aguarda um momento para garantir que os cookies foram definidos e sessão persistida
        setTimeout(() => {
          console.log('Redirecting to home with cookies set')
          router.replace('/') // Usar replace em vez de push para evitar loop
        }, 2000) // Tempo suficiente para garantir que middleware detecte a sessão
      } else if (!loading && !user) {
        console.log('No user found, redirecting to login')
        setIsRedirecting(true)
        
        setTimeout(() => {
          router.replace('/login') // Usar replace em vez de push
        }, 500)
      }
      // Se user existe mas profile ainda não, continue aguardando
    }
  }, [user, loading, profile, router, isRedirecting])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">
          {user ? 'Login successful!' : 'Authenticating...'}
        </h2>
        <p className="text-muted-foreground">
          {user 
            ? `Welcome ${user.email}! Redirecting you to the dashboard...`
            : 'Please wait while we log you in.'
          }
        </p>
        {isRedirecting && (
          <div className="mt-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </div>
  )
}