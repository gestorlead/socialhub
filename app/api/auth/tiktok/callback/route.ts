import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const scopes = searchParams.get('scopes') // TikTok retorna 'scopes' no callback
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    
    console.log('TikTok callback received:', { code: !!code, state, scopes, error })

    // Handle authorization errors
    if (error) {
      console.error('TikTok OAuth error:', error, errorDescription)
      return NextResponse.redirect(`${process.env.FRONTEND_URL}/?error=tiktok_auth_failed`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.FRONTEND_URL}/?error=missing_parameters`)
    }

    // Validate state token
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('user_id')
      .eq('state', state)
      .eq('provider', 'tiktok')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (stateError || !stateData) {
      console.error('Invalid or expired state token:', stateError)
      return NextResponse.redirect(`${process.env.FRONTEND_URL}/?error=invalid_state`)
    }

    // Clean up used state token
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state)

    // Exchange code for access token
    // IMPORTANTE: usar EXATAMENTE o mesmo redirect_uri da autorização
    const redirectUri = `${process.env.FRONTEND_URL}/api/auth/tiktok/callback`
    
    // Debug detalhado ANTES da requisição
    console.log('=== TOKEN EXCHANGE DEBUG ===')
    console.log('Code recebido:', code?.substring(0, 20) + '...')
    console.log('State validado:', state)
    console.log('Redirect URI:', redirectUri)
    console.log('Client Key:', process.env.TIKTOK_CLIENT_KEY)
    console.log('Client Secret existe?', !!process.env.TIKTOK_CLIENT_SECRET)
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL)

    // Construir body e logar
    const bodyParams = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })

    console.log('Body completo sendo enviado:', bodyParams.toString())

    let tokenData
    try {
      const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        },
        body: bodyParams
      })

      // Log da resposta ANTES de tentar parse
      console.log('=== RESPOSTA DO TIKTOK ===')
      console.log('Status:', tokenResponse.status)
      console.log('Status Text:', tokenResponse.statusText)
      console.log('Headers:', Object.fromEntries(tokenResponse.headers))
      
      // Pegar resposta como texto primeiro
      const responseText = await tokenResponse.text()
      console.log('Resposta raw completa:', responseText)

      // Tentar parse apenas se OK
      if (tokenResponse.ok) {
        try {
          tokenData = JSON.parse(responseText)
          console.log('=== TOKEN OBTIDO COM SUCESSO ===')
          console.log('Access token:', tokenData.access_token?.substring(0, 20) + '...')
          console.log('Open ID:', tokenData.open_id)
          console.log('Expires in:', tokenData.expires_in)
          console.log('Scope:', tokenData.scope)
        } catch (parseError) {
          console.error('Erro ao fazer parse do JSON de sucesso:', parseError)
          return NextResponse.redirect(`${process.env.FRONTEND_URL}/?error=json_parse_error`)
        }
      } else {
        console.error('=== ERRO DO TIKTOK ===')
        console.error('Erro completo:', responseText)
        
        // Tentar parse do erro
        try {
          const errorData = JSON.parse(responseText)
          console.error('Erro estruturado:', JSON.stringify(errorData, null, 2))
        } catch {
          console.error('Resposta de erro não é JSON válido')
        }
        
        return NextResponse.redirect(`${process.env.FRONTEND_URL}/?error=token_exchange_failed&details=${encodeURIComponent(responseText)}`)
      }
    } catch (error) {
      console.error('=== ERRO NA REQUISIÇÃO ===')
      console.error('Erro na requisição:', error)
      return NextResponse.redirect(`${process.env.FRONTEND_URL}/?error=request_failed`)
    }
    console.log('=== ANÁLISE DOS SCOPES ===')
    console.log('Token exchange response completo:', JSON.stringify(tokenData, null, 2))
    console.log('Scope from token response:', tokenData.scope)
    console.log('Scopes from callback URL:', scopes)
    
    const { access_token, refresh_token, expires_in } = tokenData
    
    // Use scopes from callback (preferred) or from token response as fallback
    const finalScope = scopes || tokenData.scope || 'user.info.basic,video.publish'
    
    // TEMP: Forçar scope para debug se estiver undefined
    const scopeToSave = finalScope || 'user.info.basic,video.publish'
    
    console.log('Final scope calculado:', finalScope)
    console.log('Usando scope de:', scopes ? 'callback' : tokenData.scope ? 'token response' : 'fallback')

    // Fetch user profile - TikTok might not require fetching profile separately
    // as token response might include user info
    let userInfo = null
    
    // Check if token response already includes user info
    if (tokenData.open_id || tokenData.user || tokenData.data?.user) {
      console.log('User info found in token response:', tokenData)
      userInfo = tokenData.data?.user || tokenData.user || tokenData
    } else {
      // Try to fetch user profile using API v2
      const profileUrl = new URL('https://open.tiktokapis.com/v2/user/info/')
      profileUrl.searchParams.append('fields', [
        'open_id',
        'union_id',
        'avatar_url',
        'avatar_url_100',
        'avatar_large_url',
        'display_name',
        'username',
        'bio_description',
        'is_verified',
        'profile_deep_link',
        'follower_count',
        'following_count',
        'likes_count',
        'video_count'
      ].join(','))
      
      const profileResponse = await fetch(profileUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text()
        console.error('Failed to fetch TikTok user profile:', profileResponse.status, errorText)
        // Continue without profile data - use a placeholder ID
        userInfo = {
          open_id: `tiktok_${Date.now()}`,
          display_name: 'TikTok User'
        }
      } else {
        const profileData = await profileResponse.json()
        console.log('Profile response:', JSON.stringify(profileData, null, 2))
        
        // API v2 response structure
        if (profileData.data?.user) {
          userInfo = profileData.data.user
        } else if (profileData.error) {
          console.error('TikTok API error:', profileData.error)
          userInfo = {
            open_id: `tiktok_${Date.now()}`,
            display_name: 'TikTok User'
          }
        } else {
          userInfo = profileData
        }
      }
    }

    // Store connection in database
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()
    
    const { error: connectionError } = await supabase
      .from('social_connections')
      .upsert({
        user_id: stateData.user_id,
        platform: 'tiktok',
        platform_user_id: userInfo.open_id,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: expiresAt,
        scope: scopeToSave,
        profile_data: {
          open_id: userInfo.open_id,
          union_id: userInfo.union_id,
          avatar_url: userInfo.avatar_url,
          avatar_url_100: userInfo.avatar_url_100,
          avatar_large_url: userInfo.avatar_large_url,
          display_name: userInfo.display_name,
          username: userInfo.username,
          bio_description: userInfo.bio_description,
          is_verified: userInfo.is_verified,
          follower_count: userInfo.follower_count || 0,
          following_count: userInfo.following_count || 0,
          likes_count: userInfo.likes_count || 0,
          video_count: userInfo.video_count || 0
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform'
      })

    if (connectionError) {
      console.error('Error storing TikTok connection:', connectionError)
      return NextResponse.redirect(`${process.env.FRONTEND_URL}/?error=connection_storage_failed`)
    }

    // Redirect to dashboard with success
    return NextResponse.redirect(`${process.env.FRONTEND_URL}/?connected=tiktok`)
  } catch (error) {
    console.error('TikTok OAuth callback error:', error)
    return NextResponse.redirect(`${process.env.FRONTEND_URL}/?error=internal_error`)
  }
}