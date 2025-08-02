import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const pageId = searchParams.get('page_id')
    const period = searchParams.get('period') || 'day' // day, week, days_28
    const metric = searchParams.get('metric') || 'all'
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get Facebook connection
    const { data: connection, error } = await supabase
      .from('social_connections')
      .select('access_token, profile_data')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Facebook connection not found' }, { status: 404 })
    }

    const pages = connection.profile_data?.pages || []
    
    // If page_id is specified, use only that page, otherwise use first page
    let targetPage
    if (pageId) {
      targetPage = pages.find((p: any) => p.id === pageId)
    } else {
      targetPage = pages[0]
    }
    
    if (!targetPage || !targetPage.access_token) {
      return NextResponse.json({ error: 'Page not found or no access token' }, { status: 404 })
    }

    // Define metrics to fetch based on request
    // Updated to use only supported metrics as of API v23.0
    // Many metrics were deprecated on November 1, 2025
    let metricsToFetch = []
    
    if (metric === 'all') {
      metricsToFetch = [
        // Core impressions metrics (confirmed supported)
        'page_impressions_unique',
        'page_impressions_paid',
        
        // Video Ad Break metrics (if applicable)
        'page_daily_video_ad_break_ad_impressions_by_crosspost_status',
        'total_video_ad_break_ad_impressions'
      ]
    } else {
      metricsToFetch = [metric]
    }

    const insights = {}
    
    // Try to fetch from daily stats first (for historical consistency)
    const { data: dailyStats } = await supabase
      .from('facebook_daily_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('platform_user_id', targetPage.id)
      .order('date', { ascending: false })
      .limit(7) // Last 7 days for trends

    // Fetch live insights for each metric
    for (const metricName of metricsToFetch) {
      try {
        const insightsResponse = await fetch(
          `https://graph.facebook.com/v23.0/${targetPage.id}/insights?metric=${metricName}&period=${period}&access_token=${targetPage.access_token}`
        )
        
        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json()
          
          if (insightsData.data && insightsData.data.length > 0) {
            const metricData = insightsData.data[0]
            insights[metricName] = {
              name: metricData.name,
              title: metricData.title,
              description: metricData.description,
              values: metricData.values,
              period: metricData.period
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch metric ${metricName}:`, error)
      }
    }

    // Add daily stats summary if available
    let dailyStatsSummary = null
    if (dailyStats && dailyStats.length > 0) {
      const latest = dailyStats[0]
      const previous = dailyStats[1]
      
      const calculateChange = (current: number, prev: number) => {
        if (!prev || prev === 0) return current > 0 ? 100 : 0
        return Math.round(((current - prev) / prev) * 100 * 100) / 100
      }

      dailyStatsSummary = {
        latest_date: latest.date,
        current_metrics: {
          // Using only available metrics from daily stats
          impressions_unique: latest.page_impressions_unique || 0,
          impressions_paid: latest.page_impressions_paid || 0,
          video_ad_impressions: latest.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0,
          total_video_ad_impressions: latest.total_video_ad_break_ad_impressions || 0
        },
        trends: previous ? {
          impressions_unique_change: calculateChange(latest.page_impressions_unique || 0, previous.page_impressions_unique || 0),
          impressions_paid_change: calculateChange(latest.page_impressions_paid || 0, previous.page_impressions_paid || 0),
          video_ad_impressions_change: calculateChange(latest.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0, previous.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0),
          total_video_ad_impressions_change: calculateChange(latest.total_video_ad_break_ad_impressions || 0, previous.total_video_ad_break_ad_impressions || 0)
        } : null
      }
    }

    // Get recent posts performance
    // Note: Simplified to avoid deprecation warnings in Facebook API v23.0
    // Complex nested fields like likes.summary() may trigger deprecation errors
    const postsResponse = await fetch(
      `https://graph.facebook.com/v23.0/${targetPage.id}/posts?fields=id,message,created_time&limit=10&access_token=${targetPage.access_token}`
    )

    let recentPosts = []
    if (postsResponse.ok) {
      const postsData = await postsResponse.json()
      if (postsData.data) {
        recentPosts = postsData.data.map((post: any) => ({
          id: post.id,
          message: post.message?.substring(0, 100) + (post.message?.length > 100 ? '...' : ''),
          created_time: post.created_time,
          likes_count: 0, // Not available in simplified API call
          comments_count: 0, // Not available in simplified API call
          shares_count: 0, // Shares field deprecated in v23.0
          engagement_rate: 0 // Cannot calculate without engagement data
        }))
      }
    }

    // Calculate summary metrics
    const summary = {
      total_fans: targetPage.fan_count || 0,
      total_followers: targetPage.followers_count || 0,
      page_name: targetPage.name,
      page_category: targetPage.category,
      is_published: targetPage.is_published,
      recent_posts_count: recentPosts.length,
      avg_engagement: recentPosts.length > 0 
        ? Math.round(recentPosts.reduce((sum, post) => sum + post.engagement_rate, 0) / recentPosts.length)
        : 0
    }

    return NextResponse.json({
      success: true,
      page_id: targetPage.id,
      page_name: targetPage.name,
      period: period,
      summary: summary,
      insights: insights,
      daily_stats_summary: dailyStatsSummary,
      recent_posts: recentPosts,
      fetched_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Facebook stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Facebook stats' },
      { status: 500 }
    )
  }
}