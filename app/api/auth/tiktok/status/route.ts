import { NextRequest, NextResponse } from 'next/server'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    console.log(`[TikTok Status API] Getting status for user: ${userId}`)

    const status = await TikTokTokenManager.getTokenStatus(userId)

    console.log(`[TikTok Status API] Status for user ${userId}:`, {
      status: status.status,
      needs_refresh: status.needs_refresh,
      needs_reconnect: status.needs_reconnect,
      time_until_expiry: status.time_until_expiry
    })

    return NextResponse.json({
      success: true,
      ...status
    })

  } catch (error) {
    console.error('[TikTok Status API] Error getting token status:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    console.log(`[TikTok Status API] Force refreshing token for user: ${userId}`)

    // Force refresh token
    const token = await TikTokTokenManager.getValidAccessToken(userId)

    if (!token) {
      return NextResponse.json({ 
        error: 'Failed to refresh token',
        needs_reconnect: true 
      }, { status: 400 })
    }

    // Get updated status
    const status = await TikTokTokenManager.getTokenStatus(userId)

    console.log(`[TikTok Status API] Token refreshed successfully for user: ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      ...status
    })

  } catch (error) {
    console.error('[TikTok Status API] Error refreshing token:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}