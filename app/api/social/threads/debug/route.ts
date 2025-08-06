import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/social/threads/debug - Debug endpoint to see what data is available from Threads API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get current connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'threads')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Threads connection found' },
        { status: 404 }
      )
    }

    const threadsUserId = connection.platform_user_id
    const accessToken = connection.access_token

    const debugData = {
      connection_info: {
        platform_user_id: threadsUserId,
        expires_at: connection.expires_at,
        created_at: connection.created_at,
        profile_data_keys: Object.keys(connection.profile_data || {})
      },
      api_tests: {}
    }

    // Test different API endpoints and field combinations
    const testEndpoints = [
      {
        name: 'me_basic',
        url: `https://graph.threads.net/v1.0/me`,
        fields: 'id,username,name'
      },
      {
        name: 'me_extended',
        url: `https://graph.threads.net/v1.0/me`,
        fields: 'id,username,name,threads_profile_picture_url,threads_biography'
      },
      {
        name: 'me_with_counts',
        url: `https://graph.threads.net/v1.0/me`,
        fields: 'id,username,name,followers_count,following_count,media_count'
      },
      {
        name: 'user_basic',
        url: `https://graph.threads.net/v1.0/${threadsUserId}`,
        fields: 'id,username,name'
      },
      {
        name: 'user_extended',
        url: `https://graph.threads.net/v1.0/${threadsUserId}`,
        fields: 'id,username,name,threads_profile_picture_url,threads_biography'
      },
      {
        name: 'user_with_counts',
        url: `https://graph.threads.net/v1.0/${threadsUserId}`,
        fields: 'id,username,name,followers_count,following_count,media_count'
      }
    ]

    for (const test of testEndpoints) {
      try {
        const testUrl = `${test.url}?fields=${test.fields}`
        console.log(`Testing: ${test.name} - ${testUrl}`)
        
        const response = await fetch(testUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          debugData.api_tests[test.name] = {
            success: true,
            status: response.status,
            data: data,
            available_fields: Object.keys(data)
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          debugData.api_tests[test.name] = {
            success: false,
            status: response.status,
            error: errorData,
            url: testUrl
          }
        }
      } catch (error: any) {
        debugData.api_tests[test.name] = {
          success: false,
          error: error.message
        }
      }
    }

    // Test insights endpoint
    try {
      const insightsUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads_insights?metric=views,likes,replies,reposts,quotes&period=day`
      const insightsResponse = await fetch(insightsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json()
        debugData.api_tests['insights'] = {
          success: true,
          status: insightsResponse.status,
          data: insightsData
        }
      } else {
        const errorData = await insightsResponse.json().catch(() => ({}))
        debugData.api_tests['insights'] = {
          success: false,
          status: insightsResponse.status,
          error: errorData
        }
      }
    } catch (error: any) {
      debugData.api_tests['insights'] = {
        success: false,
        error: error.message
      }
    }

    // Test threads endpoint
    try {
      const threadsUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads?fields=id,text,timestamp&limit=5`
      const threadsResponse = await fetch(threadsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (threadsResponse.ok) {
        const threadsData = await threadsResponse.json()
        debugData.api_tests['user_threads'] = {
          success: true,
          status: threadsResponse.status,
          data: threadsData,
          thread_count: threadsData.data?.length || 0
        }
      } else {
        const errorData = await threadsResponse.json().catch(() => ({}))
        debugData.api_tests['user_threads'] = {
          success: false,
          status: threadsResponse.status,
          error: errorData
        }
      }
    } catch (error: any) {
      debugData.api_tests['user_threads'] = {
        success: false,
        error: error.message
      }
    }

    return NextResponse.json({
      success: true,
      debug_data: debugData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Threads debug error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}