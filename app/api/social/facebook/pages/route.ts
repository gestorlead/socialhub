import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    console.log(`[Facebook Pages] Getting pages for user: ${userId}`)

    // Get Facebook connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('access_token, profile_data')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Facebook not connected' }, { status: 404 })
    }

    // Get pages from stored profile data
    const pages = connection.profile_data?.pages || []
    
    console.log(`[Facebook Pages] Found ${pages.length} pages for user ${userId}`)

    // Transform pages to consistent format
    const formattedPages = pages.map((page: any) => ({
      id: page.id,
      name: page.name,
      access_token: page.access_token,
      category: page.category || null,
      is_active: page.is_active || true,
      followers_count: page.followers_count || null,
      likes_count: page.likes_count || null,
      about: page.about || null,
      cover_photo: page.cover_photo || null,
      profile_picture: page.profile_picture || null
    }))

    return NextResponse.json({
      success: true,
      pages: formattedPages,
      selected_page_id: connection.profile_data?.selected_page_id || null
    })

  } catch (error) {
    console.error('Facebook pages fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Facebook pages' },
      { status: 500 }
    )
  }
}