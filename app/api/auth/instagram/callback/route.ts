import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Handle Instagram OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      console.error('Instagram OAuth error:', error, errorDescription)
      return new Response(
        `<html><body><h1>Instagram Authentication Error</h1><p>${error}: ${errorDescription}</p></body></html>`,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    if (!code) {
      return new Response(
        '<html><body><h1>Error</h1><p>No authorization code received</p></body></html>',
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
    const redirectUri = settings?.oauth_redirect_uri || 
      process.env.INSTAGRAM_OAUTH_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`

    if (!appId || !appSecret) {
      return new Response(
        '<html><body><h1>Configuration Error</h1><p>Instagram credentials not configured</p></body></html>',
        { 
          status: 500,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange error:', errorData)
      return new Response(
        `<html><body><h1>Token Exchange Error</h1><p>${JSON.stringify(errorData)}</p></body></html>`,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    const tokenData = await tokenResponse.json()
    const { access_token, user_id } = tokenData

    // Exchange short-lived token for long-lived token
    const longLivedTokenResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${access_token}`
    )

    let finalAccessToken = access_token
    let expiresIn = null

    if (longLivedTokenResponse.ok) {
      const longLivedData = await longLivedTokenResponse.json()
      finalAccessToken = longLivedData.access_token
      expiresIn = longLivedData.expires_in
    }

    // Get user info
    const userInfoResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${finalAccessToken}`
    )

    let userInfo = { id: user_id }
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json()
    }

    // Update settings with the access token
    const { error: updateError } = await supabase
      .from('instagram_settings')
      .upsert({
        access_token: finalAccessToken,
        instagram_business_account_id: userInfo.id,
        updated_at: new Date().toISOString()
      })

    if (updateError) {
      console.error('Error updating Instagram settings:', updateError)
    }

    // Success page
    return new Response(
      `<html>
        <body>
          <h1>Instagram Authentication Successful!</h1>
          <p>User ID: ${userInfo.id}</p>
          <p>Username: ${userInfo.username || 'N/A'}</p>
          <p>Account Type: ${userInfo.account_type || 'N/A'}</p>
          <p>Access token has been saved to your settings.</p>
          <p><a href="/integrations/instagram">Return to Instagram Settings</a></p>
        </body>
      </html>`,
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    )

  } catch (error) {
    console.error('Instagram callback error:', error)
    return new Response(
      `<html><body><h1>Server Error</h1><p>An error occurred processing the Instagram callback.</p></body></html>`,
      { 
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }
}