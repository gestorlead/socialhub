import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const platformUserId = searchParams.get('platform_user_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 30

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Build query
    let query = supabase
      .from('tiktok_daily_stats')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit)

    // Add platform_user_id filter if provided
    if (platformUserId) {
      query = query.eq('platform_user_id', platformUserId)
    }

    // Add date range filters if provided
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data: stats, error } = await query

    if (error) {
      console.error('Error fetching daily stats:', error)
      return NextResponse.json({ error: 'Failed to fetch daily stats' }, { status: 500 })
    }

    // Calculate additional metrics
    const processedStats = stats.map((stat, index) => {
      const prevStat = stats[index + 1] // Next item in reverse chronological order
      
      const dailyGrowth = prevStat ? {
        follower_growth: stat.follower_count - prevStat.follower_count,
        following_growth: stat.following_count - prevStat.following_count,
        likes_growth: stat.likes_count - prevStat.likes_count,
        video_growth: stat.video_count - prevStat.video_count
      } : null

      return {
        ...stat,
        daily_growth: dailyGrowth
      }
    })

    // Calculate summary metrics
    const summary = stats.length > 0 ? {
      total_days: stats.length,
      date_range: {
        start: stats[stats.length - 1]?.date,
        end: stats[0]?.date
      },
      latest: stats[0],
      oldest: stats[stats.length - 1],
      total_growth: stats.length > 1 ? {
        followers: stats[0].follower_count - stats[stats.length - 1].follower_count,
        following: stats[0].following_count - stats[stats.length - 1].following_count,
        likes: stats[0].likes_count - stats[stats.length - 1].likes_count,
        videos: stats[0].video_count - stats[stats.length - 1].video_count
      } : null,
      averages: {
        followers: Math.round(stats.reduce((sum, s) => sum + s.follower_count, 0) / stats.length),
        following: Math.round(stats.reduce((sum, s) => sum + s.following_count, 0) / stats.length),
        likes: Math.round(stats.reduce((sum, s) => sum + s.likes_count, 0) / stats.length),
        videos: Math.round(stats.reduce((sum, s) => sum + s.video_count, 0) / stats.length)
      }
    } : null

    return NextResponse.json({
      success: true,
      stats: processedStats,
      summary,
      count: stats.length
    })

  } catch (error) {
    console.error('Daily stats API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}