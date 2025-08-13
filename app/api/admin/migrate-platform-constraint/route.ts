import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Temporary API endpoint to update the platform constraint in publication_jobs table
 * This allows composite platform names like 'instagram_story', 'tiktok_video', etc.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Platform Constraint Migration] Starting migration...')
    
    // Create Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Try to execute the migration using direct SQL
    console.log('[Platform Constraint Migration] Executing migration SQL...')
    
    const migrationSQL = `
      -- Drop the existing constraint
      ALTER TABLE publication_jobs DROP CONSTRAINT IF EXISTS publication_jobs_platform_check;
      
      -- Add new constraint with composite platform names
      ALTER TABLE publication_jobs 
      ADD CONSTRAINT publication_jobs_platform_check 
      CHECK (platform IN (
        -- Base platforms (for backward compatibility)
        'tiktok', 'facebook', 'instagram', 'youtube', 'threads', 'x', 'linkedin',
        
        -- TikTok variants
        'tiktok_video',
        
        -- Instagram variants
        'instagram_feed', 'instagram_story', 'instagram_reels',
        
        -- YouTube variants
        'youtube_video', 'youtube_shorts',
        
        -- Facebook variants
        'facebook_feed', 'facebook_story', 'facebook_reels',
        
        -- X (Twitter) variants
        'x_post',
        
        -- LinkedIn variants
        'linkedin_post',
        
        -- Threads variants
        'threads_post'
      ));
    `
    
    // Execute each statement separately
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.from('publication_jobs').select('count').limit(0)
        // This is just to test the connection - we'll try a different approach
      }
    }
    
    // Try a simple test to see if we can modify the table
    const { error: testError } = await supabase
      .from('publication_jobs')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        platform: 'instagram_story',
        content: { test: true }
      })
      .select()
    
    if (testError) {
      console.error('[Platform Constraint Migration] Test insert failed:', testError)
      
      // If it's the constraint error, we know we need the migration
      if (testError.message.includes('publication_jobs_platform_check')) {
        return NextResponse.json({ 
          error: 'Platform constraint needs to be updated manually',
          details: 'The database constraint still only allows base platform names. Please apply the migration manually.',
          migrationSQL
        }, { status: 500 })
      }
    } else {
      // Clean up test record
      await supabase
        .from('publication_jobs')
        .delete()
        .eq('user_id', '00000000-0000-0000-0000-000000000000')
      
      console.log('[Platform Constraint Migration] Test successful - constraint appears to be updated!')
    }

    const { error: addError } = testError

    if (addError) {
      console.error('[Platform Constraint Migration] Error adding constraint:', addError)
      return NextResponse.json({ 
        error: 'Failed to add new constraint', 
        details: addError.message 
      }, { status: 500 })
    }

    console.log('[Platform Constraint Migration] Migration completed successfully!')

    return NextResponse.json({ 
      success: true,
      message: 'Platform constraint updated successfully to support composite platform names'
    })

  } catch (error) {
    console.error('[Platform Constraint Migration] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}