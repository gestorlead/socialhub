import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/auth/threads/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    console.log('Threads OAuth callback received')

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=${encodeURIComponent(errorDescription || error)}`
      )
    }

    if (!code || !state) {
      console.error('Missing code or state')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=invalid_callback`
      )
    }

    // Decode and validate state
    let stateData
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch (e) {
      console.error('Invalid state parameter')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=invalid_state`
      )
    }

    const userId = stateData.user_id
    if (!userId) {
      console.error('No user ID in state')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=invalid_user`
      )
    }

    // Get settings
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('app_id, client_secret, callback_url')
      .eq('platform', 'threads')
      .single()

    let appId = process.env.THREADS_APP_ID
    let appSecret = process.env.THREADS_APP_SECRET
    let redirectUri = process.env.THREADS_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/auth/threads/callback`

    if (settings) {
      try {
        appId = settings.app_id ? decrypt(settings.app_id) : appId
        appSecret = settings.client_secret ? decrypt(settings.client_secret) : appSecret
        redirectUri = settings.callback_url ? decrypt(settings.callback_url) : redirectUri
      } catch (error) {
        console.error('Failed to decrypt settings:', error)
        // Use environment variables as fallback
      }
    }

    if (!appId || !appSecret) {
      console.error('Threads credentials not configured')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=not_configured`
      )
    }

    // Exchange code for access token - Using Threads API endpoint
    const tokenUrl = 'https://graph.threads.net/oauth/access_token'
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })

    console.log('Exchanging code for access token...')
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()
    const shortLivedToken = tokenData.access_token
    const threadsUserId = tokenData.user_id

    if (!shortLivedToken || !threadsUserId) {
      console.error('Invalid token response:', tokenData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=invalid_token_response`
      )
    }

    console.log('Token exchange successful, exchanging for long-lived token...')

    // Exchange short-lived token for long-lived token
    const longLivedTokenUrl = 'https://graph.threads.net/access_token'
    const longLivedParams = new URLSearchParams({
      client_secret: appSecret,
      grant_type: 'th_exchange_token',
      access_token: shortLivedToken
    })

    const longLivedResponse = await fetch(`${longLivedTokenUrl}?${longLivedParams}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    let accessToken = shortLivedToken
    let tokenType = 'short_lived'
    let expiresIn = 3600 // 1 hour default for short-lived

    if (longLivedResponse.ok) {
      const longLivedData = await longLivedResponse.json()
      if (longLivedData.access_token) {
        accessToken = longLivedData.access_token
        tokenType = 'long_lived'
        expiresIn = longLivedData.expires_in || 5184000 // 60 days
        console.log('Successfully obtained long-lived token')
      }
    } else {
      console.warn('Failed to get long-lived token, using short-lived token')
    }

    // Get user profile - Using Threads API endpoint with all available fields
    console.log('Fetching user profile...')
    const profileUrl = `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url,threads_biography,is_verified`
    const profileResponse = await fetch(profileUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    let profileData = {}
    if (profileResponse.ok) {
      profileData = await profileResponse.json()
      console.log('Profile fetched successfully:', profileData)

      // Try to get additional metrics/insights
      try {
        const insightsUrl = `https://graph.threads.net/v1.0/${profileData.id}/threads_insights?metric=views,likes,replies,reposts,quotes&period=day`
        const insightsResponse = await fetch(insightsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (insightsResponse.ok) {
          const insights = await insightsResponse.json()
          console.log('Insights fetched:', insights)
          
          // Process insights into profile data
          if (insights.data) {
            const processedInsights = insights.data.reduce((acc: any, item: any) => {
              acc[item.name] = item.values?.[0]?.value || 0
              return acc
            }, {})
            
            profileData = {
              ...profileData,
              ...processedInsights,
              replies_count: processedInsights.replies || 0
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch insights during connection:', error)
      }

      // Try to get user's threads count
      try {
        const threadsUrl = `https://graph.threads.net/v1.0/${profileData.id}/threads?fields=id&limit=1`
        const threadsResponse = await fetch(threadsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        
        if (threadsResponse.ok) {
          const threadsData = await threadsResponse.json()
          console.log('Threads data sample:', threadsData)
          // Note: This is just a sample, we can't get total count easily from API
          profileData.posts_count = 0 // Will be updated on refresh
        }
      } catch (error) {
        console.warn('Failed to fetch threads count during connection:', error)
      }
    } else {
      console.warn('Failed to fetch profile data')
    }

    // Save to database
    const connectionData = {
      user_id: userId,
      platform: 'threads',
      platform_user_id: threadsUserId,
      access_token: accessToken,
      refresh_token: null, // Threads doesn't provide refresh tokens
      expires_at: new Date(Date.now() + (expiresIn * 1000)).toISOString(),
      profile_data: {
        ...profileData,
        token_type: tokenType
      },
      is_active: true,
      updated_at: new Date().toISOString()
    }

    // Check if connection already exists
    const { data: existing } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'threads')
      .single()

    if (existing) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existing.id)

      if (updateError) {
        console.error('Failed to update connection:', updateError)
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=save_failed`
        )
      }
    } else {
      // Create new connection
      const { error: insertError } = await supabase
        .from('social_connections')
        .insert(connectionData)

      if (insertError) {
        console.error('Failed to create connection:', insertError)
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=save_failed`
        )
      }
    }

    console.log('Threads connection saved successfully')

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?success=true`
    )

  } catch (error) {
    console.error('Threads OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/networks/threads?error=callback_error`
    )
  }
}