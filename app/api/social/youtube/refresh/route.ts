import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/social/youtube/refresh - Refresh YouTube channel data
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
      .eq('platform', 'youtube')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No YouTube connection found' },
        { status: 404 }
      )
    }

    const accessToken = connection.access_token

    // Check token expiry
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Access token expired. Please reconnect your account.' },
        { status: 401 }
      )
    }

    try {
      // Get updated channel data from YouTube API
      const channelResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (!channelResponse.ok) {
        const errorData = await channelResponse.json().catch(() => ({}))
        console.error('Failed to fetch YouTube channel:', errorData)
        return NextResponse.json(
          { error: 'Failed to refresh channel data' },
          { status: 500 }
        )
      }

      const channelData = await channelResponse.json()
      console.log('YouTube channel data fetched:', JSON.stringify(channelData, null, 2))

      if (!channelData.items || channelData.items.length === 0) {
        return NextResponse.json(
          { error: 'No YouTube channel found for this account' },
          { status: 404 }
        )
      }

      const channel = channelData.items[0]
      
      // Update connection with new channel data
      const updatedProfileData = {
        channel_id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        custom_url: channel.snippet.customUrl,
        published_at: channel.snippet.publishedAt,
        thumbnail_url: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
        country: channel.snippet.country,
        default_language: channel.snippet.defaultLanguage,
        localized: channel.snippet.localized,
        // Statistics
        subscriber_count: parseInt(channel.statistics?.subscriberCount || '0'),
        video_count: parseInt(channel.statistics?.videoCount || '0'),
        view_count: parseInt(channel.statistics?.viewCount || '0'),
        comment_count: parseInt(channel.statistics?.commentCount || '0'),
        // Additional fields
        channel_url: `https://www.youtube.com/channel/${channel.id}`,
        // Preserve additional data from connection
        ...connection.profile_data,
        // Override with fresh data
        last_refreshed: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('social_connections')
        .update({
          profile_data: updatedProfileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('platform', 'youtube')

      if (updateError) {
        console.error('Failed to update YouTube profile data:', updateError)
        return NextResponse.json(
          { error: 'Failed to save refreshed data' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        profile_data: updatedProfileData,
        message: 'YouTube channel data refreshed successfully'
      })

    } catch (error: any) {
      console.error('Error refreshing YouTube channel:', error)
      return NextResponse.json(
        { error: 'Failed to refresh channel data' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('YouTube channel refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}