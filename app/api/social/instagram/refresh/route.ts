import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Refresh Instagram profile data
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user's Instagram connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Instagram connection not found' }, { status: 404 })
    }

    // Check if token is still valid
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Access token expired. Please reconnect your Instagram account.' }, { status: 401 })
    }

    // Fetch updated user info from Instagram Graph API
    const userInfoResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${connection.access_token}`
    )

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json()
      console.error('Instagram API error:', errorData)
      return NextResponse.json({ error: 'Failed to fetch Instagram profile data' }, { status: 400 })
    }

    const userInfo = await userInfoResponse.json()

    // Update connection with fresh profile data
    const { error: updateError } = await supabase
      .from('social_connections')
      .update({
        profile_data: {
          id: userInfo.id,
          username: userInfo.username,
          account_type: userInfo.account_type,
          media_count: userInfo.media_count || 0
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    if (updateError) {
      console.error('Error updating Instagram connection:', updateError)
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: userInfo.id,
        username: userInfo.username,
        account_type: userInfo.account_type,
        media_count: userInfo.media_count || 0
      }
    })

  } catch (error) {
    console.error('Instagram refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}