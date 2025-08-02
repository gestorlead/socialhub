import { useState, useEffect, useCallback } from 'react'
import { useSocialConnections } from '@/lib/hooks/use-social-connections'

interface FacebookPost {
  id: string
  message?: string
  created_time: string
  likes_count: number
  comments_count: number
  shares_count: number
  engagement_rate: number
  story?: string
  link?: string
  permalink_url?: string
}

interface UseFacebookPostsReturn {
  posts: FacebookPost[]
  loading: boolean
  error: string | null
  hasMore: boolean
  fetchMore: () => Promise<void>
  refetch: () => Promise<void>
}

export function useFacebookPostsV2(pageId: string | null): UseFacebookPostsReturn {
  const { getConnection } = useSocialConnections()
  const [posts, setPosts] = useState<FacebookPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const facebookConnection = getConnection('facebook')
  const pages = facebookConnection?.profile_data?.pages || []
  const currentPage = pages.find((p: any) => p.id === pageId)

  const fetchPosts = useCallback(async (loadMore = false) => {
    if (!facebookConnection?.access_token || !pageId || !currentPage) {
      setError('Facebook connection or page not found')
      return
    }

    if (!loadMore) {
      setLoading(true)
    }
    setError(null)

    try {
      // Ultra-minimal API call to avoid ANY deprecation issues
      // Facebook API v23.0 - Only the most basic fields
      let url = `https://graph.facebook.com/v23.0/${pageId}/posts?fields=id,message,created_time&limit=20&access_token=${currentPage.access_token}`
      
      if (loadMore && nextCursor) {
        url += `&after=${nextCursor}`
      }

      console.log('[Facebook Posts v2] Making API call...')
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Facebook Posts v2] API Error:', errorData)
        throw new Error(errorData.error?.message || 'Failed to fetch Facebook posts')
      }

      const data = await response.json()
      console.log('[Facebook Posts v2] API Response received:', data.data?.length, 'posts')

      if (data.data) {
        const processedPosts: FacebookPost[] = data.data.map((post: any) => {
          return {
            id: post.id,
            message: post.message || '',
            created_time: post.created_time,
            likes_count: 0, // Not available in minimal API call
            comments_count: 0, // Not available in minimal API call
            shares_count: 0, // Deprecated in v23.0
            engagement_rate: 0, // Cannot calculate without engagement data
            story: '',
            link: '',
            permalink_url: `https://www.facebook.com/${post.id}`
          }
        })

        if (loadMore) {
          setPosts(prev => [...prev, ...processedPosts])
        } else {
          setPosts(processedPosts)
        }

        // Check if there's more data to load
        if (data.paging?.next && data.paging?.cursors?.after) {
          setNextCursor(data.paging.cursors.after)
          setHasMore(true)
        } else {
          setHasMore(false)
          setNextCursor(null)
        }
      }

    } catch (err: any) {
      console.error('[Facebook Posts v2] Error:', err)
      setError(err.message || 'Failed to fetch Facebook posts')

      // Check if error is related to permissions
      if (err.message?.includes('permission') || err.message?.includes('OAuthException')) {
        setError('Permissões insuficientes. Reconecte sua conta do Facebook com as permissões necessárias.')
      } else if (err.message?.includes('does not have permission')) {
        setError('Aplicativo não tem permissão para acessar os posts desta página.')
      }
    } finally {
      if (!loadMore) {
        setLoading(false)
      }
    }
  }, [facebookConnection, pageId, currentPage, nextCursor])

  const fetchMore = useCallback(async () => {
    if (!hasMore || loading) return
    await fetchPosts(true)
  }, [fetchPosts, hasMore, loading])

  const refetch = useCallback(async () => {
    setNextCursor(null)
    setHasMore(true)
    await fetchPosts(false)
  }, [fetchPosts])

  useEffect(() => {
    if (facebookConnection && pageId && currentPage) {
      setPosts([])
      setNextCursor(null)
      setHasMore(true)
      fetchPosts(false)
    }
  }, [facebookConnection, pageId, currentPage])

  return {
    posts,
    loading,
    error,
    hasMore,
    fetchMore,
    refetch
  }
}