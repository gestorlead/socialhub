import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate code verifier for PKCE using Web Crypto API
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Generate code challenge from verifier using Web Crypto API
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// GET - Initiate OAuth 2.0 flow with PKCE
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }


    // Verify user
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get X integration settings from unified table
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'x')
      .maybeSingle()

    const config = settings ? {
      client_id: settings.client_key,
      callback_url: settings.callback_url || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/x/callback`
    } : {
      client_id: process.env.X_CLIENT_ID,
      callback_url: process.env.X_CALLBACK_URL || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/x/callback`
    }

    if (!config.client_id) {
      return NextResponse.json({ error: 'X integration not configured' }, { status: 500 })
    }

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    
    // Generate state parameter using Web Crypto API
    const stateArray = new Uint8Array(16)
    crypto.getRandomValues(stateArray)
    const state = Array.from(stateArray, byte => byte.toString(16).padStart(2, '0')).join('')

    // Store PKCE data in oauth_states table (consistent with other integrations)
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state: state,
        user_id: userId,
        provider: 'x',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        data: {
          code_verifier: codeVerifier,
          created_at: new Date().toISOString()
        }
      })

    if (stateError) {
      console.error('Error storing OAuth state:', stateError)
      return NextResponse.json({ error: 'Failed to initialize OAuth' }, { status: 500 })
    }

    // Build authorization URL
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: config.client_id,
      redirect_uri: config.callback_url,
      scope: 'tweet.read tweet.write users.read offline.access',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    })

    const authorizationUrl = `https://twitter.com/i/oauth2/authorize?${authParams.toString()}`

    return NextResponse.json({
      authorization_url: authorizationUrl,
      state: state
    })
  } catch (error) {
    console.error('Error in GET /api/auth/x:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}