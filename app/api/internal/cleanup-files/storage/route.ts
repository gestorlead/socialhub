import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Enhanced cleanup API for both local files and Supabase Storage
 * Called by PostgreSQL functions via pg_net after publication completion
 */

interface CleanupRequest {
  job_id: string
  user_id: string
  file_paths: string[]
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Enhanced Cleanup API] Starting file cleanup')
    
    // Verify service role authorization
    const authHeader = request.headers.get('authorization')
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
      console.error('[Enhanced Cleanup API] Unauthorized access attempt')
      return NextResponse.json({ 
        error: 'Unauthorized - Service role key required' 
      }, { status: 401 })
    }

    const body: CleanupRequest = await request.json()
    const { job_id, user_id, file_paths } = body

    if (!job_id || !user_id || !file_paths || !Array.isArray(file_paths)) {
      return NextResponse.json({ 
        error: 'Missing required fields: job_id, user_id, file_paths' 
      }, { status: 400 })
    }

    console.log(`[Enhanced Cleanup API] Cleaning up ${file_paths.length} files for job ${job_id}`)

    const cleanupResults = []
    const errors = []

    // Create Supabase client for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    for (const filePath of file_paths) {
      try {
        console.log(`[Enhanced Cleanup API] Processing: ${filePath}`)

        if (filePath.startsWith('/uploads/') || filePath.startsWith('uploads/')) {
          // Local file cleanup
          await cleanupLocalFile(filePath)
          cleanupResults.push({ 
            path: filePath, 
            type: 'local', 
            status: 'deleted' 
          })
        } else if (filePath.includes('supabase') || filePath.startsWith('media-uploads/')) {
          // Supabase Storage cleanup
          await cleanupStorageFile(supabase, filePath)
          cleanupResults.push({ 
            path: filePath, 
            type: 'storage', 
            status: 'deleted' 
          })
        } else {
          // Try both methods for ambiguous paths
          let cleaned = false
          
          try {
            await cleanupLocalFile(filePath)
            cleaned = true
            cleanupResults.push({ 
              path: filePath, 
              type: 'local', 
              status: 'deleted' 
            })
          } catch (localError) {
            console.log(`[Enhanced Cleanup API] Local cleanup failed for ${filePath}, trying storage...`)
          }
          
          if (!cleaned) {
            try {
              await cleanupStorageFile(supabase, filePath)
              cleanupResults.push({ 
                path: filePath, 
                type: 'storage', 
                status: 'deleted' 
              })
            } catch (storageError) {
              console.error(`[Enhanced Cleanup API] Both cleanup methods failed for ${filePath}`)
              errors.push({
                path: filePath,
                error: `File not found in local or storage: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`
              })
            }
          }
        }

      } catch (error) {
        console.error(`[Enhanced Cleanup API] Failed to cleanup ${filePath}:`, error)
        errors.push({
          path: filePath,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Log cleanup results to database
    await logCleanupResults(supabase, job_id, user_id, cleanupResults, errors)

    const successCount = cleanupResults.length
    const errorCount = errors.length

    console.log(`[Enhanced Cleanup API] Cleanup completed: ${successCount} deleted, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${successCount} files deleted, ${errorCount} errors`,
      results: {
        deleted: cleanupResults,
        errors: errors,
        summary: {
          total: file_paths.length,
          deleted: successCount,
          errors: errorCount
        }
      }
    })

  } catch (error) {
    console.error('[Enhanced Cleanup API] Unexpected error:', error)
    
    return NextResponse.json({ 
      error: 'Internal cleanup error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

/**
 * Clean up local file
 */
async function cleanupLocalFile(filePath: string) {
  const fs = await import('fs/promises')
  const path = await import('path')
  
  // Normalize path and ensure it's within uploads directory
  const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath
  const fullPath = path.join(process.cwd(), 'public', normalizedPath)
  
  // Security check - ensure file is within uploads directory
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  if (!fullPath.startsWith(uploadsDir)) {
    throw new Error('File path outside allowed directory')
  }
  
  // Check if file exists and delete it
  try {
    await fs.access(fullPath)
    await fs.unlink(fullPath)
    console.log(`[Enhanced Cleanup API] Deleted local file: ${fullPath}`)
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      console.log(`[Enhanced Cleanup API] Local file not found (already deleted?): ${fullPath}`)
    } else {
      throw error
    }
  }
}

/**
 * Clean up Supabase Storage file
 */
async function cleanupStorageFile(supabase: any, filePath: string) {
  // Extract the actual file path for storage
  let storagePath = filePath
  
  // Handle different path formats
  if (filePath.includes('/storage/v1/object/public/media-uploads/')) {
    // Full URL format
    storagePath = filePath.split('/storage/v1/object/public/media-uploads/')[1]
  } else if (filePath.startsWith('media-uploads/')) {
    // Already in correct format
    storagePath = filePath.substring('media-uploads/'.length)
  } else if (filePath.startsWith('uploads/')) {
    // Convert local uploads path to storage path
    storagePath = filePath.substring('uploads/'.length)
  }
  
  console.log(`[Enhanced Cleanup API] Deleting from storage: ${storagePath}`)
  
  const { error } = await supabase.storage
    .from('media-uploads')
    .remove([storagePath])
  
  if (error) {
    console.error(`[Enhanced Cleanup API] Storage deletion error:`, error)
    throw new Error(`Storage deletion failed: ${error.message}`)
  }
  
  console.log(`[Enhanced Cleanup API] Deleted storage file: ${storagePath}`)
}

/**
 * Log cleanup results to database
 */
async function logCleanupResults(
  supabase: any,
  jobId: string,
  userId: string,
  results: any[],
  errors: any[]
) {
  try {
    const { error } = await supabase
      .from('cleanup_log')
      .insert({
        job_id: jobId,
        user_id: userId,
        files_deleted: results.length,
        files_failed: errors.length,
        cleanup_details: {
          deleted: results,
          errors: errors
        },
        cleanup_timestamp: new Date().toISOString()
      })

    if (error) {
      console.error('[Enhanced Cleanup API] Failed to log cleanup results:', error)
      // Don't throw here - cleanup is more important than logging
    } else {
      console.log(`[Enhanced Cleanup API] Logged cleanup results for job ${jobId}`)
    }
  } catch (logError) {
    console.error('[Enhanced Cleanup API] Cleanup logging error:', logError)
    // Don't throw here - cleanup is more important than logging
  }
}

// Configure for service operations
export const runtime = 'nodejs'
export const maxDuration = 300