import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Force update with the correct data structure from the API response
    const correctProfileData = {
      is_verified: false,
      union_id: "f6d00a3d-da49-5ae0-88c3-ccda24ab3d33",
      open_id: "-000HHOGDTU1jpaMpp3BaNQzkz0UFh7if_0y",
      profile_deep_link: "https://vm.tiktok.com/ZMSWwUuAM/",
      likes_count: 842,
      video_count: 151,
      avatar_large_url: "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7326995949027983365~tplv-tiktokx-cropcenter:1080:1080.jpeg",
      avatar_url: "https://p77-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7326995949027983365~tplv-tiktokx-cropcenter:168:168.jpeg",
      bio_description: "",
      display_name: "Girassol Ribeiro",
      follower_count: 115,
      following_count: 280,
      avatar_url_100: "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7326995949027983365~tplv-tiktokx-cropcenter:100:100.jpeg",
      username: "girassolsribeiro"
    }

    // Update the database
    const { data, error } = await supabase
      .from('social_connections')
      .update({
        profile_data: correctProfileData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json({ error: 'Failed to update profile', details: error }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Profile data force updated with correct values',
      updated_data: data
    })
  } catch (error) {
    console.error('Force update error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}