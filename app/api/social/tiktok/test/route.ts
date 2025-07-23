import { NextRequest, NextResponse } from 'next/server'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

export async function POST(request: NextRequest) {
  try {
    console.log('[TikTok Test API] Starting test request')
    
    const body = await request.json()
    const { userId } = body
    
    console.log('[TikTok Test API] User ID:', userId)
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    // Test token retrieval
    const accessToken = await TikTokTokenManager.getValidAccessToken(userId)
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: 'Authentication failed',
        details: 'Please reconnect your TikTok account',
        needsReconnect: true
      }, { status: 401 })
    }
    
    console.log('[TikTok Test API] Token retrieved successfully for user:', userId)
    
    return NextResponse.json({
      success: true,
      message: 'Test successful',
      data: {
        userId: userId,
        hasToken: !!accessToken,
        tokenLength: accessToken.length
      }
    })
    
  } catch (error) {
    console.error('[TikTok Test API] Error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}