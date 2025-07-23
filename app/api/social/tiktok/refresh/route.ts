import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

    // Fetch complete user info from TikTok using API v2
    const profileUrl = new URL('https://open.tiktokapis.com/v2/user/info/')
    profileUrl.searchParams.append('fields', [
      'open_id',
      'union_id',
      'avatar_url',
      'avatar_url_100',
      'avatar_large_url',
      'display_name',
      'username',
      'bio_description',
      'is_verified',
      'profile_deep_link',
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
      console.error('Failed to fetch TikTok profile:', profileResponse.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch profile', details: errorText }, { status: 500 })
    }

    const profileData = await profileResponse.json()
    console.log('TikTok API response:', JSON.stringify(profileData, null, 2))
    
    // Handle API v2 response structure - the data comes in data.user
    let userInfo = {}
    if (profileData.data?.user) {
      userInfo = profileData.data.user
      console.log('Extracted user info from data.user:', JSON.stringify(userInfo, null, 2))
    } else if (profileData.error && profileData.error.code !== 'ok') {
      console.error('TikTok API error:', profileData.error)
      return NextResponse.json({ 
        error: 'Failed to fetch profile from TikTok', 
        tiktok_error: profileData.error 
      }, { status: 500 })
    } else {
      // Fallback if structure is different
      userInfo = profileData
      console.log('Using profileData directly as userInfo')
    }

    // Update the profile data
    const updatedProfileData = {
      open_id: userInfo.open_id,
      union_id: userInfo.union_id,
      avatar_url: userInfo.avatar_url,
      avatar_url_100: userInfo.avatar_url_100,
      avatar_large_url: userInfo.avatar_large_url,
      display_name: userInfo.display_name,
      username: userInfo.username,
      bio_description: userInfo.bio_description,
      is_verified: userInfo.is_verified,
      profile_deep_link: userInfo.profile_deep_link,
      follower_count: userInfo.follower_count || 0,
      following_count: userInfo.following_count || 0,
      likes_count: userInfo.likes_count || 0,
      video_count: userInfo.video_count || 0
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
      console.error('Error updating profile:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }
    
    console.log('=== PROFILE UPDATED SUCCESSFULLY ===')
    console.log('Updated profile data:', JSON.stringify(updatedProfileData, null, 2))

    return NextResponse.json({ 
      success: true,
      profile: updatedProfileData,
      raw_response: profileData
    })
  } catch (error) {
    console.error('Profile refresh error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}