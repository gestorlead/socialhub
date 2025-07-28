'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { Profile, UserRole, hasPermission } from './types/auth'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  userRole: UserRole
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithOAuth: (provider: 'google' | 'facebook' | 'github') => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  hasRole: (minLevel: UserRole) => boolean
  isAdmin: () => boolean
  isSuperAdmin: () => boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      console.log('[Auth] Fetching profile for user:', userId)
      
      // First try without roles to see if basic profile exists
      const { data: basicProfile, error: basicError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (basicError) {
        console.error('[Auth] Error fetching basic profile:', basicError)
        
        // If profile doesn't exist, create one
        if (basicError.code === 'PGRST116') {
          console.log('[Auth] Profile not found, creating new profile')
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              full_name: null,
              avatar_url: null,
              role_id: null
            })
            .select()
            .single()

          if (createError) {
            console.error('[Auth] Error creating profile:', createError)
            return null
          }
          
          console.log('[Auth] Profile created successfully')
          return newProfile as Profile
        }
        
        return null
      }

      // Now try to get the full profile with roles
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
        .eq('id', userId)
        .single()

      if (error) {
        console.error('[Auth] Error fetching profile with roles:', error)
        // Return basic profile if roles query fails
        return basicProfile as Profile
      }

      console.log('[Auth] Profile fetched successfully')
      return data
    } catch (error) {
      console.error('[Auth] Unexpected error in fetchProfile:', error)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  useEffect(() => {
    const setData = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        setProfile(profileData)
      } else {
        setProfile(null)
      }
      
      setLoading(false)
    }

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state change:', _event, session?.user?.email, window.location.pathname)
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        setProfile(profileData)
      } else {
        setProfile(null)
      }
      
      setLoading(false)
      
      // Let middleware handle redirects - removing client-side redirect to avoid conflicts
      // This prevents race conditions between server and client-side navigation
    })

    setData()

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [])

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
    signIn: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    },
    signInWithOAuth: async (provider: 'google' | 'facebook' | 'github') => {
      const redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : process.env.NEXT_PUBLIC_SUPABASE_URL_CALLBACK || 'https://socialhub.gestorlead.com.br/auth/callback'
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo
        }
      })
      return { error }
    },
    signUp: async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_SUPABASE_URL_CALLBACK || `${window.location.origin}/auth/callback`
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
        
        console.log('✅ Logout completed - all cookies cleared')
        return { error }
      } catch (error) {
        console.error('SignOut error:', error)
        
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