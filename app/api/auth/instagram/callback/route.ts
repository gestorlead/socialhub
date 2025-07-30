import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Handle Instagram OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const state = searchParams.get('state')

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
        `<html>
          <head>
            <title>Instagram Callback - Social Hub</title>
            <style>
              body {
                font-family: -apple-system, system-ui, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                max-width: 500px;
              }
              h1 { color: #333; margin-bottom: 1rem; }
              p { color: #666; line-height: 1.6; }
              .info { 
                background: #e3f2fd; 
                padding: 1rem; 
                border-radius: 4px; 
                margin: 1rem 0;
                color: #1976d2;
              }
              a {
                display: inline-block;
                margin-top: 1rem;
                padding: 0.75rem 1.5rem;
                background: #1976d2;
                color: white;
                text-decoration: none;
                border-radius: 4px;
              }
              a:hover { background: #1565c0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Instagram Callback</h1>
              <p>Esta página processa o retorno da autenticação do Instagram.</p>
              <div class="info">
                <strong>Acesso direto detectado!</strong><br>
                Para conectar sua conta Instagram, use o botão 
                "Connect Instagram" no painel de redes.
              </div>
              <a href="/networks/instagram">Ir para Instagram</a>
            </div>
          </body>
        </html>`,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    // Get state to identify the user
    if (!state) {
      return new Response(
        '<html><body><h1>Error</h1><p>Missing state parameter</p></body></html>',
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Decode state to get user_id
    let userId: string
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = decodedState.user_id
      if (!userId) throw new Error('No user_id in state')
    } catch (e) {
      console.error('❌ Error decoding state:', e)
      return new Response(
        '<html><body><h1>Error</h1><p>Invalid state parameter</p></body></html>',
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Get settings from database or environment
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('app_id, app_secret, oauth_redirect_uri')
      .eq('platform', 'instagram')
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

    console.log('🔄 Exchanging code for access token...')
    
    // Build the URL with parameters for Instagram OAuth
    const tokenUrl = new URL('https://api.instagram.com/oauth/access_token')
    
    // Instagram requires POST with form data
    const formData = new URLSearchParams()
    formData.append('client_id', appId)
    formData.append('client_secret', appSecret)
    formData.append('grant_type', 'authorization_code')
    formData.append('redirect_uri', redirectUri)
    formData.append('code', code)

    // Exchange code for access token using Instagram API
    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('❌ Token exchange error:', errorData)
      return new Response(
        `<html><body><h1>Token Exchange Error</h1><p>${JSON.stringify(errorData)}</p></body></html>`,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token data received:', { hasToken: !!tokenData.access_token })
    const { access_token, user_id } = tokenData

    console.log('🔄 Getting Instagram user info...')
    
    // Get user info from Instagram Graph API for Business
    const userInfoResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${access_token}`
    )

    let userInfo = { id: user_id, username: null, account_type: null, media_count: 0 }
    
    if (userInfoResponse.ok) {
      const instagramUserInfo = await userInfoResponse.json()
      userInfo = {
        id: instagramUserInfo.id,
        username: instagramUserInfo.username,
        account_type: instagramUserInfo.account_type,
        media_count: instagramUserInfo.media_count || 0
      }
      console.log('✅ Instagram user info:', userInfo)
    } else {
      console.warn('⚠️ Failed to get Instagram user info')
    }

    // Check if account is Professional (Business or Creator)
    if (userInfo.account_type && !['BUSINESS', 'CREATOR'].includes(userInfo.account_type)) {
      return new Response(
        `<html>
          <head>
            <title>Instagram Account Type Error</title>
            <style>
              body {
                font-family: -apple-system, system-ui, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                max-width: 500px;
              }
              h1 { color: #e74c3c; margin-bottom: 1rem; }
              p { color: #666; line-height: 1.6; }
              .warning { 
                background: #ffe4e1; 
                padding: 1rem; 
                border-radius: 4px; 
                margin: 1rem 0;
                color: #c0392b;
              }
              a {
                display: inline-block;
                margin-top: 1rem;
                padding: 0.75rem 1.5rem;
                background: #3498db;
                color: white;
                text-decoration: none;
                border-radius: 4px;
              }
              a:hover { background: #2980b9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⚠️ Conta Pessoal Detectada</h1>
              <div class="warning">
                <strong>Tipo de conta: ${userInfo.account_type || 'PERSONAL'}</strong><br>
                Para publicar conteúdo através da API, você precisa de uma conta Instagram Professional (Business ou Creator).
              </div>
              <p><strong>Como converter para conta Professional:</strong></p>
              <ol style="text-align: left;">
                <li>Abra o Instagram no seu celular</li>
                <li>Vá para seu perfil</li>
                <li>Toque no menu (☰) e selecione "Configurações"</li>
                <li>Toque em "Conta"</li>
                <li>Toque em "Mudar para conta profissional"</li>
                <li>Escolha entre "Criador" ou "Empresa"</li>
              </ol>
              <a href="/networks/instagram">Voltar para Instagram</a>
            </div>
          </body>
        </html>`,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    console.log('🔄 Exchanging for long-lived token...')
    
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
      console.log('✅ Long-lived token obtained, expires in:', expiresIn, 'seconds')
    } else {
      console.warn('⚠️ Failed to get long-lived token, using short-lived token')
    }

    console.log('💾 Saving Instagram connection to database...')
    
    // Save or update user's Instagram connection
    const connectionData = {
      user_id: userId,
      platform: 'instagram',
      platform_user_id: userInfo.id,
      access_token: finalAccessToken,
      refresh_token: null, // Instagram doesn't use refresh tokens
      expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      is_active: true,
      profile_data: {
        id: userInfo.id,
        username: userInfo.username,
        account_type: userInfo.account_type,
        media_count: userInfo.media_count
      },
      updated_at: new Date().toISOString()
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .single()

    let result
    if (existingConnection) {
      // Update existing connection
      result = await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
    } else {
      // Create new connection
      result = await supabase
        .from('social_connections')
        .insert({
          ...connectionData,
          created_at: new Date().toISOString()
        })
    }

    if (result.error) {
      console.error('❌ Error saving Instagram connection:', result.error)
    } else {
      console.log('✅ Instagram connection saved successfully')
    }

    // Success page with auto-redirect
    return new Response(
      `<html>
        <head>
          <title>Instagram Authentication Success</title>
          <style>
            body {
              font-family: -apple-system, system-ui, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              max-width: 500px;
            }
            h1 { color: #4caf50; margin-bottom: 1rem; }
            p { color: #666; line-height: 1.6; }
            .success { 
              background: #e8f5e8; 
              padding: 1rem; 
              border-radius: 4px; 
              margin: 1rem 0;
              color: #2e7d32;
            }
            .info {
              background: #f5f5f5;
              padding: 1rem;
              border-radius: 4px;
              margin: 1rem 0;
              text-align: left;
            }
            .info strong { color: #333; }
            a {
              display: inline-block;
              margin-top: 1rem;
              padding: 0.75rem 1.5rem;
              background: #4caf50;
              color: white;
              text-decoration: none;
              border-radius: 4px;
            }
            a:hover { background: #45a049; }
            .countdown { font-weight: bold; color: #4caf50; }
          </style>
          <script>
            let countdown = 5;
            function updateCountdown() {
              document.getElementById('countdown').textContent = countdown;
              if (countdown <= 0) {
                window.location.href = '/networks/instagram';
              } else {
                countdown--;
                setTimeout(updateCountdown, 1000);
              }
            }
            window.onload = updateCountdown;
          </script>
        </head>
        <body>
          <div class="container">
            <h1>✅ Instagram Connected Successfully!</h1>
            <div class="success">
              <strong>Conta conectada com sucesso!</strong><br>
              Agora você pode publicar conteúdo através do Social Hub.
            </div>
            <div class="info">
              <p><strong>Instagram User ID:</strong> ${userInfo.id || 'N/A'}</p>
              <p><strong>Username:</strong> @${userInfo.username || 'N/A'}</p>
              <p><strong>Account Type:</strong> ${userInfo.account_type || 'N/A'}</p>
              <p><strong>Token Expires:</strong> ${expiresIn ? `${Math.floor(expiresIn / 86400)} days` : 'Unknown'}</p>
            </div>
            <p>Redirecionando em <span id="countdown" class="countdown">5</span> segundos...</p>
            <a href="/networks/instagram">Ir para Minhas Redes Agora</a>
          </div>
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