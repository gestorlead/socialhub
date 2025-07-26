import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'
import { IntegrationConfigManager } from '@/lib/integration-config-manager'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get TikTok configuration (database first, env fallback)
    const tikTokConfig = await IntegrationConfigManager.getTikTokConfig()
    console.log('[TikTok Auth] Using configuration from:', tikTokConfig.source)

    // Check if TikTok is properly configured
    if (!tikTokConfig.client_key || !tikTokConfig.app_id) {
      console.error('[TikTok Auth] Missing configuration - client_key or app_id not found')
      return NextResponse.json({ 
        error: 'TikTok integration not configured properly',
        details: 'Missing client_key or app_id'
      }, { status: 500 })
    }

    // Generate CSRF state token
    const state = nanoid(32)
    
    // Store state in database for validation
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        user_id: userId,
        provider: 'tiktok',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      })

    if (stateError) {
      console.error('Error storing OAuth state:', stateError)
      return NextResponse.json({ error: 'Failed to initialize OAuth' }, { status: 500 })
    }

    // Get OAuth URLs
    const { authUrl: baseAuthUrl } = await IntegrationConfigManager.getTikTokOAuthUrls()
    
    // Use callback_url from config or build from FRONTEND_URL
    const redirectUri = tikTokConfig.callback_url || `${process.env.FRONTEND_URL}/api/auth/tiktok/callback`
    
    // Build OAuth parameters manually to avoid encoding issues
    const params = [
      `client_key=${tikTokConfig.client_key}`,
      `scope=user.info.basic,user.info.profile,user.info.stats,video.publish,video.list`, // Vírgula SEM encoding
      `response_type=code`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      `state=${state}`
    ].join('&')

    const authUrl = `${baseAuthUrl}?${params}`

    console.log('[TikTok Auth] Redirecting to:', authUrl)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('TikTok OAuth initialization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}