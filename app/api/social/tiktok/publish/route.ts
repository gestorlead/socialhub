import { NextRequest, NextResponse } from 'next/server'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

// TikTok API v2 endpoints - Updated according to latest docs
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'
const VIDEO_INIT_ENDPOINT = `${TIKTOK_API_BASE}/post/publish/video/init/`
const PHOTO_INIT_ENDPOINT = `${TIKTOK_API_BASE}/post/publish/content/init/`
const STATUS_ENDPOINT = `${TIKTOK_API_BASE}/post/publish/status/fetch/`

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

interface TikTokInitResponse {
  data: {
    publish_id: string
    upload_url: string
  }
  error?: {
    code: string
    message: string
  }
}

const MAX_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks
const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024 // 4GB max

export async function POST(request: NextRequest) {
  try {
    console.log('[TikTok Publish API] Starting publish request')
    
    let body: TikTokUploadRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[TikTok Publish API] JSON parse error:', parseError)
      return NextResponse.json({ 
        error: 'Invalid JSON payload',
        details: parseError instanceof Error ? parseError.message : 'JSON parsing failed'
      }, { status: 400 })
    }
    
    const { userId, mediaFile, caption, settings } = body

    console.log('[TikTok Publish API] Request data:', {
      userId: userId || 'missing',
      mediaFileName: mediaFile?.name || 'missing',
      mediaFileSize: mediaFile?.size || 0,
      mediaFileType: mediaFile?.type || 'missing',
      hasMediaData: !!mediaFile?.data,
      mediaDataLength: mediaFile?.data?.length || 0,
      captionLength: caption?.length || 0,
      settings: settings || 'missing'
    })

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!mediaFile || !mediaFile.data) {
      return NextResponse.json({ error: 'Media file required' }, { status: 400 })
    }

    // Validate file size
    if (mediaFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File too large',
        details: `Maximum file size is ${MAX_FILE_SIZE / (1024*1024*1024)}GB`
      }, { status: 400 })
    }

    // Get valid access token
    console.log(`[TikTok Publish API] Getting access token for user: ${userId}`)
    const accessToken = await TikTokTokenManager.getValidAccessToken(userId)
    
    if (!accessToken) {
      console.error(`[TikTok Publish API] No valid access token for user: ${userId}`)
      return NextResponse.json({ 
        error: 'Authentication failed',
        details: 'Please reconnect your TikTok account',
        needsReconnect: true
      }, { status: 401 })
    }

    const isVideo = mediaFile.type.startsWith('video/')
    const initEndpoint = isVideo ? VIDEO_INIT_ENDPOINT : PHOTO_INIT_ENDPOINT

    // Different payload structure for video vs photo
    let initPayload: any = {}
    
    if (isVideo) {
      // Calculate chunking for video files
      const chunkSize = Math.min(mediaFile.size, MAX_CHUNK_SIZE)
      const totalChunks = Math.ceil(mediaFile.size / chunkSize)
      
      // Video upload payload structure
      initPayload = {
        source_info: {
          source: "FILE_UPLOAD",
          video_size: mediaFile.size,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks
        }
      }
    } else {
      // Photo upload payload structure
      initPayload = {
        source_info: {
          source: "FILE_UPLOAD",
          photo_images: [
            {
              size: mediaFile.size
            }
          ]
        },
        post_info: {
          title: caption.substring(0, 150),
          description: caption,
          privacy_level: settings.privacy,
          disable_comment: !settings.allowComments
        },
        post_mode: "DIRECT_POST"
      }
    }

    console.log(`[TikTok Publish API] Initializing upload for user: ${userId}`, {
      endpoint: initEndpoint,
      fileSize: mediaFile.size,
      chunks: totalChunks,
      isVideo,
      privacy: settings.privacy,
      caption: caption?.substring(0, 100) + '...'
    })

    const initResponse = await fetch(initEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(initPayload)
    })

    const initData: TikTokInitResponse = await initResponse.json()

    if (!initResponse.ok || initData.error) {
      console.error('[TikTok Publish API] Upload initialization failed:', {
        status: initResponse.status,
        error: initData.error,
        response: initData
      })

      // Handle specific TikTok API errors
      let errorMessage = 'Failed to initialize upload'
      let needsReconnect = false

      if (initData.error) {
        switch (initData.error.code) {
          case 'access_token_invalid':
          case 'access_token_expired':
            errorMessage = 'Access token expired. Please reconnect your account.'
            needsReconnect = true
            break
          case 'scope_not_authorized':
            errorMessage = 'Missing video.publish permission. Please reconnect your account.'
            needsReconnect = true
            break
          case 'rate_limit_exceeded':
            errorMessage = 'Rate limit exceeded. Please try again in a few minutes.'
            break
          case 'file_size_too_large':
            errorMessage = 'File size exceeds TikTok limits'
            break
          default:
            errorMessage = initData.error.message || 'TikTok API error'
        }
      }

      return NextResponse.json({ 
        error: errorMessage,
        details: initData.error?.message,
        needsReconnect,
        tiktok_error: initData.error
      }, { status: initResponse.status })
    }

    if (!initData.data?.upload_url || !initData.data?.publish_id) {
      console.error('[TikTok Publish API] Invalid initialization response:', initData)
      return NextResponse.json({ 
        error: 'Invalid response from TikTok API',
        details: 'Missing upload URL or publish ID'
      }, { status: 500 })
    }

    // Convert base64 to binary for upload
    let fileData: Buffer
    try {
      const base64Data = mediaFile.data.includes(',') ? mediaFile.data.split(',')[1] : mediaFile.data
      fileData = Buffer.from(base64Data, 'base64')
      
      console.log(`[TikTok Publish API] File conversion successful:`, {
        originalSize: mediaFile.size,
        convertedSize: fileData.length,
        sizeDifference: mediaFile.size - fileData.length
      })
      
      // Verify the converted size is reasonable
      if (Math.abs(mediaFile.size - fileData.length) > mediaFile.size * 0.1) {
        console.warn('[TikTok Publish API] Size mismatch detected - this might indicate conversion issues')
      }
    } catch (conversionError) {
      console.error('[TikTok Publish API] Base64 conversion error:', conversionError)
      return NextResponse.json({ 
        error: 'File conversion failed',
        details: 'Unable to process the uploaded file'
      }, { status: 400 })
    }

    console.log(`[TikTok Publish API] Starting file upload for user: ${userId}`, {
      publishId: initData.data.publish_id,
      uploadUrl: initData.data.upload_url.substring(0, 100) + '...',
      fileSize: fileData.length
    })

    // Upload file to TikTok's upload URL
    const uploadResponse = await fetch(initData.data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': mediaFile.type,
        'Content-Length': fileData.length.toString()
      },
      body: fileData
    })

    if (!uploadResponse.ok) {
      console.error('[TikTok Publish API] File upload failed:', {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText
      })
      
      return NextResponse.json({ 
        error: 'File upload failed',
        details: `Upload server returned ${uploadResponse.status}: ${uploadResponse.statusText}`,
        publish_id: initData.data.publish_id
      }, { status: 500 })
    }

    console.log(`[TikTok Publish API] File uploaded successfully for user: ${userId}`)

    // Check upload status
    const statusResponse = await fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publish_id: initData.data.publish_id
      })
    })

    let statusData = null
    if (statusResponse.ok) {
      statusData = await statusResponse.json()
      console.log(`[TikTok Publish API] Status check for user: ${userId}:`, statusData)
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Content uploaded successfully to TikTok',
      data: {
        publish_id: initData.data.publish_id,
        status: statusData?.data?.status || 'PROCESSING_UPLOAD',
        upload_completed: true,
        file_name: mediaFile.name,
        file_size: mediaFile.size,
        caption: caption,
        settings: settings
      }
    })

  } catch (error) {
    console.error('[TikTok Publish API] Unexpected error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

// GET endpoint to check publish status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const publishId = searchParams.get('publish_id')

    if (!userId || !publishId) {
      return NextResponse.json({ 
        error: 'User ID and Publish ID required' 
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

    // Check status with TikTok API
    const statusResponse = await fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publish_id: publishId
      })
    })

    if (!statusResponse.ok) {
      const errorData = await statusResponse.json()
      return NextResponse.json({ 
        error: 'Failed to fetch status',
        details: errorData
      }, { status: statusResponse.status })
    }

    const statusData = await statusResponse.json()

    return NextResponse.json({
      success: true,
      data: statusData.data || {}
    })

  } catch (error) {
    console.error('[TikTok Status API] Error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}