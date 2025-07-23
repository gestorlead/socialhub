import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get the current refresh token
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'TikTok connection not found' }, { status: 404 })
    }

    if (!connection.refresh_token) {
      return NextResponse.json({ error: 'No refresh token available' }, { status: 400 })
    }

    // Check if token is close to expiring (refresh if less than 1 hour remaining)
    const expiresAt = new Date(connection.expires_at)
    const now = new Date()
    const timeUntilExpiry = expiresAt.getTime() - now.getTime()
    const oneHour = 60 * 60 * 1000

    if (timeUntilExpiry > oneHour) {
      return NextResponse.json({ 
        message: 'Token is still valid',
        expires_at: connection.expires_at,
        time_remaining_hours: Math.round(timeUntilExpiry / (60 * 60 * 1000))
      })
    }

    console.log('Refreshing TikTok access token for user:', userId)

    // Refresh the access token
    const refreshResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token
      })
    })

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text()
      console.error('Failed to refresh TikTok token:', refreshResponse.status, errorText)
      return NextResponse.json({ 
        error: 'Failed to refresh token',
        details: errorText,
        status: refreshResponse.status
      }, { status: 500 })
    }

    const tokenData = await refreshResponse.json()
    console.log('Token refresh response:', { 
      access_token: tokenData.access_token ? 'present' : 'missing',
      expires_in: tokenData.expires_in,
      refresh_token: tokenData.refresh_token ? 'present' : 'missing',
      scope: tokenData.scope 
    })

    // Calculate new expiration time
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    // Update the connection with new tokens
    const { error: updateError } = await supabase
      .from('social_connections')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token, // Use new refresh token if provided
        expires_at: newExpiresAt,
        scope: tokenData.scope,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('platform', 'tiktok')

    if (updateError) {
      console.error('Error updating tokens:', updateError)
      return NextResponse.json({ error: 'Failed to update tokens' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      expires_at: newExpiresAt,
      scope: tokenData.scope,
      expires_in_hours: Math.round(tokenData.expires_in / 3600)
    })

  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}