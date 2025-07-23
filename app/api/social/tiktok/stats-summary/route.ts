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
    const period = searchParams.get('period') || '30' // days

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const periodDays = parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)
    const startDateStr = startDate.toISOString().split('T')[0]

    // Build query for the specified period
    let query = supabase
      .from('tiktok_daily_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .order('date', { ascending: true })

    if (platformUserId) {
      query = query.eq('platform_user_id', platformUserId)
    }

    const { data: stats, error } = await query

    if (error) {
      console.error('Error fetching stats summary:', error)
      return NextResponse.json({ error: 'Failed to fetch stats summary' }, { status: 500 })
    }

    if (!stats || stats.length === 0) {
      return NextResponse.json({
        success: true,
        summary: null,
        message: 'No data available for the specified period'
      })
    }

    // Calculate trends and insights
    const firstStat = stats[0]
    const lastStat = stats[stats.length - 1]
    const midPoint = Math.floor(stats.length / 2)
    const midStat = stats[midPoint]

    const totalGrowth = {
      followers: lastStat.follower_count - firstStat.follower_count,
      following: lastStat.following_count - firstStat.following_count,
      likes: lastStat.likes_count - firstStat.likes_count,
      videos: lastStat.video_count - firstStat.video_count
    }

    const totalGrowthPercentage = {
      followers: firstStat.follower_count > 0 ? ((totalGrowth.followers / firstStat.follower_count) * 100) : 0,
      following: firstStat.following_count > 0 ? ((totalGrowth.following / firstStat.following_count) * 100) : 0,
      likes: firstStat.likes_count > 0 ? ((totalGrowth.likes / firstStat.likes_count) * 100) : 0,
      videos: firstStat.video_count > 0 ? ((totalGrowth.videos / firstStat.video_count) * 100) : 0
    }

    // Calculate daily averages
    const dailyGrowthData = []
    for (let i = 1; i < stats.length; i++) {
      const current = stats[i]
      const previous = stats[i - 1]
      dailyGrowthData.push({
        date: current.date,
        followers: current.follower_count - previous.follower_count,
        following: current.following_count - previous.following_count,
        likes: current.likes_count - previous.likes_count,
        videos: current.video_count - previous.video_count
      })
    }

    const avgDailyGrowth = dailyGrowthData.length > 0 ? {
      followers: Math.round(dailyGrowthData.reduce((sum, d) => sum + d.followers, 0) / dailyGrowthData.length * 100) / 100,
      following: Math.round(dailyGrowthData.reduce((sum, d) => sum + d.following, 0) / dailyGrowthData.length * 100) / 100,
      likes: Math.round(dailyGrowthData.reduce((sum, d) => sum + d.likes, 0) / dailyGrowthData.length * 100) / 100,
      videos: Math.round(dailyGrowthData.reduce((sum, d) => sum + d.videos, 0) / dailyGrowthData.length * 100) / 100
    } : null

    // Find best and worst days
    const bestDay = dailyGrowthData.reduce((best, day) => 
      (day.followers + day.likes) > (best.followers + best.likes) ? day : best, 
      dailyGrowthData[0] || { followers: 0, likes: 0, date: null }
    )

    const worstDay = dailyGrowthData.reduce((worst, day) => 
      (day.followers + day.likes) < (worst.followers + worst.likes) ? day : worst, 
      dailyGrowthData[0] || { followers: 0, likes: 0, date: null }
    )

    // Calculate velocity (acceleration)
    const firstHalfGrowth = midStat.follower_count - firstStat.follower_count
    const secondHalfGrowth = lastStat.follower_count - midStat.follower_count
    const isAccelerating = secondHalfGrowth > firstHalfGrowth

    // Determine trends
    const trends = {
      followers: totalGrowth.followers > 0 ? 'growing' : totalGrowth.followers < 0 ? 'declining' : 'stable',
      following: totalGrowth.following > 0 ? 'growing' : totalGrowth.following < 0 ? 'declining' : 'stable',
      likes: totalGrowth.likes > 0 ? 'growing' : totalGrowth.likes < 0 ? 'declining' : 'stable',
      videos: totalGrowth.videos > 0 ? 'growing' : totalGrowth.videos < 0 ? 'declining' : 'stable'
    }

    // Calculate engagement rate trend
    const engagementRates = stats.map(stat => ({
      date: stat.date,
      rate: stat.follower_count > 0 ? (stat.likes_count / stat.follower_count) : 0
    }))

    const avgEngagement = engagementRates.reduce((sum, er) => sum + er.rate, 0) / engagementRates.length

    const summary = {
      period: {
        days: periodDays,
        start_date: firstStat.date,
        end_date: lastStat.date,
        data_points: stats.length
      },
      current_stats: {
        followers: lastStat.follower_count,
        following: lastStat.following_count,
        likes: lastStat.likes_count,
        videos: lastStat.video_count
      },
      total_growth: totalGrowth,
      growth_percentage: {
        followers: Math.round(totalGrowthPercentage.followers * 100) / 100,
        following: Math.round(totalGrowthPercentage.following * 100) / 100,
        likes: Math.round(totalGrowthPercentage.likes * 100) / 100,
        videos: Math.round(totalGrowthPercentage.videos * 100) / 100
      },
      avg_daily_growth: avgDailyGrowth,
      trends,
      insights: {
        is_accelerating: isAccelerating,
        best_day: bestDay,
        worst_day: worstDay,
        avg_engagement_rate: Math.round(avgEngagement * 1000) / 1000,
        consistency_score: calculateConsistencyScore(dailyGrowthData)
      },
      chart_data: {
        daily_stats: stats.map(stat => ({
          date: stat.date,
          followers: stat.follower_count,
          following: stat.following_count,
          likes: stat.likes_count,
          videos: stat.video_count
        })),
        daily_growth: dailyGrowthData,
        engagement_rates: engagementRates
      }
    }

    return NextResponse.json({
      success: true,
      summary
    })

  } catch (error) {
    console.error('Stats summary API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to calculate consistency score
function calculateConsistencyScore(dailyGrowthData: any[]): number {
  if (dailyGrowthData.length === 0) return 0
  
  const followerGrowths = dailyGrowthData.map(d => d.followers)
  const mean = followerGrowths.reduce((sum, val) => sum + val, 0) / followerGrowths.length
  const variance = followerGrowths.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / followerGrowths.length
  const standardDeviation = Math.sqrt(variance)
  
  // Lower standard deviation = higher consistency
  // Normalize to 0-100 scale (arbitrary scaling)
  const consistencyScore = Math.max(0, 100 - (standardDeviation * 10))
  return Math.round(consistencyScore * 100) / 100
}