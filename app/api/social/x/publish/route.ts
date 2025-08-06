import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PublishRequest {
  user_id: string
  text: string
  media_ids?: string[]
  reply_to?: string
}

// POST - Publish post to X
export async function POST(request: NextRequest) {
  try {
    const body: PublishRequest = await request.json()
    const { user_id, text, media_ids, reply_to } = body

    if (!user_id || !text) {
      return NextResponse.json({ 
        error: 'User ID and text are required' 
      }, { status: 400 })
    }

    // Validate text length (X limit is 280 characters)
    if (text.length > 280) {
      return NextResponse.json({ 
        error: 'Text exceeds 280 character limit' 
      }, { status: 400 })
    }

    // Get user's X connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', user_id)
      .eq('platform', 'x')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'X account not connected' }, { status: 404 })
    }

    // Check if connection is active
    if (!connection.is_active) {
      return NextResponse.json({ error: 'X connection is inactive' }, { status: 403 })
    }

    // Check if token is still valid
    const now = new Date()
    const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null
    
    if (expiresAt && expiresAt <= now) {
      if (connection.refresh_token) {
        await refreshAccessToken(supabase, connection)
        // Reload connection after refresh
        const { data: refreshedConnection } = await supabase
          .from('social_connections')
          .select('access_token')
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

    // Check monthly post limit for Free Tier (100 posts/month)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const { count: monthlyPosts } = await supabase
      .from('social_posts')
      .select('*', { count: 'exact' })
      .eq('user_id', user_id)
      .eq('platform', 'x')
      .eq('status', 'published')
      .gte('created_at', startOfMonth.toISOString())

    if (monthlyPosts && monthlyPosts >= 100) {
      return NextResponse.json({ 
        error: 'Monthly posting limit reached (100 posts/month for Free Tier)' 
      }, { status: 429 })
    }

    // Prepare tweet data
    const tweetData: any = {
      text: text
    }

    // Add media if provided
    if (media_ids && media_ids.length > 0) {
      tweetData.media = {
        media_ids: media_ids
      }
    }

    // Add reply reference if provided
    if (reply_to) {
      tweetData.reply = {
        in_reply_to_tweet_id: reply_to
      }
    }

    // Publish tweet to X
    const publishResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetData)
    })

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json()
      console.error('Failed to publish to X:', errorData)
      
      // Check for specific error types
      if (publishResponse.status === 429) {
        return NextResponse.json({ 
          error: 'Rate limit exceeded. Please try again later.',
          details: errorData
        }, { status: 429 })
      }
      
      if (publishResponse.status === 403) {
        return NextResponse.json({ 
          error: 'Permission denied. Check your app permissions.',
          details: errorData
        }, { status: 403 })
      }

      return NextResponse.json({ 
        error: 'Failed to publish post to X',
        details: errorData
      }, { status: publishResponse.status })
    }

    const publishData = await publishResponse.json()
    const tweetId = publishData.data.id

    // Save published post to database (consistent with other integrations)
    const { data: savedPost, error: saveError } = await supabase
      .from('social_posts')
      .insert({
        user_id: user_id,
        platform: 'x',
        platform_post_id: tweetId,
        content: text,
        media_urls: media_ids?.length ? [] : null, // X doesn't store URLs, only IDs
        status: 'published',
        published_at: new Date().toISOString(),
        metadata: {
          media_ids: media_ids,
          reply_to: reply_to,
          response_data: publishData
        }
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save published post:', saveError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Post published successfully to X',
      data: {
        tweet_id: tweetId,
        url: `https://x.com/${connection.profile_data.username}/status/${tweetId}`,
        published_at: new Date().toISOString(),
        remaining_posts: Math.max(0, 100 - (monthlyPosts || 0) - 1)
      }
    })
  } catch (error) {
    console.error('Error in POST /api/social/x/publish:', error)
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