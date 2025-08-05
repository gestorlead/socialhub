import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface InstagramPublishRequest {
  userId: string
  optionId: 'instagram_feed' | 'instagram_story' | 'instagram_reels'
  mediaUrls: string[]
  caption: string
  settings?: Record<string, any>
}

// POST - Publish content to Instagram
export async function POST(request: NextRequest) {
  try {
    const body: InstagramPublishRequest = await request.json()
    const { userId, optionId, mediaUrls, caption, settings } = body

    console.log(`[Instagram Publish] Starting ${optionId} publish for user:`, userId)

    if (!userId || !optionId || !mediaUrls?.length) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Get Instagram connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('access_token, platform_user_id, profile_data')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      console.error('[Instagram Publish] Connection not found:', connectionError)
      return NextResponse.json(
        { error: 'Instagram connection not found or inactive' },
        { status: 404 }
      )
    }

    const igUserId = connection.platform_user_id
    const accessToken = connection.access_token

    console.log(`[Instagram Publish] Using Instagram User ID:`, igUserId)

    // Determine media type and API parameters based on optionId
    let mediaType: string
    let additionalParams: Record<string, any> = {}

    switch (optionId) {
      case 'instagram_feed':
        mediaType = mediaUrls.length > 1 ? 'CAROUSEL' : 'IMAGE'
        if (mediaUrls[0].includes('.mp4') || mediaUrls[0].includes('.mov')) {
          mediaType = 'VIDEO'
        }
        break
      case 'instagram_story':
        mediaType = 'STORIES'
        break
      case 'instagram_reels':
        mediaType = 'REELS'
        break
      default:
        return NextResponse.json(
          { error: 'Invalid Instagram option type' },
          { status: 400 }
        )
    }

    let publishId: string

    if (mediaType === 'CAROUSEL') {
      // Handle carousel posts (multiple media items)
      publishId = await publishCarousel(igUserId, accessToken, mediaUrls, caption)
    } else {
      // Handle single media posts
      publishId = await publishSingleMedia(igUserId, accessToken, mediaUrls[0], caption, mediaType)
    }

    // Save post record to database
    const { error: saveError } = await supabase
      .from('social_posts')
      .insert({
        user_id: userId,
        platform: 'instagram',
        platform_post_id: publishId,
        content: caption,
        media_urls: mediaUrls,
        status: 'published',
        published_at: new Date().toISOString(),
        metadata: {
          option_id: optionId,
          media_type: mediaType,
          settings: settings || {}
        }
      })

    if (saveError) {
      console.warn('[Instagram Publish] Error saving post record:', saveError)
      // Continue anyway, the post was published successfully
    }

    console.log(`[Instagram Publish] ${optionId} published successfully:`, publishId)

    return NextResponse.json({
      success: true,
      data: {
        publish_id: publishId,
        media_type: mediaType,
        option_id: optionId,
        platform: 'instagram'
      }
    })

  } catch (error) {
    console.error('[Instagram Publish] Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Instagram publish failed',
        details: error instanceof Error ? error.stack : undefined 
      },
      { status: 500 }
    )
  }
}

// Publish single media (Image, Video, Story, Reels)
async function publishSingleMedia(
  igUserId: string,
  accessToken: string,
  mediaUrl: string,
  caption: string,
  mediaType: string
): Promise<string> {
  
  console.log(`[Instagram Publish] Creating ${mediaType} container`)

  // Ensure HTTPS URL
  const httpsMediaUrl = mediaUrl.replace(/^http:/, 'https:')
  console.log(`[Instagram Publish] Using HTTPS URL: ${httpsMediaUrl}`)

  // Step 1: Create media container
  const containerParams = new URLSearchParams({
    access_token: accessToken,
    caption: caption
  })

  // Determine if this is a video based on URL or media type
  const isVideo = mediaType === 'VIDEO' || mediaType === 'REELS' || mediaType === 'STORIES' && httpsMediaUrl.includes('.mp4')

  if (isVideo) {
    containerParams.append('video_url', httpsMediaUrl)
  } else {
    containerParams.append('image_url', httpsMediaUrl)
  }

  // Add media type for Stories and Reels
  if (mediaType === 'STORIES' || mediaType === 'REELS') {
    containerParams.append('media_type', mediaType)
  }

  const containerResponse = await fetch(
    `https://graph.instagram.com/${igUserId}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: containerParams
    }
  )

  if (!containerResponse.ok) {
    const error = await containerResponse.json()
    console.error('[Instagram Publish] Container creation failed:', error)
    throw new Error(`Container creation failed: ${error.error?.message || containerResponse.statusText}`)
  }

  const containerData = await containerResponse.json()
  const creationId = containerData.id

  console.log(`[Instagram Publish] Container created:`, creationId)

  // Step 2: Wait for video processing if needed (for videos only)
  if (isVideo) {
    console.log(`[Instagram Publish] Waiting for video processing...`)
    await waitForMediaProcessing(igUserId, creationId, accessToken)
  }

  // Step 3: Publish media container
  const publishParams = new URLSearchParams({
    access_token: accessToken,
    creation_id: creationId
  })

  const publishResponse = await fetch(
    `https://graph.instagram.com/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams
    }
  )

  if (!publishResponse.ok) {
    const error = await publishResponse.json()
    console.error('[Instagram Publish] Publish failed:', error)
    throw new Error(`Publish failed: ${error.error?.message || publishResponse.statusText}`)
  }

  const publishData = await publishResponse.json()
  
  console.log(`[Instagram Publish] Media published:`, publishData.id)
  
  return publishData.id
}

