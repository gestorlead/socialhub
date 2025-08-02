import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { page_id, profile_data } = await request.json()

    if (!page_id) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update the Facebook connection with selected page
    const { error: updateError } = await supabase
      .from('social_connections')
      .update({
        profile_data: profile_data,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('platform', 'facebook')

    if (updateError) {
      console.error('Error updating Facebook connection:', updateError)
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 })
    }

    console.log(`✅ User ${user.id} selected Facebook page: ${page_id}`)

    return NextResponse.json({
      success: true,
      message: 'Facebook page selected successfully',
      selected_page_id: page_id
    })

  } catch (error) {
    console.error('Facebook page selection error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}