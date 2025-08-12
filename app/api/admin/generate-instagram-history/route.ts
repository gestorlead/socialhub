import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate realistic historical data based on current stats
function generateHistoricalData(currentStats: any, days: number) {
  const historicalData = []
  const baseDate = new Date()
  
  // Calculate base values (90 days ago would be lower)
  const growthRate = 0.015 // 1.5% growth per month on average
  const monthlyGrowth = growthRate / 30 // Daily growth rate
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(baseDate)
    date.setDate(baseDate.getDate() - i)
    
    // Calculate what the values would have been i days ago
    const daysFromNow = i
    const totalGrowthFactor = Math.pow(1 + monthlyGrowth, daysFromNow)
    
    // Add some realistic variance (±5%)
    const variance = 0.95 + (Math.random() * 0.1) // 0.95 to 1.05
    
    const historicalFollowers = Math.max(0, Math.floor((currentStats.followers_count || 0) / totalGrowthFactor * variance))
    const historicalFollowing = Math.max(0, Math.floor((currentStats.follows_count || 0) / Math.pow(1 + monthlyGrowth * 0.3, daysFromNow) * variance))
    const historicalMedia = Math.max(0, Math.floor((currentStats.media_count || 0) - (daysFromNow * 0.1) * variance))
    
    // Insights data (only if current account has it)
    let impressions = 0
    let reach = 0
    let profileViews = 0
    
    if (historicalFollowers >= 100) {
      // Estimate based on follower count
      impressions = Math.floor(historicalFollowers * (1.0 + Math.random() * 0.5) * variance)
      reach = Math.floor(historicalFollowers * (0.6 + Math.random() * 0.3) * variance)
      profileViews = Math.floor(historicalFollowers * (0.08 + Math.random() * 0.04) * variance)
    }
    
    historicalData.push({
      date: date.toISOString().split('T')[0],
      follower_count: historicalFollowers,
      following_count: historicalFollowing,
      media_count: historicalMedia,
      impressions,
      reach,
      profile_views: profileViews
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

    console.log('[ADMIN] Starting Instagram historical data generation...')

    // Get all Instagram connections
    const { data: connections, error: connectionsError } = await supabase
      .from('social_connections')
      .select('user_id, platform_user_id, profile_data')
      .eq('platform', 'instagram')

    if (connectionsError) {
      console.error('[ADMIN] Error fetching connections:', connectionsError)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      console.log('[ADMIN] No Instagram connections found')
      return NextResponse.json({ message: 'No connections to process' })
    }

    console.log(`[ADMIN] Found ${connections.length} Instagram connections`)

    const results = []
    const daysToGenerate = 90

    for (const connection of connections) {
      try {
        console.log(`[ADMIN] Processing user ${connection.user_id}`)

        // Check if historical data already exists
        const { data: existingData } = await supabase
          .from('instagram_daily_stats')
          .select('date')
          .eq('user_id', connection.user_id)
          .eq('platform_user_id', connection.platform_user_id)
          .limit(1)

        if (existingData && existingData.length > 0) {
          console.log(`[ADMIN] Historical data already exists for user ${connection.user_id}, skipping`)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: true,
            message: 'Historical data already exists',
            records_generated: 0
          })
          continue
        }

        if (!connection.profile_data) {
          console.warn(`[ADMIN] No profile data for user ${connection.user_id}, skipping`)
          results.push({
            user_id: connection.user_id,
            platform_user_id: connection.platform_user_id,
            success: false,
            error: 'No profile data available'
          })
          continue
        }

        // Generate historical data
        const historicalData = generateHistoricalData(connection.profile_data, daysToGenerate)
        
        // Prepare data for batch insert
        const recordsToInsert = historicalData.map(data => ({
          user_id: connection.user_id,
          platform_user_id: connection.platform_user_id,
          date: data.date,
          follower_count: data.follower_count,
          following_count: data.following_count,
          media_count: data.media_count,
          impressions: data.impressions,
          reach: data.reach,
          profile_views: data.profile_views,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        // Insert in batches of 50 to avoid timeout
        const batchSize = 50
        let insertedCount = 0

        for (let i = 0; i < recordsToInsert.length; i += batchSize) {
          const batch = recordsToInsert.slice(i, i + batchSize)
          
          const { error: insertError } = await supabase
            .from('instagram_daily_stats')
            .insert(batch)

          if (insertError) {
            console.error(`[ADMIN] Error inserting batch for user ${connection.user_id}:`, insertError)
            throw insertError
          }

          insertedCount += batch.length
          console.log(`[ADMIN] Inserted ${insertedCount}/${recordsToInsert.length} records for user ${connection.user_id}`)
        }

        console.log(`[ADMIN] Successfully generated ${insertedCount} historical records for user ${connection.user_id}`)
        results.push({
          user_id: connection.user_id,
          platform_user_id: connection.platform_user_id,
          success: true,
          records_generated: insertedCount
        })

      } catch (error) {
        console.error(`[ADMIN] Error processing user ${connection.user_id}:`, error)
        results.push({
          user_id: connection.user_id,
          platform_user_id: connection.platform_user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length
    const totalRecords = results.reduce((sum, r) => sum + (r.records_generated || 0), 0)

    console.log(`[ADMIN] Historical data generation completed. Success: ${successCount}, Failures: ${failureCount}, Total records: ${totalRecords}`)

    return NextResponse.json({
      success: true,
      message: `Generated historical data for ${connections.length} connections`,
      summary: {
        total_connections: connections.length,
        successful: successCount,
        failed: failureCount,
        total_records_generated: totalRecords
      },
      results
    })

  } catch (error) {
    console.error('[ADMIN] Fatal error in historical data generation:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}