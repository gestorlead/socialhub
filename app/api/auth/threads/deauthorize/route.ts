import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/auth/threads/deauthorize - Handle deauthorization request from Meta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id } = body

    console.log('Threads deauthorization request received for user:', user_id)

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Deactivate user's Threads connection in our database
    const { error: updateError } = await supabase
      .from('social_connections')
      .update({ 
        is_active: false,
        access_token: null,
        refresh_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('platform', 'threads')
      .eq('platform_user_id', user_id)

    if (updateError) {
      console.error('Failed to deauthorize Threads connection:', updateError)
      return NextResponse.json(
        { error: 'Failed to deauthorize connection' },
        { status: 500 }
      )
    }

    console.log('Threads connection deauthorized successfully for user:', user_id)

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Connection deauthorized successfully'
    })

  } catch (error) {
    console.error('Threads deauthorization error:', error)
    
    return NextResponse.json(
      { error: 'Failed to process deauthorization request' },
      { status: 500 }
    )
  }
}

// GET /api/auth/threads/deauthorize - Verify webhook (Meta requirement)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Verify webhook (use same token as other integrations for consistency)
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'socialhub-webhook-token'

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Threads deauthorization webhook verified')
    return new NextResponse(challenge)
  }

  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 }
  )
}