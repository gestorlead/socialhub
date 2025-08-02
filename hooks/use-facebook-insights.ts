import { useState, useEffect, useCallback } from 'react'
import { useSocialConnections } from '@/lib/hooks/use-social-connections'
import { useAuth } from '@/lib/supabase-auth-helpers'

interface FacebookPageInsights {
  // Updated for API v23.0 - only supported metrics
  page_impressions_unique: number
  page_impressions_paid: number
  page_daily_video_ad_break_ad_impressions_by_crosspost_status: number
  total_video_ad_break_ad_impressions: number
}

interface FacebookMetrics {
  impressions_unique: {
    current: number
    change: number
    changePercent: number
  }
  impressions_paid: {
    current: number
    change: number
    changePercent: number
  }
  video_ad_impressions: {
    current: number
    change: number
    changePercent: number
  }
  total_video_ad_impressions: {
    current: number
    change: number
    changePercent: number
  }
}

interface FacebookPost {
  id: string
  message?: string
  created_time: string
  likes_count: number
  comments_count: number
  shares_count: number
  engagement_rate: number
}

interface UseFacebookInsightsReturn {
  pageInsights: FacebookPageInsights | null
  metrics: FacebookMetrics | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

type Period = '7d' | '30d' | '60d' | '90d'

const PERIOD_MAPPING = {
  '7d': 'day',
  '30d': 'week',
  '60d': 'days_28',
  '90d': 'week'
}

export function useFacebookInsights(pageId: string | null, period: Period = '30d'): UseFacebookInsightsReturn {
  const { user } = useAuth()
  const { getConnection } = useSocialConnections()
  const [pageInsights, setPageInsights] = useState<FacebookPageInsights | null>(null)
  const [metrics, setMetrics] = useState<FacebookMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const facebookConnection = getConnection('facebook')
  const pages = facebookConnection?.profile_data?.pages || []
  const currentPage = pages.find((p: any) => p.id === pageId)

  const fetchInsights = useCallback(async () => {
    if (!user?.id || !facebookConnection?.access_token || !pageId || !currentPage) {
      setError('Facebook connection or page not found')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch insights from our API which handles the Facebook API calls
      const response = await fetch(
        `/api/social/facebook/stats?user_id=${user.id}&page_id=${pageId}&period=${PERIOD_MAPPING[period]}&metric=all`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch Facebook insights')
      }

      const data = await response.json()

      // Process insights data
      if (data.insights) {
        const processedInsights: FacebookPageInsights = {
          // Updated for API v23.0 - only supported metrics
          page_impressions_unique: 0,
          page_impressions_paid: 0,
          page_daily_video_ad_break_ad_impressions_by_crosspost_status: 0,
          total_video_ad_break_ad_impressions: 0
        }

        // Sum up values for each metric across the period
        Object.keys(data.insights).forEach(metricName => {
          const metric = data.insights[metricName]
          if (metric.values && metric.values.length > 0) {
            const totalValue = metric.values.reduce((sum: number, item: any) => sum + (item.value || 0), 0)
            processedInsights[metricName as keyof FacebookPageInsights] = totalValue
          }
        })

        setPageInsights(processedInsights)

        // Calculate metrics with period comparison - Updated for new metrics
        const calculatedMetrics: FacebookMetrics = {
          impressions_unique: {
            current: processedInsights.page_impressions_unique || 0,
            change: 0, // Would need historical data for accurate change
            changePercent: 0
          },
          impressions_paid: {
            current: processedInsights.page_impressions_paid || 0,
            change: 0, // Would need historical data for accurate change
            changePercent: 0
          },
          video_ad_impressions: {
            current: processedInsights.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0,
            change: 0, // Would need historical data for accurate change
            changePercent: 0
          },
          total_video_ad_impressions: {
            current: processedInsights.total_video_ad_break_ad_impressions || 0,
            change: 0, // Would need historical data for accurate change
            changePercent: 0
          }
        }

        // Note: With API v23.0 updates, engagement metrics are no longer available
        // Historical data comparison would need to be implemented using daily_stats_summary from the API

        setMetrics(calculatedMetrics)
      }

    } catch (err: any) {
      console.error('Error fetching Facebook insights:', err)
      setError(err.message || 'Failed to fetch Facebook insights')

      // Check if error is related to permissions
      if (err.message?.includes('permission') || err.message?.includes('OAuthException')) {
        setError('Permissões insuficientes. Reconecte sua conta do Facebook com as permissões necessárias.')
      }
    } finally {
      setLoading(false)
    }
  }, [user, facebookConnection, pageId, currentPage, period])

  const refetch = useCallback(async () => {
    await fetchInsights()
  }, [fetchInsights])

  useEffect(() => {
    if (user?.id && facebookConnection && pageId && currentPage) {
      fetchInsights()
    }
  }, [fetchInsights])

  return {
    pageInsights,
    metrics,
    loading,
    error,
    refetch
  }
}