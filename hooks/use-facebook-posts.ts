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

export function useFacebookPosts(pageId: string | null): UseFacebookPostsReturn {
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
      // Build URL with pagination if loading more  
      // Note: Using absolute minimal fields to avoid ALL deprecation warnings
      // API v23.0 - only the most basic fields to prevent attachment-related deprecation
      let url = `https://graph.facebook.com/v23.0/${pageId}/posts?fields=id,message,created_time&limit=20&access_token=${currentPage.access_token}`
      
      if (loadMore && nextCursor) {
        url += `&after=${nextCursor}`
      }

      console.log('Facebook Posts API URL:', url.replace(currentPage.access_token, '[REDACTED]'))
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to fetch Facebook posts')
      }

      const data = await response.json()

      if (data.data) {
        const processedPosts: FacebookPost[] = data.data.map((post: any) => {
          // API v23.0: Likes and comments counts not available in basic posts call
          // Would need separate API calls to get engagement data
          const likesCount = 0 // Not available in simplified API call
          const commentsCount = 0 // Not available in simplified API call
          const sharesCount = 0 // Shares field deprecated in v23.0
          const engagementRate = 0 // Cannot calculate without engagement data

          return {
            id: post.id,
            message: post.message,
            created_time: post.created_time,
            likes_count: likesCount,
            comments_count: commentsCount,
            shares_count: sharesCount,
            engagement_rate: engagementRate,
            story: post.story || '', // May not be available in minimal call
            link: post.link || '', // May not be available in minimal call  
            permalink_url: post.permalink_url || '' // May not be available in minimal call
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
      console.error('Error fetching Facebook posts:', err)
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