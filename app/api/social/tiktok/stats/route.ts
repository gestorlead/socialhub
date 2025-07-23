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

    // Get current profile data for merging
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('profile_data')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Fetch updated stats from TikTok using API v2
    const profileUrl = new URL('https://open.tiktokapis.com/v2/user/info/')
    profileUrl.searchParams.append('fields', 'follower_count,following_count,likes_count,video_count')
    
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
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    const profileData = await profileResponse.json()
    
    // Handle API v2 response structure
    let stats = {}
    if (profileData.data?.user) {
      stats = profileData.data.user
    } else if (profileData.error) {
      console.error('TikTok API error:', profileData.error)
      return NextResponse.json({ error: 'Failed to fetch stats from TikTok' }, { status: 500 })
    } else {
      stats = profileData
    }

    // Update the profile data with new stats
    const updatedProfileData = {
      ...connection.profile_data,
      follower_count: stats.follower_count || connection.profile_data.follower_count || 0,
      following_count: stats.following_count || connection.profile_data.following_count || 0,
      likes_count: stats.likes_count || connection.profile_data.likes_count || 0,
      video_count: stats.video_count || connection.profile_data.video_count || 0
    }

    // Update in database
    const { error: updateError } = await supabase
      .from('social_connections')
      .update({
        profile_data: updatedProfileData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('platform', 'tiktok')

    if (updateError) {
      console.error('Error updating stats:', updateError)
      return NextResponse.json({ error: 'Failed to update stats' }, { status: 500 })
    }

    return NextResponse.json({ stats: updatedProfileData })
  } catch (error) {
    console.error('Stats update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}