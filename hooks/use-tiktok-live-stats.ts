'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'

export interface TikTokStats {
  follower_count: number
  following_count: number
  likes_count: number
  video_count: number
}

export interface TikTokStatsComparison {
  current: TikTokStats
  previous: TikTokStats
  changes: {
    follower_count: 'up' | 'down' | 'same'
    following_count: 'up' | 'down' | 'same'
    likes_count: 'up' | 'down' | 'same'
    video_count: 'up' | 'down' | 'same'
  }
  differences: {
    follower_count: number
    following_count: number
    likes_count: number
    video_count: number
  }
}

export function useTikTokLiveStats(previousStats: TikTokStats | null) {
  const { user } = useAuth()
  const [liveStats, setLiveStats] = useState<TikTokStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<TikTokStatsComparison | null>(null)

  const fetchLiveStats = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/social/tiktok/live-stats?user_id=${user.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch live stats')
      }

      const data = await response.json()
      
      if (data.success && data.stats) {
        setLiveStats(data.stats)
        
        // Calculate comparison if we have previous stats
        if (previousStats) {
          const changes = {
            follower_count: data.stats.follower_count > previousStats.follower_count ? 'up' : 
                           data.stats.follower_count < previousStats.follower_count ? 'down' : 'same',
            following_count: data.stats.following_count > previousStats.following_count ? 'up' : 
                            data.stats.following_count < previousStats.following_count ? 'down' : 'same',
            likes_count: data.stats.likes_count > previousStats.likes_count ? 'up' : 
                        data.stats.likes_count < previousStats.likes_count ? 'down' : 'same',
            video_count: data.stats.video_count > previousStats.video_count ? 'up' : 
                        data.stats.video_count < previousStats.video_count ? 'down' : 'same'
          } as const

          const differences = {
            follower_count: data.stats.follower_count - previousStats.follower_count,
            following_count: data.stats.following_count - previousStats.following_count,
            likes_count: data.stats.likes_count - previousStats.likes_count,
            video_count: data.stats.video_count - previousStats.video_count
          }

          setComparison({
            current: data.stats,
            previous: previousStats,
            changes,
            differences
          })
        }
      }
    } catch (err) {
      console.error('Error fetching live stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLiveStats()
  }, [user])

  return {
    liveStats,
    comparison,
    loading,
    error,
    refetch: fetchLiveStats
  }
}