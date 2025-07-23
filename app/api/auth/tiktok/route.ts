import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

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

    // TikTok OAuth parameters - construir manualmente para evitar encoding da vírgula
    // IMPORTANTE: usar o mesmo redirect_uri configurado no TikTok
    const redirectUri = `${process.env.FRONTEND_URL}/api/auth/tiktok/callback`
    
    // NÃO usar URLSearchParams para evitar encoding da vírgula nos scopes
    const params = [
      `client_key=${process.env.TIKTOK_CLIENT_KEY!}`,
      `scope=user.info.basic,video.publish`, // Vírgula SEM encoding
      `response_type=code`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      `state=${state}`
    ].join('&')

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params}`

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('TikTok OAuth initialization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}