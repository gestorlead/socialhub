import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    const supabase = createClient()
    
    // Check current user (secure method)
    const { data: { user }, error: sessionError } = await supabase.auth.getUser()
    const session = user ? { user } : null
    
    // Get social connections
    const { data: connections, error: connectionsError } = await supabase
      .from('social_connections')
      .select('id, platform, platform_user_id, access_token, refresh_token, scope, expires_at, profile_data, created_at, updated_at')
      .eq('user_id', userId)
    
    return NextResponse.json({
      debug: {
        userId,
        hasSession: !!session,
        sessionUser: session?.user?.id,
        sessionError: sessionError?.message,
        connections: connections || [],
        connectionsError: connectionsError?.message,
        connectionsCount: connections?.length || 0,
        tiktokConnections: connections?.filter(c => c.platform === 'tiktok') || []
      }
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}