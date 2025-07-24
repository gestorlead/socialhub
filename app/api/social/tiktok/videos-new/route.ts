import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export async function GET(request: NextRequest) {
  console.log('[NEW TikTok Videos API] Starting request')
  
  try {
    // Get authorization token from request headers
    const authHeader = request.headers.get('authorization')
    console.log('[NEW TikTok Videos API] Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[NEW TikTok Videos API] No valid authorization token')
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('[NEW TikTok Videos API] Token extracted, length:', token.length)
    
    // Create Supabase client with user token
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )
    
    console.log('[NEW TikTok Videos API] Supabase client created')

    // Verify the user token
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('[NEW TikTok Videos API] User verification:', { hasUser: !!user, authError: !!authError })
    
    if (authError || !user) {
      console.log('[NEW TikTok Videos API] Auth failed:', authError?.message)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    console.log('[NEW TikTok Videos API] User authenticated:', user.id)
    
    return NextResponse.json({
      success: true,
      message: 'Authentication working!',
      userId: user.id,
      userEmail: user.email
    })
    
  } catch (error) {
    console.error('[NEW TikTok Videos API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}