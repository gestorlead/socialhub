import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Initiate Instagram OAuth
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('app_id, oauth_redirect_uri, permissions')
      .eq('platform', 'instagram')
      .single()

    const appId = settings?.app_id || process.env.INSTAGRAM_APP_ID
    const redirectUri = settings?.oauth_redirect_uri || 
      process.env.INSTAGRAM_OAUTH_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`
    
    const permissions = settings?.permissions || 
      process.env.INSTAGRAM_PERMISSIONS?.split(',') || 
      ['instagram_business_basic']

    if (!appId) {
      return NextResponse.json({ error: 'Instagram App ID not configured' }, { status: 500 })
    }

    // Create state parameter with user ID
    const state = Buffer.from(JSON.stringify({ user_id: userId })).toString('base64')
    
    // Build Instagram OAuth URL
    const authUrl = new URL('https://www.instagram.com/oauth/authorize')
    authUrl.searchParams.set('client_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', permissions.join(','))
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    return NextResponse.json({
      success: true,
      auth_url: authUrl.toString()
    })

  } catch (error) {
    console.error('Instagram OAuth initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Instagram OAuth' },
      { status: 500 }
    )
  }
}