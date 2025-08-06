import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Refresh X profile data
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user's X connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'x')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'X account not connected' }, { status: 404 })
    }

    // Check if token is still valid
    const now = new Date()
    const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null
    
    if (expiresAt && expiresAt <= now) {
      // Token expired, try to refresh it
      if (connection.refresh_token) {
        await refreshAccessToken(supabase, connection)
        // Reload connection after refresh
        const { data: refreshedConnection } = await supabase
          .from('social_connections')
          .select('*')
          .eq('id', connection.id)
          .single()
        
        if (refreshedConnection) {
          connection.access_token = refreshedConnection.access_token
        }
      } else {
        return NextResponse.json({ 
          error: 'Token expired and no refresh token available. Please reconnect your account.' 
        }, { status: 401 })
      }
    }

    // Fetch updated profile data from X API
    const profileResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=id,username,name,profile_image_url,public_metrics,verified,description', {
      headers: {
        'Authorization': `Bearer ${connection.access_token}`
      }
    })

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text()
      console.error('Failed to fetch X profile:', errorText)
      return NextResponse.json({ 
        error: 'Failed to fetch profile data from X',
        details: errorText
      }, { status: profileResponse.status })
    }

    const profileData = await profileResponse.json()
    const userProfile = profileData.data

    // Update connection with fresh profile data
    const updatedProfileData = {
      id: userProfile.id,
      username: userProfile.username,
      name: userProfile.name,
      profile_image_url: userProfile.profile_image_url,
      verified: userProfile.verified || false,
      description: userProfile.description || '',
      public_metrics: userProfile.public_metrics || {
        followers_count: 0,
        following_count: 0,
        tweet_count: 0,
        listed_count: 0
      }
    }

    const { data: updatedConnection, error: updateError } = await supabase
      .from('social_connections')
      .update({
        profile_data: updatedProfileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update connection:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update profile data',
        details: updateError.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Profile data refreshed successfully',
      data: updatedConnection
    })
  } catch (error) {
    console.error('Error in POST /api/social/x/refresh:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

// Helper function to refresh access token
async function refreshAccessToken(supabase: any, connection: any) {
  try {
    // Get X integration settings from unified table
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'x')
      .maybeSingle()

    const config = settings ? {
      client_id: settings.client_key,
      client_secret: settings.client_secret
    } : {
      client_id: process.env.X_CLIENT_ID,
      client_secret: process.env.X_CLIENT_SECRET
    }

    const tokenRequestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
      client_id: config.client_id,
      client_secret: config.client_secret
    })

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenRequestBody
    })

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json()
      
      // Update connection with new tokens
      await supabase
        .from('social_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || connection.refresh_token,
          expires_at: tokenData.expires_in ? 
            new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : 
            null,
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)
    } else {
      console.error('Failed to refresh X token:', await tokenResponse.text())
      throw new Error('Failed to refresh access token')
    }
  } catch (error) {
    console.error('Error refreshing X token:', error)
    throw error
  }
}