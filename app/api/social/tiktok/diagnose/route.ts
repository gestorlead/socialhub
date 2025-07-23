import { NextRequest, NextResponse } from 'next/server'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    console.log(`[TikTok Diagnose] Checking status for user: ${userId}`)
    
    // 1. Check database connection
    const { data: connection, error: dbError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .single()
    
    if (dbError || !connection) {
      return NextResponse.json({
        error: 'No TikTok connection found',
        details: dbError?.message
      }, { status: 404 })
    }
    
    // 2. Check token status
    const tokenStatus = await TikTokTokenManager.getTokenStatus(userId)
    
    // 3. Try to get valid access token
    let accessToken = null
    let tokenError = null
    try {
      accessToken = await TikTokTokenManager.getValidAccessToken(userId)
    } catch (error) {
      tokenError = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // 4. Check scopes
    const scopes = connection.scope ? connection.scope.split(',').map((s: string) => s.trim()) : []
    const hasVideoPublish = scopes.includes('video.publish') || scopes.includes('video.upload')
    
    // 5. Test TikTok API connectivity (if we have a token)
    let apiTest = { success: false, error: null as any }
    if (accessToken) {
      try {
        const testResponse = await fetch('https://open.tiktokapis.com/v2/user/info/', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: 'open_id,display_name'
          })
        })
        
        if (testResponse.ok) {
          apiTest.success = true
        } else {
          const errorData = await testResponse.json()
          apiTest.error = errorData
        }
      } catch (error) {
        apiTest.error = error instanceof Error ? error.message : 'API test failed'
      }
    }
    
    // Return diagnostic information
    return NextResponse.json({
      success: true,
      diagnosis: {
        database: {
          connected: !!connection,
          platform: connection.platform,
          created_at: connection.created_at,
          updated_at: connection.updated_at
        },
        token: {
          status: tokenStatus.status,
          hasAccessToken: !!accessToken,
          accessTokenLength: accessToken?.length || 0,
          expiresAt: tokenStatus.access_token_expires_at,
          needsRefresh: tokenStatus.needs_refresh,
          needsReconnect: tokenStatus.needs_reconnect,
          error: tokenError
        },
        permissions: {
          scopes: scopes,
          hasVideoPublish: hasVideoPublish,
          hasUserInfo: scopes.includes('user.info.basic')
        },
        api: {
          testPassed: apiTest.success,
          error: apiTest.error
        },
        summary: {
          canPublish: !!accessToken && hasVideoPublish && !tokenStatus.needs_reconnect,
          issues: [
            !connection && 'No TikTok connection',
            !accessToken && 'No valid access token',
            !hasVideoPublish && 'Missing video.publish permission',
            tokenStatus.needs_reconnect && 'Token needs reconnection',
            !apiTest.success && 'TikTok API test failed'
          ].filter(Boolean)
        }
      }
    })
    
  } catch (error) {
    console.error('[TikTok Diagnose] Error:', error)
    return NextResponse.json({ 
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}