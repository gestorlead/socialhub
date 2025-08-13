import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API para testar se o Realtime está funcionando
 * Atualiza um job com timestamp para verificar se a interface recebe a atualização
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Test Realtime] Testando atualização via Realtime...')
    
    const { jobId } = await request.json()
    
    if (!jobId) {
      return NextResponse.json({ 
        error: 'Job ID é obrigatório' 
      }, { status: 400 })
    }
    
    // Usar service role para fazer a atualização
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Atualizar o job com um timestamp para testar Realtime
    const testMessage = `Realtime test update at ${new Date().toISOString()}`
    
    const { data, error } = await supabase
      .from('publication_jobs')
      .update({ 
        error_message: testMessage
      })
      .eq('id', jobId)
      .select()
    
    if (error) {
      console.error('[Test Realtime] Erro ao atualizar job:', error)
      return NextResponse.json({ 
        error: 'Falha ao atualizar job',
        details: error.message
      }, { status: 500 })
    }
    
    console.log('[Test Realtime] Job atualizado com sucesso:', data)
    
    return NextResponse.json({ 
      success: true,
      message: 'Job atualizado com timestamp de teste',
      updatedJob: data?.[0],
      testMessage,
      instructions: [
        '1. Verifique se a interface mostrou a atualização automaticamente',
        '2. Procure por logs no console do navegador sobre Realtime',
        '3. Se não atualizou, pode haver problema com Realtime'
      ]
    })

  } catch (error) {
    console.error('[Test Realtime] Erro inesperado:', error)
    return NextResponse.json({ 
      error: 'Falha no teste de Realtime',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}