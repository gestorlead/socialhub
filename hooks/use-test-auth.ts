import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'

export function useTestAuth() {
  const { session } = useAuth()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testAuth = async () => {
    console.log('[Test Auth] Starting test, session:', !!session, 'token:', !!session?.access_token)
    
    if (!session?.access_token) {
      setError('No session or access token')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('[Test Auth] Making request to test API')
      const response = await fetch('/api/social/tiktok/videos-new', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('[Test Auth] Response status:', response.status)
      const data = await response.json()
      console.log('[Test Auth] Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      setResult(data)
    } catch (err) {
      console.error('[Test Auth] Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.access_token) {
      testAuth()
    }
  }, [session?.access_token])

  return { result, loading, error, testAuth }
}