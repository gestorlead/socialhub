import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import path from 'path'

/**
 * Generate presigned upload URLs for Supabase Storage
 * Allows direct client-to-storage uploads without server limits
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Presigned Upload API] Starting presigned URL generation')
    
    // Extract auth token from header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authorization header required' 
      }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // First, verify user token with service role client
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify user token
    const { data: { user }, error: userError } = await serviceSupabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('[Presigned Upload API] User verification failed:', userError)
      return NextResponse.json({ 
        error: 'Invalid user token' 
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { files } = body

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ 
        error: 'Files array required' 
      }, { status: 400 })
    }

    console.log(`[Presigned Upload API] Generating URLs for ${files.length} files`)

    // Generate presigned URLs for each file
    const presignedData = await Promise.all(
      files.map(async (fileInfo: { name: string; type: string; size: number }) => {
        // Generate unique filename
        const timestamp = Date.now()
        const randomString = crypto.randomBytes(8).toString('hex')
        const extension = path.extname(fileInfo.name)
        const filename = `${user.id}_${timestamp}_${randomString}${extension}`
        const filePath = `uploads/${filename}`

        console.log(`[Presigned Upload API] Generating URL for: ${filename}`)

        try {
          // Create presigned upload URL (24 hour expiry) using service role
          const { data: uploadData, error: uploadError } = await serviceSupabase.storage
            .from('media-uploads')
            .createSignedUploadUrl(filePath, {
              expiresIn: 24 * 60 * 60, // 24 hours
              upsert: false
            })

          if (uploadError) {
            throw uploadError
          }

          // Generate the public URL for the file
          const { data: publicData } = serviceSupabase.storage
            .from('media-uploads')
            .getPublicUrl(filePath)

          return {
            originalName: fileInfo.name,
            filename,
            path: filePath,
            uploadUrl: uploadData.signedUrl,
            token: uploadData.token,
            publicUrl: publicData.publicUrl,
            size: fileInfo.size,
            type: fileInfo.type
          }
        } catch (error) {
          console.error(`[Presigned Upload API] Error generating URL for ${filename}:`, error)
          throw new Error(`Failed to generate upload URL for ${fileInfo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      })
    )

    console.log(`[Presigned Upload API] Successfully generated ${presignedData.length} presigned URLs`)

    return NextResponse.json({
      success: true,
      data: presignedData,
      expiresIn: 24 * 60 * 60,
      message: 'Presigned upload URLs generated successfully'
    })

  } catch (error) {
    console.error('[Presigned Upload API] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate presigned upload URLs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Configure for service operations
export const runtime = 'nodejs'
export const maxDuration = 60