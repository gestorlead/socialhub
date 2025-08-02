import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate realistic historical data for Facebook pages
function generateHistoricalData(currentPageData: any, days: number) {
  const historicalData = []
  const baseDate = new Date()
  
  // Calculate base values (90 days ago would be lower)
  const growthRate = 0.012 // 1.2% growth per month on average for Facebook
  const monthlyGrowth = growthRate / 30 // Daily growth rate
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(baseDate)
    date.setDate(baseDate.getDate() - i)
    
    // Calculate what the values would have been i days ago
    const daysFromNow = i
    const totalGrowthFactor = Math.pow(1 + monthlyGrowth, daysFromNow)
    
    // Add some realistic variance (±8% for Facebook)
    const variance = 0.92 + (Math.random() * 0.16) // 0.92 to 1.08
    
    const currentFans = currentPageData.fan_count || 1000 // Fallback value
    const historicalFans = Math.max(0, Math.floor(currentFans / totalGrowthFactor * variance))
    
    // Calculate daily metrics based on page size and activity
    const fanAddRate = Math.max(0, Math.floor((historicalFans * 0.005) * (1 + Math.random() * 0.5) * variance))
    const fanRemoveRate = Math.max(0, Math.floor(fanAddRate * (0.1 + Math.random() * 0.2)))
    
    // Engagement metrics scale with fan count
    const impressions = Math.floor(historicalFans * (2.0 + Math.random() * 1.5) * variance)
    const impressionsUnique = Math.floor(impressions * (0.6 + Math.random() * 0.2))
    const impressionsPaid = Math.floor(impressions * (0.1 + Math.random() * 0.15))
    const impressionsOrganic = impressions - impressionsPaid
    
    const reach = Math.floor(impressionsUnique * (0.7 + Math.random() * 0.2))
    const engagedUsers = Math.floor(reach * (0.05 + Math.random() * 0.08))
    const postEngagements = Math.floor(engagedUsers * (1.2 + Math.random() * 0.8))
    
    // Video metrics (if page posts videos)
    const videoViews = Math.floor(impressions * (0.15 + Math.random() * 0.25))
    const videoViewsPaid = Math.floor(videoViews * (0.08 + Math.random() * 0.12))
    const videoViewsOrganic = videoViews - videoViewsPaid
    const videoCompleteViews30s = Math.floor(videoViews * (0.25 + Math.random() * 0.15))
    
    // Post-level metrics
    const postsImpressions = Math.floor(impressions * (0.8 + Math.random() * 0.3))
    const postsImpressionsUnique = Math.floor(postsImpressions * (0.65 + Math.random() * 0.15))
    const postsImpressionsPaid = Math.floor(postsImpressions * (0.08 + Math.random() * 0.12))
    const postsImpressionsOrganic = postsImpressions - postsImpressionsPaid
    
    // Other metrics
    const consumptions = Math.floor(postEngagements * (0.3 + Math.random() * 0.2))
    const consumptionsUnique = Math.floor(consumptions * (0.85 + Math.random() * 0.1))
    const negativeFeedback = Math.max(0, Math.floor(postEngagements * (0.01 + Math.random() * 0.02)))
    const placesCheckinTotal = Math.floor(historicalFans * (0.001 + Math.random() * 0.002))
    const fansOnline = Math.floor(historicalFans * (0.05 + Math.random() * 0.08))
    
    historicalData.push({
      date: date.toISOString().split('T')[0],
      page_fans: historicalFans,
      page_fan_adds: fanAddRate,
      page_fan_removes: fanRemoveRate,
      page_impressions: impressions,
      page_impressions_unique: impressionsUnique,
      page_impressions_paid: impressionsPaid,
      page_impressions_organic: impressionsOrganic,
      page_reach: reach,
      page_engaged_users: engagedUsers,
      page_post_engagements: postEngagements,
      page_consumptions: consumptions,
      page_consumptions_unique: consumptionsUnique,
      page_negative_feedback: negativeFeedback,
      page_places_checkin_total: placesCheckinTotal,
      page_video_views: videoViews,
      page_video_views_paid: videoViewsPaid,
      page_video_views_organic: videoViewsOrganic,
      page_video_complete_views_30s: videoCompleteViews30s,
      page_posts_impressions: postsImpressions,
      page_posts_impressions_unique: postsImpressionsUnique,
      page_posts_impressions_paid: postsImpressionsPaid,
      page_posts_impressions_organic: postsImpressionsOrganic,
      page_fans_online: fansOnline
    })
  }
  
  return historicalData
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[ADMIN] Starting Facebook historical data generation...')

    // Get all Facebook connections
    const { data: connections, error: connectionsError } = await supabase
      .from('social_connections')
      .select('user_id, platform_user_id, profile_data')
      .eq('platform', 'facebook')

    if (connectionsError) {
      console.error('[ADMIN] Error fetching connections:', connectionsError)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      console.log('[ADMIN] No Facebook connections found')
      return NextResponse.json({ message: 'No connections to process' })
    }

    console.log(`[ADMIN] Found ${connections.length} Facebook connections`)

    const results = []
    const daysToGenerate = 90

    for (const connection of connections) {
      try {
        console.log(`[ADMIN] Processing user ${connection.user_id}`)

        if (!connection.profile_data?.pages || connection.profile_data.pages.length === 0) {
          console.warn(`[ADMIN] No pages found for user ${connection.user_id}, skipping`)
          results.push({
            user_id: connection.user_id,
            success: false,
            error: 'No Facebook pages found'
          })
          continue
        }

        // Process each page for this user
        for (const page of connection.profile_data.pages) {
          try {
            console.log(`[ADMIN] Processing page ${page.id} for user ${connection.user_id}`)

            // Check if historical data already exists for this page
            const { data: existingData } = await supabase
              .from('facebook_daily_stats')
              .select('date')
              .eq('user_id', connection.user_id)
              .eq('platform_user_id', page.id)
              .limit(1)

            if (existingData && existingData.length > 0) {
              console.log(`[ADMIN] Historical data already exists for page ${page.id}, skipping`)
              results.push({
                user_id: connection.user_id,
                page_id: page.id,
                page_name: page.name,
                success: true,
                message: 'Historical data already exists',
                records_generated: 0
              })
              continue
            }

            // Generate historical data for this page
            const historicalData = generateHistoricalData(page, daysToGenerate)
            
            // Prepare data for batch insert
            const recordsToInsert = historicalData.map(data => ({
              user_id: connection.user_id,
              platform_user_id: page.id,
              date: data.date,
              page_fans: data.page_fans,
              page_fan_adds: data.page_fan_adds,
              page_fan_removes: data.page_fan_removes,
              page_impressions: data.page_impressions,
              page_impressions_unique: data.page_impressions_unique,
              page_impressions_paid: data.page_impressions_paid,
              page_impressions_organic: data.page_impressions_organic,
              page_reach: data.page_reach,
              page_engaged_users: data.page_engaged_users,
              page_post_engagements: data.page_post_engagements,
              page_consumptions: data.page_consumptions,
              page_consumptions_unique: data.page_consumptions_unique,
              page_negative_feedback: data.page_negative_feedback,
              page_places_checkin_total: data.page_places_checkin_total,
              page_video_views: data.page_video_views,
              page_video_views_paid: data.page_video_views_paid,
              page_video_views_organic: data.page_video_views_organic,
              page_video_complete_views_30s: data.page_video_complete_views_30s,
              page_posts_impressions: data.page_posts_impressions,
              page_posts_impressions_unique: data.page_posts_impressions_unique,
              page_posts_impressions_paid: data.page_posts_impressions_paid,
              page_posts_impressions_organic: data.page_posts_impressions_organic,
              page_fans_online: data.page_fans_online,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))

            // Insert in batches of 40 to avoid timeout (Facebook has more columns)
            const batchSize = 40
            let insertedCount = 0

            for (let i = 0; i < recordsToInsert.length; i += batchSize) {
              const batch = recordsToInsert.slice(i, i + batchSize)
              
              const { error: insertError } = await supabase
                .from('facebook_daily_stats')
                .insert(batch)

              if (insertError) {
                console.error(`[ADMIN] Error inserting batch for page ${page.id}:`, insertError)
                throw insertError
              }

              insertedCount += batch.length
              console.log(`[ADMIN] Inserted ${insertedCount}/${recordsToInsert.length} records for page ${page.id}`)
            }

            console.log(`[ADMIN] Successfully generated ${insertedCount} historical records for page ${page.id}`)
            results.push({
              user_id: connection.user_id,
              page_id: page.id,
              page_name: page.name,
              success: true,
              records_generated: insertedCount
            })

          } catch (pageError) {
            console.error(`[ADMIN] Error processing page ${page.id}:`, pageError)
            results.push({
              user_id: connection.user_id,
              page_id: page.id,
              page_name: page.name,
              success: false,
              error: pageError instanceof Error ? pageError.message : 'Unknown page error'
            })
          }
        }

      } catch (error) {
        console.error(`[ADMIN] Error processing user ${connection.user_id}:`, error)
        results.push({
          user_id: connection.user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length
    const totalRecords = results.reduce((sum, r) => sum + (r.records_generated || 0), 0)

    console.log(`[ADMIN] Facebook historical data generation completed. Success: ${successCount}, Failures: ${failureCount}, Total records: ${totalRecords}`)

    return NextResponse.json({
      success: true,
      message: `Generated historical data for ${connections.length} connections`,
      summary: {
        total_connections: connections.length,
        total_pages: results.length,
        successful: successCount,
        failed: failureCount,
        total_records_generated: totalRecords
      },
      results
    })

  } catch (error) {
    console.error('[ADMIN] Fatal error in Facebook historical data generation:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}