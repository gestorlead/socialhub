import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/auth/threads/data-deletion - Handle data deletion request from Meta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id } = body

    console.log('Threads data deletion request received for user:', user_id)

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Delete user's Threads data from our database
    const { error: deleteError } = await supabase
      .from('social_connections')
      .delete()
      .eq('platform', 'threads')
      .eq('platform_user_id', user_id)

    if (deleteError) {
      console.error('Failed to delete Threads data:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete user data' },
        { status: 500 }
      )
    }

    console.log('Threads data deleted successfully for user:', user_id)

    // Return required response format for Meta
    return NextResponse.json({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/data-deletion-status?user_id=${user_id}`,
      confirmation_code: `THREADS_DELETE_${user_id}_${Date.now()}`
    })

  } catch (error) {
    console.error('Threads data deletion error:', error)
    
    return NextResponse.json(
      { error: 'Failed to process data deletion request' },
      { status: 500 }
    )
  }
}

// GET /api/auth/threads/data-deletion - Verify webhook (Meta requirement)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Verify webhook (use same token as other integrations for consistency)
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'socialhub-webhook-token'

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Threads data deletion webhook verified')
    return new NextResponse(challenge)
  }

  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 }
  )
}