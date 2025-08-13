import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API para diagnosticar configuração do Realtime
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Diagnose Realtime] Iniciando diagnóstico...')
    
    // Usar service role para verificar configurações
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const diagnosis = {
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configurado' : 'MISSING',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configurado' : 'MISSING',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configurado' : 'MISSING'
      },
      database: {},
      realtime: {},
      policies: {}
    }

    // 1. Verificar se tabela está na publicação do Realtime
    try {
      const { data: realtimeTables, error: realtimeError } = await supabase
        .from('pg_publication_tables')
        .select('schemaname, tablename')
        .eq('pubname', 'supabase_realtime')
        .eq('tablename', 'publication_jobs')

      diagnosis.realtime.tablesInPublication = realtimeError ? 
        `Erro: ${realtimeError.message}` : realtimeTables
    } catch (err) {
      diagnosis.realtime.tablesInPublication = `Erro ao verificar: ${err}`
    }

    // 2. Verificar políticas RLS
    try {
      const { data: policies, error: policiesError } = await supabase.rpc('get_policies_for_table', {
        table_name: 'publication_jobs'
      }).catch(() => {
        // Se a função não existe, usar consulta SQL direta
        return supabase.from('pg_policies').select('*').eq('tablename', 'publication_jobs')
      })

      diagnosis.policies.count = policiesError ? 
        `Erro: ${policiesError.message}` : `${policies?.length || 0} políticas encontradas`
    } catch (err) {
      diagnosis.policies.count = `Erro ao verificar políticas: ${err}`
    }

    // 3. Verificar jobs existentes
    try {
      const { data: jobsCount, error: jobsError } = await supabase
        .from('publication_jobs')
        .select('status', { count: 'exact', head: true })

      diagnosis.database.totalJobs = jobsError ? 
        `Erro: ${jobsError.message}` : jobsCount
    } catch (err) {
      diagnosis.database.totalJobs = `Erro ao contar jobs: ${err}`
    }

    // 4. Verificar jobs por status
    try {
      const { data: statusCounts, error: statusError } = await supabase
        .from('publication_jobs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour

      if (statusError) {
        diagnosis.database.recentJobsByStatus = `Erro: ${statusError.message}`
      } else {
        const counts = statusCounts?.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        diagnosis.database.recentJobsByStatus = counts
      }
    } catch (err) {
      diagnosis.database.recentJobsByStatus = `Erro: ${err}`
    }

    // 5. Recomendações
    const recommendations = []
    
    if (diagnosis.environment.supabaseUrl === 'MISSING') {
      recommendations.push('Configurar NEXT_PUBLIC_SUPABASE_URL')
    }
    
    if (diagnosis.environment.anonKey === 'MISSING') {
      recommendations.push('Configurar NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }

    // Se não há jobs recentes, pode ser que o Realtime não tenha nada para mostrar
    if (typeof diagnosis.database.recentJobsByStatus === 'object' && 
        Object.keys(diagnosis.database.recentJobsByStatus).length === 0) {
      recommendations.push('Criar jobs de teste para verificar Realtime')
    }

    return NextResponse.json({ 
      success: true,
      diagnosis,
      recommendations,
      troubleshooting: {
        realtime: [
          '1. Verificar se a tabela publication_jobs está na publicação supabase_realtime',
          '2. Verificar se há políticas RLS que permitam leitura pelo usuário autenticado',
          '3. Verificar se há jobs recentes para testar atualizações',
          '4. Verificar logs do console do navegador para erros de WebSocket'
        ],
        frontend: [
          '1. Abrir DevTools e verificar aba Console para logs do usePublicationStatus',
          '2. Verificar aba Network para conexões WebSocket',
          '3. Procurar por mensagens como "Successfully subscribed to publication_jobs changes"'
        ]
      }
    })

  } catch (error) {
    console.error('[Diagnose Realtime] Erro inesperado:', error)
    return NextResponse.json({ 
      error: 'Falha no diagnóstico',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}