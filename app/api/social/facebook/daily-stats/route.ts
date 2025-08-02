import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('page_id')
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!pageId) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get the current user to ensure they own this page
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('facebook_daily_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_user_id', pageId)
      .order('date', { ascending: false })

    // Apply date filters
    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate)
    } else if (days) {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - days)
      query = query.gte('date', daysAgo.toISOString().split('T')[0])
    }

    const { data: stats, error } = await query.limit(days || 90)

    if (error) {
      console.error('Error fetching Facebook daily stats:', error)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Calculate growth trends and summary metrics
    const summary = calculateSummaryMetrics(stats || [])
    const trends = calculateTrends(stats || [])

    return NextResponse.json({
      success: true,
      page_id: pageId,
      period: { days, start_date: startDate, end_date: endDate },
      summary,
      trends,
      data: stats,
      total_records: stats?.length || 0,
      fetched_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Facebook daily stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Facebook daily stats' },
      { status: 500 }
    )
  }
}

function calculateSummaryMetrics(stats: any[]) {
  if (stats.length === 0) return {}

  const latest = stats[0] // Most recent (ordered by date desc)
  const oldest = stats[stats.length - 1]

  return {
    // Legacy metrics (deprecated - will be 0)
    current_fans: latest.page_fans || 0,
    fans_change: (latest.page_fans || 0) - (oldest.page_fans || 0),
    total_impressions: stats.reduce((sum, s) => sum + (s.page_impressions || 0), 0),
    avg_daily_impressions: Math.round(stats.reduce((sum, s) => sum + (s.page_impressions || 0), 0) / stats.length),
    total_reach: stats.reduce((sum, s) => sum + (s.page_reach || 0), 0),
    avg_daily_reach: Math.round(stats.reduce((sum, s) => sum + (s.page_reach || 0), 0) / stats.length),
    total_engagements: stats.reduce((sum, s) => sum + (s.page_post_engagements || 0), 0),
    avg_daily_engagements: Math.round(stats.reduce((sum, s) => sum + (s.page_post_engagements || 0), 0) / stats.length),
    total_video_views: stats.reduce((sum, s) => sum + (s.page_video_views || 0), 0),
    avg_daily_video_views: Math.round(stats.reduce((sum, s) => sum + (s.page_video_views || 0), 0) / stats.length),
    
    // ✅ NEW API v23.0 metrics (supported)
    total_impressions_unique: stats.reduce((sum, s) => sum + (s.page_impressions_unique || 0), 0),
    avg_daily_impressions_unique: Math.round(stats.reduce((sum, s) => sum + (s.page_impressions_unique || 0), 0) / stats.length),
    
    total_impressions_paid: stats.reduce((sum, s) => sum + (s.page_impressions_paid || 0), 0),
    avg_daily_impressions_paid: Math.round(stats.reduce((sum, s) => sum + (s.page_impressions_paid || 0), 0) / stats.length),
    
    total_video_ad_impressions: stats.reduce((sum, s) => sum + (s.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0), 0),
    avg_daily_video_ad_impressions: Math.round(stats.reduce((sum, s) => sum + (s.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0), 0) / stats.length),
    
    total_crosspost_video_ads: stats.reduce((sum, s) => sum + (s.total_video_ad_break_ad_impressions || 0), 0),
    avg_daily_crosspost_video_ads: Math.round(stats.reduce((sum, s) => sum + (s.total_video_ad_break_ad_impressions || 0), 0) / stats.length),
    
    engagement_rate: latest.page_fans > 0 
      ? Math.round(((latest.page_post_engagements || 0) / latest.page_fans) * 100 * 100) / 100
      : 0,
      
    period_days: stats.length
  }
}

function calculateTrends(stats: any[]) {
  if (stats.length < 2) return {}

  const latest = stats[0]
  const previous = stats[1]

  const calculateChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0
    return Math.round(((current - prev) / prev) * 100 * 100) / 100
  }

  return {
    // Legacy trends (deprecated metrics)
    fans_trend: calculateChange(latest.page_fans || 0, previous.page_fans || 0),
    impressions_trend: calculateChange(latest.page_impressions || 0, previous.page_impressions || 0),
    reach_trend: calculateChange(latest.page_reach || 0, previous.page_reach || 0),
    engagement_trend: calculateChange(latest.page_post_engagements || 0, previous.page_post_engagements || 0),
    video_views_trend: calculateChange(latest.page_video_views || 0, previous.page_video_views || 0),
    
    // ✅ NEW API v23.0 trends (supported metrics)
    impressions_unique_trend: calculateChange(latest.page_impressions_unique || 0, previous.page_impressions_unique || 0),
    impressions_paid_trend: calculateChange(latest.page_impressions_paid || 0, previous.page_impressions_paid || 0),
    video_ad_impressions_trend: calculateChange(latest.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0, previous.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0),
    total_video_ad_impressions_trend: calculateChange(latest.total_video_ad_break_ad_impressions || 0, previous.total_video_ad_break_ad_impressions || 0)
  }
}