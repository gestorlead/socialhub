import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Handle OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=oauth_denied`)
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=missing_parameters`)
    }

    // Decode signed state from /api/auth/x/authorize
    const parseState = (state: string) => {
      try {
        const [raw] = state.split('.')
        const json = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        return JSON.parse(json)
      } catch {
        return null
      }
    }
    const parsed = parseState(stateParam)
    if (!parsed?.v || !parsed?.c || !parsed?.r || !parsed?.u) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=invalid_state`)
    }
    const userId = parsed.u

    // Get X integration settings from unified table
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'x')
      .maybeSingle()

    const config = settings ? {
      client_id: settings.client_key || parsed.c,
      client_secret: settings.client_secret,
      callback_url: settings.callback_url || parsed.r || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/x/callback`
    } : {
      client_id: process.env.X_CLIENT_ID || parsed.c,
      client_secret: process.env.X_CLIENT_SECRET,
      callback_url: process.env.X_CALLBACK_URL || parsed.r || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/x/callback`
    }

    if (!config.client_id) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=integration_not_configured`)
    }

    // Exchange code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.client_id,
      redirect_uri: config.callback_url,
      code: code,
      code_verifier: parsed.v
    })
    if (config.client_secret) {
      tokenRequestBody.set('client_secret', config.client_secret)
    }

    // Build headers; confidential clients must authenticate with Authorization header
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
    if (config.client_secret) {
      const basic = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64')
      headers['Authorization'] = `Basic ${basic}`
      // Do not send client_secret in body if Authorization header present to avoid conflicts
      tokenRequestBody.delete('client_secret')
    }

    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers,
      body: tokenRequestBody
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=token_exchange_failed`)
    }

    const tokenData = await tokenResponse.json()

    // Get user profile data
    const profileResponse = await fetch('https://api.x.com/2/users/me?user.fields=id,username,name,profile_image_url,public_metrics,verified', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })

    if (!profileResponse.ok) {
      console.error('Failed to fetch user profile')
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=profile_fetch_failed`)
    }

    const profileData = await profileResponse.json()
    const userProfile = profileData.data

    // Store connection in database
    const connectionData = {
      user_id: userId,
      platform: 'x',
      platform_user_id: userProfile.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: tokenData.expires_in ? 
        new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : 
        null,
      scope: tokenData.scope || 'tweet.read tweet.write users.read offline.access',
      profile_data: {
        id: userProfile.id,
        username: userProfile.username,
        name: userProfile.name,
        profile_image_url: userProfile.profile_image_url,
        verified: userProfile.verified || false,
        public_metrics: userProfile.public_metrics || {
          followers_count: 0,
          following_count: 0,
          tweet_count: 0,
          listed_count: 0
        }
      },
      is_active: true
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'x')
      .single()

    let result
    if (existingConnection) {
      // Update existing connection
      result = await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
        .select()
        .single()
    } else {
      // Create new connection
      result = await supabase
        .from('social_connections')
        .insert(connectionData)
        .select()
        .single()
    }

    if (result.error) {
      console.error('Failed to save connection:', result.error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=save_failed`)
    }

    // Success - redirect to X network page
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?success=connected`)
  } catch (error) {
    console.error('Error in GET /api/auth/x/callback:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=internal_error`)
  }
}