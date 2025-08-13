import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateMultipleFiles } from '@/lib/platform-limits'

/**
 * API endpoint to enqueue publication jobs for background processing
 * Replaces the sequential processing in PublishButton.tsx
 */

interface EnqueueRequest {
  userId: string
  selectedOptions: string[]
  mediaFiles: {
    name: string
    size: number
    type: string
    url: string  // URL after upload to our server
    path?: string // File path for cleanup tracking
  }[]
  captions: {
    universal: string
    specific: Record<string, string>
  }
  settings: Record<string, any>
}

interface JobCreationResult {
  job_id: string
  platform: string
  status: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Publications Enqueue API] Starting enqueue request')
    
    // Check content length early to prevent 413 errors
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ 
        error: 'Request payload too large. Maximum size is 10MB.',
        details: `Received ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`
      }, { status: 413 })
    }
    
    let body: EnqueueRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[Publications Enqueue API] JSON parse error:', parseError)
      return NextResponse.json({ 
        error: 'Invalid JSON payload',
        details: parseError instanceof Error ? parseError.message : 'JSON parsing failed'
      }, { status: 400 })
    }
    
    const { userId, selectedOptions, mediaFiles, captions, settings } = body

    console.log('[Publications Enqueue API] Request data:', {
      userId: userId || 'missing',
      selectedOptionsCount: selectedOptions?.length || 0,
      mediaFilesCount: mediaFiles?.length || 0,
      hasUniversalCaption: !!captions?.universal,
      settingsKeys: Object.keys(settings || {})
    })

    // Validate required fields
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!selectedOptions || selectedOptions.length === 0) {
      return NextResponse.json({ error: 'At least one platform must be selected' }, { status: 400 })
    }

    if (!mediaFiles || mediaFiles.length === 0) {
      return NextResponse.json({ error: 'At least one media file required' }, { status: 400 })
    }

    if (!captions) {
      return NextResponse.json({ error: 'Captions object required' }, { status: 400 })
    }

    // Function to get effective caption for each platform
    const getEffectiveCaption = (optionId: string): string => {
      return captions.specific[optionId] || captions.universal || ''
    }

    // Create jobs for each selected platform
    const createdJobs: JobCreationResult[] = []
    const errors: { platform: string; error: string }[] = []

    for (const optionId of selectedOptions) {
      try {
        const effectiveCaption = getEffectiveCaption(optionId)
        const platformSettings = settings[optionId] || {}

        // Validate file sizes against platform limits
        const filesForValidation = mediaFiles.map(file => ({
          size: file.size,
          type: file.type
        }))
        
        // The validateMultipleFiles function now automatically detects story types from optionId
        const validation = validateMultipleFiles(optionId, filesForValidation)
        
        if (!validation.valid) {
          throw new Error(`Platform validation failed: ${validation.errors.join('; ')}`)
        }

        // Extract file paths for cleanup tracking (preserve original paths for Storage compatibility)
        const filePaths = mediaFiles
          .map(file => {
            // Use the original path from upload result
            if (file.path) {
              return file.path
            }
            
            // Fallback: extract path from URL if needed
            if (file.url) {
              // For Storage URLs, extract the storage path
              if (file.url.includes('/storage/v1/object/public/media-uploads/')) {
                return file.url.split('/storage/v1/object/public/media-uploads/')[1]
              }
              // For local URLs, convert to local path
              if (file.url.includes('/uploads/')) {
                return file.url.replace(/^.*\/uploads\//, '/uploads/')
              }
            }
            
            return null
          })
          .filter(path => path !== null)

        console.log(`[Publications Enqueue API] File paths for cleanup:`, filePaths)

        // Prepare job content with optimized payload (remove redundant data)
        const jobContent = {
          mediaFiles: mediaFiles,
          caption: effectiveCaption,
          settings: platformSettings,
          metadata: {
            enqueuedAt: new Date().toISOString(),
            optionId,
            // Only store essential metadata, not entire original request
            totalPlatforms: selectedOptions.length,
            hasCustomCaption: !!captions.specific[optionId],
            validationPassed: true
          }
        }

        console.log(`[Publications Enqueue API] Creating job for platform: ${optionId}`, {
          mediaFilesCount: mediaFiles.length,
          captionLength: effectiveCaption.length,
          hasSettings: Object.keys(platformSettings).length > 0
        })

        // Create Supabase client with service role
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Call the enqueue function with file paths
        const { data: result, error: enqueueError } = await supabase
          .rpc('enqueue_publication_job', {
            p_user_id: userId,
            p_platform: optionId,
            p_content: jobContent,
            p_metadata: {},
            p_file_paths: filePaths
          })

        if (enqueueError) {
          throw new Error(`Failed to enqueue job: ${enqueueError.message}`)
        }

        if (result) {
          createdJobs.push({
            job_id: result,
            platform: optionId,
            status: 'pending'
          })
          
          console.log(`[Publications Enqueue API] Job created successfully for ${optionId}:`, result)
        } else {
          throw new Error('Failed to create job - no job ID returned')
        }

      } catch (jobError) {
        console.error(`[Publications Enqueue API] Failed to create job for ${optionId}:`, jobError)
        errors.push({
          platform: optionId,
          error: jobError instanceof Error ? jobError.message : 'Unknown error'
        })
      }
    }

    // Return response with created jobs and any errors
    const response = {
      success: createdJobs.length > 0,
      message: createdJobs.length > 0 
        ? `Successfully enqueued ${createdJobs.length} publication job(s)`
        : 'No jobs were created',
      data: {
        jobs: createdJobs,
        totalEnqueued: createdJobs.length,
        totalRequested: selectedOptions.length,
        errors: errors.length > 0 ? errors : undefined
      }
    }

    console.log('[Publications Enqueue API] Response:', {
      totalEnqueued: createdJobs.length,
      totalRequested: selectedOptions.length,
      hasErrors: errors.length > 0
    })

    // Return 207 Multi-Status if there were some failures, 200 if all succeeded
    const statusCode = errors.length > 0 && createdJobs.length > 0 ? 207 : 
                      errors.length > 0 ? 400 : 200

    return NextResponse.json(response, { status: statusCode })

  } catch (error) {
    console.error('[Publications Enqueue API] Unexpected error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}