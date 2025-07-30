import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Redirect to Instagram OAuth
export async function GET(request: NextRequest) {
  try {
    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('instagram_settings')
      .select('app_id, oauth_redirect_uri, permissions')
      .limit(1)
      .single()

    const appId = settings?.app_id || process.env.INSTAGRAM_APP_ID
    const redirectUri = settings?.oauth_redirect_uri || 
      process.env.INSTAGRAM_OAUTH_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`

    const permissions = settings?.permissions?.join(',') || 
      'instagram_basic,pages_show_list,pages_read_engagement,instagram_content_publish,instagram_manage_insights'

    if (!appId) {
      return NextResponse.json(
        { error: 'Instagram App ID not configured' },
        { status: 500 }
      )
    }

    // Build Instagram OAuth URL
    const authUrl = new URL('https://api.instagram.com/oauth/authorize')
    authUrl.searchParams.set('client_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', permissions)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', crypto.randomUUID()) // Add CSRF protection

    return NextResponse.redirect(authUrl.toString())

  } catch (error) {
    console.error('Instagram OAuth initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Instagram OAuth' },
      { status: 500 }
    )
  }
}