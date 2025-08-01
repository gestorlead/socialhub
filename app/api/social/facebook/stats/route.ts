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

    const supabase = createClient()

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
    let metricsToFetch = []
    
    if (metric === 'all') {
      metricsToFetch = [
        'page_engaged_users',
        'page_post_engagements', 
        'page_impressions',
        'page_reach',
        'page_video_views',
        'page_fans',
        'page_fan_adds',
        'page_fan_removes'
      ]
    } else {
      metricsToFetch = [metric]
    }

    const insights = {}
    
    // Fetch insights for each metric
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

    // Get recent posts performance
    const postsResponse = await fetch(
      `https://graph.facebook.com/v23.0/${targetPage.id}/posts?fields=id,message,created_time,likes.summary(true),comments.summary(true),shares&limit=10&access_token=${targetPage.access_token}`
    )

    let recentPosts = []
    if (postsResponse.ok) {
      const postsData = await postsResponse.json()
      if (postsData.data) {
        recentPosts = postsData.data.map((post: any) => ({
          id: post.id,
          message: post.message?.substring(0, 100) + (post.message?.length > 100 ? '...' : ''),
          created_time: post.created_time,
          likes_count: post.likes?.summary?.total_count || 0,
          comments_count: post.comments?.summary?.total_count || 0,
          shares_count: post.shares?.count || 0,
          engagement_rate: ((post.likes?.summary?.total_count || 0) + 
                          (post.comments?.summary?.total_count || 0) + 
                          (post.shares?.count || 0))
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