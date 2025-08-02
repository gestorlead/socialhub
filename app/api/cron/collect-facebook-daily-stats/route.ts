import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Facebook Page Insights metrics - Updated for API v23.0
// Many metrics were deprecated on November 1, 2025
const FACEBOOK_METRICS = [
  // Core impressions metrics (confirmed supported)
  'page_impressions_unique',
  'page_impressions_paid'
]

// Video Ad Break metrics (if applicable to pages with monetization)
const VIDEO_AD_METRICS = [
  'page_daily_video_ad_break_ad_impressions_by_crosspost_status',
  'total_video_ad_break_ad_impressions'
]

// Note: Most demographic metrics were deprecated on November 1, 2025
// Keeping empty array for backward compatibility but these likely won't work
const DEMOGRAPHIC_METRICS = []

interface FacebookPageStats {
  [key: string]: number | any
}

async function fetchPageMetrics(pageId: string, accessToken: string, period: string = 'day'): Promise<FacebookPageStats> {
  const stats: FacebookPageStats = {}
  
  // Fetch core metrics
  if (FACEBOOK_METRICS.length > 0) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v23.0/${pageId}/insights?metric=${FACEBOOK_METRICS.join(',')}&period=${period}&access_token=${accessToken}`
      )
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.data) {
          data.data.forEach((metric: any) => {
            const metricName = metric.name
            let value = 0
            
            // Sum up values for the period
            if (metric.values && metric.values.length > 0) {
              value = metric.values.reduce((sum: number, item: any) => sum + (item.value || 0), 0)
            }
            
            stats[metricName] = value
          })
        }
      } else {
        console.warn(`Failed to fetch core metrics for page ${pageId}:`, response.status)
      }
    } catch (error) {
      console.warn(`Error fetching core metrics for page ${pageId}:`, error)
    }
  }
  
  // Fetch video ad metrics separately (may not be available for all pages)
  for (const videoMetric of VIDEO_AD_METRICS) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v23.0/${pageId}/insights?metric=${videoMetric}&period=${period}&access_token=${accessToken}`
      )
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.data && data.data.length > 0) {
          const metric = data.data[0]
          if (metric.values && metric.values.length > 0) {
            const value = metric.values.reduce((sum: number, item: any) => sum + (item.value || 0), 0)
            stats[videoMetric] = value
          }
        }
      } else {
        // Video ad metrics may not be available for all pages, so don't warn
        console.log(`Video ad metric ${videoMetric} not available for page ${pageId}`)
      }
    } catch (error) {
      console.warn(`Error fetching video ad metric ${videoMetric} for page ${pageId}:`, error)
    }
  }
  
  // Demographic metrics are deprecated, skipping
  
  return stats
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Starting Facebook daily stats collection...')

    // Get all active Facebook connections
    const { data: connections, error: connectionsError } = await supabase
      .from('social_connections')
      .select('user_id, platform_user_id, access_token, profile_data')
      .eq('platform', 'facebook')

    if (connectionsError) {
      console.error('[CRON] Error fetching connections:', connectionsError)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      console.log('[CRON] No Facebook connections found')
      return NextResponse.json({ message: 'No connections to process' })
    }

    console.log(`[CRON] Found ${connections.length} Facebook connections`)

    const results = []
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    for (const connection of connections) {
      try {
        console.log(`[CRON] Processing user ${connection.user_id}`)

        if (!connection.access_token) {
          console.error(`[CRON] No access token for user ${connection.user_id}`)
          results.push({
            user_id: connection.user_id,
            success: false,
            error: 'No access token'
          })
          continue
        }

        const selectedPageId = connection.profile_data?.selected_page_id
        const selectedPage = connection.profile_data?.selected_page
        const pages = connection.profile_data?.pages || []
        
        // Use selected page if available, otherwise fall back to first page for backward compatibility
        let pageToProcess = null
        if (selectedPage && selectedPageId) {
          pageToProcess = selectedPage
        } else if (pages.length > 0) {
          pageToProcess = pages[0] // Backward compatibility
        }

        if (!pageToProcess) {
          console.warn(`[CRON] No page to process for user ${connection.user_id}`)
          results.push({
            user_id: connection.user_id,
            success: false,
            error: 'No page selected for processing'
          })
          continue
        }

        console.log(`[CRON] Processing selected page ${pageToProcess.id} (${pageToProcess.name}) for user ${connection.user_id}`)

        // Process only the selected page
        const page = pageToProcess
        
        if (!page.access_token) {
          console.warn(`[CRON] No access token for page ${page.id} of user ${connection.user_id}`)
          results.push({
            user_id: connection.user_id,
            page_id: page.id,
            page_name: page.name,
            success: false,
            error: 'No access token for selected page'
          })
          continue
        }

        try {
          console.log(`[CRON] Fetching stats for page ${page.id}`)
          
          // Fetch all metrics for this page
          const stats = await fetchPageMetrics(page.id, page.access_token)
          
          // Prepare data for database insertion
          // Updated for API v23.0 - using only supported metrics
          const dbStats = {
            user_id: connection.user_id,
            platform_user_id: page.id,
            date: today,
            
            // Core supported metrics
            page_impressions_unique: stats.page_impressions_unique || 0,
            page_impressions_paid: stats.page_impressions_paid || 0,
            
            // Video ad metrics (may be 0 for pages without monetization)
            page_daily_video_ad_break_ad_impressions_by_crosspost_status: stats.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0,
            total_video_ad_break_ad_impressions: stats.total_video_ad_break_ad_impressions || 0,
            
            // Deprecated metrics set to 0 for backward compatibility with existing database schema
            page_fans: 0,
            page_fan_adds: 0,
            page_fan_removes: 0,
            page_impressions: 0,
            page_impressions_organic: 0,
            page_reach: 0,
            page_engaged_users: 0,
            page_post_engagements: 0,
            page_consumptions: 0,
            page_consumptions_unique: 0,
            page_negative_feedback: 0,
            page_places_checkin_total: 0,
            page_video_views: 0,
            page_video_views_paid: 0,
            page_video_views_organic: 0,
            page_video_complete_views_30s: 0,
            page_posts_impressions: 0,
            page_posts_impressions_unique: 0,
            page_posts_impressions_paid: 0,
            page_posts_impressions_organic: 0,
            page_fans_online: 0,
            
            // Demographic data (deprecated, set to null)
            page_fans_country: null,
            page_fans_city: null,
            page_fans_locale: null,
            page_fans_gender_age: null,
            
            updated_at: new Date().toISOString()
          }

          // Save daily stats to database using upsert
          const { error: insertError } = await supabase
            .from('facebook_daily_stats')
            .upsert(dbStats, {
              onConflict: 'user_id,platform_user_id,date'
            })

          if (insertError) {
            console.error(`[CRON] Error saving stats for page ${page.id}:`, insertError)
            results.push({
              user_id: connection.user_id,
              page_id: page.id,
              page_name: page.name,
              success: false,
              error: `Database error: ${insertError.message}`
            })
          } else {
            console.log(`[CRON] Successfully saved stats for page ${page.id}`)
            results.push({
              user_id: connection.user_id,
              page_id: page.id,
              page_name: page.name,
              success: true,
              stats: {
                fans: dbStats.page_fans,
                impressions: dbStats.page_impressions,
                reach: dbStats.page_reach,
                engagement: dbStats.page_post_engagements
              }
            })
          }

        } catch (pageError) {
          console.error(`[CRON] Error processing page ${page.id}:`, pageError)
          results.push({
            user_id: connection.user_id,
            page_id: page.id,
            page_name: page.name,
            success: false,
            error: pageError instanceof Error ? pageError.message : 'Unknown page error'
          })
        }

      } catch (error) {
        console.error(`[CRON] Unexpected error processing user ${connection.user_id}:`, error)
        results.push({
          user_id: connection.user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unexpected error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    console.log(`[CRON] Facebook daily stats collection completed. Success: ${successCount}, Failures: ${failureCount}`)

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} pages from ${connections.length} connections`,
      summary: {
        total_connections: connections.length,
        total_pages: results.length,
        successful: successCount,
        failed: failureCount
      },
      results,
      date: today
    })

  } catch (error) {
    console.error('[CRON] Fatal error in Facebook daily stats collection:', error)
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