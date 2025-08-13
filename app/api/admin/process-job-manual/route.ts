import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API para processar um job manualmente (desenvolvimento/teste)
 * Isso simula o que o cron job faria, mas executando localmente
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Manual Process] Starting manual job processing')
    
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
      console.error('[Manual Process] Job not found:', jobError)
      return NextResponse.json({ 
        error: 'Job não encontrado',
        details: jobError?.message
      }, { status: 404 })
    }
    
    if (job.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Job não está pendente',
        currentStatus: job.status
      }, { status: 400 })
    }
    
    console.log('[Manual Process] Processing job:', {
      id: job.id,
      platform: job.platform,
      userId: job.user_id
    })
    
    // Update status to processing
    const { error: updateError } = await supabase
      .from('publication_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString(),
        retry_count: job.retry_count + 1
      })
      .eq('id', jobId)
    
    if (updateError) {
      console.error('[Manual Process] Failed to update job status:', updateError)
      return NextResponse.json({ 
        error: 'Falha ao atualizar status do job',
        details: updateError.message
      }, { status: 500 })
    }
    
    // Make request to process-publication API (local call)
    const processResponse = await fetch(`http://localhost:3001/api/internal/process-publication`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        job_id: job.id,
        user_id: job.user_id,
        platform: job.platform,
        content: job.content,
        metadata: job.metadata
      })
    })
    
    const processResult = await processResponse.json()
    
    console.log('[Manual Process] Process result:', {
      status: processResponse.status,
      success: processResult.success,
      error: processResult.error
    })
    
    return NextResponse.json({ 
      success: true,
      message: 'Job processado manualmente',
      result: {
        jobId: job.id,
        platform: job.platform,
        processResponse: {
          status: processResponse.status,
          success: processResult.success,
          data: processResult.data,
          error: processResult.error
        }
      }
    })

  } catch (error) {
    console.error('[Manual Process] Erro inesperado:', error)
    return NextResponse.json({ 
      error: 'Falha no processamento manual',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}