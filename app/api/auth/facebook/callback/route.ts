import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { 
  validateOAuthCallback,
  validateOAuthState,
  checkOAuthRateLimit,
  logOAuthSecurityEvent,
  sanitizeTokenResponse,
  validateApiResponse
} from '@/lib/oauth-security'
import { sanitizeText } from '@/lib/input-sanitizer-enhanced'

// GET - Handle Facebook OAuth callback with security
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting check
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = checkOAuthRateLimit(`callback:${clientIp}`, 5, 5 * 60 * 1000) // 5 requests per 5 minutes for callback
    
    if (!rateLimitResult.allowed) {
      await logOAuthSecurityEvent(
        'rate_limit_exceeded',
        { 
          ip: clientIp, 
          remaining: rateLimitResult.remaining,
          endpoint: 'facebook_callback'
        },
        request
      )
      
      return new Response(
        '<html><body><h1>Too Many Requests</h1><p>Please try again later.</p></body></html>',
        { 
          status: 429,
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      )
    }

    // Validate OAuth callback parameters
    const validation = validateOAuthCallback(request)
    
    if (!validation.isValid) {
      await logOAuthSecurityEvent(
        'invalid_callback',
        { 
          error: validation.error,
          description: validation.errorDescription,
          ip: clientIp
        },
        request
      )
      
      const safeError = sanitizeText(validation.error || 'Invalid request')
      const safeDescription = sanitizeText(validation.errorDescription || 'An error occurred')
      
      return new Response(
        `<html><body><h1>Facebook Authentication Error</h1><p>${safeError}: ${safeDescription}</p></body></html>`,
        { 
          status: 400,
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        }
      )
    }

    const { code, state } = validation

    // Validate OAuth state
    const oauthState = await validateOAuthState(state!, 'facebook')
    
    if (!oauthState) {
      await logOAuthSecurityEvent(
        'state_validation_failed',
        { 
          state: state,
          ip: clientIp
        },
        request
      )
      
      return new Response(
        '<html><body><h1>Security Error</h1><p>Invalid or expired session. Please try again.</p></body></html>',
        { 
          status: 400,
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        }
      )
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('facebook_settings')
      .select('app_id, app_secret, api_version')
      .limit(1)
      .single()

    const appId = settings?.app_id || process.env.FACEBOOK_APP_ID
    const appSecret = settings?.app_secret || process.env.FACEBOOK_APP_SECRET
    const apiVersion = settings?.api_version || process.env.FACEBOOK_API_VERSION || 'v18.0'

    if (!appId || !appSecret) {
      await logOAuthSecurityEvent(
        'invalid_configuration',
        { 
          error: 'Facebook credentials not configured',
          has_app_id: !!appId,
          has_app_secret: !!appSecret
        },
        request
      )
      
      return new Response(
        '<html><body><h1>Configuration Error</h1><p>Facebook integration not properly configured.</p></body></html>',
        { 
          status: 500,
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        }
      )
    }

    // Exchange code for access token using POST (more secure)
    const tokenFormData = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: oauthState.redirectUri,
      code: code!
    })
    
    const tokenResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/oauth/access_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenFormData
      }
    )

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      
      await logOAuthSecurityEvent(
        'token_exchange_failed',
        { 
          error: errorData,
          status: tokenResponse.status,
          provider: 'facebook'
        },
        request
      )
      
      return new Response(
        '<html><body><h1>Authentication Failed</h1><p>Unable to complete Facebook authentication. Please try again.</p></body></html>',
        { 
          status: 400,
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        }
      )
    }

    const rawTokenData = await tokenResponse.json()
    const tokenData = sanitizeTokenResponse(rawTokenData)
    
    if (!tokenData.accessToken) {
      await logOAuthSecurityEvent(
        'invalid_token_response',
        { 
          provider: 'facebook',
          has_token: false
        },
        request
      )
      
      return new Response(
        '<html><body><h1>Authentication Error</h1><p>Invalid response from Facebook. Please try again.</p></body></html>',
        { 
          status: 400,
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        }
      )
    }

    // Get user info with minimal required fields
    const userInfoResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/me?fields=id,name&access_token=${tokenData.accessToken}`
    )

    let userInfo = { id: '', name: 'Unknown User' }
    if (userInfoResponse.ok) {
      const rawUserInfo = await userInfoResponse.json()
      if (validateApiResponse(rawUserInfo, ['id'])) {
        userInfo = {
          id: sanitizeText(rawUserInfo.id),
          name: sanitizeText(rawUserInfo.name || 'Unknown User')
        }
      }
    }

    // Get user's pages with sanitization
    const pagesResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/me/accounts?fields=id,name,category,access_token&access_token=${tokenData.accessToken}`
    )

    let pages = []
    if (pagesResponse.ok) {
      const rawPagesData = await pagesResponse.json()
      if (rawPagesData.data && Array.isArray(rawPagesData.data)) {
        pages = rawPagesData.data
          .filter(page => validateApiResponse(page, ['id', 'name', 'access_token']))
          .map(page => ({
            id: sanitizeText(page.id),
            name: sanitizeText(page.name),
            category: sanitizeText(page.category || 'Unknown'),
            access_token: page.access_token, // Don't sanitize tokens
            is_active: true
          }))
      }
    }

    // Update settings with the access token and pages
    const updateData = {
      access_token: tokenData.accessToken,
      pages: pages,
      updated_at: new Date().toISOString()
    }

    // If we have a user context from the state, update the updated_by field
    if (oauthState.userId) {
      (updateData as any).updated_by = oauthState.userId
    }

    const { error: updateError } = await supabase
      .from('facebook_settings')
      .upsert(updateData)

    if (updateError) {
      console.error('Error updating Facebook settings:', updateError)
      
      await logOAuthSecurityEvent(
        'settings_update_failed',
        { 
          error: updateError.message,
          provider: 'facebook'
        },
        request
      )
    }

    // Log successful authentication
    await logOAuthSecurityEvent(
      'oauth_completed',
      { 
        provider: 'facebook',
        user_id: userInfo.id,
        pages_count: pages.length,
        duration_ms: Date.now() - startTime,
        has_user_context: !!oauthState.userId
      },
      request
    )

    // Success page with security headers
    const successHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="5;url=/integrations/facebook">
    <title>Facebook Authentication Successful</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        h1 { color: #1877f2; }
        .info { background: #f0f2f5; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .pages { margin: 20px 0; }
        .page { padding: 10px; background: #fff; border: 1px solid #ddd; margin: 5px 0; border-radius: 4px; }
        a { color: #1877f2; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>✓ Facebook Authentication Successful!</h1>
    <div class="info">
        <p><strong>User ID:</strong> ${userInfo.id}</p>
        <p><strong>Name:</strong> ${userInfo.name}</p>
        <p><strong>Pages found:</strong> ${pages.length}</p>
    </div>
    ${pages.length > 0 ? `
        <div class="pages">
            <h3>Your Facebook Pages:</h3>
            ${pages.map(page => `
                <div class="page">
                    <strong>${page.name}</strong> - ${page.category}
                </div>
            `).join('')}
        </div>
    ` : '<p><em>No pages found. Make sure you have admin access to Facebook pages.</em></p>'}
    <p>Access token and page information have been securely saved.</p>
    <p>You will be redirected in 5 seconds, or <a href="/integrations/facebook">click here</a> to return to Facebook Settings.</p>
</body>
</html>`

    return new Response(successHtml, { 
      status: 200,
      headers: { 
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none';"
      }
    })

  } catch (error) {
    console.error('Facebook callback error:', error)
    
    await logOAuthSecurityEvent(
      'oauth_error',
      { 
        provider: 'facebook',
        error: error.message,
        phase: 'callback',
        stack: error.stack
      },
      request
    )
    
    return new Response(
      '<html><body><h1>Server Error</h1><p>An unexpected error occurred. Please try again later.</p></body></html>',
      { 
        status: 500,
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    )
  }
}