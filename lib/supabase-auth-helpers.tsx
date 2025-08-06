'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { Profile, UserRole, hasPermission } from './types/auth'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  userRole: UserRole
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  hasRole: (minLevel: UserRole) => boolean
  isAdmin: () => boolean
  isSuperAdmin: () => boolean
  refreshProfile: () => Promise<void>
  forceRetry: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  
  // Initialize Supabase client using SSR approach
  const supabase = createClient()

  const fetchProfile = async (userId: string, retryCount = 0): Promise<Profile | null> => {
    try {
      // Timeout para evitar queries eternos
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
      
      try {
        // Seguindo as melhores práticas do Supabase: sempre adicionar filtro
        // Busca perfil com roles em uma única query otimizada
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            *,
            roles (
              id,
              name,
              level,
              description,
              permissions
            )
          `)
          .eq('id', userId)  // Filtro explícito conforme documentação
          .abortSignal(controller.signal)
          .single()

        clearTimeout(timeoutId)

        if (error) {
          // Se perfil não existe (código PGRST116), o trigger deve ter criado
          // Aguarda um momento e tenta novamente
          if (error.code === 'PGRST116' && retryCount < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            return fetchProfile(userId, retryCount + 1)
          }
          
          console.error('Profile fetch error:', error)
          return null
        }

        return data as Profile
      } catch (fetchError) {
        clearTimeout(timeoutId)
        throw fetchError
      }
    } catch (error) {
      console.error('Profile fetch failed:', error)
      
      // Se falhar e ainda temos tentativas, tenta novamente após delay
      if (retryCount < 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return fetchProfile(userId, retryCount + 1)
      }
      
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  const forceRetry = () => {
    setRetryCount(prev => prev + 1)
    setLoading(true)
  }

  useEffect(() => {
    let mounted = true
    let initializationComplete = false
    let fallbackTimeoutId: NodeJS.Timeout | null = null

    const initializeAuth = async () => {
      try {
        // Set a fallback timeout to prevent infinite loading
        fallbackTimeoutId = setTimeout(() => {
          if (mounted && !initializationComplete) {
            console.warn('Auth initialization timeout - setting loading to false')
            setLoading(false)
            initializationComplete = true
          }
        }, 15000) // 15 second fallback

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted && !initializationComplete) {
            setSession(null)
            setUser(null)
            setProfile(null)
            setLoading(false)
            initializationComplete = true
          }
          return
        }

        if (mounted && !initializationComplete) {
          setSession(session)
          setUser(session?.user ?? null)
          
          if (session?.user) {
            try {
              const profileData = await fetchProfile(session.user.id)
              if (mounted && !initializationComplete) {
                setProfile(profileData)
              }
            } catch (profileError) {
              console.error('Profile fetch error during init:', profileError)
              // Continue without profile data
              if (mounted && !initializationComplete) {
                setProfile(null)
              }
            }
          } else {
            if (mounted && !initializationComplete) {
              setProfile(null)
            }
          }
          
          if (mounted && !initializationComplete) {
            setLoading(false)
            initializationComplete = true
            if (fallbackTimeoutId) {
              clearTimeout(fallbackTimeoutId)
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted && !initializationComplete) {
          setSession(null)
          setUser(null)
          setProfile(null)
          setLoading(false)
          initializationComplete = true
          if (fallbackTimeoutId) {
            clearTimeout(fallbackTimeoutId)
          }
        }
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      // Skip initial session event to avoid duplicate initialization
      if (event === 'INITIAL_SESSION') {
        return
      }
      
      console.log('Auth state change:', event)
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        try {
          const profileData = await fetchProfile(session.user.id)
          if (mounted) {
            setProfile(profileData)
          }
        } catch (profileError) {
          console.error('Profile fetch error during auth change:', profileError)
          if (mounted) {
            setProfile(null)
          }
        }
      } else {
        if (mounted) {
          setProfile(null)
        }
      }
      
      if (mounted) {
        setLoading(false)
      }
    })

    // Initialize auth state
    initializeAuth()

    return () => {
      mounted = false
      if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId)
      }
      listener?.subscription.unsubscribe()
    }
  }, [retryCount])

  const userRole = (profile?.roles?.level || UserRole.USER) as UserRole

  const value = {
    session,
    user,
    profile,
    loading,
    userRole,
    hasRole: (minLevel: UserRole) => hasPermission(userRole, minLevel),
    isAdmin: () => userRole >= UserRole.ADMIN,
    isSuperAdmin: () => userRole >= UserRole.SUPER_ADMIN,
    refreshProfile,
    forceRetry,
    signIn: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    },
    signUp: async (email: string, password: string) => {
      const emailRedirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : (process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3001/auth/callback'
            : process.env.NEXT_PUBLIC_SUPABASE_URL_CALLBACK || 'https://socialhub.gestorlead.com.br/auth/callback'
          )
      
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: emailRedirectTo
        }
      })
      return { error }
    },
    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.error('Supabase signOut error:', error)
        }
        
        // Clear all possible authentication cookies explicitly
        const cookiesToClear = [
          'sb-localhost-auth-token',
          'sb-127.0.0.1-auth-token',
          'supabase-auth-token',
          'sh-login-success',
          'sh-login-timestamp'
        ]
        
        // Get hostname for dynamic cookie patterns
        const hostname = window.location.hostname
        cookiesToClear.push(`sb-${hostname}-auth-token`)
        
        // Clear each cookie with multiple domain/path combinations
        cookiesToClear.forEach(cookieName => {
          // Clear for current path
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          // Clear for root path
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${hostname}`
          // Clear for localhost
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=localhost`
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=127.0.0.1`
          }
        })
        
        // Clear any remaining Supabase cookies
        document.cookie.split(';').forEach(cookie => {
          const cookieName = cookie.split('=')[0].trim()
          if (cookieName.includes('supabase') || cookieName.includes('sb-') || cookieName.includes('auth')) {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${hostname}`
          }
        })
        
        // Clear local state
        setUser(null)
        setProfile(null)
        setSession(null)
        
        return { error }
      } catch (error) {
        
        // Clear local state even if there's an error
        setUser(null)
        setProfile(null)
        setSession(null)
        
        return { error }
      }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}