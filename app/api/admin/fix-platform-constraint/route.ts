import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API para corrigir o constraint de plataforma usando service role
 * Permite nomes de plataforma compostos como 'instagram_story', 'threads_post', etc.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Fix Platform Constraint] Iniciando correção do constraint...')
    
    // Verificar se é ambiente de desenvolvimento
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        error: 'Esta operação só pode ser executada em desenvolvimento'
      }, { status: 403 })
    }
    
    // Usar service role para ter privilégios administrativos
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('[Fix Platform Constraint] Testando inserção para verificar constraint atual...')
    
    // Primeiro, testar se o constraint atual aceita plataformas compostas
    const { data: testData, error: testError } = await supabase
      .from('publication_jobs')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        platform: 'threads_post',
        content: { test: true, timestamp: new Date().toISOString() }
      })
      .select()
    
    if (testError) {
      if (testError.message.includes('publication_jobs_platform_check')) {
        console.log('[Fix Platform Constraint] Constraint precisa ser atualizado - erro esperado')
        
        return NextResponse.json({ 
          needsManualFix: true,
          error: 'Constraint precisa ser atualizado manualmente',
          details: testError.message,
          solution: `
Execute este SQL no Supabase Dashboard (SQL Editor):

-- 1. Remover constraint atual
ALTER TABLE publication_jobs DROP CONSTRAINT publication_jobs_platform_check;

-- 2. Adicionar novo constraint
ALTER TABLE publication_jobs 
ADD CONSTRAINT publication_jobs_platform_check 
CHECK (platform IN (
  'tiktok', 'facebook', 'instagram', 'youtube', 'threads', 'x', 'linkedin',
  'tiktok_video',
  'instagram_feed', 'instagram_story', 'instagram_reels',
  'youtube_video', 'youtube_shorts',
  'facebook_feed', 'facebook_story', 'facebook_reels',
  'x_post',
  'linkedin_post',
  'threads_post'
));

-- 3. Verificar se funcionou
INSERT INTO publication_jobs (user_id, platform, content) 
VALUES ('00000000-0000-0000-0000-000000000000', 'threads_post', '{"test": true}');

-- 4. Limpar teste
DELETE FROM publication_jobs WHERE user_id = '00000000-0000-0000-0000-000000000000';
          `,
          instructions: [
            '1. Acesse o Supabase Dashboard',
            '2. Vá para SQL Editor',
            '3. Execute o SQL fornecido acima',
            '4. Teste novamente o enfileiramento'
          ]
        }, { status: 422 })
      } else {
        console.error('[Fix Platform Constraint] Erro inesperado:', testError)
        return NextResponse.json({ 
          error: 'Erro inesperado ao testar constraint',
          details: testError.message
        }, { status: 500 })
      }
    }
    
    // Se chegou aqui, o teste passou - constraint já está correto
    console.log('[Fix Platform Constraint] Constraint já aceita plataformas compostas!')
    
    // Limpar registro de teste
    if (testData?.[0]?.id) {
      await supabase
        .from('publication_jobs')
        .delete()
        .eq('id', testData[0].id)
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Constraint já está correto - aceita plataformas compostas',
      testedPlatform: 'threads_post'
    })

  } catch (error) {
    console.error('[Fix Platform Constraint] Erro inesperado:', error)
    return NextResponse.json({ 
      error: 'Falha ao verificar/corrigir constraint',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}