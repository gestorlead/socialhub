import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, postId } = body

    if (!userId || !postId) {
      return NextResponse.json({ error: 'Missing userId or postId' }, { status: 400 })
    }

    // Create authenticated Supabase client using service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log(`[Facebook Status] Checking status for post: ${postId}`)

    // Get Facebook connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('access_token, profile_data')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Facebook not connected' }, { status: 404 })
    }

    // Find the page and its access token from the post_id
    // For now, we'll get the first page, but in a real scenario you'd need to 
    // match the post_id to the correct page
    const pages = connection.profile_data?.pages || []
    const page = pages[0]
    
    if (!page || !page.access_token) {
      return NextResponse.json({ error: 'Page not found or no access token' }, { status: 404 })
    }

    // Check the status of the Facebook post/video
    const statusResponse = await fetch(
      `https://graph.facebook.com/v23.0/${postId}?fields=status&access_token=${page.access_token}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    const statusData = await statusResponse.json()
    
    console.log(`[Facebook Status] API response for ${postId}:`, {
      status: statusResponse.status,
      ok: statusResponse.ok,
      data: statusData
    })

    if (!statusResponse.ok) {
      // If we can't get the status, assume it's still processing
      console.log(`[Facebook Status] Could not get status for ${postId}, assuming still processing`)
      return NextResponse.json({
        success: true,
        data: {
          status: 'PROCESSING',
          ready: false,
          post_id: postId
        }
      })
    }

    // Facebook video processing status logic
    // If the post exists and we can fetch it, it's likely published
    // Facebook doesn't provide a direct "PROCESSING" vs "READY" status like TikTok
    // so we infer from successful API responses
    const isReady = statusResponse.ok && statusData.id

    return NextResponse.json({
      success: true,
      data: {
        status: isReady ? 'PUBLISHED' : 'PROCESSING',
        ready: isReady,
        post_id: postId,
        facebook_data: statusData
      }
    })

  } catch (error) {
    console.error('[Facebook Status] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}