import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    console.log('[CRON] Starting Instagram daily stats collection...')

    // Get all active Instagram connections
    const { data: connections, error: connectionsError } = await supabase
      .from('social_connections')
      .select('user_id, platform_user_id, access_token, profile_data')
      .eq('platform', 'instagram')

    if (connectionsError) {
      console.error('[CRON] Error fetching connections:', connectionsError)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      console.log('[CRON] No Instagram connections found')
      return NextResponse.json({ message: 'No connections to process' })
    }

    console.log(`[CRON] Found ${connections.length} Instagram connections`)

    const results = []
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    for (const connection of connections) {
      try {
        console.log(`[CRON] Processing user ${connection.user_id}, platform_user_id: ${connection.platform_user_id}`)

        if (!connection.access_token) {
          console.error(`[CRON] No access token for user ${connection.user_id}`)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: false,
            error: 'No access token'
          })
          continue
        }

        // Fetch current basic profile stats from Instagram Graph API
        const basicStatsUrl = `https://graph.instagram.com/${connection.platform_user_id}?fields=followers_count,follows_count,media_count&access_token=${connection.access_token}`
        
        const basicStatsResponse = await fetch(basicStatsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!basicStatsResponse.ok) {
          const errorText = await basicStatsResponse.text()
          console.error(`[CRON] Failed to fetch Instagram basic stats for user ${connection.user_id}:`, basicStatsResponse.status, errorText)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: false,
            error: `Basic stats API error: ${basicStatsResponse.status}`
          })
          continue
        }

        const basicStatsData = await basicStatsResponse.json()
        
        // Initialize stats with basic data
        const stats = {
          follower_count: basicStatsData.followers_count || 0,
          following_count: basicStatsData.follows_count || 0,
          media_count: basicStatsData.media_count || 0,
          impressions: 0,
          reach: 0,
          profile_views: 0
        }

        // Try to fetch insights if account has 100+ followers
        if (stats.follower_count >= 100) {
          try {
            const endDate = new Date()
            const startDate = new Date()
            startDate.setDate(endDate.getDate() - 1) // Yesterday's data

            const since = Math.floor(startDate.getTime() / 1000)
            const until = Math.floor(endDate.getTime() / 1000)

            const insightsUrl = `https://graph.instagram.com/${connection.platform_user_id}/insights?metric=impressions,reach,profile_views&period=day&since=${since}&until=${until}&access_token=${connection.access_token}`
            
            const insightsResponse = await fetch(insightsUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            })

            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json()
              
              // Process insights data
              if (insightsData.data) {
                insightsData.data.forEach((metric: any) => {
                  const totalValue = metric.values.reduce((sum: number, value: any) => sum + (value.value || 0), 0)
                  switch (metric.name) {
                    case 'impressions':
                      stats.impressions = totalValue
                      break
                    case 'reach':
                      stats.reach = totalValue
                      break
                    case 'profile_views':
                      stats.profile_views = totalValue
                      break
                  }
                })
              }
              
              console.log(`[CRON] Successfully fetched insights for user ${connection.user_id}`)
            } else {
              console.warn(`[CRON] Could not fetch insights for user ${connection.user_id}, using basic stats only`)
            }
          } catch (insightsError) {
            console.warn(`[CRON] Insights fetch failed for user ${connection.user_id}:`, insightsError)
            // Continue with basic stats only
          }
        } else {
          console.log(`[CRON] User ${connection.user_id} has less than 100 followers, skipping insights`)
        }

        // Save daily stats to database
        const { error: insertError } = await supabase
          .from('instagram_daily_stats')
          .upsert({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            date: today,
            follower_count: stats.follower_count,
            following_count: stats.following_count,
            media_count: stats.media_count,
            impressions: stats.impressions,
            reach: stats.reach,
            profile_views: stats.profile_views,
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

    console.log(`[CRON] Instagram daily stats collection completed. Success: ${successCount}, Failures: ${failureCount}`)

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
    console.error('[CRON] Fatal error in Instagram daily stats collection:', error)
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