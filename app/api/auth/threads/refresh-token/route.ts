import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/auth/threads/refresh-token - Refresh long-lived token
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get current connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'threads')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Threads connection found' },
        { status: 404 }
      )
    }

    // Check if token is at least 24 hours old
    const tokenAge = Date.now() - new Date(connection.created_at).getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000

    if (tokenAge < twentyFourHours) {
      return NextResponse.json(
        { error: 'Token must be at least 24 hours old to refresh' },
        { status: 400 }
      )
    }

    // Get settings
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('app_secret')
      .eq('platform', 'threads')
      .single()

    const appSecret = settings?.app_secret || process.env.THREADS_APP_SECRET

    if (!appSecret) {
      return NextResponse.json(
        { error: 'Threads credentials not configured' },
        { status: 500 }
      )
    }

    // Refresh the long-lived token
    const refreshUrl = 'https://graph.threads.net/refresh_access_token'
    const params = new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: connection.access_token
    })

    console.log('Refreshing Threads token...')
    const response = await fetch(`${refreshUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Token refresh failed:', errorData)
      return NextResponse.json(
        { error: 'Failed to refresh token' },
        { status: 500 }
      )
    }

    const tokenData = await response.json()
    
    if (!tokenData.access_token) {
      return NextResponse.json(
        { error: 'Invalid refresh response' },
        { status: 500 }
      )
    }

    // Update connection with new token
    const { error: updateError } = await supabase
      .from('social_connections')
      .update({
        access_token: tokenData.access_token,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('platform', 'threads')

    if (updateError) {
      console.error('Failed to update token:', updateError)
      return NextResponse.json(
        { error: 'Failed to save refreshed token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      expires_in: tokenData.expires_in,
      message: 'Token refreshed successfully'
    })

  } catch (error) {
    console.error('Threads token refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    )
  }
}