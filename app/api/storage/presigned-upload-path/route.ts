import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'

/**
 * Generate presigned upload URL for a specific path in Supabase Storage
 * Used for chunked uploads where we need to specify exact file paths
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Presigned Upload Path API] Starting presigned URL generation for specific path')
    
    // Extract auth token from header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authorization header required' 
      }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Create service role client for presigned URL generation
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify user token
    const { data: { user }, error: userError } = await serviceSupabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('[Presigned Upload Path API] User verification failed:', userError)
      return NextResponse.json({ 
        error: 'Invalid user token' 
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { file, path: filePath } = body

    if (!file || !file.name || !file.type || !file.size) {
      return NextResponse.json({ 
        error: 'File info required (name, type, size)' 
      }, { status: 400 })
    }

    if (!filePath) {
      return NextResponse.json({ 
        error: 'File path required' 
      }, { status: 400 })
    }

    console.log(`[Presigned Upload Path API] Generating URL for path: ${filePath}`)

    try {
      // Create presigned upload URL (1 hour expiry) using service role
      const { data: uploadData, error: uploadError } = await serviceSupabase.storage
        .from('media-uploads')
        .createSignedUploadUrl(filePath, {
          expiresIn: 60 * 60, // 1 hour
          upsert: true // Allow overwriting chunks
        })

      if (uploadError) {
        throw uploadError
      }

      // Generate the public URL for the file
      const { data: publicData } = serviceSupabase.storage
        .from('media-uploads')
        .getPublicUrl(filePath)

      const result = {
        originalName: file.name,
        filename: path.basename(filePath),
        path: filePath,
        uploadUrl: uploadData.signedUrl,
        token: uploadData.token,
        publicUrl: publicData.publicUrl,
        size: file.size,
        type: file.type
      }

      console.log(`[Presigned Upload Path API] Successfully generated URL for: ${filePath}`)

      return NextResponse.json({
        success: true,
        data: result,
        expiresIn: 60 * 60,
        message: 'Presigned upload URL generated successfully'
      })

    } catch (error) {
      console.error(`[Presigned Upload Path API] Error generating URL for ${filePath}:`, error)
      throw new Error(`Failed to generate upload URL for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

  } catch (error) {
    console.error('[Presigned Upload Path API] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate presigned upload URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Configure for service operations
export const runtime = 'nodejs'
export const maxDuration = 60