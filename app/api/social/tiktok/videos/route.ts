import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'
import { TikTokVideoListResponse } from '@/types/tiktok'

export async function GET(request: NextRequest) {
  console.log('[TikTok Videos API] ===== NEW VERSION LOADED =====')
  try {
    // Get authorization token from request headers
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[TikTok Videos API] No authorization token provided')
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('[TikTok Videos API] Token extracted, creating Supabase client')
    
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
    
    console.log('[TikTok Videos API] Supabase client created successfully')

    // Verify the user token
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('[TikTok Videos API] Invalid or expired token:', authError?.message)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const platformUserId = searchParams.get('platform_user_id')
    const cursor = searchParams.get('cursor')
    const maxCount = searchParams.get('max_count') || '20'
    
    // Security: Use authenticated user's ID only
    const userId = user.id

    if (!platformUserId) {
      return NextResponse.json(
        { error: 'Platform user ID is required' },
        { status: 400 }
      )
    }

    // Get access token
    console.log(`[TikTok Videos API] Getting access token for user: ${userId}`)
    const accessToken = await TikTokTokenManager.getValidAccessToken(userId)

    if (!accessToken) {
      console.error(`[TikTok Videos API] No access token found for user: ${userId}`)
      return NextResponse.json(
        { error: 'No valid access token found' },
        { status: 401 }
      )
    }

    console.log(`[TikTok Videos API] Access token found: ${accessToken.substring(0, 20)}...`)
    console.log(`[TikTok Videos API] Platform user ID: ${platformUserId}`)
    console.log(`[TikTok Videos API] Making request to TikTok API`)

    // CORRECT FIELDS BASED ON DOCUMENTATION
    const fields = [
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

    // Build correct URL with fields parameter only
    const url = new URL('https://open.tiktokapis.com/v2/video/list/')
    url.searchParams.append('fields', fields)

    // Build correct request body with cursor and max_count
    const requestBody: any = {}
    if (cursor) {
      requestBody.cursor = parseInt(cursor)
    }
    if (maxCount) {
      requestBody.max_count = parseInt(maxCount)
    }

    console.log(`[TikTok Videos API] Requesting: ${url.toString()}`)
    console.log(`[TikTok Videos API] Fields: ${fields}`)
    console.log(`[TikTok Videos API] Request body:`, requestBody)
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    console.log(`[TikTok Videos API] Response status: ${response.status}`)

    if (!response.ok) {
      const errorData = await response.json()
      console.error('[TikTok Videos API] TikTok API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to fetch videos from TikTok', details: errorData },
        { status: response.status }
      )
    }

    const data: TikTokVideoListResponse = await response.json()
    console.log(`[TikTok Videos API] Success! Received ${data.data?.videos?.length || 0} videos`)

    if (data.error) {
      console.error('[TikTok Videos API] TikTok API returned error:', data.error)
      return NextResponse.json(
        { error: data.error.message, details: data.error },
        { status: 400 }
      )
    }

    // Store videos in database
    if (data.data?.videos?.length > 0) {
      console.log(`[TikTok Videos API] Storing ${data.data.videos.length} videos in database`)
      const videosToInsert = data.data.videos.map(video => ({
        user_id: userId,
        platform_user_id: platformUserId,
        video_id: video.id,
        title: video.title || video.video_description?.substring(0, 100),
        description: video.video_description,
        share_url: video.share_url,
        embed_link: video.embed_link || video.embed_html,
        view_count: video.view_count || 0,
        like_count: video.like_count || 0,
        comment_count: video.comment_count || 0,
        share_count: video.share_count || 0,
        favorite_count: 0, // Not available in API
        play_count: 0, // Not available in API
        duration: video.duration,
        height: video.height,
        width: video.width,
        cover_image_url: video.cover_image_url,
        is_top_video: false, // Not available in API
        privacy_type: null, // Not available in API
        create_time: video.create_time ? new Date(video.create_time * 1000).toISOString() : null,
      }))

      // Upsert videos (update if exists, insert if new)
      const { error: dbError } = await supabase
        .from('tiktok_videos')
        .upsert(videosToInsert, {
          onConflict: 'video_id',
          ignoreDuplicates: false
        })

      if (dbError) {
        console.error('[TikTok Videos API] Database error:', dbError)
        // Continue even if database insert fails
      } else {
        console.log('[TikTok Videos API] Videos stored successfully')
      }
    }

    // Fetch videos from database (to get all stored videos)
    const { data: dbVideos, error: fetchError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('user_id', userId)
      .eq('platform_user_id', platformUserId)
      .order('create_time', { ascending: false })

    if (fetchError) {
      console.error('[TikTok Videos API] Database fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch videos from database' },
        { status: 500 }
      )
    }

    console.log(`[TikTok Videos API] Returning ${dbVideos?.length || 0} videos from database`)
    return NextResponse.json({
      videos: dbVideos || [],
      has_more: data.has_more || false,
      cursor: data.cursor,
      total_count: dbVideos?.length || 0
    })
  } catch (error) {
    console.error('[TikTok Videos API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}