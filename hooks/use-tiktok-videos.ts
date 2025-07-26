import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { TikTokVideo, TikTokVideoApiResponse, TIKTOK_VIDEO_FIELDS } from '@/types/tiktok'
import { buildTikTokVideoQuery, transformTikTokApiResponse } from '@/lib/tiktok-api-utils'

interface UseTikTokVideosResult {
  videos: TikTokVideo[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor?: number
  fetchVideos: () => Promise<void>
  fetchMore: () => Promise<void>
  refetch: () => Promise<void>
}

export function useTikTokVideos(platformUserId: string | null): UseTikTokVideosResult {
  const { session } = useAuth()
  const [videos, setVideos] = useState<TikTokVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<number | undefined>()

  const fetchVideos = async (isLoadMore = false) => {
    if (!platformUserId || !session?.access_token) {
      const errorMsg = !platformUserId ? 'Platform user ID is required' : 'Authentication token is required'
      console.error('[TikTok Videos Hook]', errorMsg)
      setError(errorMsg)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Build query parameters for GET request
      const params = new URLSearchParams({
        platform_user_id: platformUserId,
        max_count: '20'
      })

      if (isLoadMore && cursor) {
        params.set('cursor', cursor.toString())
      }

      console.log('[TikTok Videos Hook] Request params:', params.toString())

      const response = await fetch(`/api/social/tiktok/videos?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })
      
      if (!response.ok) {
        let errorData
        let responseText = ''
        try {
          responseText = await response.text()
          console.log('[TikTok Videos Hook] Error response text:', responseText)
          errorData = responseText ? JSON.parse(responseText) : { error: 'Empty response' }
        } catch (parseError) {
          console.error('[TikTok Videos Hook] Failed to parse error response:', parseError)
          console.error('[TikTok Videos Hook] Raw error response:', responseText)
          errorData = { 
            error: `HTTP ${response.status}: ${response.statusText}`,
            raw_response: responseText,
            parse_error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
          }
        }
        console.error('[TikTok Videos Hook] API error details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          errorData,
          responseText
        })
        
        const errorMessage = errorData.error || errorData.message || `Failed to fetch videos (${response.status}: ${response.statusText})`
        throw new Error(errorMessage)
      }

      let apiResponse
      try {
        const text = await response.text()
        console.log('[TikTok Videos Hook] Raw response:', text.substring(0, 200) + '...')
        
        if (!text) {
          throw new Error('Empty response from server')
        }
        apiResponse = JSON.parse(text)
        console.log('[TikTok Videos Hook] Parsed response:', apiResponse)
      } catch (parseError) {
        console.error('[TikTok Videos Hook] Failed to parse response:', parseError)
        throw new Error('Invalid response format from server')
      }
      
      // Transform and validate API response
      const { videos: newVideos, cursor: newCursor, hasMore: more, error: apiError } = transformTikTokApiResponse(apiResponse)
      
      if (apiError) {
        throw new Error(apiError)
      }
      
      if (isLoadMore) {
        setVideos(prev => [...prev, ...newVideos])
      } else {
        setVideos(newVideos)
      }
      
      setHasMore(more)
      setCursor(newCursor)
      
    } catch (err) {
      console.error('Error fetching TikTok videos:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch videos'
      setError(errorMessage)
      
      // Reset state on error
      if (!isLoadMore) {
        setVideos([])
        setHasMore(false)
        setCursor(undefined)
      }
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

  const refetch = async () => {
    setCursor(undefined)
    await fetchVideos(false)
  }

  return {
    videos,
    loading,
    error,
    hasMore,
    cursor,
    fetchVideos: () => fetchVideos(false),
    fetchMore,
    refetch
  }
}