// Publish carousel (multiple media items)
async function publishCarousel(
  igUserId: string,
  accessToken: string,
  mediaUrls: string[],
  caption: string
): Promise<string> {
  
  console.log(`[Instagram Publish] Creating carousel with ${mediaUrls.length} items`)

  // Step 1: Create container for each media item
  const childrenIds: string[] = []

  for (const [index, mediaUrl] of mediaUrls.entries()) {
    console.log(`[Instagram Publish] Creating child container ${index + 1}/${mediaUrls.length}`)

    // Ensure HTTPS URL
    const httpsMediaUrl = mediaUrl.replace(/^http:/, 'https:')
    const isVideo = httpsMediaUrl.includes('.mp4') || httpsMediaUrl.includes('.mov')
    const containerParams = new URLSearchParams({
      access_token: accessToken,
      is_carousel_item: 'true'
    })

    if (isVideo) {
      containerParams.append('video_url', httpsMediaUrl)
      containerParams.append('media_type', 'VIDEO')
    } else {
      containerParams.append('image_url', httpsMediaUrl)
    }

    const containerResponse = await fetch(
      `https://graph.instagram.com/${igUserId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: containerParams
      }
    )

    if (!containerResponse.ok) {
      const error = await containerResponse.json()
      console.error(`[Instagram Publish] Child container ${index + 1} creation failed:`, error)
      throw new Error(`Child container creation failed: ${error.error?.message || containerResponse.statusText}`)
    }

    const containerData = await containerResponse.json()
    childrenIds.push(containerData.id)
  }

  console.log(`[Instagram Publish] All child containers created:`, childrenIds)

  // Step 2: Create carousel container
  const carouselParams = new URLSearchParams({
    access_token: accessToken,
    media_type: 'CAROUSEL',
    children: childrenIds.join(','),
    caption: caption
  })

  const carouselResponse = await fetch(
    `https://graph.instagram.com/${igUserId}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: carouselParams
    }
  )

  if (!carouselResponse.ok) {
    const error = await carouselResponse.json()
    console.error('[Instagram Publish] Carousel container creation failed:', error)
    throw new Error(`Carousel container creation failed: ${error.error?.message || carouselResponse.statusText}`)
  }

  const carouselData = await carouselResponse.json()
  const carouselId = carouselData.id

  console.log(`[Instagram Publish] Carousel container created:`, carouselId)

  // Step 3: Publish carousel
  const publishParams = new URLSearchParams({
    access_token: accessToken,
    creation_id: carouselId
  })

  const publishResponse = await fetch(
    `https://graph.instagram.com/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams
    }
  )

  if (!publishResponse.ok) {
    const error = await publishResponse.json()
    console.error('[Instagram Publish] Carousel publish failed:', error)
    throw new Error(`Carousel publish failed: ${error.error?.message || publishResponse.statusText}`)
  }

  const publishData = await publishResponse.json()
  
  console.log(`[Instagram Publish] Carousel published:`, publishData.id)
  
  return publishData.id
}

// Wait for media processing (for videos)
async function waitForMediaProcessing(
  igUserId: string,
  creationId: string,
  accessToken: string
): Promise<void> {
  const maxAttempts = 10
  const delayMs = 10000 // 10 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Instagram Publish] Checking media status (attempt ${attempt}/${maxAttempts})`)
    
    try {
      const statusResponse = await fetch(
        `https://graph.instagram.com/${creationId}?fields=status_code&access_token=${accessToken}`
      )

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        console.log(`[Instagram Publish] Media status:`, statusData.status_code)
        
        if (statusData.status_code === 'FINISHED') {
          console.log(`[Instagram Publish] Media processing completed`)
          return
        }
        
        if (statusData.status_code === 'ERROR') {
          console.warn(`[Instagram Publish] Media processing status ERROR - continuing anyway`)
          // Don't throw error, let the publish attempt proceed
          return
        }
      }
      
      // Wait before next attempt
      if (attempt < maxAttempts) {
        console.log(`[Instagram Publish] Waiting ${delayMs/1000}s before next check...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
      
    } catch (error) {
      console.warn(`[Instagram Publish] Status check attempt ${attempt} failed:`, error)
      
      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }
  
  console.warn(`[Instagram Publish] Media processing status unclear after ${maxAttempts} attempts, proceeding anyway`)
}