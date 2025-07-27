import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'

export interface DailyStats {
  date: string
  follower_count: number
  following_count: number
  likes_count: number
  video_count: number
}

export interface GrowthData {
  date: string
  follower_growth: number
  likes_growth: number
  video_growth: number
  follower_growth_percent: number
  likes_growth_percent: number
  video_growth_percent: number
}

export interface AnalyticsData {
  current: DailyStats
  previous: DailyStats
  timeSeries: DailyStats[]
  growth: GrowthData[]
}

type Period = '7d' | '30d' | '60d' | '90d'

export function useAnalyticsData(platformUserId: string | undefined, period: Period) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth()

  useEffect(() => {
    if (!platformUserId || !session?.access_token) {
      setData(null)
      return
    }

    const fetchAnalytics = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/analytics/data?platform_user_id=${platformUserId}&period=${period}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Analytics response error:', errorText)
          throw new Error(`Failed to fetch analytics: ${response.statusText}`)
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error('Error fetching analytics:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [platformUserId, period, session?.access_token])

  const refetch = () => {
    if (platformUserId && session?.access_token) {
      const fetchAnalytics = async () => {
        setLoading(true)
        setError(null)
        
        try {
          const response = await fetch(`/api/analytics/data?platform_user_id=${platformUserId}&period=${period}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.statusText}`)
          }
          
          const result = await response.json()
          setData(result)
        } catch (err) {
          console.error('Error fetching analytics:', err)
          setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
          setLoading(false)
        }
      }

      fetchAnalytics()
    }
  }

  return { data, loading, error, refetch }
}

export function useGrowthCalculations(data: DailyStats[] | null) {
  return useState(() => {
    if (!data || data.length < 2) return []

    const growthData: GrowthData[] = []
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i]
      const previous = data[i - 1]
      
      const followerGrowth = current.follower_count - previous.follower_count
      const likesGrowth = current.likes_count - previous.likes_count
      const videoGrowth = current.video_count - previous.video_count
      
      const followerGrowthPercent = previous.follower_count > 0 
        ? (followerGrowth / previous.follower_count) * 100 
        : 0
      const likesGrowthPercent = previous.likes_count > 0 
        ? (likesGrowth / previous.likes_count) * 100 
        : 0
      const videoGrowthPercent = previous.video_count > 0 
        ? (videoGrowth / previous.video_count) * 100 
        : 0
      
      growthData.push({
        date: current.date,
        follower_growth: followerGrowth,
        likes_growth: likesGrowth,
        video_growth: videoGrowth,
        follower_growth_percent: followerGrowthPercent,
        likes_growth_percent: likesGrowthPercent,
        video_growth_percent: videoGrowthPercent
      })
    }
    
    return growthData
  })[0]
}

export function usePeriodComparison(
  currentData: DailyStats[] | null,
  period: Period
) {
  return useState(() => {
    if (!currentData || currentData.length === 0) return null

    const periodDays = {
      '7d': 7,
      '30d': 30,
      '60d': 60,
      '90d': 90
    }

    const days = periodDays[period]
    const current = currentData[currentData.length - 1]
    const periodStart = currentData[Math.max(0, currentData.length - days)]

    if (!current || !periodStart) return null

    return {
      current,
      periodStart,
      followerGrowth: current.follower_count - periodStart.follower_count,
      likesGrowth: current.likes_count - periodStart.likes_count,
      videoGrowth: current.video_count - periodStart.video_count,
      followerGrowthPercent: periodStart.follower_count > 0 
        ? ((current.follower_count - periodStart.follower_count) / periodStart.follower_count) * 100 
        : 0,
      likesGrowthPercent: periodStart.likes_count > 0 
        ? ((current.likes_count - periodStart.likes_count) / periodStart.likes_count) * 100 
        : 0,
      videoGrowthPercent: periodStart.video_count > 0 
        ? ((current.video_count - periodStart.video_count) / periodStart.video_count) * 100 
        : 0
    }
  })[0]
}