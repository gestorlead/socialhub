import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { 
  validateOAuthCallback, 
  validateOAuthState, 
  sanitizeTokenResponse,
  validateApiResponse,
  checkOAuthRateLimit,
  logOAuthSecurityEvent
} from '@/lib/oauth-security'
import { encrypt } from '@/lib/crypto-secure'
import { 
  sanitizeOAuthCode, 
  sanitizeOAuthState,
  sanitizeInstagramData 
} from '@/lib/input-sanitizer-enhanced'

// GET - Secure Instagram OAuth callback
export async function GET(request: NextRequest) {
  const clientIp = request.ip || 'unknown'
  
  try {
    // Rate limiting for callback endpoint
    const rateLimitResult = checkOAuthRateLimit(`callback:${clientIp}`, 5, 5 * 60 * 1000) // 5 requests per 5 minutes
    
    if (!rateLimitResult.allowed) {
      logOAuthSecurityEvent('callback_rate_limit_exceeded', {
        ip: clientIp,
        provider: 'instagram'
      }, request)
      
      return new Response(
        '<html><body><h1>Rate Limit Exceeded</h1><p>Too many callback requests. Please try again later.</p></body></html>',
        { 
          status: 429,
          headers: { 
            'Content-Type': 'text/html',
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      )
    }

    // Validate OAuth callback parameters
    const callbackValidation = validateOAuthCallback(request)
    
    if (!callbackValidation.isValid) {
      logOAuthSecurityEvent('invalid_callback_parameters', {
        provider: 'instagram',
        error: callbackValidation.error,
        errorDescription: callbackValidation.errorDescription,
        ip: clientIp
      }, request)
      
      return new Response(
        `<html><body><h1>Instagram Authentication Error</h1><p>${callbackValidation.error}: ${callbackValidation.errorDescription}</p></body></html>`,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    const { code, state } = callbackValidation
    
    // Sanitize OAuth parameters
    const sanitizedCode = sanitizeOAuthCode(code!)
    const sanitizedState = sanitizeOAuthState(state!)
    
    if (!sanitizedCode || !sanitizedState) {
      logOAuthSecurityEvent('invalid_oauth_parameters', {
        provider: 'instagram',
        codePresent: !!code,
        statePresent: !!state,
        ip: clientIp
      }, request)
      
      return new Response(
        '<html><body><h1>Error</h1><p>Invalid OAuth parameters</p></body></html>',
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    // Validate OAuth state (CSRF protection)
    const stateData = await validateOAuthState(sanitizedState, 'instagram')
    
    if (!stateData) {
      logOAuthSecurityEvent('state_validation_failed', {
        provider: 'instagram',
        state: sanitizedState,
        ip: clientIp
      }, request)
      
      return new Response(
        '<html><body><h1>Security Error</h1><p>Invalid or expired OAuth state. Please try again.</p></body></html>',
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('instagram_settings')
      .select('app_id, app_secret, oauth_redirect_uri')
      .limit(1)
      .single()

    const appId = settings?.app_id || process.env.INSTAGRAM_APP_ID
    const appSecret = settings?.app_secret || process.env.INSTAGRAM_APP_SECRET
    const redirectUri = stateData.redirectUri

    if (!appId || !appSecret) {
      logOAuthSecurityEvent('missing_app_credentials', {
        provider: 'instagram',
        ip: clientIp
      }, request)
      
      return new Response(
        '<html><body><h1>Configuration Error</h1><p>Instagram credentials not configured</p></body></html>',
        { 
          status: 500,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    // Exchange authorization code for access token
    const tokenRequestBody = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: sanitizedCode
    })
    
    // Add PKCE code verifier if available
    if (stateData.codeVerifier) {
      tokenRequestBody.append('code_verifier', stateData.codeVerifier)
    }

    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'SocialHub/1.0'
      },
      body: tokenRequestBody
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      
      logOAuthSecurityEvent('token_exchange_failed', {
        provider: 'instagram',
        status: tokenResponse.status,
        error: errorData,
        ip: clientIp
      }, request)
      
      return new Response(
        `<html><body><h1>Token Exchange Error</h1><p>Failed to exchange authorization code for access token</p></body></html>`,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    const rawTokenData = await tokenResponse.json()
    const tokenData = sanitizeTokenResponse(rawTokenData)

    if (!tokenData.accessToken || !tokenData.userId) {
      logOAuthSecurityEvent('invalid_token_response', {
        provider: 'instagram',
        hasAccessToken: !!tokenData.accessToken,
        hasUserId: !!tokenData.userId,
        ip: clientIp
      }, request)
      
      return new Response(
        '<html><body><h1>Authentication Error</h1><p>Invalid token response from Instagram</p></body></html>',
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    // Exchange short-lived token for long-lived token
    let finalAccessToken = tokenData.accessToken
    let expiresIn = tokenData.expiresIn

    try {
      const longLivedResponse = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${tokenData.accessToken}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'SocialHub/1.0'
          }
        }
      )

      if (longLivedResponse.ok) {
        const longLivedData = await longLivedResponse.json()
        if (longLivedData.access_token) {
          finalAccessToken = longLivedData.access_token
          expiresIn = longLivedData.expires_in
        }
      }
    } catch (error) {
      console.warn('Failed to exchange for long-lived token:', error)
      // Continue with short-lived token
    }

    // Get user info with validation
    let userInfo = { id: tokenData.userId, username: 'Unknown', account_type: 'Unknown' }
    
    try {
      const userInfoResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${finalAccessToken}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'SocialHub/1.0'
          }
        }
      )

      if (userInfoResponse.ok) {
        const rawUserInfo = await userInfoResponse.json()
        if (validateApiResponse(rawUserInfo, ['id'])) {
          userInfo = {
            id: rawUserInfo.id || tokenData.userId,
            username: rawUserInfo.username || 'Unknown',
            account_type: rawUserInfo.account_type || 'Unknown'
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch user info:', error)
      // Continue with basic user info
    }

    // Encrypt sensitive data before storage
    const encryptedAccessToken = encrypt(finalAccessToken)

    // Update settings with the encrypted access token
    const { error: updateError } = await supabase
      .from('instagram_settings')
      .upsert({
        access_token: encryptedAccessToken,
        instagram_business_account_id: userInfo.id,
        updated_at: new Date().toISOString()
      })

    if (updateError) {
      logOAuthSecurityEvent('database_update_failed', {
        provider: 'instagram',
        error: updateError.message,
        ip: clientIp
      }, request)
      
      console.error('Error updating Instagram settings:', updateError)
    } else {
      logOAuthSecurityEvent('oauth_completed_successfully', {
        provider: 'instagram',
        userId: userInfo.id,
        username: userInfo.username,
        accountType: userInfo.account_type,
        ip: clientIp
      }, request)
    }

    // Success page with security headers
    const successHtml = `
      <html>
        <head>
          <title>Instagram Authentication Successful</title>
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; object-src 'none';">
        </head>
        <body>
          <h1>Instagram Authentication Successful!</h1>
          <p>User ID: ${userInfo.id}</p>
          <p>Username: ${userInfo.username}</p>
          <p>Account Type: ${userInfo.account_type}</p>
          <p>Access token has been securely saved to your settings.</p>
          <p><a href="/integrations/instagram">Return to Instagram Settings</a></p>
          <script>
            // Auto-close popup if opened in popup window
            if (window.opener) {
              window.opener.postMessage({ success: true, provider: 'instagram' }, '*');
              window.close();
            }
          </script>
        </body>
      </html>
    `

    return new Response(successHtml, { 
      status: 200,
      headers: { 
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff'
      }
    })

  } catch (error) {
    logOAuthSecurityEvent('callback_processing_error', {
      provider: 'instagram',
      error: error.message,
      stack: error.stack,
      ip: clientIp
    }, request)
    
    console.error('Instagram callback error:', error)
    return new Response(
      `<html><body><h1>Server Error</h1><p>An error occurred processing the Instagram callback.</p></body></html>`,
      { 
        status: 500,
        headers: { 
          'Content-Type': 'text/html',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    )
  }
}