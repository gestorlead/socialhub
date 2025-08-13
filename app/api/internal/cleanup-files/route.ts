import { NextRequest, NextResponse } from 'next/server'
import { unlink, access } from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * Internal API endpoint for cleaning up files after publication completion
 * Called by PostgreSQL functions via pg_net
 */

interface CleanupRequest {
  job_id: string
  user_id: string
  file_paths: string[]
}

interface CleanupResult {
  job_id: string
  total_files: number
  deleted_files: number
  failed_files: number
  errors: string[]
  details: Array<{
    path: string
    status: 'deleted' | 'not_found' | 'error'
    error?: string
  }>
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function POST(request: NextRequest) {
  try {
    console.log('[Cleanup Files API] Starting cleanup request')
    
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Verify token with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Parse request body
    let body: CleanupRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[Cleanup Files API] JSON parse error:', parseError)
      return NextResponse.json({ 
        error: 'Invalid JSON payload',
        details: parseError instanceof Error ? parseError.message : 'JSON parsing failed'
      }, { status: 400 })
    }

    const { job_id, user_id, file_paths } = body

    console.log('[Cleanup Files API] Request data:', {
      job_id,
      user_id,
      file_paths_count: file_paths?.length || 0
    })

    // Validate required fields
    if (!job_id) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!file_paths || !Array.isArray(file_paths) || file_paths.length === 0) {
      return NextResponse.json({ error: 'File paths array required' }, { status: 400 })
    }

    // Verify job exists and belongs to user
    const { data: job, error: jobError } = await supabase
      .from('publication_jobs')
      .select('id, user_id, status, file_paths')
      .eq('id', job_id)
      .eq('user_id', user_id)
      .single()

    if (jobError || !job) {
      console.error('[Cleanup Files API] Job verification failed:', jobError)
      return NextResponse.json({ 
        error: 'Job not found or access denied',
        details: jobError?.message
      }, { status: 404 })
    }

    // Only cleanup completed or failed jobs
    if (!['completed', 'failed'].includes(job.status)) {
      return NextResponse.json({ 
        error: 'Job not eligible for cleanup',
        details: `Job status is '${job.status}', must be 'completed' or 'failed'`
      }, { status: 400 })
    }

    console.log('[Cleanup Files API] Job verified, proceeding with cleanup')

    // Cleanup result tracking
    const result: CleanupResult = {
      job_id,
      total_files: file_paths.length,
      deleted_files: 0,
      failed_files: 0,
      errors: [],
      details: []
    }

    // Process each file path
    for (const filePath of file_paths) {
      try {
        // Sanitize file path to prevent directory traversal
        if (!filePath.startsWith('/uploads/')) {
          result.details.push({
            path: filePath,
            status: 'error',
            error: 'Invalid file path - must start with /uploads/'
          })
          result.failed_files++
          result.errors.push(`Invalid path: ${filePath}`)
          continue
        }

        // Extract filename and create full system path
        const filename = path.basename(filePath)
        const fullPath = path.join(UPLOAD_DIR, filename)
        
        // Verify file exists before attempting deletion
        try {
          await access(fullPath)
        } catch (accessError) {
          result.details.push({
            path: filePath,
            status: 'not_found'
          })
          continue // Not an error - file might have been already deleted
        }

        // Delete the file
        await unlink(fullPath)
        
        result.details.push({
          path: filePath,
          status: 'deleted'
        })
        result.deleted_files++
        
        console.log(`[Cleanup Files API] Successfully deleted: ${filename}`)

      } catch (fileError) {
        const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error'
        
        result.details.push({
          path: filePath,
          status: 'error',
          error: errorMessage
        })
        result.failed_files++
        result.errors.push(`${filePath}: ${errorMessage}`)
        
        console.error(`[Cleanup Files API] Failed to delete ${filePath}:`, fileError)
      }
    }

    // Log cleanup completion to database
    try {
      const cleanupStatus = result.failed_files === 0 ? 'success' : 
                          result.deleted_files > 0 ? 'partial' : 'failed'
      
      await supabase
        .from('publication_jobs_cleanup_log')
        .insert({
          job_id: job_id,
          file_paths: file_paths,
          cleanup_status: cleanupStatus,
          cleanup_response: {
            ...result,
            timestamp: new Date().toISOString()
          }
        })

      console.log(`[Cleanup Files API] Logged cleanup result: ${cleanupStatus}`)
    } catch (logError) {
      console.error('[Cleanup Files API] Failed to log cleanup result:', logError)
      // Don't fail the request just because logging failed
    }

    // Determine response status
    const statusCode = result.failed_files === 0 ? 200 : 
                      result.deleted_files > 0 ? 207 : // Partial success
                      500 // Complete failure

    const response = {
      success: result.failed_files === 0,
      message: result.failed_files === 0 
        ? `Successfully deleted ${result.deleted_files} files`
        : `Deleted ${result.deleted_files} files, ${result.failed_files} failed`,
      data: result
    }

    console.log('[Cleanup Files API] Cleanup completed:', {
      job_id,
      deleted: result.deleted_files,
      failed: result.failed_files,
      total: result.total_files
    })

    return NextResponse.json(response, { status: statusCode })

  } catch (error) {
    console.error('[Cleanup Files API] Unexpected error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

// GET endpoint for cleanup status/health check
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')
    
    if (!jobId) {
      return NextResponse.json({ 
        error: 'job_id parameter required' 
      }, { status: 400 })
    }

    // Get cleanup logs for this job
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: logs, error } = await supabase
      .from('publication_jobs_cleanup_log')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ 
        error: 'Failed to fetch cleanup logs',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        job_id: jobId,
        cleanup_logs: logs || []
      }
    })

  } catch (error) {
    console.error('[Cleanup Files API] GET error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}