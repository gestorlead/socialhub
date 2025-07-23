import { NextRequest, NextResponse } from 'next/server'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

// TikTok Content Posting API v2 - Correct implementation
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

interface TikTokUploadRequest {
  userId: string
  mediaFile: {
    name: string
    size: number
    type: string
    data: string // base64 encoded
  }
  caption: string
  settings: {
    privacy: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
    allowComments: boolean
    allowDuet: boolean
    allowStitch: boolean
    coverTimestamp?: number
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[TikTok Publish V2] Starting publish request')
    
    let body: TikTokUploadRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[TikTok Publish V2] JSON parse error:', parseError)
      return NextResponse.json({ 
        error: 'Invalid JSON payload',
        details: parseError instanceof Error ? parseError.message : 'JSON parsing failed'
      }, { status: 400 })
    }
    
    const { userId, mediaFile, caption, settings } = body

    if (!userId || !mediaFile || !mediaFile.data) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId and mediaFile are required'
      }, { status: 400 })
    }

    // Get valid access token
    console.log(`[TikTok Publish V2] Getting access token for user: ${userId}`)
    const accessToken = await TikTokTokenManager.getValidAccessToken(userId)
    
    if (!accessToken) {
      console.error(`[TikTok Publish V2] No valid access token for user: ${userId}`)
      return NextResponse.json({ 
        error: 'Authentication failed',
        details: 'Please reconnect your TikTok account',
        needsReconnect: true
      }, { status: 401 })
    }

    const isVideo = mediaFile.type.startsWith('video/')
    
    // For now, we'll use PULL_FROM_URL method which is simpler
    // In a production environment, you would upload the file to a temporary storage (S3, etc)
    // and provide that URL to TikTok
    
    // Since we can't use FILE_UPLOAD directly from browser (requires chunked upload),
    // we need to inform the user about this limitation
    
    return NextResponse.json({
      error: 'Upload method not supported',
      details: 'Direct file upload from browser is not supported. Please use TikTok Creator Portal or mobile app.',
      recommendation: 'The TikTok Content Posting API requires either:',
      options: [
        '1. FILE_UPLOAD: Requires server-side chunked upload implementation',
        '2. PULL_FROM_URL: Requires hosting the video on a public URL first',
        '3. Use TikTok Creator Portal at https://www.tiktok.com/creator-portal/content',
        '4. Use TikTok mobile app for direct uploads'
      ],
      technicalDetails: {
        method: 'FILE_UPLOAD',
        limitation: 'Browser cannot perform chunked uploads directly to TikTok servers',
        videoSize: mediaFile.size,
        isVideo: isVideo
      }
    }, { status: 501 }) // 501 Not Implemented

  } catch (error) {
    console.error('[TikTok Publish V2] Unexpected error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

// Alternative implementation using PULL_FROM_URL
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, mediaUrl, caption, settings, isVideo } = body

    if (!userId || !mediaUrl) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId and mediaUrl are required'
      }, { status: 400 })
    }

    // Get valid access token
    const accessToken = await TikTokTokenManager.getValidAccessToken(userId)
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: 'Authentication failed',
        needsReconnect: true
      }, { status: 401 })
    }

    // Initialize upload with PULL_FROM_URL
    const endpoint = isVideo 
      ? `${TIKTOK_API_BASE}/post/publish/video/init/`
      : `${TIKTOK_API_BASE}/post/publish/content/init/`

    const payload = {
      source_info: {
        source: "PULL_FROM_URL",
        ...(isVideo 
          ? { video_url: mediaUrl }
          : { 
              photo_cover_urls: [mediaUrl],
              photo_download_urls: [mediaUrl]
            }
        )
      },
      post_info: {
        title: caption.substring(0, 150),
        privacy_level: settings.privacy,
        disable_comment: !settings.allowComments,
        ...(isVideo && {
          disable_duet: !settings.allowDuet,
          disable_stitch: !settings.allowStitch,
        })
      },
      post_mode: "DIRECT_POST"
    }

    console.log('[TikTok Publish V2] Initializing PULL_FROM_URL upload')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[TikTok Publish V2] API error:', data)
      return NextResponse.json({ 
        error: 'TikTok API error',
        details: data.error?.message || 'Upload initialization failed',
        tiktok_error: data.error
      }, { status: response.status })
    }

    return NextResponse.json({
      success: true,
      message: 'Content submitted to TikTok',
      data: {
        publish_id: data.data?.publish_id,
        status: 'PROCESSING'
      }
    })

  } catch (error) {
    console.error('[TikTok Publish V2] Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}