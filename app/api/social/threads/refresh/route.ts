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
      // Get updated profile data
      const profileUrl = `https://graph.threads.net/v1.0/${threadsUserId}?fields=id,username,name,threads_profile_picture_url,threads_biography`
      const profileResponse = await fetch(profileUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!profileResponse.ok) {
        const errorData = await profileResponse.json().catch(() => ({}))
        console.error('Failed to fetch profile:', errorData)
        return NextResponse.json(
          { error: 'Failed to refresh profile data' },
          { status: 500 }
        )
      }

      const profileData = await profileResponse.json()

      // Update connection with new profile data
      const updatedProfileData = {
        ...connection.profile_data,
        ...profileData,
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