import { NextRequest, NextResponse } from 'next/server'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'
import { IntegrationConfigManager } from '@/lib/integration-config-manager'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

interface PublishRequest {
  userId: string
  mediaUrl: string
  mediaType: string
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
    console.log('[TikTok Publish URL] Starting PULL_FROM_URL publish')
    
    const body: PublishRequest = await request.json()
    const { userId, mediaUrl, mediaType, caption, settings } = body
    
    if (!userId || !mediaUrl) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId and mediaUrl are required'
      }, { status: 400 })
    }

    // Basic content validation to avoid policy violations
    const forbiddenWords = ['adult', 'nude', 'sex', 'violence', 'hate', 'spam', 'scam']
    const lowerCaption = caption.toLowerCase()
    
    const hasForbiddenContent = forbiddenWords.some(word => lowerCaption.includes(word))
    if (hasForbiddenContent) {
      return NextResponse.json({ 
        error: 'Content policy violation',
        details: 'Content may violate TikTok community guidelines. Please review your caption and media.',
        suggestion: 'Remove any inappropriate language or content that may violate policies'
      }, { status: 400 })
    }

    // Validate caption length
    if (caption.length > 2200) {
      return NextResponse.json({ 
        error: 'Caption too long',
        details: `Caption must be 2200 characters or less. Current: ${caption.length}`
      }, { status: 400 })
    }
    
    // Get valid access token
    console.log(`[TikTok Publish URL] Getting access token for user: ${userId}`)
    const accessToken = await TikTokTokenManager.getValidAccessToken(userId)
    
    if (!accessToken) {
      console.error(`[TikTok Publish URL] No valid access token for user: ${userId}`)
      return NextResponse.json({ 
        error: 'Authentication failed',
        details: 'Please reconnect your TikTok account',
        needsReconnect: true
      }, { status: 401 })
    }
    
    const isVideo = mediaType.startsWith('video/')
    
    // Prepare the API endpoint
    const endpoint = isVideo 
      ? `${TIKTOK_API_BASE}/post/publish/video/init/`
      : `${TIKTOK_API_BASE}/post/publish/content/init/`
    
    // Validate URL is HTTPS and accessible
    if (!mediaUrl.startsWith('https://')) {
      return NextResponse.json({ 
        error: 'Invalid media URL',
        details: 'TikTok requires HTTPS URLs for PULL_FROM_URL method',
        mediaUrl: mediaUrl
      }, { status: 400 })
    }

    // Test if URL is accessible (HEAD request to avoid downloading full file)
    try {
      console.log(`[TikTok Publish URL] Testing URL accessibility: ${mediaUrl}`)
      const testResponse = await fetch(mediaUrl, { method: 'HEAD' })
      
      if (!testResponse.ok) {
        return NextResponse.json({ 
          error: 'Media URL not accessible',
          details: `URL returned ${testResponse.status}: ${testResponse.statusText}`,
          mediaUrl: mediaUrl
        }, { status: 400 })
      }
      
      // Check if it's a valid media type
      const contentType = testResponse.headers.get('content-type')
      if (!contentType || (!contentType.startsWith('video/') && !contentType.startsWith('image/'))) {
        return NextResponse.json({ 
          error: 'Invalid media type',
          details: `Expected video/* or image/*, got: ${contentType}`,
          mediaUrl: mediaUrl
        }, { status: 400 })
      }
      
      console.log(`[TikTok Publish URL] URL test passed - Content-Type: ${contentType}`)
    } catch (error) {
      console.error(`[TikTok Publish URL] URL test failed:`, error)
      return NextResponse.json({ 
        error: 'Media URL test failed',
        details: 'Could not verify URL accessibility. Ensure the file is publicly accessible.',
        mediaUrl: mediaUrl
      }, { status: 400 })
    }

    // Get TikTok configuration and environment settings
    const envSettings = await IntegrationConfigManager.getTikTokEnvironmentSettings()
    const privacyLevel = envSettings.isProduction ? (settings.privacy || 'PUBLIC_TO_EVERYONE') : 'SELF_ONLY'
    
    console.log(`[TikTok Publish URL] Using privacy level: ${privacyLevel}`, {
      isProduction: envSettings.isProduction,
      isSandbox: envSettings.isSandbox,
      isAudited: envSettings.isAudited
    })

    // Prepare payload according to TikTok guidelines
    let payload: any = {}
    
    if (isVideo) {
      // Video payload structure according to TikTok docs
      payload = {
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: mediaUrl
        },
        post_info: {
          title: caption.substring(0, 150) || 'Video uploaded via API',
          description: caption || '',
          privacy_level: privacyLevel,
          disable_comment: !settings.allowComments,
          disable_duet: !settings.allowDuet,
          disable_stitch: !settings.allowStitch,
          brand_content_toggle: false,
          brand_organic_toggle: false
        },
        post_mode: 'DIRECT_POST'
      }
      
      // Add video cover timestamp if specified (in milliseconds)
      if (settings.coverTimestamp !== undefined && settings.coverTimestamp > 0) {
        payload.post_info.video_cover_timestamp_ms = Math.floor(settings.coverTimestamp * 1000)
      }
    } else {
      // Photo payload structure
      payload = {
        source_info: {
          source: 'PULL_FROM_URL',
          photo_images: [
            {
              image_url: mediaUrl
            }
          ]
        },
        post_info: {
          title: caption.substring(0, 150) || 'Photo uploaded via API',
          description: caption || '',
          privacy_level: privacyLevel,
          disable_comment: !settings.allowComments,
          brand_content_toggle: false,
          brand_organic_toggle: false
        },
        post_mode: 'DIRECT_POST'
      }
    }
    
    console.log(`[TikTok Publish URL] Sending request to TikTok:`, {
      endpoint,
      isVideo,
      mediaUrl: mediaUrl.substring(0, 100) + '...',
      privacy: settings.privacy
    })
    
    // Make request to TikTok API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    
    const responseData = await response.json()
    
    console.log(`[TikTok Publish URL] TikTok API response:`, {
      status: response.status,
      ok: response.ok,
      data: responseData
    })
    
    if (!response.ok) {
      console.error('[TikTok Publish URL] TikTok API error:', responseData)
      
      let errorMessage = 'TikTok API error'
      let needsReconnect = false
      
      if (responseData.error) {
        switch (responseData.error.code) {
          case 'access_token_invalid':
          case 'access_token_expired':
            errorMessage = 'Access token expired. Please reconnect your account.'
            needsReconnect = true
            break
          case 'scope_not_authorized':
            errorMessage = 'Missing video.publish permission. Please reconnect your account.'
            needsReconnect = true
            break
          case 'invalid_param':
            errorMessage = `Invalid parameters: ${responseData.error.message}`
            break
          case 'integration_guidelines_violation':
            errorMessage = 'Content violates TikTok integration guidelines. Please review your content and ensure it complies with community standards.'
            break
          case 'unaudited_client_can_only_post_to_private_accounts':
            errorMessage = 'Sandbox Mode Restriction: Your TikTok account must be set to PRIVATE in the TikTok app settings. Go to Profile → Settings → Privacy → Private account (ON). This is required for unaudited apps.'
            break
          case 'content_policy_violation':
            errorMessage = 'Content violates TikTok content policies. Please ensure your media and caption comply with community guidelines.'
            break
          case 'url_not_accessible':
            errorMessage = 'Media URL is not accessible by TikTok servers. Ensure the URL is publicly accessible via HTTPS.'
            break
          case 'unsupported_media_format':
            errorMessage = 'Media format not supported. Use MP4, MOV, AVI for videos or JPG, PNG for images.'
            break
          case 'media_too_large':
            errorMessage = 'Media file is too large. Maximum size is 4GB for videos and 20MB for images.'
            break
          case 'rate_limit_exceeded':
            errorMessage = 'Rate limit exceeded. Please wait before trying again.'
            break
          default:
            errorMessage = responseData.error.message || 'Unknown TikTok error'
            // If it mentions integration guidelines, add helpful information
            if (responseData.error.message?.toLowerCase().includes('integration guidelines')) {
              errorMessage += ' Please review TikTok integration guidelines at https://developers.tiktok.com/doc/content-sharing-guidelines/'
            }
        }
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: responseData.error,
        needsReconnect,
        tiktok_response: responseData
      }, { status: response.status })
    }
    
    // Success response
    const message = envSettings.isSandbox && privacyLevel === 'SELF_ONLY' 
      ? 'Content submitted to TikTok successfully (posted privately due to sandbox mode)'
      : 'Content submitted to TikTok successfully'
      
    return NextResponse.json({
      success: true,
      message,
      data: {
        publish_id: responseData.data?.publish_id,
        status: 'PROCESSING',
        privacy_level: privacyLevel,
        environment: envSettings.isSandbox ? 'sandbox' : 'production',
        is_audited: envSettings.isAudited,
        ...(responseData.data || {})
      }
    })
    
  } catch (error) {
    console.error('[TikTok Publish URL] Unexpected error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}