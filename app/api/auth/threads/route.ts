import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Return Threads OAuth URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    console.log('Threads OAuth requested for user:', userId)

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('app_id, callback_url')
      .eq('platform', 'threads')
      .single()

    let appId = process.env.THREADS_APP_ID
    let redirectUri = process.env.THREADS_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/auth/threads/callback`

    if (settings) {
      try {
        appId = settings.app_id ? decrypt(settings.app_id) : appId
        redirectUri = settings.callback_url ? decrypt(settings.callback_url) : redirectUri
      } catch (error) {
        console.error('Failed to decrypt settings:', error)
        // Use environment variables as fallback
      }
    }

    // Threads permissions - using multiple scopes for complete access
    const permissions = 'threads_basic,threads_content_publish'

    if (!appId) {
      console.error('Threads App ID not configured')
      return NextResponse.json(
        { error: 'Threads integration not configured' },
        { status: 500 }
      )
    }

    console.log('Threads OAuth config:', {
      appId: appId ? `${appId.substring(0, 6)}...` : 'NOT CONFIGURED',
      redirectUri,
      permissions: permissions.split(',').length + ' permissions',
      settingsSource: settings ? 'database' : 'environment'
    })

    // Create state parameter with user info
    const state = Buffer.from(JSON.stringify({
      user_id: userId,
      timestamp: Date.now()
    })).toString('base64')

    // Build Threads OAuth URL - Using correct Threads API endpoint
    const authUrl = new URL('https://threads.net/oauth/authorize')
    authUrl.searchParams.set('client_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', permissions)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    console.log('Generated Threads OAuth URL')
    console.log('OAuth URL params:', {
      client_id: appId,
      redirect_uri: redirectUri,
      scope: permissions,
      response_type: 'code',
      state_length: state.length
    })
    console.log('Full OAuth URL:', authUrl.toString())
    
    // Debug: Let's also check if this might be a Meta Developer Console configuration issue
    console.log('DEBUGGING - App configuration check:')
    console.log('- App ID format valid:', /^\d+$/.test(appId))
    console.log('- App ID length:', appId.length)
    console.log('- Redirect URI format:', redirectUri)
    console.log('- Using HTTPS:', redirectUri.startsWith('https://'))
    console.log('- Domain matches expected:', redirectUri.includes('socialhub.gestorlead.com.br'))
    console.log('- Permissions format:', permissions)
    console.log('- State parameter length:', state.length)
    
    // Additional debugging - let's check if the URL construction is correct
    console.log('URL construction debug:')
    console.log('- Base URL:', 'https://threads.net/oauth/authorize')
    console.log('- Final URL length:', authUrl.toString().length)
    console.log('- Contains client_id:', authUrl.toString().includes('client_id'))
    console.log('- Contains redirect_uri:', authUrl.toString().includes('redirect_uri'))

    return NextResponse.json({
      success: true,
      auth_url: authUrl.toString()
    })

  } catch (error) {
    console.error('Threads OAuth initiation error:', error)
    
    return NextResponse.json(
      { error: 'Failed to initiate Threads authentication' },
      { status: 500 }
    )
  }
}