"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Session } from '@supabase/supabase-js'

/**
 * Hook to handle session synchronization and delays
 * Helps prevent middleware/client desync issues
 */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const initSession = async () => {
      try {
        // Wait a bit for potential session recovery
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const { data: { session: currentSession }, error } = await supabase.auth.getSession()
        
        if (mounted) {
          setSession(currentSession)
          setLoading(false)
          
          // Wait a bit more to ensure middleware has time to sync
          setTimeout(() => {
            if (mounted) {
              setIsReady(true)
            }
          }, 200)
        }
        
        if (error) {
          console.error('Session initialization error:', error)
        }
      } catch (error) {
        console.error('Unexpected session error:', error)
        if (mounted) {
          setLoading(false)
          setIsReady(true)
        }
      }
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state change:', event, !!newSession)
        
        if (mounted) {
          setSession(newSession)
          setLoading(false)
          
          // Give middleware time to sync on auth changes
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setTimeout(() => {
              if (mounted) {
                setIsReady(true)
              }
            }, 300)
          } else {
            setIsReady(true)
          }
        }
      }
    )

    initSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    loading,
    isReady,
    isAuthenticated: !!session && isReady
  }
}