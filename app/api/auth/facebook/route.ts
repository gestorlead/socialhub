import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Return Facebook OAuth URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    console.log('Facebook OAuth requested for user:', userId)

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
      .eq('platform', 'facebook')
      .single()

    const appId = settings?.app_id || process.env.FACEBOOK_APP_ID
    const apiVersion = 'v23.0' // Always use v23.0 as per latest API
    
    const redirectUri = settings?.callback_url || 
      process.env.FACEBOOK_OAUTH_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/auth/facebook/callback`

    // Facebook Login for Business permissions
    const permissions = 'pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,pages_manage_engagement,business_management'

    if (!appId) {
      console.error('Facebook App ID not configured')
      return NextResponse.json(
        { error: 'Facebook integration not configured' },
        { status: 500 }
      )
    }

    console.log('Facebook OAuth config:', {
      appId: appId ? `${appId.substring(0, 6)}...` : 'NOT CONFIGURED',
      redirectUri,
      permissions: permissions.split(',').length + ' permissions',
      apiVersion,
      settingsSource: settings ? 'database' : 'environment'
    })

    // Create state parameter with user info
    const state = Buffer.from(JSON.stringify({
      user_id: userId,
      timestamp: Date.now()
    })).toString('base64')

    // Build Facebook OAuth URL
    const authUrl = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`)
    authUrl.searchParams.set('client_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', permissions)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    console.log('Generated Facebook OAuth URL')

    return NextResponse.json({
      success: true,
      auth_url: authUrl.toString()
    })

  } catch (error) {
    console.error('Facebook OAuth initiation error:', error)
    
    return NextResponse.json(
      { error: 'Failed to initiate Facebook authentication' },
      { status: 500 }
    )
  }
}