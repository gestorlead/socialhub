import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Return YouTube OAuth URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    console.log('YouTube OAuth requested for user:', userId)

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('client_key, callback_url, config_data')
      .eq('platform', 'youtube')
      .single()

    let clientId = process.env.YOUTUBE_CLIENT_ID
    let redirectUri = process.env.YOUTUBE_CALLBACK_URL ||
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/auth/youtube/callback`

    if (settings) {
      try {
        clientId = settings.client_key ? decrypt(settings.client_key) : clientId
        redirectUri = settings.callback_url ? decrypt(settings.callback_url) : redirectUri
      } catch (error) {
        console.error('Failed to decrypt settings:', error)
        // Use environment variables as fallback
      }
    }

    // YouTube permissions - basic read access
    const scope = 'https://www.googleapis.com/auth/youtube.readonly'

    if (!clientId) {
      console.error('YouTube Client ID not configured')
      return NextResponse.json(
        { error: 'YouTube integration not configured' },
        { status: 500 }
      )
    }

    console.log('YouTube OAuth config:', {
      clientId: clientId ? `${clientId.substring(0, 10)}...` : 'NOT CONFIGURED',
      redirectUri,
      scope,
      settingsSource: settings ? 'database' : 'environment'
    })

    // Create state parameter with user info
    const state = Buffer.from(JSON.stringify({
      user_id: userId,
      timestamp: Date.now()
    })).toString('base64')

    // Build YouTube OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('include_granted_scopes', 'true')
    authUrl.searchParams.set('state', state)

    console.log('Generated YouTube OAuth URL:', authUrl.toString())

    return NextResponse.json({
      success: true,
      auth_url: authUrl.toString()
    })

  } catch (error) {
    console.error('YouTube OAuth initiation error:', error)
    
    return NextResponse.json(
      { error: 'Failed to initiate YouTube authentication' },
      { status: 500 }
    )
  }
}