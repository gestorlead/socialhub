import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Test endpoint to check if the platform constraint accepts composite names
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Platform Constraint Test] Testing platform constraint...')
    
    // Create Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Test inserting a record with composite platform name
    const testPlatforms = [
      'instagram_story',
      'tiktok_video', 
      'youtube_shorts',
      'facebook_reels',
      'threads_post'
    ]
    
    const results = []
    
    for (const platform of testPlatforms) {
      try {
        // Try to insert a test record
        const { data, error } = await supabase
          .from('publication_jobs')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            platform: platform,
            content: { test: true, platform }
          })
          .select()
        
        if (error) {
          results.push({
            platform,
            success: false,
            error: error.message
          })
        } else {
          results.push({
            platform,
            success: true,
            inserted_id: data?.[0]?.id
          })
          
          // Clean up immediately
          if (data?.[0]?.id) {
            await supabase
              .from('publication_jobs')
              .delete()
              .eq('id', data[0].id)
          }
        }
      } catch (err) {
        results.push({
          platform,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    const allSuccess = results.every(r => r.success)
    const constraintErrors = results.filter(r => 
      !r.success && r.error?.includes('publication_jobs_platform_check')
    )

    return NextResponse.json({ 
      success: allSuccess,
      message: allSuccess 
        ? 'All composite platform names are accepted by the constraint'
        : 'Some platform names are rejected by the constraint',
      results,
      constraintNeedsUpdate: constraintErrors.length > 0,
      migrationSQL: constraintErrors.length > 0 ? `
-- Migration SQL to update the constraint:
ALTER TABLE publication_jobs DROP CONSTRAINT IF EXISTS publication_jobs_platform_check;

ALTER TABLE publication_jobs 
ADD CONSTRAINT publication_jobs_platform_check 
CHECK (platform IN (
  'tiktok', 'facebook', 'instagram', 'youtube', 'threads', 'x', 'linkedin',
  'tiktok_video',
  'instagram_feed', 'instagram_story', 'instagram_reels',
  'youtube_video', 'youtube_shorts',
  'facebook_feed', 'facebook_story', 'facebook_reels',
  'x_post',
  'linkedin_post',
  'threads_post'
));
      ` : null
    })

  } catch (error) {
    console.error('[Platform Constraint Test] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}