import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/social/threads/metrics - Get comprehensive metrics for Threads account
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const since = searchParams.get('since') // Unix timestamp
    const until = searchParams.get('until') // Unix timestamp
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get current connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'threads')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Threads connection found' },
        { status: 404 }
      )
    }

    const threadsUserId = connection.platform_user_id
    const accessToken = connection.access_token

    // Check token expiry
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Access token expired. Please reconnect your account.' },
        { status: 401 }
      )
    }

    const metrics = {
      profile: {},
      posts: [],
      insights: {},
      summary: {
        total_posts: 0,
        total_likes: 0,
        total_replies: 0,
        total_reposts: 0,
        total_quotes: 0,
        total_views: 0,
        followers_count: 0,
        following_count: 0
      }
    }

    try {
      // 1. Get basic profile information
      console.log('Fetching basic profile data...')
      const profileUrl = `https://graph.threads.net/v1.0/${threadsUserId}?fields=id,username,name,threads_profile_picture_url,threads_biography,is_verified`
      const profileResponse = await fetch(profileUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (profileResponse.ok) {
        metrics.profile = await profileResponse.json()
        console.log('Basic profile data:', JSON.stringify(metrics.profile, null, 2))
        console.log('🔍 Checking follower_count field:', {
          'follower_count': metrics.profile.follower_count,
          'has_follower_count': 'follower_count' in metrics.profile,
          'typeof_follower_count': typeof metrics.profile.follower_count
        })
      } else {
        const errorData = await profileResponse.json().catch(() => ({}))
        console.error('❌ Profile API failed:', {
          status: profileResponse.status,
          statusText: profileResponse.statusText,
          error: errorData
        })
      }

      // 2. Try Profile Discovery API for public metrics (requires 1K+ followers)
      console.log('Attempting Profile Discovery API...')
      const discoveryUrl = `https://graph.threads.net/v1.0/threads_profile_discovery?username=${metrics.profile.username}&fields=follower_count,likes_count,quotes_count,reposts_count,views_count,is_verified`
      const discoveryResponse = await fetch(discoveryUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (discoveryResponse.ok) {
        const discoveryData = await discoveryResponse.json()
        console.log('Profile Discovery data:', discoveryData)
        // Merge discovery data with profile data
        metrics.profile = { ...metrics.profile, ...discoveryData }
      } else {
        const discoveryError = await discoveryResponse.json().catch(() => ({}))
        console.log('Profile Discovery not available:', discoveryError.error?.message || 'Unknown error')
      }

      // 3. Try User Insights API for detailed metrics
      console.log('Attempting User Insights API...')
      let insightsUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads_insights?metric=likes,replies,reposts,quotes,views&period=day`
      
      // Add since/until parameters if provided
      if (since && until) {
        insightsUrl += `&since=${since}&until=${until}`
        console.log(`Using time range: ${since} to ${until}`)
      }
      
      const insightsResponse = await fetch(insightsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      // 4. Try to get followers count via insights API (always use lifetime for followers)
      console.log('Attempting Followers Count via Insights API...')
      const followersUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads_insights?metric=followers_count&period=lifetime`
      const followersResponse = await fetch(followersUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json()
        console.log('User Insights data:', JSON.stringify(insightsData, null, 2))
        console.log('📅 Time range applied:', since && until ? `${since} to ${until}` : 'No time range (default period)')
        
        // Process insights data - handle both period and total_value formats
        if (insightsData.data && Array.isArray(insightsData.data)) {
          const processedInsights = insightsData.data.reduce((acc: any, item: any) => {
            if (item.total_value && item.total_value.value !== undefined) {
              // Handle total_value format (likes)
              acc[item.name] = item.total_value.value
            } else if (item.values && item.values.length > 0) {
              // Handle values array format (views per day) - sum all values
              if (item.period === 'day') {
                acc[`${item.name}_daily`] = item.values
                acc[item.name] = item.values.reduce((sum: number, val: any) => sum + (val.value || 0), 0)
              } else {
                acc[item.name] = item.values[0].value || 0
              }
            }
            return acc
          }, {})
          
          console.log('Processed insights:', processedInsights)
          metrics.insights = processedInsights
        }
      } else {
        const insightsError = await insightsResponse.json().catch(() => ({}))
        console.log('User Insights not available:', insightsError.error?.message || 'Permission may be required')
      }

      // Process followers count from insights API
      if (followersResponse.ok) {
        const followersData = await followersResponse.json()
        console.log('🎯 Followers Count data:', JSON.stringify(followersData, null, 2))
        
        if (followersData.data && Array.isArray(followersData.data) && followersData.data.length > 0) {
          const followersItem = followersData.data[0]
          if (followersItem.total_value && followersItem.total_value.value !== undefined) {
            metrics.insights.followers_count = followersItem.total_value.value
            console.log('✅ Successfully retrieved followers_count:', followersItem.total_value.value)
          }
        }
      } else {
        const followersError = await followersResponse.json().catch(() => ({}))
        console.log('❌ Followers Count not available:', followersError.error?.message || 'Permission may be required')
      }

      // 4. Get user's recent threads/posts (simplified - just count them)
      console.log('Fetching user threads...')
      const threadsUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads?fields=id,text,timestamp&limit=100`
      const threadsResponse = await fetch(threadsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (threadsResponse.ok) {
        const threadsData = await threadsResponse.json()
        metrics.posts = threadsData.data || []
        metrics.summary.total_posts = metrics.posts.length
        console.log(`Found ${metrics.posts.length} posts`)
        
        // Try to get more posts by following pagination
        let nextUrl = threadsData.paging?.next
        let totalPosts = metrics.posts.length
        
        // Get up to 200 more posts to have a better count
        while (nextUrl && totalPosts < 300) {
          try {
            const nextResponse = await fetch(nextUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            })
            
            if (nextResponse.ok) {
              const nextData = await nextResponse.json()
              if (nextData.data && nextData.data.length > 0) {
                metrics.posts = [...metrics.posts, ...nextData.data]
                totalPosts += nextData.data.length
                nextUrl = nextData.paging?.next
                console.log(`Total posts found so far: ${totalPosts}`)
              } else {
                break
              }
            } else {
              break
            }
          } catch (error) {
            console.warn('Error fetching more posts:', error)
            break
          }
        }
        
        metrics.summary.total_posts = totalPosts
        console.log(`Final post count: ${totalPosts}`)
      }

      // 5. Update summary with all available data sources
      console.log('Consolidating metrics from all sources...')
      console.log('🔍 All data sources for follower_count:', {
        'metrics.profile.follower_count': metrics.profile.follower_count,
        'metrics.insights.followers_count': metrics.insights.followers_count,
        'connection.profile_data?.followers_count': connection.profile_data?.followers_count
      })
      
      // Use insights followers_count as primary source
      metrics.summary.followers_count = metrics.insights.followers_count || 
                                       metrics.profile.follower_count || 
                                       connection.profile_data?.followers_count || 0
                                       
      console.log('📊 Final followers_count assigned:', metrics.summary.followers_count)
                                       
      metrics.summary.total_likes = metrics.profile.likes_count || 
                                   metrics.insights.likes || 
                                   connection.profile_data?.total_likes || 0
                                   
      metrics.summary.total_views = metrics.profile.views_count || 
                                   metrics.insights.views || 
                                   connection.profile_data?.total_views || 0
                                   
      metrics.summary.total_reposts = metrics.profile.reposts_count || 
                                     metrics.insights.reposts || 
                                     connection.profile_data?.total_reposts || 0
                                     
      metrics.summary.total_quotes = metrics.profile.quotes_count || 
                                    metrics.insights.quotes || 
                                    connection.profile_data?.total_quotes || 0
                                    
      metrics.summary.total_replies = metrics.insights.replies || 
                                     connection.profile_data?.replies_count || 0

      // Following count is not available via any API
      metrics.summary.following_count = connection.profile_data?.following_count || 0

      console.log('Final summary metrics:', metrics.summary)

      // Update database with latest metrics from all sources
      const updatedProfileData = {
        ...connection.profile_data,
        ...metrics.profile,
        posts_count: metrics.summary.total_posts,
        followers_count: metrics.summary.followers_count,
        follower_count: metrics.profile.follower_count, // Keep API field name too
        following_count: metrics.summary.following_count,
        replies_count: metrics.summary.total_replies,
        total_likes: metrics.summary.total_likes,
        total_views: metrics.summary.total_views,
        total_reposts: metrics.summary.total_reposts,
        total_quotes: metrics.summary.total_quotes,
        // Keep original API field names for reference
        likes_count: metrics.profile.likes_count,
        views_count: metrics.profile.views_count,
        reposts_count: metrics.profile.reposts_count,
        quotes_count: metrics.profile.quotes_count,
        // Add insights data with individual fields for easy access
        insights_data: metrics.insights,
        insights_likes: metrics.insights?.likes || 0,
        insights_views: metrics.insights?.views || 0,
        insights_replies: metrics.insights?.replies || 0,
        insights_reposts: metrics.insights?.reposts || 0,
        insights_quotes: metrics.insights?.quotes || 0,
        views_daily: metrics.insights?.views_daily || [],
        last_metrics_update: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('social_connections')
        .update({
          profile_data: updatedProfileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('platform', 'threads')

      if (updateError) {
        console.error('Failed to update metrics in database:', updateError)
      }

      return NextResponse.json({
        success: true,
        data: metrics,
        updated_profile: updatedProfileData
      })

    } catch (error: any) {
      console.error('Error fetching Threads metrics:', error)
      return NextResponse.json(
        { 
          error: 'Failed to fetch metrics',
          details: error.message 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Threads metrics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}