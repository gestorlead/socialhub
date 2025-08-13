import { NextRequest, NextResponse } from 'next/server'

function parseState(state: string) {
  try {
    const [raw] = state.split('.')
    const json = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')

    if (!code || !stateParam) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
    }

    const state = parseState(stateParam)
    if (!state?.v || !state?.c || !state?.r || !state?.u) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }

    const tokenUrl = 'https://api.x.com/2/oauth2/token'
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: state.c,
      redirect_uri: state.r,
      code_verifier: state.v
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    const tokenData = await response.json().catch(() => ({}))
    if (!response.ok || !tokenData?.access_token) {
      return NextResponse.json({ error: 'Failed to exchange code', details: tokenData }, { status: 400 })
    }

    // Persist tokenData em um endpoint interno admin já existente (não implementado aqui)
    // Você pode criar /api/admin/integrations/x/tokens para salvar em social_connections

    return NextResponse.json({ success: true, tokens: { access_token: tokenData.access_token, expires_in: tokenData.expires_in, scope: tokenData.scope, refresh_token: tokenData.refresh_token } })
  } catch (error) {
    return NextResponse.json({ error: 'Callback failed' }, { status: 500 })
  }
}

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
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=oauth_denied`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=missing_parameters`)
    }


    // Validate OAuth state (consistent with other integrations)
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('user_id, data')
      .eq('state', state)
      .eq('provider', 'x')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (stateError || !stateData) {
      console.error('Invalid or expired state token:', stateError)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=invalid_state`)
    }

    const userId = stateData.user_id
    const oauthData = stateData.data

    // Clean up used state token
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state)

    // Get X integration settings from unified table
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'x')
      .maybeSingle()

    const config = settings ? {
      client_id: settings.client_key,
      client_secret: settings.client_secret,
      callback_url: settings.callback_url || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/x/callback`
    } : {
      client_id: process.env.X_CLIENT_ID,
      client_secret: process.env.X_CLIENT_SECRET,
      callback_url: process.env.X_CALLBACK_URL || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/x/callback`
    }

    if (!config.client_id || !config.client_secret) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=integration_not_configured`)
    }

    // Exchange code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.client_id,
      client_secret: config.client_secret,
      redirect_uri: config.callback_url,
      code: code,
      code_verifier: oauthData.code_verifier
    })

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenRequestBody
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/networks/x?error=token_exchange_failed`)
    }

    const tokenData = await tokenResponse.json()

    // Get user profile data
    const profileResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=id,username,name,profile_image_url,public_metrics,verified', {
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