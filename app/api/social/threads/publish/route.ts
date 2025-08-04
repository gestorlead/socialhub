import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/social/threads/publish - Publish content to Threads
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Validate user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { text, media_type = 'TEXT', image_url, video_url, media_urls } = body

    // Validate input
    if (!text && !image_url && !video_url && !media_urls?.length) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Text length validation
    if (text && text.length > 500) {
      return NextResponse.json({ error: 'Text must be 500 characters or less' }, { status: 400 })
    }

    // Get user's Threads connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'threads')
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Threads account not connected' }, { status: 400 })
    }

    const threadsUserId = connection.platform_user_id
    const accessToken = connection.access_token

    // Check token expiry
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Access token expired' }, { status: 401 })
    }

    try {
      // Step 1: Create media container
      const createUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads`
      const createParams: any = {
        media_type: media_type,
        access_token: accessToken
      }

      // Add content based on media type
      if (text) {
        createParams.text = text
      }

      if (media_type === 'IMAGE' && image_url) {
        createParams.image_url = image_url
      } else if (media_type === 'VIDEO' && video_url) {
        createParams.video_url = video_url
      } else if (media_type === 'CAROUSEL' && media_urls?.length) {
        // For carousel, we need to create individual media containers first
        // This is a simplified implementation - full carousel support would require
        // creating multiple media containers and then a carousel container
        return NextResponse.json({ error: 'Carousel posts not yet supported' }, { status: 400 })
      }

      console.log('Creating Threads media container...')
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(createParams).toString()
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        console.error('Failed to create media container:', errorData)
        return NextResponse.json({
          error: 'Failed to create post',
          details: errorData.error?.message || 'Unknown error'
        }, { status: 400 })
      }

      const createData = await createResponse.json()
      const creationId = createData.id

      if (!creationId) {
        return NextResponse.json({ error: 'Invalid response from Threads API' }, { status: 500 })
      }

      // Step 2: Wait a moment before publishing (recommended by Threads API)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 3: Publish the media container
      const publishUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`
      const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken
      })

      console.log('Publishing Threads post...')
      const publishResponse = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: publishParams.toString()
      })

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json().catch(() => ({}))
        console.error('Failed to publish post:', errorData)
        return NextResponse.json({
          error: 'Failed to publish post',
          details: errorData.error?.message || 'Unknown error'
        }, { status: 400 })
      }

      const publishData = await publishResponse.json()
      const threadId = publishData.id

      // Save post to database
      const postData = {
        user_id: userId,
        thread_id: threadId,
        content: text,
        media_type: media_type,
        media_urls: image_url ? [image_url] : video_url ? [video_url] : media_urls || [],
        status: 'published',
        published_at: new Date().toISOString()
      }

      const { error: insertError } = await supabase
        .from('threads_posts')
        .insert(postData)

      if (insertError) {
        console.error('Failed to save post to database:', insertError)
        // Post was published but not saved locally - this is okay
      }

      return NextResponse.json({
        success: true,
        thread_id: threadId,
        message: 'Post published successfully'
      })

    } catch (error: any) {
      console.error('Error publishing to Threads:', error)
      return NextResponse.json({
        error: 'Failed to publish post',
        details: error.message
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in POST /api/social/threads/publish:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}