import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Combine uploaded chunks into a single file in Supabase Storage
 * This is a simplified version - in production, you might want to use Supabase Edge Functions
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Combine Chunks API] Starting chunk combination')
    
    // Extract auth token from header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authorization header required' 
      }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Create service role client
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify user token
    const { data: { user }, error: userError } = await serviceSupabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('[Combine Chunks API] User verification failed:', userError)
      return NextResponse.json({ 
        error: 'Invalid user token' 
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { chunkPaths, finalPath, totalSize } = body

    if (!chunkPaths || !Array.isArray(chunkPaths) || chunkPaths.length === 0) {
      return NextResponse.json({ 
        error: 'Chunk paths array required' 
      }, { status: 400 })
    }

    if (!finalPath) {
      return NextResponse.json({ 
        error: 'Final file path required' 
      }, { status: 400 })
    }

    console.log(`[Combine Chunks API] Combining ${chunkPaths.length} chunks into: ${finalPath}`)

    try {
      // For now, we'll use a simple approach: download all chunks and re-upload as single file
      // In production, you'd want to use Supabase Edge Functions or server-side streaming
      
      const chunks: Buffer[] = []
      
      // Download all chunks
      for (let i = 0; i < chunkPaths.length; i++) {
        const chunkPath = chunkPaths[i]
        console.log(`[Combine Chunks API] Downloading chunk ${i + 1}/${chunkPaths.length}: ${chunkPath}`)
        
        const { data: chunkData, error: downloadError } = await serviceSupabase.storage
          .from('media-uploads')
          .download(chunkPath)
        
        if (downloadError) {
          throw new Error(`Failed to download chunk ${chunkPath}: ${downloadError.message}`)
        }
        
        const chunkBuffer = Buffer.from(await chunkData.arrayBuffer())
        chunks.push(chunkBuffer)
      }
      
      // Combine all chunks
      const combinedBuffer = Buffer.concat(chunks)
      console.log(`[Combine Chunks API] Combined ${chunks.length} chunks into ${combinedBuffer.length} bytes`)
      
      // Upload combined file
      const { data: uploadData, error: uploadError } = await serviceSupabase.storage
        .from('media-uploads')
        .upload(finalPath, combinedBuffer, {
          cacheControl: '3600',
          upsert: true
        })
      
      if (uploadError) {
        throw new Error(`Failed to upload combined file: ${uploadError.message}`)
      }
      
      // Clean up chunk files
      console.log('[Combine Chunks API] Cleaning up chunk files')
      for (const chunkPath of chunkPaths) {
        try {
          await serviceSupabase.storage
            .from('media-uploads')
            .remove([chunkPath])
        } catch (cleanupError) {
          console.warn(`[Combine Chunks API] Failed to clean up chunk ${chunkPath}:`, cleanupError)
          // Continue cleanup even if one fails
        }
      }
      
      // Generate public URL for final file
      const { data: publicData } = serviceSupabase.storage
        .from('media-uploads')
        .getPublicUrl(finalPath)

      console.log(`[Combine Chunks API] Successfully combined chunks into: ${finalPath}`)

      return NextResponse.json({
        success: true,
        data: {
          path: finalPath,
          publicUrl: publicData.publicUrl,
          size: combinedBuffer.length
        },
        message: 'Chunks combined successfully'
      })

    } catch (error) {
      console.error(`[Combine Chunks API] Error combining chunks:`, error)
      throw error
    }

  } catch (error) {
    console.error('[Combine Chunks API] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to combine chunks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Configure for service operations
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large file processing