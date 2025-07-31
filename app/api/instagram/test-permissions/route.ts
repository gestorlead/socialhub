import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Instagram access token from database
    const { data: connection } = await supabase
      .from('user_social_connections')
      .select('access_token, instagram_business_account_id')
      .eq('user_id', user.id)
      .eq('platform', 'instagram')
      .single()

    if (!connection || !connection.access_token) {
      return NextResponse.json({ 
        error: 'Instagram connection not found. Please connect your Instagram account first.' 
      }, { status: 404 })
    }

    const accessToken = connection.access_token
    const igBusinessAccountId = connection.instagram_business_account_id

    if (!igBusinessAccountId) {
      return NextResponse.json({ 
        error: 'Instagram Business Account ID not found. Please ensure you have a Business account connected.' 
      }, { status: 400 })
    }

    const results = {
      instagram_business_manage_comments: null,
      instagram_business_manage_insights: null,
      instagram_business_content_publish: null
    }

    // Test 1: instagram_business_manage_comments
    // Get comments from a recent media post
    try {
      // First, get recent media
      const mediaResponse = await fetch(
        `https://graph.instagram.com/v18.0/${igBusinessAccountId}/media?fields=id,caption&limit=1&access_token=${accessToken}`
      )
      const mediaData = await mediaResponse.json()

      if (mediaData.data && mediaData.data.length > 0) {
        const mediaId = mediaData.data[0].id
        
        // Try to get comments for this media
        const commentsResponse = await fetch(
          `https://graph.instagram.com/v18.0/${mediaId}/comments?fields=id,text,username&access_token=${accessToken}`
        )
        const commentsData = await commentsResponse.json()
        
        results.instagram_business_manage_comments = {
          success: !commentsData.error,
          endpoint: `/${mediaId}/comments`,
          response: commentsData
        }
      } else {
        results.instagram_business_manage_comments = {
          success: false,
          error: 'No media found to test comments'
        }
      }
    } catch (error) {
      results.instagram_business_manage_comments = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: instagram_business_manage_insights
    // Get insights for the business account
    try {
      const insightsResponse = await fetch(
        `https://graph.instagram.com/v18.0/${igBusinessAccountId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${accessToken}`
      )
      const insightsData = await insightsResponse.json()
      
      results.instagram_business_manage_insights = {
        success: !insightsData.error,
        endpoint: `/${igBusinessAccountId}/insights`,
        response: insightsData
      }
    } catch (error) {
      results.instagram_business_manage_insights = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: instagram_business_content_publish
    // Test creating a media container (dry run - we won't actually publish)
    try {
      // This is a test call to create a media container
      // We'll use a test image URL that won't actually be published
      const createMediaResponse = await fetch(
        `https://graph.instagram.com/v18.0/${igBusinessAccountId}/media?` +
        `image_url=https://www.example.com/test-image.jpg&` +
        `caption=${encodeURIComponent('Test caption for API permission test')}&` +
        `access_token=${accessToken}`,
        { method: 'POST' }
      )
      const createMediaData = await createMediaResponse.json()
      
      results.instagram_business_content_publish = {
        success: !createMediaData.error || createMediaData.error.code === 100, // Error 100 is expected for invalid image URL
        endpoint: `/${igBusinessAccountId}/media`,
        response: createMediaData,
        note: 'This was a test call with an invalid image URL to verify API access'
      }
    } catch (error) {
      results.instagram_business_content_publish = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Log the test results
    await supabase
      .from('api_test_logs')
      .insert({
        user_id: user.id,
        platform: 'instagram',
        test_type: 'permissions',
        results: results,
        timestamp: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Permission tests completed',
      results: results,
      note: 'These test calls should activate the permission request buttons within 24 hours'
    })

  } catch (error) {
    console.error('Instagram permission test error:', error)
    return NextResponse.json(
      { error: 'Failed to test Instagram permissions' },
      { status: 500 }
    )
  }
}