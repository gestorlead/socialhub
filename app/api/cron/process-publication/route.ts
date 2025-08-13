import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchPendingJobs(limit: number = 5) {
  const { data, error } = await supabase
    .from('publication_jobs')
    .select('id, user_id, platform, content, metadata')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data || []
}

async function markProcessing(jobIds: string[]) {
  if (jobIds.length === 0) return { count: 0 }
  const { data, error } = await supabase
    .from('publication_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .in('id', jobIds)
    .eq('status', 'pending')
    .select('id')

  if (error) throw error
  return { count: data?.length || 0 }
}

async function callInternalProcessor(job: any) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/internal/process-publication`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      job_id: job.id,
      user_id: job.user_id,
      platform: job.platform,
      content: job.content
    }),
    signal: AbortSignal.timeout(120000)
  })

  let json: any = null
  try { json = await res.json() } catch {}
  return { ok: res.ok, status: res.status, body: json }
}

export async function GET(request: NextRequest) {
  try {
    // If no CRON_SECRET is set, allow manual/internal triggering without header
    const expected = process.env.CRON_SECRET
    if (expected) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${expected}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const pendingJobs = await fetchPendingJobs(5)
    if (pendingJobs.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending jobs' })
    }

    const { count: processingCount } = await markProcessing(pendingJobs.map(j => j.id))

    const toProcess = pendingJobs.slice(0, processingCount)
    const results = [] as any[]
    for (const job of toProcess) {
      try {
        const result = await callInternalProcessor(job)
        results.push({ job_id: job.id, platform: job.platform, ok: result.ok, status: result.status, body: result.body })
      } catch (e: any) {
        // Fallback: mark as failed if internal call throws
        await supabase
          .from('publication_jobs')
          .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: e?.message || 'Processor call failed' })
          .eq('id', job.id)
        results.push({ job_id: job.id, platform: job.platform, ok: false, status: 500, body: { error: 'Processor call failed' } })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}

