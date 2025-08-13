import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API para testar publicação manualmente e gerar logs detalhados
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Test Publication] Starting manual test')
    
    const { jobId } = await request.json()
    
    if (!jobId) {
      return NextResponse.json({ 
        error: 'Job ID é obrigatório' 
      }, { status: 400 })
    }
    
    // Create Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the job
    const { data: job, error: jobError } = await supabase
      .from('publication_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (jobError || !job) {
      console.error('[Test Publication] Job not found:', jobError)
      return NextResponse.json({ 
        error: 'Job não encontrado',
        details: jobError?.message
      }, { status: 404 })
    }
    
    console.log('[Test Publication] Job details:', {
      id: job.id,
      platform: job.platform,
      userId: job.user_id,
      contentKeys: Object.keys(job.content || {}),
      mediaFiles: job.content?.mediaFiles?.length || 0,
      caption: job.content?.caption?.substring(0, 50) + '...',
      settings: Object.keys(job.content?.settings || {})
    })
    
    // Test calling the TikTok API directly with proper logging
    if (job.platform === 'tiktok_video') {
      console.log('[Test Publication] Testing TikTok API call')
      
      const content = job.content
      const mediaFile = content.mediaFiles?.[0]
      
      if (!mediaFile) {
        throw new Error('No media file found')
      }
      
      console.log('[Test Publication] TikTok payload:', {
        userId: job.user_id,
        mediaUrl: mediaFile.url.substring(0, 100) + '...',
        mediaType: mediaFile.type,
        captionLength: content.caption?.length || 0,
        settings: content.settings
      })
      
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://socialhub.gestorlead.com.br'
      
      const response = await fetch(`${baseUrl}/api/social/tiktok/publish-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: job.user_id,
          mediaUrl: mediaFile.url,
          mediaType: mediaFile.type,
          caption: content.caption,
          settings: content.settings || {
            privacy: 'PUBLIC_TO_EVERYONE',
            allowComments: true,
            allowDuet: true,
            allowStitch: true
          }
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout for testing
      })
      
      const result = await response.json()
      
      console.log('[Test Publication] TikTok API response:', {
        status: response.status,
        ok: response.ok,
        hasError: !!result.error,
        dataKeys: Object.keys(result.data || {}),
        error: result.error
      })
      
      return NextResponse.json({
        success: true,
        message: 'Test completed',
        data: {
          jobId: job.id,
          platform: job.platform,
          apiResponse: {
            status: response.status,
            ok: response.ok,
            data: result.data,
            error: result.error
          }
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Job details retrieved',
      data: {
        jobId: job.id,
        platform: job.platform,
        contentStructure: {
          hasMediaFiles: !!job.content?.mediaFiles,
          mediaCount: job.content?.mediaFiles?.length || 0,
          hasCaption: !!job.content?.caption,
          captionLength: job.content?.caption?.length || 0,
          hasSettings: !!job.content?.settings,
          settingsKeys: Object.keys(job.content?.settings || {})
        }
      }
    })

  } catch (error) {
    console.error('[Test Publication] Erro:', error)
    return NextResponse.json({ 
      error: 'Falha no teste',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}