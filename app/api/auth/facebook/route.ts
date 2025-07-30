import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { 
  createOAuthState, 
  checkOAuthRateLimit, 
  logOAuthSecurityEvent,
  createSecureRedirectUri 
} from '@/lib/oauth-security'

// GET - Redirect to Facebook OAuth with security
export async function GET(request: NextRequest) {
  try {
    // Rate limiting check
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = checkOAuthRateLimit(clientIp, 10, 15 * 60 * 1000) // 10 requests per 15 minutes
    
    if (!rateLimitResult.allowed) {
      await logOAuthSecurityEvent(
        'rate_limit_exceeded',
        { ip: clientIp, remaining: rateLimitResult.remaining },
        request
      )
      
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      )
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('facebook_settings')
      .select('app_id, oauth_redirect_uri, permissions, api_version')
      .limit(1)
      .single()

    const appId = settings?.app_id || process.env.FACEBOOK_APP_ID
    const apiVersion = settings?.api_version || process.env.FACEBOOK_API_VERSION || 'v18.0'
    
    // Create secure redirect URI
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`
    const redirectUri = settings?.oauth_redirect_uri || 
      process.env.FACEBOOK_OAUTH_REDIRECT_URI ||
      createSecureRedirectUri(baseUrl, 'facebook')

    const permissions = settings?.permissions?.join(',') || 
      'pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata'

    if (!appId) {
      await logOAuthSecurityEvent(
        'invalid_configuration',
        { error: 'Facebook App ID not configured' },
        request
      )
      
      return NextResponse.json(
        { error: 'Facebook integration not configured' },
        { status: 500 }
      )
    }

    // Create secure OAuth state with optional user context
    const authHeader = request.headers.get('authorization')
    let userId: string | undefined
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    // Create and store OAuth state with PKCE support
    const { state, codeChallenge } = await createOAuthState(
      'facebook',
      redirectUri,
      userId,
      false // Facebook doesn't support PKCE
    )

    // Build Facebook OAuth URL
    const authUrl = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`)
    authUrl.searchParams.set('client_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', permissions)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    // Log successful OAuth initiation
    await logOAuthSecurityEvent(
      'oauth_initiated',
      { 
        provider: 'facebook',
        client_id: appId,
        scope: permissions,
        has_user: !!userId
      },
      request
    )

    // Set security headers
    const response = NextResponse.redirect(authUrl.toString())
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    
    return response

  } catch (error) {
    console.error('Facebook OAuth initiation error:', error)
    
    await logOAuthSecurityEvent(
      'oauth_error',
      { 
        provider: 'facebook',
        error: error.message,
        phase: 'initiation'
      },
      request
    )
    
    return NextResponse.json(
      { error: 'Failed to initiate Facebook authentication' },
      { status: 500 }
    )
  }
}