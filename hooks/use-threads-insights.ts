import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { useSocialConnections } from '@/lib/hooks/use-social-connections'

export interface ThreadsProfile {
  id: string
  username: string
  name: string
  threads_profile_picture_url?: string
  threads_biography?: string
  is_verified: boolean
  posts_count: number
  followers_count?: number
  follower_count?: number
  following_count?: number
  // Insights data
  insights_likes: number
  insights_views: number
  insights_replies: number
  insights_reposts: number
  insights_quotes?: number
  total_likes?: number
  total_views?: number
  total_reposts?: number
  replies_count?: number
  // Daily views breakdown
  views_daily?: Array<{
    end_time: string
    value: number
  }>
  last_metrics_update?: string
}

export interface ThreadsMetrics {
  posts: {
    current: number
    change: number
    changePercent: number
  }
  likes: {
    current: number
    change: number
    changePercent: number
  }
  views: {
    current: number
    change: number
    changePercent: number
  }
  replies: {
    current: number
    change: number
    changePercent: number
  }
  reposts: {
    current: number
    change: number
    changePercent: number
  }
  followers: {
    current: number
    change: number
    changePercent: number
    available: boolean
  }
}

export interface ThreadsInsightsData {
  profile: ThreadsProfile | null
  metrics: ThreadsMetrics | null
  engagementRate: number
  viewsPerPost: number
  replyRate: number
}

type Period = '7d' | '30d' | '60d' | '90d'

export function useThreadsInsights(period: Period = '30d') {
  const [data, setData] = useState<ThreadsInsightsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { getConnection, refresh } = useSocialConnections()

  const fetchInsights = async () => {
    if (!user) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Calculate since/until timestamps based on period
      const now = Math.floor(Date.now() / 1000) // Current timestamp
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '60d': 60,
        '90d': 90
      }
      
      const daysAgo = periodDays[period]
      const since = now - (daysAgo * 24 * 60 * 60) // X days ago
      const until = now
      
      console.log(`Fetching insights for period: ${period} (${since} to ${until})`)
      
      // Get fresh metrics from the API with time range
      const metricsResponse = await fetch(
        `/api/social/threads/metrics?user_id=${user.id}&since=${since}&until=${until}`
      )
      
      if (!metricsResponse.ok) {
        throw new Error('Failed to fetch Threads metrics')
      }

      const metricsData = await metricsResponse.json()
      
      // Refresh the connection to get updated profile data
      await refresh()
      
      // Get the updated connection
      const threadsConnection = getConnection('threads')
      const profile = threadsConnection?.profile_data

      if (!profile) {
        throw new Error('No Threads connection found')
      }

      // Process the data into our format
      const processedData = processThreadsData(profile, period)
      setData(processedData)

    } catch (err) {
      console.error('Error fetching Threads insights:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch insights')
      
      // Try to use cached data from connection
      const threadsConnection = getConnection('threads')
      if (threadsConnection?.profile_data) {
        const processedData = processThreadsData(threadsConnection.profile_data, period)
        setData(processedData)
      }
    } finally {
      setLoading(false)
    }
  }

  // Process raw profile data into structured insights
  const processThreadsData = (profile: any, selectedPeriod: Period): ThreadsInsightsData => {
    const posts = profile.posts_count || 0
    const likes = profile.insights_likes || profile.total_likes || 0
    const views = profile.insights_views || profile.total_views || 0
    const replies = profile.insights_replies || profile.replies_count || 0
    const reposts = profile.insights_reposts || profile.total_reposts || 0
    const followers = profile.followers_count || profile.follower_count || 0

    // Calculate engagement metrics
    const totalEngagement = likes + replies + reposts
    const engagementRate = posts > 0 ? totalEngagement / posts : 0
    const viewsPerPost = posts > 0 ? views / posts : 0
    const replyRate = posts > 0 ? (replies / posts) * 100 : 0

    // For now, we don't have historical data for comparison
    // TODO: Implement historical data comparison when available
    const metrics: ThreadsMetrics = {
      posts: {
        current: posts,
        change: 0,
        changePercent: 0
      },
      likes: {
        current: likes,
        change: 0,
        changePercent: 0
      },
      views: {
        current: views,
        change: 0,
        changePercent: 0
      },
      replies: {
        current: replies,
        change: 0,
        changePercent: 0
      },
      reposts: {
        current: reposts,
        change: 0,
        changePercent: 0
      },
      followers: {
        current: followers,
        change: 0,
        changePercent: 0,
        available: followers > 0 // Only available if we have follower data
      }
    }

    return {
      profile: profile as ThreadsProfile,
      metrics,
      engagementRate,
      viewsPerPost,
      replyRate
    }
  }

  // Refresh insights (useful for manual refresh)
  const refetch = async () => {
    await fetchInsights()
  }

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    fetchInsights()
  }, [user?.id, period])

  // Helper to get insights availability status
  const getInsightsStatus = () => {
    if (!data?.profile) return null
    
    const hasInsights = (data.profile.insights_likes || 0) > 0 || 
                       (data.profile.insights_views || 0) > 0 ||
                       (data.profile.insights_replies || 0) > 0 ||
                       (data.profile.insights_reposts || 0) > 0

    return {
      available: hasInsights,
      hasViewsDaily: data.profile.views_daily && data.profile.views_daily.length > 0,
      lastUpdate: data.profile.last_metrics_update,
      totalMetrics: {
        likes: data.profile.insights_likes || 0,
        views: data.profile.insights_views || 0,
        replies: data.profile.insights_replies || 0,
        reposts: data.profile.insights_reposts || 0
      }
    }
  }

  return {
    data,
    loading,
    error,
    refetch,
    fetchInsights,
    insightsStatus: getInsightsStatus()
  }
}