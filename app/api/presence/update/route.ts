import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { SecureLogger } from '@/lib/secure-logger'
import { z } from 'zod'

/**
 * Real-time Presence Update API
 * 
 * Handles user presence updates for collaborative features:
 * - Update user status in comment threads
 * - Track typing indicators
 * - Manage user activity states
 * - Real-time presence broadcasting
 * 
 * Security Features:
 * - Rate limiting: 30 requests/minute per user
 * - JWT authentication required
 * - Input validation and sanitization
 * - Audit logging for all presence changes
 */

// Create Supabase client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function createAuthenticatedClient(authToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    }
  )
}

// Validation schema for presence updates
const PresenceUpdateSchema = z.object({
  channel: z.string()
    .min(1, 'Channel is required')
    .max(200, 'Channel name too long')
    .regex(/^(presence|comments):[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/, 'Invalid channel format'),
  
  status: z.enum(['viewing', 'typing', 'idle', 'away'], {
    required_error: 'Status is required'
  }),
  
  metadata: z.object({
    username: z.string().max(100).optional(),
    avatar: z.string().url().optional(),
    comment_id: z.string().uuid().optional(),
    platform_post_id: z.string().max(100).optional(),
    platform: z.enum(['instagram', 'tiktok', 'facebook']).optional()
  }).optional().default({})
})

/**
 * POST /api/presence/update - Update user presence
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Apply security middleware
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 64 * 1024 // 64KB limit for presence updates
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply presence-specific rate limiting
    const rateLimitCheck = await RateLimitMiddleware.getPresenceRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/presence/update',
          method: 'POST',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded for presence updates',
          retryAfter: rateLimitCheck.retryAfter
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitCheck.limit.toString(),
            'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitCheck.resetTime).toISOString(),
            'Retry-After': (rateLimitCheck.retryAfter || 60).toString()
          }
        }
      )
    }

    // Extract and validate auth token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createAuthenticatedClient(token)

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      await SecureLogger.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        details: {
          endpoint: '/api/presence/update',
          method: 'POST',
          error: authError?.message || 'Invalid token'
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate presence data
    let validatedData
    try {
      validatedData = PresenceUpdateSchema.parse(requestBody)
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid presence data', 
          details: error instanceof z.ZodError ? error.errors : error 
        },
        { status: 400 }
      )
    }

    // Extract channel information
    const channelParts = validatedData.channel.split(':')
    const channelType = channelParts[0] // 'presence' or 'comments'
    const platform = channelParts[1]
    const identifier = channelParts.slice(2).join(':') // post_id or comment_id

    // Validate user has access to this channel
    if (channelType === 'comments' && validatedData.metadata?.platform_post_id) {
      // Check if user has comments on this post or has moderation rights
      const { data: userComments } = await supabase
        .from('comments')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', platform)
        .eq('platform_post_id', identifier)
        .limit(1)

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role_id, roles(level)')
        .eq('id', user.id)
        .single()

      const hasModeratorAccess = userProfile?.roles?.level >= 2
      
      if (!userComments?.length && !hasModeratorAccess) {
        return NextResponse.json(
          { success: false, error: 'Access denied to this comment thread' },
          { status: 403 }
        )
      }
    }

    // Check for rapid status changes (potential abuse)
    const recentPresenceKey = `presence_recent:${user.id}:${validatedData.channel}`
    const recentPresence = await supabaseAdmin
      .from('comment_thread_presence')
      .select('status, updated_at')
      .eq('user_id', user.id)
      .eq('platform_post_id', identifier)
      .eq('platform', platform)
      .gte('updated_at', new Date(Date.now() - 60000).toISOString()) // Last minute
      .order('updated_at', { ascending: false })
      .limit(5)

    if (recentPresence.data && recentPresence.data.length >= 5) {
      await SecureLogger.logSecurityEvent({
        type: 'PRESENCE_ABUSE_DETECTED',
        severity: 'MEDIUM',
        details: {
          userId: user.id,
          channel: validatedData.channel,
          rapidChanges: recentPresence.data.length
        },
        actionRequired: true
      }, request)

      return NextResponse.json(
        { success: false, error: 'Too many presence updates. Please slow down.' },
        { status: 429 }
      )
    }

    // Update presence in database using the SQL function
    const { data: presenceResult, error: presenceError } = await supabaseAdmin
      .rpc('update_user_presence', {
        p_comment_id: validatedData.metadata?.comment_id || null,
        p_platform_post_id: identifier,
        p_platform: platform,
        p_status: validatedData.status,
        p_metadata: {
          ...validatedData.metadata,
          username: validatedData.metadata?.username || user.user_metadata?.username || user.email?.split('@')[0],
          avatar: validatedData.metadata?.avatar || user.user_metadata?.avatar_url,
          channel: validatedData.channel,
          timestamp: new Date().toISOString()
        }
      })

    if (presenceError) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'PRESENCE',
        message: 'Failed to update presence',
        details: {
          error: presenceError.message,
          userId: user.id,
          data: {
            channel: validatedData.channel,
            status: validatedData.status
          }
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to update presence' },
        { status: 500 }
      )
    }

    // Clean up old presence records for this user
    await supabaseAdmin
      .from('comment_thread_presence')
      .delete()
      .eq('user_id', user.id)
      .lt('last_activity', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Older than 15 minutes

    // Log successful presence update
    await SecureLogger.log({
      level: 'DEBUG',
      category: 'PRESENCE',
      message: 'Presence updated successfully',
      details: {
        userId: user.id,
        channel: validatedData.channel,
        status: validatedData.status,
        responseTime: Date.now() - startTime
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    const response = NextResponse.json({
      success: true,
      data: {
        presenceId: presenceResult,
        status: validatedData.status,
        channel: validatedData.channel,
        updatedAt: new Date().toISOString()
      },
      meta: {
        responseTime: Date.now() - startTime
      }
    })

    // Add performance headers
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    
    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error('Presence update API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Presence update API request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        responseTime
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
        meta: {
          responseTime
        }
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/presence/update - Get current presence for a channel
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Apply security middleware (lighter for GET requests)
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: false,
      enableAuditLogging: false
    })
    
    if (securityResult) {
      return securityResult
    }

    // Extract and validate auth token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createAuthenticatedClient(token)

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const channel = url.searchParams.get('channel')
    const platform = url.searchParams.get('platform')
    const postId = url.searchParams.get('post_id')

    if (!channel && (!platform || !postId)) {
      return NextResponse.json(
        { success: false, error: 'Channel or platform+post_id required' },
        { status: 400 }
      )
    }

    let platformQuery = platform
    let postIdQuery = postId

    if (channel) {
      const channelParts = channel.split(':')
      if (channelParts.length >= 3) {
        platformQuery = channelParts[1]
        postIdQuery = channelParts.slice(2).join(':')
      }
    }

    // Get current presence for the channel
    const { data: presenceData, error: presenceError } = await supabase
      .from('comment_thread_presence')
      .select(`
        user_id,
        status,
        last_activity,
        metadata,
        profiles (
          id,
          user_metadata
        )
      `)
      .eq('platform', platformQuery)
      .eq('platform_post_id', postIdQuery)
      .gte('last_activity', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Active in last 15 minutes
      .order('last_activity', { ascending: false })

    if (presenceError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch presence data' },
        { status: 500 }
      )
    }

    // Format presence data
    const formattedPresence = presenceData?.map(presence => ({
      userId: presence.user_id,
      username: presence.metadata?.username || presence.profiles?.user_metadata?.username || 'Unknown',
      avatar: presence.metadata?.avatar || presence.profiles?.user_metadata?.avatar_url,
      status: presence.status,
      lastActivity: presence.last_activity,
      isCurrentUser: presence.user_id === user.id
    })) || []

    const response = NextResponse.json({
      success: true,
      data: {
        channel: channel || `presence:${platformQuery}:${postIdQuery}`,
        presence: formattedPresence,
        activeUsers: formattedPresence.length,
        typingUsers: formattedPresence.filter(p => p.status === 'typing').length
      },
      meta: {
        responseTime: Date.now() - startTime,
        lastUpdated: new Date().toISOString()
      }
    })

    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    
    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error('Presence GET API error:', error)

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        meta: {
          responseTime
        }
      },
      { status: 500 }
    )
  }
}