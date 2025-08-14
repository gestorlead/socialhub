import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function buildQuery(username?: string) {
  if (!username) return null
  // Count posts authored by the user, excluding retweets
  return `(from:${username}) -is:retweet`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const granularity = searchParams.get('granularity') || 'day' // minute|hour|day
    const start_time = searchParams.get('start_time') // optional ISO8601
    const end_time = searchParams.get('end_time') // optional ISO8601

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Fetch X connection and profile to build query
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('access_token, profile_data')
      .eq('user_id', userId)
      .eq('platform', 'x')
      .single()

    if (connError || !connection?.access_token) {
      return NextResponse.json({ error: 'X account not connected' }, { status: 404 })
    }

    const username = connection.profile_data?.username
    const query = buildQuery(username)
    if (!query) {
      return NextResponse.json({ error: 'Missing username in profile' }, { status: 400 })
    }

    const params = new URLSearchParams({ query, granularity })
    if (start_time) params.set('start_time', start_time)
    if (end_time) params.set('end_time', end_time)

    // Prefer app-only bearer if configured (alguns endpoints de counts exigem token app-only)
    let bearer: string | null = null
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('config_data, bearer_token')
      .eq('platform', 'x')
      .maybeSingle()
    bearer = (settings?.bearer_token || settings?.config_data?.bearer_token) || null
    if (!bearer) {
      bearer = connection.access_token // fallback para token de usuário
    }

    const fetchTotal = async (base: string) => {
      const url = `${base}?${params.toString()}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, data }
      const total = typeof data?.meta?.total_tweet_count === 'number'
        ? data.meta.total_tweet_count
        : Array.isArray(data?.data) ? data.data.reduce((acc: number, it: any) => acc + (it?.tweet_count || 0), 0) : 0
      return { ok: true, total, data }
    }

    const allRes = await fetchTotal('https://api.x.com/2/tweets/counts/all')
    const recentRes = await fetchTotal('https://api.x.com/2/tweets/counts/recent')

    if (allRes.ok || recentRes.ok) {
      return NextResponse.json({
        success: true,
        totals: {
          all: allRes.ok ? allRes.total : null,
          recent: recentRes.ok ? recentRes.total : null
        },
        raw: {
          all: allRes.ok ? allRes.data : allRes.data,
          recent: recentRes.ok ? recentRes.data : recentRes.data
        }
      })
    }

    return NextResponse.json({ error: 'Failed to fetch counts', details: { all: allRes.data, recent: recentRes.data } }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

