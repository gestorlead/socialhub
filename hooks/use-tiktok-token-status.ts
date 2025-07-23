'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'

interface TokenStatus {
  status: 'valid' | 'expiring' | 'expired' | 'refresh_expired' | 'not_found'
  access_token_expires_at?: string
  refresh_token_expires_at?: string
  time_until_expiry?: { hours: number, minutes: number }
  needs_refresh: boolean
  needs_reconnect: boolean
}

export function useTikTokTokenStatus() {
  const { user } = useAuth()
  const [status, setStatus] = useState<TokenStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStatus = async () => {
    if (!user) {
      setStatus(null)
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/auth/tiktok/status?user_id=${user.id}`)
      const data = await response.json()
      
      if (response.ok) {
        setStatus(data)
      } else {
        console.error('Error fetching token status:', data.error)
        setStatus(null)
      }
    } catch (error) {
      console.error('Error fetching token status:', error)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshToken = async () => {
    if (!user || refreshing) return

    setRefreshing(true)
    try {
      const response = await fetch(`/api/auth/tiktok/status?user_id=${user.id}`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (response.ok) {
        setStatus(data)
        return { success: true, data }
      } else {
        console.error('Error refreshing token:', data.error)
        return { success: false, error: data.error }
      }
    } catch (error) {
      console.error('Error refreshing token:', error)
      return { success: false, error: 'Network error' }
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [user])

  return {
    status,
    loading,
    refreshing,
    refreshToken,
    refetch: fetchStatus
  }
}