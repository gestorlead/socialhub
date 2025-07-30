import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { 
  createOAuthState, 
  createSecureRedirectUri, 
  checkOAuthRateLimit, 
  logOAuthSecurityEvent 
} from '@/lib/oauth-security'
import { sanitizeText } from '@/lib/input-sanitizer-enhanced'

// GET - Secure Instagram OAuth initiation
export async function GET(request: NextRequest) {
  try {
    const clientIp = request.ip || 'unknown'
    
    // Rate limiting
    const rateLimitResult = checkOAuthRateLimit(clientIp, 10, 15 * 60 * 1000) // 10 requests per 15 minutes
    
    if (!rateLimitResult.allowed) {
      logOAuthSecurityEvent('rate_limit_exceeded', {
        ip: clientIp,
        provider: 'instagram',
        remaining: rateLimitResult.remaining
      }, request)
      
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      )
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('instagram_settings')
      .select('app_id, oauth_redirect_uri, permissions')
      .limit(1)
      .single()

    const appId = sanitizeText(settings?.app_id || process.env.INSTAGRAM_APP_ID)
    
    if (!appId) {
      logOAuthSecurityEvent('missing_credentials', {
        provider: 'instagram',
        ip: clientIp
      }, request)
      
      return NextResponse.json(
        { error: 'Instagram App ID not configured' },
        { status: 500 }
      )
    }

    // Create secure redirect URI
    let redirectUri: string
    try {
      const baseUrl = settings?.oauth_redirect_uri || 
        process.env.INSTAGRAM_OAUTH_REDIRECT_URI ||
        process.env.NEXT_PUBLIC_APP_URL
      
      if (!baseUrl) {
        throw new Error('No base URL configured')
      }
      
      redirectUri = createSecureRedirectUri(baseUrl, 'instagram')
    } catch (error) {
      logOAuthSecurityEvent('invalid_redirect_uri', {
        provider: 'instagram',
        error: error.message,
        ip: clientIp
      }, request)
      
      return NextResponse.json(
        { error: 'Invalid redirect URI configuration' },
        { status: 500 }
      )
    }

    // Sanitize permissions
    const rawPermissions = settings?.permissions || [
      'instagram_basic',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_content_publish',
      'instagram_manage_insights'
    ]
    
    const permissions = Array.isArray(rawPermissions) 
      ? rawPermissions.map(p => sanitizeText(p, { maxLength: 100 })).filter(p => p && /^[a-z_]+$/.test(p))
      : []

    if (permissions.length === 0) {
      return NextResponse.json(
        { error: 'No valid permissions configured' },
        { status: 500 }
      )
    }

    // Create secure OAuth state with PKCE
    const { state, codeChallenge } = await createOAuthState(
      'instagram',
      redirectUri,
      undefined,
      true // Enable PKCE
    )

    // Build Instagram OAuth URL with security parameters
    const authUrl = new URL('https://api.instagram.com/oauth/authorize')
    authUrl.searchParams.set('client_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', permissions.join(','))
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)
    
    // Add PKCE parameters if available
    if (codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
    }

    // Log successful OAuth initiation
    logOAuthSecurityEvent('oauth_initiated', {
      provider: 'instagram',
      ip: clientIp,
      redirectUri,
      permissions
    }, request)

    // Set security headers
    const response = NextResponse.redirect(authUrl.toString())
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response

  } catch (error) {
    const clientIp = request.ip || 'unknown'
    
    logOAuthSecurityEvent('oauth_initiation_error', {
      provider: 'instagram',
      error: error.message,
      ip: clientIp
    }, request)
    
    console.error('Instagram OAuth initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Instagram OAuth' },
      { status: 500 }
    )
  }
}