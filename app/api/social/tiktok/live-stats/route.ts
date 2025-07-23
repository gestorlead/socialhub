import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get a valid access token (auto-refresh if needed)
    const accessToken = await TikTokTokenManager.getValidAccessToken(userId)
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Could not obtain valid access token' }, { status: 401 })
    }

    // Fetch only stats fields from TikTok API
    const profileUrl = new URL('https://open.tiktokapis.com/v2/user/info/')
    profileUrl.searchParams.append('fields', [
      'open_id',
      'follower_count',
      'following_count',
      'likes_count',
      'video_count'
    ].join(','))
    
    const profileResponse = await fetch(profileUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text()
      console.error('Failed to fetch TikTok stats:', profileResponse.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch stats', details: errorText }, { status: 500 })
    }

    const profileData = await profileResponse.json()
    
    // Handle API v2 response structure
    let stats = {}
    if (profileData.data?.user) {
      const user = profileData.data.user
      stats = {
        follower_count: user.follower_count || 0,
        following_count: user.following_count || 0,
        likes_count: user.likes_count || 0,
        video_count: user.video_count || 0
      }
    } else if (profileData.error && profileData.error.code !== 'ok') {
      console.error('TikTok API error:', profileData.error)
      return NextResponse.json({ 
        error: 'Failed to fetch stats from TikTok', 
        tiktok_error: profileData.error 
      }, { status: 500 })
    }

    // Get current stored stats for comparison
    const { data: connection, error: dbError } = await supabase
      .from('social_connections')
      .select('profile_data')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .single()

    if (dbError) {
      console.error('Error fetching stored connection:', dbError)
    }

    const storedStats = connection?.profile_data ? {
      follower_count: connection.profile_data.follower_count || 0,
      following_count: connection.profile_data.following_count || 0,
      likes_count: connection.profile_data.likes_count || 0,
      video_count: connection.profile_data.video_count || 0
    } : null

    // Update database if stats have changed
    if (storedStats && (
      stats.follower_count !== storedStats.follower_count ||
      stats.following_count !== storedStats.following_count ||
      stats.likes_count !== storedStats.likes_count ||
      stats.video_count !== storedStats.video_count
    )) {
      const { error: updateError } = await supabase
        .from('social_connections')
        .update({
          profile_data: {
            ...connection.profile_data,
            ...stats
          },
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('platform', 'tiktok')

      if (updateError) {
        console.error('Error updating stats:', updateError)
      } else {
        console.log('Stats updated in database')
      }
    }

    return NextResponse.json({ 
      success: true,
      stats,
      stored: storedStats,
      updated: stats !== storedStats
    })
  } catch (error) {
    console.error('Live stats error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}