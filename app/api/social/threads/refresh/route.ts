import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/social/threads/refresh - Refresh profile data
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
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

    try {
      // Get updated profile data with all available fields including insights
      const profileUrl = `https://graph.threads.net/v1.0/${threadsUserId}?fields=id,username,name,threads_profile_picture_url,threads_biography`
      const profileResponse = await fetch(profileUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      // Also try to get insights/metrics if available
      const insightsUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads_insights?metric=views,likes,replies,reposts,quotes&period=day`
      const insightsResponse = await fetch(insightsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }).catch(() => null) // Don't fail if insights are not available

      if (!profileResponse.ok) {
        const errorData = await profileResponse.json().catch(() => ({}))
        console.error('Failed to fetch profile:', errorData)
        return NextResponse.json(
          { error: 'Failed to refresh profile data' },
          { status: 500 }
        )
      }

      const profileData = await profileResponse.json()
      console.log('Profile data fetched:', profileData)

      // Process insights data if available
      let insightsData = {}
      if (insightsResponse && insightsResponse.ok) {
        try {
          const insights = await insightsResponse.json()
          console.log('Insights data fetched:', insights)
          
          // Process insights into readable format
          if (insights.data) {
            insightsData = insights.data.reduce((acc: any, item: any) => {
              acc[item.name] = item.values?.[0]?.value || 0
              return acc
            }, {})
          }
        } catch (error) {
          console.warn('Failed to process insights data:', error)
        }
      }

      // Try to get user's threads/posts for counting
      const threadsUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads?fields=id&limit=1`
      let postsCount = 0
      try {
        const threadsResponse = await fetch(threadsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        if (threadsResponse.ok) {
          const threadsData = await threadsResponse.json()
          // This would give us a sample, but we need to use paging info for total count
          postsCount = threadsData.paging?.cursors ? threadsData.data?.length || 0 : 0
        }
      } catch (error) {
        console.warn('Failed to fetch threads count:', error)
      }

      // Update connection with new profile data
      const updatedProfileData = {
        ...connection.profile_data,
        ...profileData,
        ...insightsData,
        posts_count: postsCount,
        followers_count: profileData.followers_count || connection.profile_data?.followers_count || 0,
        following_count: profileData.following_count || connection.profile_data?.following_count || 0,
        replies_count: insightsData.replies || connection.profile_data?.replies_count || 0,
        last_refreshed: new Date().toISOString()
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
        console.error('Failed to update profile data:', updateError)
        return NextResponse.json(
          { error: 'Failed to save refreshed data' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        profile_data: updatedProfileData,
        message: 'Profile data refreshed successfully'
      })

    } catch (error: any) {
      console.error('Error refreshing Threads profile:', error)
      return NextResponse.json(
        { error: 'Failed to refresh profile data' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Threads profile refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}