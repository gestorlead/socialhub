import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Get authorization token from request headers
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create Supabase client with user token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    // Verify the user token
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const platformUserId = searchParams.get('platform_user_id')
    const period = searchParams.get('period') || '30d'
    
    // Security: Use authenticated user's ID only
    const userId = user.id

    if (!platformUserId) {
      return NextResponse.json({ error: 'platform_user_id is required' }, { status: 400 })
    }

    // Calculate date range based on period
    const periodDays = {
      '7d': 7,
      '30d': 30,
      '60d': 60,
      '90d': 90
    }

    const days = periodDays[period as keyof typeof periodDays] || 30
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    // Fetch time series data
    const { data: timeSeriesData, error: timeSeriesError } = await supabase
      .from('tiktok_daily_stats')
      .select('date, follower_count, following_count, likes_count, video_count')
      .eq('user_id', userId)
      .eq('platform_user_id', platformUserId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (timeSeriesError) {
      console.error('Error fetching time series data:', timeSeriesError)
      return NextResponse.json({ error: 'Failed to fetch time series data' }, { status: 500 })
    }

    // Get current stats (latest available)
    const { data: currentStats, error: currentError } = await supabase
      .from('tiktok_daily_stats')
      .select('date, follower_count, following_count, likes_count, video_count')
      .eq('user_id', userId)
      .eq('platform_user_id', platformUserId)
      .order('date', { ascending: false })
      .limit(1)

    if (currentError) {
      console.error('Error fetching current stats:', currentError)
      return NextResponse.json({ error: 'Failed to fetch current stats' }, { status: 500 })
    }

    // Get previous period stats for comparison
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - days)

    const { data: previousStats, error: previousError } = await supabase
      .from('tiktok_daily_stats')
      .select('date, follower_count, following_count, likes_count, video_count')
      .eq('user_id', userId)
      .eq('platform_user_id', platformUserId)
      .gte('date', previousStartDate.toISOString().split('T')[0])
      .lt('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(1)

    if (previousError) {
      console.error('Error fetching previous stats:', previousError)
      // Don't return error, just set previous to null
    }

    // Calculate growth data
    const growthData = []
    if (timeSeriesData && timeSeriesData.length > 1) {
      for (let i = 1; i < timeSeriesData.length; i++) {
        const current = timeSeriesData[i]
        const previous = timeSeriesData[i - 1]
        
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
    }

    // Fallback to default values if no data
    const defaultStats = {
      date: new Date().toISOString().split('T')[0],
      follower_count: 0,
      following_count: 0,
      likes_count: 0,
      video_count: 0
    }

    const response = {
      current: currentStats?.[0] || defaultStats,
      previous: previousStats?.[0] || defaultStats,
      timeSeries: timeSeriesData || [],
      growth: growthData
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}