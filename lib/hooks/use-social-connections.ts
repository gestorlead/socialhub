'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { createClient } from '@/utils/supabase/client'

export interface SocialConnection {
  id: string
  platform: string
  platform_user_id: string
  access_token?: string
  refresh_token?: string
  scope?: string
  expires_at?: string
  is_active: boolean
  profile_data: {
    display_name?: string
    username?: string
    avatar_url?: string
    [key: string]: any
  }
  created_at: string
  updated_at: string
}

export function useSocialConnections(includeInactive = false) {
  const { user } = useAuth()
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchConnections = async () => {
    if (!user) {
      setConnections([])
      setLoading(false)
      return
    }

    try {
      let query = supabase
        .from('social_connections')
        .select('id, platform, platform_user_id, access_token, refresh_token, scope, expires_at, is_active, profile_data, created_at, updated_at')
        .eq('user_id', user.id)

      // Filter only active connections unless explicitly requested to include inactive
      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching social connections:', error)
        return
      }

      console.log('=== FETCHED SOCIAL CONNECTIONS ===')
      console.log('Raw data from Supabase:', JSON.stringify(data, null, 2))
      
      // Debug YouTube connection specifically
      const youtubeConnection = data?.find(conn => conn.platform === 'youtube')
      if (youtubeConnection) {
        console.log('=== YOUTUBE CONNECTION DEBUG ===')
        console.log('YouTube profile_data:', JSON.stringify(youtubeConnection.profile_data, null, 2))
        console.log('Subscriber count:', youtubeConnection.profile_data?.subscriber_count)
        console.log('Video count:', youtubeConnection.profile_data?.video_count)
        console.log('View count:', youtubeConnection.profile_data?.view_count)
      }
      
      setConnections(data || [])
    } catch (error) {
      console.error('Error fetching social connections:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [user])

  const isConnected = (platform: string) => {
    return connections.some(conn => conn.platform === platform && conn.is_active)
  }

  const getConnection = (platform: string) => {
    return connections.find(conn => conn.platform === platform)
  }

  const connectTikTok = async () => {
    if (!user) {
      throw new Error('User must be logged in to connect TikTok')
    }

    // Redirect to TikTok OAuth
    window.location.href = `/api/auth/tiktok?user_id=${user.id}`
  }

  const connectInstagram = async () => {
    if (!user) {
      throw new Error('User must be logged in to connect Instagram')
    }

    try {
      // Get Instagram OAuth URL from the API
      const response = await fetch(`/api/auth/instagram?user_id=${user.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Instagram OAuth')
      }

      if (data.success && data.auth_url) {
        // Redirect to Instagram OAuth
        window.location.href = data.auth_url
      } else {
        throw new Error('Invalid response from Instagram OAuth endpoint')
      }
    } catch (error) {
      console.error('Error connecting Instagram:', error)
      throw error
    }
  }

  const connectFacebook = async () => {
    if (!user) {
      throw new Error('User must be logged in to connect Facebook')
    }

    try {
      // Get Facebook OAuth URL from the API
      const response = await fetch(`/api/auth/facebook?user_id=${user.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Facebook OAuth')
      }

      if (data.success && data.auth_url) {
        // Redirect to Facebook OAuth
        window.location.href = data.auth_url
      } else {
        throw new Error('Invalid response from Facebook OAuth endpoint')
      }
    } catch (error) {
      console.error('Error connecting Facebook:', error)
      throw error
    }
  }

  const connectThreads = async () => {
    if (!user) {
      throw new Error('User must be logged in to connect Threads')
    }

    try {
      // Get Threads OAuth URL from the API
      const response = await fetch(`/api/auth/threads?user_id=${user.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Threads OAuth')
      }

      if (data.success && data.auth_url) {
        // Redirect to Threads OAuth
        window.location.href = data.auth_url
      } else {
        throw new Error('Invalid response from Threads OAuth endpoint')
      }
    } catch (error) {
      console.error('Error connecting Threads:', error)
      throw error
    }
  }

  const connectYouTube = async () => {
    if (!user) {
      throw new Error('User must be logged in to connect YouTube')
    }

    try {
      // Get YouTube OAuth URL from the API
      const response = await fetch(`/api/auth/youtube?user_id=${user.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate YouTube OAuth')
      }

      if (data.success && data.auth_url) {
        // Redirect to YouTube OAuth
        window.location.href = data.auth_url
      } else {
        throw new Error('Invalid response from YouTube OAuth endpoint')
      }
    } catch (error) {
      console.error('Error connecting YouTube:', error)
      throw error
    }
  }

  const connectX = async () => {
    if (!user) {
      throw new Error('User must be logged in to connect X')
    }

    try {
      // Get X OAuth URL from the API
      const response = await fetch(`/api/auth/x?user_id=${user.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate X OAuth')
      }

      if (data.authorization_url) {
        // Redirect to X OAuth
        window.location.href = data.authorization_url
      } else {
        throw new Error('Invalid response from X OAuth endpoint')
      }
    } catch (error) {
      console.error('Error connecting X:', error)
      throw error
    }
  }

  const disconnect = async (platform: string) => {
    if (!user) {
      throw new Error('User must be logged in')
    }

    try {
      const { error } = await supabase
        .from('social_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', platform)

      if (error) {
        throw error
      }

      // Refresh connections
      await fetchConnections()
    } catch (error) {
      console.error('Error disconnecting platform:', error)
      throw error
    }
  }

  return {
    connections,
    loading,
    isConnected,
    getConnection,
    connectTikTok,
    connectInstagram,
    connectFacebook,
    connectThreads,
    connectYouTube,
    connectX,
    disconnect,
    refresh: fetchConnections
  }
}