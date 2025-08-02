import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Handle Facebook OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const state = searchParams.get('state')

    // Handle OAuth errors
    if (error) {
      console.error('Facebook OAuth error:', error, errorDescription)
      return new Response(
        `<html><body><h1>Facebook Authentication Error</h1><p>${error}: ${errorDescription}</p></body></html>`,
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
            <title>Facebook Callback - Social Hub</title>
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
                background: #1877f2;
                color: white;
                text-decoration: none;
                border-radius: 4px;
              }
              a:hover { background: #166fe5; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Facebook Callback</h1>
              <p>Esta página processa o retorno da autenticação do Facebook.</p>
              <div class="info">
                <strong>Acesso direto detectado!</strong><br>
                Para conectar suas páginas do Facebook, use o botão 
                "Connect Facebook" no painel de redes.
              </div>
              <a href="/networks/facebook">Ir para Facebook</a>
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
      .select('app_id, client_secret, callback_url')
      .eq('platform', 'facebook')
      .single()

    const appId = settings?.app_id || process.env.FACEBOOK_APP_ID
    const appSecret = settings?.client_secret || process.env.FACEBOOK_APP_SECRET
    const redirectUri = settings?.callback_url || 
      process.env.FACEBOOK_OAUTH_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/auth/facebook/callback`
    const apiVersion = 'v23.0' // Always use v23.0

    if (!appId || !appSecret) {
      return new Response(
        '<html><body><h1>Configuration Error</h1><p>Facebook credentials not configured</p></body></html>',
        { 
          status: 500,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    console.log('🔄 Exchanging code for access token...')
    
    // Exchange code for access token
    const tokenUrl = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)
    
    const tokenResponse = await fetch(tokenUrl.toString())

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
    const { access_token } = tokenData

    console.log('🔄 Getting Facebook user info...')
    
    // Get user info
    const userInfoResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/me?fields=id,name,email&access_token=${access_token}`
    )

    let userInfo = { id: '', name: 'Unknown User', email: '' }
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json()
      console.log('✅ Facebook user info:', { id: userInfo.id, name: userInfo.name })
    } else {
      console.warn('⚠️ Failed to get Facebook user info')
    }

    console.log('🔄 Getting Facebook pages...')
    
    // Get user's pages with extended fields
    const pagesResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/me/accounts?fields=id,name,category,access_token,is_published,about,fan_count,followers_count,picture{url}&access_token=${access_token}`
    )

    let pages = []
    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json()
      if (pagesData.data && Array.isArray(pagesData.data)) {
        pages = pagesData.data.map(page => ({
          id: page.id,
          name: page.name,
          category: page.category || 'Unknown',
          access_token: page.access_token,
          is_published: page.is_published !== false,
          about: page.about || '',
          fan_count: page.fan_count || 0,
          followers_count: page.followers_count || 0,
          picture: page.picture?.data?.url || null,
          is_active: true
        }))
        console.log(`✅ Found ${pages.length} Facebook pages`)
      }
    } else {
      console.warn('⚠️ Failed to get Facebook pages')
    }

    console.log('💾 Saving Facebook connection to database...')
    
    // Save or update user's Facebook connection in social_connections table
    const connectionData = {
      user_id: userId,
      platform: 'facebook',
      platform_user_id: userInfo.id,
      access_token: access_token,
      refresh_token: null, // Facebook doesn't use refresh tokens
      expires_at: null, // Facebook long-lived tokens don't have expiry
      is_active: true,
      profile_data: {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        pages: pages
      },
      updated_at: new Date().toISOString()
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
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
      console.error('❌ Error saving Facebook connection:', result.error)
    } else {
      console.log('✅ Facebook connection saved successfully')
    }

    // Determine redirect URL based on page count
    const redirectUrl = pages.length > 1 ? '/networks/facebook/select-page' : '/networks/facebook'
    
    // Success page with auto-redirect
    return new Response(
      `<html>
        <head>
          <title>Facebook Authentication Success</title>
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
            h1 { color: #1877f2; margin-bottom: 1rem; }
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
            .pages { 
              margin: 1rem 0; 
              text-align: left;
              max-height: 200px;
              overflow-y: auto;
            }
            .page { 
              padding: 0.5rem; 
              background: #fff; 
              border: 1px solid #ddd; 
              margin: 0.25rem 0; 
              border-radius: 4px;
              font-size: 0.9rem;
            }
            .next-step {
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
              background: #1877f2;
              color: white;
              text-decoration: none;
              border-radius: 4px;
            }
            a:hover { background: #166fe5; }
            .countdown { font-weight: bold; color: #1877f2; }
          </style>
          <script>
            let countdown = 5;
            function updateCountdown() {
              document.getElementById('countdown').textContent = countdown;
              if (countdown <= 0) {
                window.location.href = '${redirectUrl}';
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
            <h1>✅ Facebook Connected Successfully!</h1>
            <div class="success">
              <strong>Conta conectada com sucesso!</strong><br>
              Agora você pode publicar conteúdo através do Social Hub.
            </div>
            <div class="info">
              <p><strong>Facebook User:</strong> ${userInfo.name || 'N/A'}</p>
              <p><strong>Pages found:</strong> ${pages.length}</p>
            </div>
            ${pages.length > 0 ? `
              <div class="pages">
                <strong>Your Facebook Pages:</strong>
                ${pages.map(page => `
                  <div class="page">
                    ${page.name} - ${page.category}
                  </div>
                `).join('')}
              </div>
            ` : '<p><em>No pages found. Make sure you have admin access to Facebook pages.</em></p>'}
            
            ${pages.length > 1 ? `
              <div class="next-step">
                <strong>Próximo passo:</strong> Escolha qual página você deseja gerenciar no Social Hub.
              </div>
            ` : ''}
            
            <p>Redirecionando em <span id="countdown" class="countdown">5</span> segundos...</p>
            <a href="${redirectUrl}">
              ${pages.length > 1 ? 'Escolher Página' : 'Ir para Minhas Redes Agora'}
            </a>
          </div>
        </body>
      </html>`,
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    )

  } catch (error) {
    console.error('Facebook callback error:', error)
    return new Response(
      `<html><body><h1>Server Error</h1><p>An error occurred processing the Facebook callback.</p></body></html>`,
      { 
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }
}