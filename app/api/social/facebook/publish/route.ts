import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient()
    
    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { 
      page_id, 
      message, 
      link,
      media_urls,
      media_type, // 'photo' or 'video'
      scheduled_publish_time,
      targeting,
      privacy
    } = body

    if (!page_id) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 })
    }

    if (!message && !link && !media_urls) {
      return NextResponse.json({ error: 'Message, link or media is required' }, { status: 400 })
    }

    // Get Facebook connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('access_token, profile_data')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Facebook not connected' }, { status: 404 })
    }

    // Find the page and its access token
    const pages = connection.profile_data?.pages || []
    const page = pages.find((p: any) => p.id === page_id)
    
    if (!page || !page.access_token) {
      return NextResponse.json({ error: 'Page not found or no access token' }, { status: 404 })
    }

    console.log('Publishing to Facebook page:', page.name)

    // Build the post data
    const postData: any = {}
    
    if (message) {
      postData.message = message
    }
    
    if (link) {
      postData.link = link
    }

    if (scheduled_publish_time) {
      const scheduledDate = new Date(scheduled_publish_time)
      const now = new Date()
      const minTime = new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes from now
      const maxTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      
      // Validate scheduled time is within Meta's required range
      if (scheduledDate < minTime) {
        return NextResponse.json({
          error: 'Scheduled time must be at least 10 minutes from now'
        }, { status: 400 })
      }
      
      if (scheduledDate > maxTime) {
        return NextResponse.json({
          error: 'Scheduled time cannot be more than 30 days from now'
        }, { status: 400 })
      }
      
      postData.published = false
      postData.scheduled_publish_time = Math.floor(scheduledDate.getTime() / 1000)
    }

    if (targeting) {
      postData.targeting = targeting
    }

    if (privacy) {
      postData.privacy = privacy
    }

    let publishResponse
    
    // Handle different types of posts
    if (media_urls && media_urls.length > 0) {
      if (media_type === 'video') {
        // Video post
        const videoUrl = media_urls[0]
        const videoResponse = await fetch(
          `https://graph.facebook.com/v23.0/${page_id}/videos`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${page.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...postData,
              file_url: videoUrl
            })
          }
        )
        
        publishResponse = videoResponse
      } else {
        // Photo post (single or multiple)
        if (media_urls.length === 1) {
          // Single photo
          const photoResponse = await fetch(
            `https://graph.facebook.com/v23.0/${page_id}/photos`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${page.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                ...postData,
                url: media_urls[0]
              })
            }
          )
          
          publishResponse = photoResponse
        } else {
          // Multiple photos (album)
          const photoIds = []
          
          // Upload each photo and collect IDs
          for (const mediaUrl of media_urls) {
            const photoResponse = await fetch(
              `https://graph.facebook.com/v23.0/${page_id}/photos`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${page.access_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  url: mediaUrl,
                  published: false // Don't publish individually
                })
              }
            )
            
            if (photoResponse.ok) {
              const photoData = await photoResponse.json()
              photoIds.push({ media_fbid: photoData.id })
            }
          }
          
          // Create the album post
          const albumResponse = await fetch(
            `https://graph.facebook.com/v23.0/${page_id}/feed`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${page.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                ...postData,
                attached_media: photoIds
              })
            }
          )
          
          publishResponse = albumResponse
        }
      }
    } else {
      // Text/link post
      const feedResponse = await fetch(
        `https://graph.facebook.com/v23.0/${page_id}/feed`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${page.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(postData)
        }
      )
      
      publishResponse = feedResponse
    }

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json()
      console.error('Facebook publish error:', errorData)
      
      return NextResponse.json(
        { 
          error: 'Failed to publish to Facebook',
          details: errorData.error?.message || 'Unknown error'
        },
        { status: 400 }
      )
    }

    const result = await publishResponse.json()
    console.log('Facebook publish success:', result)

    // Save publish record
    const { error: saveError } = await supabase
      .from('social_posts')
      .insert({
        user_id: user.id,
        platform: 'facebook',
        platform_post_id: result.id || result.post_id,
        page_id: page_id,
        content: message,
        media_urls: media_urls,
        media_type: media_type,
        scheduled_at: scheduled_publish_time || null,
        published_at: scheduled_publish_time ? null : new Date().toISOString(),
        status: scheduled_publish_time ? 'scheduled' : 'published',
        metadata: {
          page_name: page.name,
          link: link,
          targeting: targeting,
          privacy: privacy
        }
      })

    if (saveError) {
      console.error('Error saving post record:', saveError)
    }

    return NextResponse.json({
      success: true,
      post_id: result.id || result.post_id,
      page_id: page_id,
      page_name: page.name,
      scheduled: !!scheduled_publish_time
    })

  } catch (error) {
    console.error('Facebook publish error:', error)
    return NextResponse.json(
      { error: 'Failed to publish to Facebook' },
      { status: 500 }
    )
  }
}