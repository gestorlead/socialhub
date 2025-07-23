import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Starting daily stats collection...')

    // Get all active TikTok connections
    const { data: connections, error: connectionsError } = await supabase
      .from('social_connections')
      .select('user_id, platform_user_id, access_token, refresh_token')
      .eq('platform', 'tiktok')

    if (connectionsError) {
      console.error('[CRON] Error fetching connections:', connectionsError)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      console.log('[CRON] No TikTok connections found')
      return NextResponse.json({ message: 'No connections to process' })
    }

    console.log(`[CRON] Found ${connections.length} TikTok connections`)

    const results = []
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    for (const connection of connections) {
      try {
        console.log(`[CRON] Processing user ${connection.user_id}, platform_user_id: ${connection.platform_user_id}`)

        // Get valid access token
        const accessToken = await TikTokTokenManager.getValidAccessToken(connection.user_id)
        
        if (!accessToken) {
          console.error(`[CRON] Could not get valid token for user ${connection.user_id}`)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: false,
            error: 'No valid access token'
          })
          continue
        }

        // Fetch current stats from TikTok API
        const profileUrl = new URL('https://open.tiktokapis.com/v2/user/info/')
        profileUrl.searchParams.append('fields', [
          'open_id',
          'follower_count',
          'following_count',
          'likes_count',
          'video_count'
        ].join(','))
        
        const profileResponse = await fetch(profileUrl.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })

        if (!profileResponse.ok) {
          const errorText = await profileResponse.text()
          console.error(`[CRON] Failed to fetch TikTok stats for user ${connection.user_id}:`, profileResponse.status, errorText)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: false,
            error: `API error: ${profileResponse.status}`
          })
          continue
        }

        const profileData = await profileResponse.json()
        
        // Extract stats from response
        let stats = null
        if (profileData.data?.user) {
          const user = profileData.data.user
          stats = {
            follower_count: user.follower_count || 0,
            following_count: user.following_count || 0,
            likes_count: user.likes_count || 0,
            video_count: user.video_count || 0
          }
        } else if (profileData.error && profileData.error.code !== 'ok') {
          console.error(`[CRON] TikTok API error for user ${connection.user_id}:`, profileData.error)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: false,
            error: `TikTok API error: ${profileData.error.message}`
          })
          continue
        }

        if (!stats) {
          console.error(`[CRON] No stats data for user ${connection.user_id}`)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: false,
            error: 'No stats data returned'
          })
          continue
        }

        // Save daily stats to database
        const { error: insertError } = await supabase
          .from('tiktok_daily_stats')
          .upsert({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            date: today,
            follower_count: stats.follower_count,
            following_count: stats.following_count,
            likes_count: stats.likes_count,
            video_count: stats.video_count,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,platform_user_id,date'
          })

        if (insertError) {
          console.error(`[CRON] Error saving stats for user ${connection.user_id}:`, insertError)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: false,
            error: `Database error: ${insertError.message}`
          })
        } else {
          console.log(`[CRON] Successfully saved stats for user ${connection.user_id}`)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: true,
            stats
          })
        }

      } catch (error) {
        console.error(`[CRON] Unexpected error processing user ${connection.user_id}:`, error)
        results.push({
          user_id: connection.user_id,
          platform_user_id: connection.platform_user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unexpected error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    console.log(`[CRON] Daily stats collection completed. Success: ${successCount}, Failures: ${failureCount}`)

    return NextResponse.json({
      success: true,
      message: `Processed ${connections.length} connections`,
      summary: {
        total: connections.length,
        success: successCount,
        failures: failureCount
      },
      results,
      date: today
    })

  } catch (error) {
    console.error('[CRON] Fatal error in daily stats collection:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}