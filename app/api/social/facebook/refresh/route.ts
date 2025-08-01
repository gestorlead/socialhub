import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Get Facebook connection
    const { data: connection, error } = await supabase
      .from('social_connections')
      .select('id, access_token, profile_data')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Facebook connection not found' }, { status: 404 })
    }

    const accessToken = connection.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'No access token found' }, { status: 400 })
    }

    // Get user info
    const userInfoResponse = await fetch(
      `https://graph.facebook.com/v23.0/me?fields=id,name,email&access_token=${accessToken}`
    )

    if (!userInfoResponse.ok) {
      return NextResponse.json({ error: 'Failed to refresh user info' }, { status: 400 })
    }

    const userInfo = await userInfoResponse.json()

    // Get updated pages info
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,category,access_token,is_published,about,fan_count,followers_count,picture{url},engagement&access_token=${accessToken}`
    )

    let pages = []
    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json()
      if (pagesData.data && Array.isArray(pagesData.data)) {
        // For each page, get additional metrics
        for (const page of pagesData.data) {
          // Get page insights
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v23.0/${page.id}/insights?metric=page_engaged_users,page_post_engagements,page_impressions&period=day&access_token=${page.access_token}`
          )
          
          let engagementCount = 0
          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json()
            // Sum up engagement metrics
            if (insightsData.data) {
              insightsData.data.forEach((metric: any) => {
                if (metric.name === 'page_engaged_users' && metric.values?.[0]?.value) {
                  engagementCount = metric.values[0].value
                }
              })
            }
          }

          pages.push({
            id: page.id,
            name: page.name,
            category: page.category || 'Unknown',
            access_token: page.access_token,
            is_published: page.is_published !== false,
            about: page.about || '',
            fan_count: page.fan_count || 0,
            followers_count: page.followers_count || 0,
            engagement_count: engagementCount,
            picture: page.picture?.data?.url || null,
            is_active: true
          })
        }
      }
    }

    // Update connection with fresh data
    const updateData = {
      profile_data: {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        pages: pages
      },
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('social_connections')
      .update(updateData)
      .eq('id', connection.id)

    if (updateError) {
      console.error('Error updating Facebook connection:', updateError)
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email
      },
      pages_count: pages.length,
      pages: pages.map(p => ({
        id: p.id,
        name: p.name,
        fan_count: p.fan_count,
        followers_count: p.followers_count,
        engagement_count: p.engagement_count
      }))
    })

  } catch (error) {
    console.error('Facebook refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh Facebook data' },
      { status: 500 }
    )
  }
}