'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'

export interface DailyStats {
  id: string
  user_id: string
  platform_user_id: string
  date: string
  follower_count: number
  following_count: number
  likes_count: number
  video_count: number
  created_at: string
  updated_at: string
  daily_growth?: {
    follower_growth: number
    following_growth: number
    likes_growth: number
    video_growth: number
  } | null
}

export interface StatsSummary {
  total_days: number
  date_range: {
    start: string
    end: string
  }
  latest: DailyStats
  oldest: DailyStats
  total_growth: {
    followers: number
    following: number
    likes: number
    videos: number
  } | null
  averages: {
    followers: number
    following: number
    likes: number
    videos: number
  }
}

export interface StatsInsights {
  period: {
    days: number
    start_date: string
    end_date: string
    data_points: number
  }
  current_stats: {
    followers: number
    following: number
    likes: number
    videos: number
  }
  total_growth: {
    followers: number
    following: number
    likes: number
    videos: number
  }
  growth_percentage: {
    followers: number
    following: number
    likes: number
    videos: number
  }
  avg_daily_growth: {
    followers: number
    following: number
    likes: number
    videos: number
  } | null
  trends: {
    followers: 'growing' | 'declining' | 'stable'
    following: 'growing' | 'declining' | 'stable'
    likes: 'growing' | 'declining' | 'stable'
    videos: 'growing' | 'declining' | 'stable'
  }
  insights: {
    is_accelerating: boolean
    best_day: any
    worst_day: any
    avg_engagement_rate: number
    consistency_score: number
  }
  chart_data: {
    daily_stats: Array<{
      date: string
      followers: number
      following: number
      likes: number
      videos: number
    }>
    daily_growth: Array<{
      date: string
      followers: number
      following: number
      likes: number
      videos: number
    }>
    engagement_rates: Array<{
      date: string
      rate: number
    }>
  }
}

export function useTikTokDailyStats(platformUserId?: string, options?: {
  startDate?: string
  endDate?: string
  limit?: number
}) {
  const { user } = useAuth()
  const [stats, setStats] = useState<DailyStats[]>([])
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        user_id: user.id,
        ...(platformUserId && { platform_user_id: platformUserId }),
        ...(options?.startDate && { start_date: options.startDate }),
        ...(options?.endDate && { end_date: options.endDate }),
        ...(options?.limit && { limit: options.limit.toString() })
      })

      const response = await fetch(`/api/social/tiktok/daily-stats?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch daily stats')
      }

      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats || [])
        setSummary(data.summary)
      } else {
        throw new Error(data.error || 'Failed to fetch stats')
      }
    } catch (err) {
      console.error('Error fetching daily stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [user, platformUserId, options?.startDate, options?.endDate, options?.limit])

  return {
    stats,
    summary,
    loading,
    error,
    refetch: fetchStats
  }
}

export function useTikTokStatsInsights(platformUserId?: string, period: number = 30) {
  const { user } = useAuth()
  const [insights, setInsights] = useState<StatsInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        user_id: user.id,
        period: period.toString(),
        ...(platformUserId && { platform_user_id: platformUserId })
      })

      const response = await fetch(`/api/social/tiktok/stats-summary?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats insights')
      }

      const data = await response.json()
      
      if (data.success) {
        setInsights(data.summary)
      } else {
        throw new Error(data.error || 'Failed to fetch insights')
      }
    } catch (err) {
      console.error('Error fetching stats insights:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [user, platformUserId, period])

  return {
    insights,
    loading,
    error,
    refetch: fetchInsights
  }
}

// Helper hook for common periods
export function useTikTokPeriodStats(platformUserId?: string) {
  const last7Days = useTikTokStatsInsights(platformUserId, 7)
  const last30Days = useTikTokStatsInsights(platformUserId, 30)
  const last90Days = useTikTokStatsInsights(platformUserId, 90)

  return {
    last7Days,
    last30Days,
    last90Days
  }
}