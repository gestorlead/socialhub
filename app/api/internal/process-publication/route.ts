import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Internal API endpoint for processing publication jobs from the queue
 * Called by pg_cron job every 10 seconds via pg_net
 * This replaces the direct platform API calls from PublishButton.tsx
 */

interface ProcessJobRequest {
  job_id: string
  user_id: string
  platform: string
  content: {
    mediaFiles: {
      name: string
      size: number
      type: string
      url: string
    }[]
    caption: string
    settings: Record<string, any>
    metadata: Record<string, any>
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Process Publication API] Starting job processing')
    
    // Verify service role authorization
    const authHeader = request.headers.get('authorization')
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
      console.error('[Process Publication API] Unauthorized access attempt')
      return NextResponse.json({ 
        error: 'Unauthorized - Service role key required' 
      }, { status: 401 })
    }

    let body: ProcessJobRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[Process Publication API] JSON parse error:', parseError)
      return NextResponse.json({ 
        error: 'Invalid JSON payload',
        details: parseError instanceof Error ? parseError.message : 'JSON parsing failed'
      }, { status: 400 })
    }
    
    const { job_id, user_id, platform, content } = body

    console.log('[Process Publication API] Processing job:', {
      job_id,
      user_id,
      platform,
      mediaFilesCount: content?.mediaFiles?.length || 0,
      captionLength: content?.caption?.length || 0
    })

    // Validate required fields
    if (!job_id || !user_id || !platform || !content) {
      return NextResponse.json({ 
        error: 'Missing required fields: job_id, user_id, platform, content' 
      }, { status: 400 })
    }

    let processingResult: any = null
    let errorMessage: string | null = null

    try {
      // Route to appropriate platform processor
      switch (platform) {
        case 'tiktok_video':
          processingResult = await processTikTokJob(user_id, content)
          break
          
        case 'facebook_post':
        case 'facebook_story':
        case 'facebook_reels':
          processingResult = await processFacebookJob(user_id, content, platform)
          break
          
        case 'instagram_feed':
        case 'instagram_story':
        case 'instagram_reels':
          processingResult = await processInstagramJob(user_id, content, platform)
          break
          
        case 'youtube_video':
        case 'youtube_shorts':
          processingResult = await processYouTubeJob(user_id, content, platform)
          break
          
        case 'threads_post':
          processingResult = await processThreadsJob(user_id, content)
          break
          
        case 'x_post':
          processingResult = await processXJob(user_id, content)
          break
          
        case 'linkedin_post':
        case 'linkedin_article':
          processingResult = await processLinkedInJob(user_id, content, platform)
          break
          
        default:
          throw new Error(`Unsupported platform: ${platform}`)
      }

      // Update job status to completed
      await updateJobStatus(job_id, 'completed', null, processingResult)
      
      console.log(`[Process Publication API] Job ${job_id} completed successfully for platform: ${platform}`)

      return NextResponse.json({
        success: true,
        message: 'Job processed successfully',
        data: {
          job_id,
          platform,
          result: processingResult
        }
      })

    } catch (processingError) {
      errorMessage = processingError instanceof Error ? processingError.message : 'Unknown processing error'
      console.error(`[Process Publication API] Job ${job_id} failed:`, processingError)

      // Update job status to failed
      await updateJobStatus(job_id, 'failed', errorMessage, null)

      return NextResponse.json({
        success: false,
        error: 'Job processing failed',
        details: errorMessage,
        data: {
          job_id,
          platform
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[Process Publication API] Unexpected error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

/**
 * Update job status in the database
 */
async function updateJobStatus(
  jobId: string, 
  status: 'completed' | 'failed', 
  errorMessage: string | null, 
  platformResponse: any
) {
  try {
    // Create Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: updateError } = await supabase
      .from('publication_jobs')
      .update({
        status,
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        platform_response: platformResponse
      })
      .eq('id', jobId)

    if (updateError) {
      throw updateError
    }

    console.log(`[Process Publication API] Updated job ${jobId} status to: ${status}`)
  } catch (updateError) {
    console.error(`[Process Publication API] Failed to update job status:`, updateError)
    // Don't throw here to avoid masking the original error
  }
}

/**
 * Process TikTok publication job
 */
async function processTikTokJob(userId: string, content: any) {
  console.log('[Process Publication API] Processing TikTok job')
  
  if (!content.mediaFiles || content.mediaFiles.length === 0) {
    throw new Error('No media files provided for TikTok')
  }

  const mediaFile = content.mediaFiles[0] // TikTok uses first file only
  
  // Call existing TikTok publish-url API
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/social/tiktok/publish-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: userId,
      mediaUrl: mediaFile.url,
      mediaType: mediaFile.type,
      caption: content.caption,
      settings: content.settings || {
        privacy: 'PUBLIC_TO_EVERYONE',
        allowComments: true,
        allowDuet: true,
        allowStitch: true
      }
    })
  })

  const result = await response.json()
  
  if (!response.ok || result.error) {
    throw new Error(result.error || `TikTok API error: ${response.status}`)
  }

  return {
    publish_id: result.data?.publish_id,
    status: result.data?.status || 'PROCESSING_UPLOAD',
    platform_specific: result.data
  }
}

/**
 * Process Facebook publication job
 */
async function processFacebookJob(userId: string, content: any, platform: string) {
  console.log('[Process Publication API] Processing Facebook job')
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/social/facebook/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: userId,
      page_id: content.settings?.page_id,
      message: content.caption,
      media_urls: content.mediaFiles.map((file: any) => file.url),
      media_type: content.mediaFiles[0]?.type.startsWith('video/') ? 'video' : 'photo',
      publication_type: platform.replace('facebook_', ''),
      privacy: content.settings?.privacy || { value: 'EVERYONE' },
      scheduled_publish_time: content.settings?.scheduled_publish_time
    })
  })

  const result = await response.json()
  
  if (!response.ok || result.error) {
    throw new Error(result.error || `Facebook API error: ${response.status}`)
  }

  return result.data || result
}

/**
 * Process Instagram publication job
 */
async function processInstagramJob(userId: string, content: any, platform: string) {
  console.log('[Process Publication API] Processing Instagram job')
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/social/instagram/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: userId,
      optionId: platform as 'instagram_feed' | 'instagram_story' | 'instagram_reels',
      mediaUrls: content.mediaFiles.map((file: any) => file.url),
      caption: content.caption,
      settings: content.settings || {}
    })
  })

  const result = await response.json()
  
  if (!response.ok || result.error) {
    throw new Error(result.error || `Instagram API error: ${response.status}`)
  }

  return result.data || result
}

/**
 * Process YouTube publication job
 */
async function processYouTubeJob(userId: string, content: any, platform: string) {
  console.log('[Process Publication API] Processing YouTube job')
  // TODO: Implement YouTube API integration
  throw new Error('YouTube integration not yet implemented')
}

/**
 * Process Threads publication job
 */
async function processThreadsJob(userId: string, content: any) {
  console.log('[Process Publication API] Processing Threads job')
  // TODO: Implement Threads API integration
  throw new Error('Threads integration not yet implemented')
}

/**
 * Process X (Twitter) publication job
 */
async function processXJob(userId: string, content: any) {
  console.log('[Process Publication API] Processing X job')
  // TODO: Implement X API integration
  throw new Error('X integration not yet implemented')
}

/**
 * Process LinkedIn publication job
 */
async function processLinkedInJob(userId: string, content: any, platform: string) {
  console.log('[Process Publication API] Processing LinkedIn job')
  // TODO: Implement LinkedIn API integration
  throw new Error('LinkedIn integration not yet implemented')
}