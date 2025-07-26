import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

export async function GET(request: NextRequest) {
  console.log('[TikTok Direct Test] ===== STARTING DIRECT API TEST =====')
  
  try {
    // Get authorization token from request headers
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create Supabase client with user token
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    // Verify the user token
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const platformUserId = searchParams.get('platform_user_id')
    
    if (!platformUserId) {
      return NextResponse.json({ error: 'Platform user ID is required' }, { status: 400 })
    }

    console.log(`[TikTok Direct Test] User ID: ${user.id}`)
    console.log(`[TikTok Direct Test] Platform User ID: ${platformUserId}`)

    // Get access token
    const accessToken = await TikTokTokenManager.getValidAccessToken(user.id)
    
    if (!accessToken) {
      return NextResponse.json({ error: 'No valid access token found' }, { status: 401 })
    }

    console.log(`[TikTok Direct Test] Access token: ${accessToken.substring(0, 20)}...${accessToken.substring(accessToken.length - 10)}`)

    // Test 1: Basic user info to verify token works
    console.log('[TikTok Direct Test] === TEST 1: USER INFO ===')
    const userInfoUrl = 'https://open.tiktokapis.com/v2/user/info/'
    const userInfoFields = 'open_id,union_id,avatar_url,display_name,username'
    
    const userInfoResponse = await fetch(`${userInfoUrl}?fields=${userInfoFields}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    })

    console.log(`[TikTok Direct Test] User Info Status: ${userInfoResponse.status}`)
    const userInfoData = await userInfoResponse.text()
    console.log(`[TikTok Direct Test] User Info Response: ${userInfoData}`)

    let userInfoJson = null
    try {
      userInfoJson = JSON.parse(userInfoData)
    } catch (e) {
      console.error('[TikTok Direct Test] Failed to parse user info response')
    }

    // Test 2: Video list with minimal fields
    console.log('[TikTok Direct Test] === TEST 2: VIDEO LIST (MINIMAL) ===')
    const videoListUrl = 'https://open.tiktokapis.com/v2/video/list/'
    const minimalFields = 'id,create_time'
    
    const videoListResponse = await fetch(`${videoListUrl}?fields=${minimalFields}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_count: 5
      })
    })

    console.log(`[TikTok Direct Test] Video List Status: ${videoListResponse.status}`)
    const videoListData = await videoListResponse.text()
    console.log(`[TikTok Direct Test] Video List Response: ${videoListData}`)

    let videoListJson = null
    try {
      videoListJson = JSON.parse(videoListData)
    } catch (e) {
      console.error('[TikTok Direct Test] Failed to parse video list response')
    }

    // Test 3: Video list with all fields (what we currently use)
    console.log('[TikTok Direct Test] === TEST 3: VIDEO LIST (ALL FIELDS) ===')
    const allFields = [
      'id',
      'title',
      'share_url',
      'embed_html',
      'embed_link',
      'create_time',
      'cover_image_url',
      'video_description',
      'duration',
      'height',
      'width',
      'like_count',
      'comment_count',
      'share_count',
      'view_count'
    ].join(',')
    
    const fullVideoListResponse = await fetch(`${videoListUrl}?fields=${allFields}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_count: 5
      })
    })

    console.log(`[TikTok Direct Test] Full Video List Status: ${fullVideoListResponse.status}`)
    const fullVideoListData = await fullVideoListResponse.text()
    console.log(`[TikTok Direct Test] Full Video List Response: ${fullVideoListData}`)

    let fullVideoListJson = null
    try {
      fullVideoListJson = JSON.parse(fullVideoListData)
    } catch (e) {
      console.error('[TikTok Direct Test] Failed to parse full video list response')
    }

    // Return comprehensive test results
    return NextResponse.json({
      success: true,
      tests: {
        userInfo: {
          status: userInfoResponse.status,
          response: userInfoJson,
          rawResponse: userInfoData
        },
        videoListMinimal: {
          status: videoListResponse.status,
          response: videoListJson,
          rawResponse: videoListData
        },
        videoListFull: {
          status: fullVideoListResponse.status,
          response: fullVideoListJson,
          rawResponse: fullVideoListData
        }
      },
      accessTokenLength: accessToken.length,
      platformUserId
    })

  } catch (error) {
    console.error('[TikTok Direct Test] Unexpected error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}