import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[ADMIN] Creating Facebook daily stats table...')

    const createTableSQL = `
-- Create table for storing Facebook daily statistics
CREATE TABLE IF NOT EXISTS facebook_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and page info
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_user_id TEXT NOT NULL, -- Facebook Page ID
  date DATE NOT NULL,
  
  -- Basic fan metrics
  page_fans INTEGER DEFAULT 0,
  page_fan_adds INTEGER DEFAULT 0,
  page_fan_removes INTEGER DEFAULT 0,
  
  -- Impressions and reach metrics
  page_impressions INTEGER DEFAULT 0,
  page_impressions_unique INTEGER DEFAULT 0,
  page_impressions_paid INTEGER DEFAULT 0,
  page_impressions_organic INTEGER DEFAULT 0,
  page_reach INTEGER DEFAULT 0,
  
  -- Engagement metrics
  page_engaged_users INTEGER DEFAULT 0,
  page_post_engagements INTEGER DEFAULT 0,
  page_consumptions INTEGER DEFAULT 0,
  page_consumptions_unique INTEGER DEFAULT 0,
  page_negative_feedback INTEGER DEFAULT 0,
  page_places_checkin_total INTEGER DEFAULT 0,
  
  -- Video metrics
  page_video_views INTEGER DEFAULT 0,
  page_video_views_paid INTEGER DEFAULT 0,
  page_video_views_organic INTEGER DEFAULT 0,
  page_video_complete_views_30s INTEGER DEFAULT 0,
  
  -- Post-level metrics
  page_posts_impressions INTEGER DEFAULT 0,
  page_posts_impressions_unique INTEGER DEFAULT 0,
  page_posts_impressions_paid INTEGER DEFAULT 0,
  page_posts_impressions_organic INTEGER DEFAULT 0,
  
  -- Demographic data (stored as JSON)
  page_fans_country JSONB,
  page_fans_city JSONB,
  page_fans_locale JSONB,
  page_fans_gender_age JSONB,
  
  -- Online fans metrics
  page_fans_online INTEGER DEFAULT 0,
  page_fans_online_per_day JSONB, -- Daily breakdown
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(user_id, platform_user_id, date)
);`

    // Execute the CREATE TABLE statement directly
    const { error: createError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'facebook_daily_stats')
      .single()

    if (!createError) {
      console.log('[ADMIN] Table already exists')
      return NextResponse.json({
        success: true,
        message: 'Facebook daily stats table already exists',
        table: 'facebook_daily_stats'
      })
    }

    // If table doesn't exist, we need to create it via raw SQL
    // Since we can't execute DDL directly, let's try a different approach
    try {
      await supabase.sql`
        CREATE TABLE IF NOT EXISTS facebook_daily_stats (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          platform_user_id TEXT NOT NULL,
          date DATE NOT NULL,
          page_fans INTEGER DEFAULT 0,
          page_fan_adds INTEGER DEFAULT 0,
          page_fan_removes INTEGER DEFAULT 0,
          page_impressions INTEGER DEFAULT 0,
          page_impressions_unique INTEGER DEFAULT 0,
          page_impressions_paid INTEGER DEFAULT 0,
          page_impressions_organic INTEGER DEFAULT 0,
          page_reach INTEGER DEFAULT 0,
          page_engaged_users INTEGER DEFAULT 0,
          page_post_engagements INTEGER DEFAULT 0,
          page_consumptions INTEGER DEFAULT 0,
          page_consumptions_unique INTEGER DEFAULT 0,
          page_negative_feedback INTEGER DEFAULT 0,
          page_places_checkin_total INTEGER DEFAULT 0,
          page_video_views INTEGER DEFAULT 0,
          page_video_views_paid INTEGER DEFAULT 0,
          page_video_views_organic INTEGER DEFAULT 0,
          page_video_complete_views_30s INTEGER DEFAULT 0,
          page_posts_impressions INTEGER DEFAULT 0,
          page_posts_impressions_unique INTEGER DEFAULT 0,
          page_posts_impressions_paid INTEGER DEFAULT 0,
          page_posts_impressions_organic INTEGER DEFAULT 0,
          page_fans_country JSONB,
          page_fans_city JSONB,
          page_fans_locale JSONB,
          page_fans_gender_age JSONB,
          page_fans_online INTEGER DEFAULT 0,
          page_fans_online_per_day JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, platform_user_id, date)
        );
      `
    } catch (sqlError) {
      console.error('[ADMIN] Error creating table with SQL:', sqlError)
      return NextResponse.json({ 
        error: 'Failed to create table', 
        details: sqlError instanceof Error ? sqlError.message : 'Unknown error'
      }, { status: 500 })
    }

    console.log('[ADMIN] Table created successfully')

    console.log('[ADMIN] Facebook daily stats table setup completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Facebook daily stats table created successfully',
      table: 'facebook_daily_stats'
    })

  } catch (error) {
    console.error('[ADMIN] Fatal error setting up Facebook table:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}