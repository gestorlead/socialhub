import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Get the TikTok connection data
    const { data, error } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .single()

    if (error) {
      console.error('Error fetching TikTok connection:', error)
      return NextResponse.json({ error: 'Failed to fetch connection', details: error }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'No TikTok connection found' }, { status: 404 })
    }

    // Return all data for debugging
    return NextResponse.json({
      success: true,
      connection: {
        id: data.id,
        platform: data.platform,
        platform_user_id: data.platform_user_id,
        scope: data.scope,
        profile_data: data.profile_data,
        created_at: data.created_at,
        updated_at: data.updated_at,
        expires_at: data.expires_at,
        has_access_token: !!data.access_token,
        has_refresh_token: !!data.refresh_token
      },
      raw_data: data
    })
  } catch (error) {
    console.error('Debug route error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}