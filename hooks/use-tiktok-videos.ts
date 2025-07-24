import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { TikTokVideo } from '@/types/tiktok'

interface UseTikTokVideosResult {
  videos: TikTokVideo[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor?: number
  fetchVideos: () => Promise<void>
  fetchMore: () => Promise<void>
}

export function useTikTokVideos(platformUserId: string | null): UseTikTokVideosResult {
  const { session } = useAuth()
  const [videos, setVideos] = useState<TikTokVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<number | undefined>()

  const fetchVideos = async (isLoadMore = false) => {
    console.log('[TikTok Videos Hook] Fetch called with:', { platformUserId, hasSession: !!session, hasToken: !!session?.access_token })
    
    if (!platformUserId || !session?.access_token) {
      const errorMsg = !platformUserId ? 'Platform user ID is required' : 'Authentication token is required'
      console.error('[TikTok Videos Hook]', errorMsg)
      setError(errorMsg)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        platform_user_id: platformUserId,
        max_count: '20'
      })

      if (isLoadMore && cursor) {
        params.append('cursor', cursor.toString())
      }

      console.log('[TikTok Videos Hook] Making request to API')
      const response = await fetch(`/api/social/tiktok/videos?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('[TikTok Videos Hook] Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('[TikTok Videos Hook] API error:', errorData)
        throw new Error(errorData.error || `Failed to fetch videos (${response.status})`)
      }

      const data = await response.json()
      
      if (isLoadMore) {
        setVideos(prev => [...prev, ...data.videos])
      } else {
        setVideos(data.videos)
      }
      
      setHasMore(data.has_more || false)
      setCursor(data.cursor)
    } catch (err) {
      console.error('Error fetching TikTok videos:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch videos')
    } finally {
      setLoading(false)
    }
  }

  const fetchMore = async () => {
    if (!hasMore || loading) return
    await fetchVideos(true)
  }

  useEffect(() => {
    if (platformUserId && session?.access_token) {
      fetchVideos()
    }
  }, [platformUserId, session?.access_token])

  return {
    videos,
    loading,
    error,
    hasMore,
    cursor,
    fetchVideos: () => fetchVideos(false),
    fetchMore
  }
}