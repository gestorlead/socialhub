import { NextRequest, NextResponse } from 'next/server'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'
const STATUS_ENDPOINT = `${TIKTOK_API_BASE}/post/publish/status/fetch/`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, publishId } = body
    
    if (!userId || !publishId) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId and publishId are required'
      }, { status: 400 })
    }
    
    // Get valid access token
    const accessToken = await TikTokTokenManager.getValidAccessToken(userId)
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: 'Authentication failed',
        details: 'Please reconnect your TikTok account',
        needsReconnect: true
      }, { status: 401 })
    }
    
    console.log(`[TikTok Status] Checking status for publish_id: ${publishId}`)
    
    // Check status with TikTok API
    const response = await fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publish_id: publishId
      })
    })
    
    const responseData = await response.json()
    
    console.log(`[TikTok Status] Response:`, {
      status: response.status,
      data: responseData
    })
    
    if (!response.ok) {
      console.error('[TikTok Status] Error:', responseData)
      return NextResponse.json({ 
        error: 'Failed to fetch status',
        details: responseData.error,
        tiktok_response: responseData
      }, { status: response.status })
    }
    
    // Parse status information
    const statusData = responseData.data || {}
    const status = statusData.status || 'UNKNOWN'
    
    // Possible statuses:
    // - PROCESSING_UPLOAD: Upload is being processed
    // - PUBLISH_COMPLETE: Successfully published
    // - FAILED: Failed to publish
    
    return NextResponse.json({
      success: true,
      data: {
        publish_id: publishId,
        status: status,
        fail_reason: statusData.fail_reason,
        publicaly_available_post_id: statusData.publicaly_available_post_id,
        ...statusData
      }
    })
    
  } catch (error) {
    console.error('[TikTok Status] Error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}