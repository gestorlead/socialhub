import { useState, useEffect, useCallback } from 'react'
import { useSocialConnections } from '@/lib/hooks/use-social-connections'
import { useAuth } from '@/lib/supabase-auth-helpers'

interface InstagramDailyStat {
  id: string
  user_id: string
  platform_user_id: string
  date: string
  follower_count: number
  following_count: number
  media_count: number
  impressions: number
  reach: number
  profile_views: number
  created_at: string
  updated_at: string
  daily_growth?: {
    follower_growth: number
    following_growth: number
    media_growth: number
    impressions_growth: number
    reach_growth: number
    profile_views_growth: number
  }
}

interface InstagramStatsGrowth {
  followers: { current: number; change: number; changePercent: number }
  following: { current: number; change: number; changePercent: number }  
  media: { current: number; change: number; changePercent: number }
  impressions: { current: number; change: number; changePercent: number }
  reach: { current: number; change: number; changePercent: number }
  profileViews: { current: number; change: number; changePercent: number }
}

interface UseInstagramDailyStatsReturn {
  dailyStats: InstagramDailyStat[]
  growth: InstagramStatsGrowth | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

type Period = '7d' | '30d' | '60d' | '90d'

export function useInstagramDailyStats(period: Period = '30d'): UseInstagramDailyStatsReturn {
  const { user } = useAuth()
  const { getConnection } = useSocialConnections()
  const [dailyStats, setDailyStats] = useState<InstagramDailyStat[]>([])
  const [growth, setGrowth] = useState<InstagramStatsGrowth | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const instagramConnection = getConnection('instagram')
  const profile = instagramConnection?.profile_data

  const fetchDailyStats = useCallback(async () => {
    if (!user?.id || !profile?.id) {
      setError('User or Instagram connection not found')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '60d': 60,
        '90d': 90
      }
      
      startDate.setDate(endDate.getDate() - periodDays[period])

      // Build query parameters
      const params = new URLSearchParams({
        user_id: user.id,
        platform_user_id: profile.id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        limit: (periodDays[period] + 5).toString() // Add some buffer
      })

      const response = await fetch(`/api/social/instagram/daily-stats?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch daily stats: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch daily stats')
      }

      // Sort data chronologically (oldest first)
      const sortedStats = data.stats.sort((a: InstagramDailyStat, b: InstagramDailyStat) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      setDailyStats(sortedStats)

      // Calculate growth metrics
      if (sortedStats.length >= 2) {
        const latest = sortedStats[sortedStats.length - 1]
        const previous = sortedStats[0]
        
        const calculateGrowth = (current: number, previous: number) => {
          const change = current - previous
          const changePercent = previous > 0 ? (change / previous) * 100 : 0
          return { current, change, changePercent }
        }

        setGrowth({
          followers: calculateGrowth(latest.follower_count, previous.follower_count),
          following: calculateGrowth(latest.following_count, previous.following_count),
          media: calculateGrowth(latest.media_count, previous.media_count),
          impressions: calculateGrowth(latest.impressions, previous.impressions),
          reach: calculateGrowth(latest.reach, previous.reach),
          profileViews: calculateGrowth(latest.profile_views, previous.profile_views)
        })
      } else if (sortedStats.length === 1) {
        // Single data point, no growth calculation possible
        const latest = sortedStats[0]
        setGrowth({
          followers: { current: latest.follower_count, change: 0, changePercent: 0 },
          following: { current: latest.following_count, change: 0, changePercent: 0 },
          media: { current: latest.media_count, change: 0, changePercent: 0 },
          impressions: { current: latest.impressions, change: 0, changePercent: 0 },
          reach: { current: latest.reach, change: 0, changePercent: 0 },
          profileViews: { current: latest.profile_views, change: 0, changePercent: 0 }
        })
      }

    } catch (err: any) {
      console.error('Error fetching Instagram daily stats:', err)
      setError(err.message || 'Failed to fetch daily stats')
      
      // Fallback to current profile data if available
      if (profile) {
        setGrowth({
          followers: { current: profile.followers_count || 0, change: 0, changePercent: 0 },
          following: { current: profile.follows_count || 0, change: 0, changePercent: 0 },
          media: { current: profile.media_count || 0, change: 0, changePercent: 0 },
          impressions: { current: 0, change: 0, changePercent: 0 },
          reach: { current: 0, change: 0, changePercent: 0 },
          profileViews: { current: 0, change: 0, changePercent: 0 }
        })
      }
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.id, period])

  const refetch = useCallback(async () => {
    await fetchDailyStats()
  }, [fetchDailyStats])

  useEffect(() => {
    if (user?.id && profile?.id) {
      fetchDailyStats()
    }
  }, [fetchDailyStats])

  return {
    dailyStats,
    growth,
    loading,
    error,
    refetch
  }
}