import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/auth/youtube/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    console.log('YouTube OAuth callback received')

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=${encodeURIComponent(errorDescription || error)}`
      )
    }

    if (!code || !state) {
      console.error('Missing code or state')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=invalid_callback`
      )
    }

    // Decode and validate state
    let stateData
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch (e) {
      console.error('Invalid state parameter')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=invalid_state`
      )
    }

    const userId = stateData.user_id
    if (!userId) {
      console.error('No user ID in state')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=missing_user`
      )
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('client_key, client_secret, callback_url')
      .eq('platform', 'youtube')
      .single()

    let clientId = process.env.YOUTUBE_CLIENT_ID
    let clientSecret = process.env.YOUTUBE_CLIENT_SECRET
    let redirectUri = process.env.YOUTUBE_CALLBACK_URL ||
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/auth/youtube/callback`

    if (settings) {
      try {
        clientId = settings.client_key ? decrypt(settings.client_key) : clientId
        clientSecret = settings.client_secret ? decrypt(settings.client_secret) : clientSecret
        redirectUri = settings.callback_url ? decrypt(settings.callback_url) : redirectUri
      } catch (error) {
        console.error('Failed to decrypt settings:', error)
        // Use environment variables as fallback
      }
    }

    if (!clientId || !clientSecret) {
      console.error('YouTube credentials not configured')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=missing_credentials`
      )
    }

    console.log('Exchanging code for tokens...')

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('Tokens received successfully')

    // Get user profile information
    const profileResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      }
    )

    if (!profileResponse.ok) {
      console.error('Failed to fetch YouTube profile')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=profile_fetch_failed`
      )
    }

    const profileData = await profileResponse.json()
    console.log('YouTube profile data:', JSON.stringify(profileData, null, 2))

    if (!profileData.items || profileData.items.length === 0) {
      console.error('No YouTube channel found for this account')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=no_channel_found`
      )
    }

    const channel = profileData.items[0]
    const channelData = {
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
    }

    // Calculate token expiration
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
      : null

    // Save or update connection
    const connectionData = {
      user_id: userId,
      platform: 'youtube',
      platform_user_id: channel.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      scope: tokenData.scope || 'https://www.googleapis.com/auth/youtube.readonly',
      expires_at: expiresAt,
      profile_data: channelData,
      updated_at: new Date().toISOString()
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .single()

    if (existingConnection) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)

      if (updateError) {
        console.error('Failed to update YouTube connection:', updateError)
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=database_error`
        )
      }
    } else {
      // Create new connection
      const { error: insertError } = await supabase
        .from('social_connections')
        .insert([{
          ...connectionData,
          created_at: new Date().toISOString()
        }])

      if (insertError) {
        console.error('Failed to create YouTube connection:', insertError)
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=database_error`
        )
      }
    }

    console.log('YouTube connection saved successfully')

    // Redirect to YouTube page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?success=connected`
    )

  } catch (error) {
    console.error('YouTube OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/youtube?error=callback_error`
    )
  }
}