import { useState, useEffect } from 'react'

interface FacebookDailyStats {
  id: string
  user_id: string
  platform_user_id: string
  date: string
  
  // Basic fan metrics
  page_fans: number
  page_fan_adds: number
  page_fan_removes: number
  
  // Impressions and reach
  page_impressions: number
  page_impressions_unique: number
  page_impressions_paid: number
  page_impressions_organic: number
  page_reach: number
  
  // Engagement metrics
  page_engaged_users: number
  page_post_engagements: number
  page_consumptions: number
  page_consumptions_unique: number
  page_negative_feedback: number
  page_places_checkin_total: number
  
  // Video metrics
  page_video_views: number
  page_video_views_paid: number
  page_video_views_organic: number
  page_video_complete_views_30s: number
  
  // Post-level metrics
  page_posts_impressions: number
  page_posts_impressions_unique: number
  page_posts_impressions_paid: number
  page_posts_impressions_organic: number
  
  // Demographic data (JSON)
  page_fans_country: any
  page_fans_city: any
  page_fans_locale: any
  page_fans_gender_age: any
  
  // Online fans
  page_fans_online: number
  
  created_at: string
  updated_at: string
}

interface SummaryMetrics {
  current_fans: number
  fans_change: number
  total_impressions: number
  avg_daily_impressions: number
  total_reach: number
  avg_daily_reach: number
  total_engagements: number
  avg_daily_engagements: number
  total_video_views: number
  avg_daily_video_views: number
  engagement_rate: number
  period_days: number
}

interface TrendMetrics {
  fans_trend: number
  impressions_trend: number
  reach_trend: number
  engagement_trend: number
  video_views_trend: number
}

interface FacebookDailyStatsResponse {
  success: boolean
  page_id: string
  period: {
    days?: number
    start_date?: string
    end_date?: string
  }
  summary: SummaryMetrics
  trends: TrendMetrics
  data: FacebookDailyStats[]
  total_records: number
  fetched_at: string
}

interface UseFacebookDailyStatsOptions {
  pageId: string
  days?: number
  startDate?: string
  endDate?: string
  enabled?: boolean
}

export function useFacebookDailyStats({
  pageId,
  days = 30,
  startDate,
  endDate,
  enabled = true
}: UseFacebookDailyStatsOptions) {
  const [data, setData] = useState<FacebookDailyStatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fetchDailyStats = async () => {
    if (!pageId || !enabled) return
    
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({ page_id: pageId })
      
      if (startDate && endDate) {
        params.append('start_date', startDate)
        params.append('end_date', endDate)
      } else if (days) {
        params.append('days', days.toString())
      }
      
      const response = await fetch(`/api/social/facebook/daily-stats?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch daily stats')
      }
      
      setData(result)
    } catch (err) {
      console.error('Error fetching Facebook daily stats:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchDailyStats()
  }, [pageId, days, startDate, endDate, enabled])
  
  const refetch = () => {
    fetchDailyStats()
  }
  
  return {
    data: data?.data || [],
    summary: data?.summary || null,
    trends: data?.trends || null,
    loading,
    error,
    refetch,
    totalRecords: data?.total_records || 0,
    period: data?.period || null,
    fetchedAt: data?.fetched_at || null
  }
}

// Export individual types for use in components
export type { FacebookDailyStats, SummaryMetrics, TrendMetrics, FacebookDailyStatsResponse }