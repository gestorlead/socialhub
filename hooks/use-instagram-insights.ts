import { useState, useEffect, useCallback } from 'react'
import { useSocialConnections } from '@/lib/hooks/use-social-connections'

interface InstagramAccountInsights {
  impressions: number
  reach: number
  profile_views: number
}

interface InstagramMediaInsight {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  permalink: string
  timestamp: string
  insights: {
    engagement: number
    impressions: number
    reach: number
    likes?: number
    comments?: number
  }
}

interface UseInstagramInsightsReturn {
  accountInsights: InstagramAccountInsights | null
  mediaInsights: InstagramMediaInsight[]
  loading: boolean
  error: string | null
  hasMinimumFollowers: boolean
  refetch: () => Promise<void>
}

type Period = '7d' | '30d' | '60d' | '90d'

const PERIOD_MAPPING = {
  '7d': 'day',
  '30d': 'week', 
  '60d': 'days_28',
  '90d': 'week'
}

export function useInstagramInsights(period: Period = '30d'): UseInstagramInsightsReturn {
  const { getConnection } = useSocialConnections()
  const [accountInsights, setAccountInsights] = useState<InstagramAccountInsights | null>(null)
  const [mediaInsights, setMediaInsights] = useState<InstagramMediaInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMinimumFollowers, setHasMinimumFollowers] = useState(true)

  const instagramConnection = getConnection('instagram')
  const profile = instagramConnection?.profile_data

  const fetchInsights = useCallback(async () => {
    if (!instagramConnection?.access_token || !profile?.id) {
      setError('Instagram connection not found')
      return
    }

    // Check if account has minimum 100 followers for insights
    if ((profile.followers_count || 0) < 100) {
      setHasMinimumFollowers(false)
      setError('Instagram Insights require at least 100 followers')
      return
    }

    setLoading(true)
    setError(null)
    setHasMinimumFollowers(true)

    try {
      // Calculate date range based on period
      const endDate = new Date()
      const startDate = new Date()
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(endDate.getDate() - 30)
          break
        case '60d':
          startDate.setDate(endDate.getDate() - 60)
          break
        case '90d':
          startDate.setDate(endDate.getDate() - 90)
          break
      }

      const since = Math.floor(startDate.getTime() / 1000)
      const until = Math.floor(endDate.getTime() / 1000)
      const periodParam = PERIOD_MAPPING[period]

      // Fetch account insights - using only valid metrics for Instagram Business accounts
      const accountInsightsResponse = await fetch(
        `https://graph.instagram.com/${profile.id}/insights?metric=reach,profile_views&period=${periodParam}&since=${since}&until=${until}&access_token=${instagramConnection.access_token}`
      )

      if (!accountInsightsResponse.ok) {
        const errorData = await accountInsightsResponse.json()
        throw new Error(errorData.error?.message || 'Failed to fetch account insights')
      }

      const accountData = await accountInsightsResponse.json()
      
      // Process account insights
      const processedAccountInsights: InstagramAccountInsights = {
        impressions: 0, // Will be calculated from media insights
        reach: 0,
        profile_views: 0
      }

      if (accountData.data) {
        accountData.data.forEach((metric: any) => {
          const totalValue = metric.values.reduce((sum: number, value: any) => sum + (value.value || 0), 0)
          switch (metric.name) {
            case 'reach':
              processedAccountInsights.reach = totalValue
              break
            case 'profile_views':
              processedAccountInsights.profile_views = totalValue
              break
          }
        })
      }

      // Fetch recent media for media insights
      const mediaResponse = await fetch(
        `https://graph.instagram.com/${profile.id}/media?fields=id,caption,media_type,media_url,permalink,timestamp&limit=20&access_token=${instagramConnection.access_token}`
      )

      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json()
        const mediaWithInsights: InstagramMediaInsight[] = []

        // Fetch insights for each media item
        for (const media of mediaData.data || []) {
          try {
            const mediaInsightsResponse = await fetch(
              `https://graph.instagram.com/${media.id}/insights?metric=engagement,impressions,reach&access_token=${instagramConnection.access_token}`
            )

            if (mediaInsightsResponse.ok) {
              const insightsData = await mediaInsightsResponse.json()
              const insights = {
                engagement: 0,
                impressions: 0,
                reach: 0
              }

              if (insightsData.data) {
                insightsData.data.forEach((metric: any) => {
                  insights[metric.name as keyof typeof insights] = metric.values[0]?.value || 0
                })
              }

              mediaWithInsights.push({
                ...media,
                insights
              })
            }
          } catch (error) {
            console.warn(`Failed to fetch insights for media ${media.id}:`, error)
            // Add media without insights
            mediaWithInsights.push({
              ...media,
              insights: {
                engagement: 0,
                impressions: 0,
                reach: 0
              }
            })
          }
        }

        setMediaInsights(mediaWithInsights)
        
        // Calculate total impressions from media insights
        const totalImpressions = mediaWithInsights.reduce((sum, media) => sum + media.insights.impressions, 0)
        processedAccountInsights.impressions = totalImpressions
        setAccountInsights(processedAccountInsights)
      }

    } catch (err: any) {
      console.error('Error fetching Instagram insights:', err)
      setError(err.message || 'Failed to fetch Instagram insights')
      
      // Check if error is related to insufficient permissions or account requirements
      if (err.message?.includes('permission') || err.message?.includes('insufficient')) {
        setError('Permissões insuficientes. A conta Instagram precisa ser reconectada com permissões de Business Insights. Desconecte e conecte novamente a conta.')
      } else if (err.message?.includes('100')) {
        setHasMinimumFollowers(false)
        setError('Instagram Insights require at least 100 followers')
      } else if (err.message?.includes('does not have permission')) {
        setError('Aplicativo não tem permissão para esta ação. A conta Instagram precisa ser reconectada com as permissões corretas.')
      }
    } finally {
      setLoading(false)
    }
  }, [instagramConnection, profile, period])

  const refetch = useCallback(async () => {
    await fetchInsights()
  }, [fetchInsights])

  useEffect(() => {
    if (instagramConnection && profile?.id) {
      fetchInsights()
    }
  }, [fetchInsights])

  return {
    accountInsights,
    mediaInsights,
    loading,
    error,
    hasMinimumFollowers,
    refetch
  }
}