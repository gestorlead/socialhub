import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { BulkUpdateCommentsSchema, CommentsValidator } from '@/lib/comments-validation'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { SecureLogger } from '@/lib/secure-logger'

// Create authenticated Supabase client
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

// Create admin Supabase client for privileged operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Check if user has admin privileges
 */
async function checkAdminPrivileges(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', userId)
      .single()

    // Role ID 2 = Admin, Role ID 3 = Super Admin
    return profile && (profile.role_id === 2 || profile.role_id === 3)
  } catch (error) {
    console.error('Error checking admin privileges:', error)
    return false
  }
}

/**
 * POST /api/comments/moderate - Bulk moderation actions
 */
export async function POST(request: NextRequest) {
  try {
    // Apply security middleware with strict settings for moderation operations
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 1024 * 1024 // 1MB limit
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply moderation-specific rate limiting
    const rateLimitCheck = await RateLimitMiddleware.getCommentsModerationRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        details: {
          endpoint: '/api/comments/moderate',
          method: 'POST',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded for moderation operations',
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
          endpoint: '/api/comments/moderate',
          method: 'POST',
          error: authError?.message || 'Invalid token'
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Check admin privileges for moderation actions
    const isAdmin = await checkAdminPrivileges(supabase, user.id)
    if (!isAdmin) {
      await SecureLogger.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        details: {
          endpoint: '/api/comments/moderate',
          method: 'POST',
          userId: user.id,
          reason: 'Insufficient privileges for moderation'
        },
        actionRequired: true
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges. Admin access required.' },
        { status: 403 }
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

    // Validate bulk update data
    let validatedUpdate
    try {
      validatedUpdate = BulkUpdateCommentsSchema.parse(requestBody)
    } catch (error) {
      await SecureLogger.logSecurityEvent({
        type: 'MALICIOUS_INPUT',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/comments/moderate',
          method: 'POST',
          error: error instanceof Error ? error.message : 'Validation failed',
          input: CommentsValidator.sanitizeForLogging(requestBody)
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid moderation data', details: error },
        { status: 400 }
      )
    }

    // Prepare update data based on action
    const updateData: any = {
      updated_at: new Date().toISOString(),
      moderated_by: user.id,
      moderated_at: new Date().toISOString()
    }

    switch (validatedUpdate.action) {
      case 'approve':
        updateData.status = 'approved'
        break
      case 'reject':
        updateData.status = 'rejected'
        break
      case 'mark_spam':
        updateData.status = 'spam'
        updateData.moderation_flags = ['spam']
        break
      case 'delete':
        updateData.status = 'deleted'
        updateData.deleted_at = new Date().toISOString()
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid moderation action' },
          { status: 400 }
        )
    }

    // Add reason if provided
    if (validatedUpdate.reason) {
      updateData.moderation_reason = validatedUpdate.reason
    }

    // First, fetch existing comments to validate ownership and log changes
    const { data: existingComments, error: fetchError } = await supabase
      .from('comments')
      .select('id, user_id, platform, platform_comment_id, status, content')
      .in('id', validatedUpdate.comment_ids)

    if (fetchError) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to fetch comments for moderation',
        details: {
          error: fetchError.message,
          commentIds: validatedUpdate.comment_ids,
          userId: user.id
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to fetch comments for moderation' },
        { status: 500 }
      )
    }

    if (!existingComments || existingComments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No comments found with the provided IDs' },
        { status: 404 }
      )
    }

    // Check if all comments belong to the user (unless admin override)
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', user.id)
      .single()

    const isSuperAdmin = adminProfile && adminProfile.role_id === 3
    const commentsFromOtherUsers = existingComments.filter(c => c.user_id !== user.id)

    if (commentsFromOtherUsers.length > 0 && !isSuperAdmin) {
      await SecureLogger.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        details: {
          endpoint: '/api/comments/moderate',
          method: 'POST',
          userId: user.id,
          reason: 'Attempted to moderate comments from other users',
          commentIds: commentsFromOtherUsers.map(c => c.id)
        },
        actionRequired: true
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot moderate comments from other users. Super admin privileges required.' 
        },
        { status: 403 }
      )
    }

    // Perform bulk update
    const { data: updatedComments, error: updateError } = await supabase
      .from('comments')
      .update(updateData)
      .in('id', validatedUpdate.comment_ids)
      .select('id, status, updated_at, moderated_at')

    if (updateError) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to update comments during moderation',
        details: {
          error: updateError.message,
          commentIds: validatedUpdate.comment_ids,
          action: validatedUpdate.action,
          userId: user.id,
          data: CommentsValidator.sanitizeForLogging(updateData)
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to update comments' },
        { status: 500 }
      )
    }

    // Log successful moderation action
    await SecureLogger.logAPIRequest(
      '/api/comments/moderate',
      'POST',
      200,
      updatedComments?.length || 0,
      user.id,
      request
    )

    // Create detailed audit log entry
    await SecureLogger.log({
      level: 'INFO',
      category: 'MODERATION',
      message: `Bulk moderation action completed: ${validatedUpdate.action}`,
      details: {
        action: validatedUpdate.action,
        commentIds: validatedUpdate.comment_ids,
        reason: validatedUpdate.reason,
        affectedComments: updatedComments?.length || 0,
        moderatorId: user.id,
        previousStatuses: existingComments.map(c => ({ id: c.id, status: c.status }))
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Additional logging for sensitive actions
    if (validatedUpdate.action === 'delete') {
      for (const comment of existingComments) {
        await SecureLogger.log({
          level: 'WARN',
          category: 'MODERATION',
          message: 'Comment deleted via bulk moderation',
          details: {
            commentId: comment.id,
            platform: comment.platform,
            platformCommentId: comment.platform_comment_id,
            originalUserId: comment.user_id,
            moderatorId: user.id,
            reason: validatedUpdate.reason || 'No reason provided',
            contentHash: CommentsCrypto.hashContent(comment.content || '', comment.user_id)
          },
          userId: user.id,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        })
      }
    }

    // Calculate summary statistics
    const summary = {
      total_requested: validatedUpdate.comment_ids.length,
      successfully_updated: updatedComments?.length || 0,
      failed: validatedUpdate.comment_ids.length - (updatedComments?.length || 0),
      action: validatedUpdate.action,
      reason: validatedUpdate.reason
    }

    return NextResponse.json({
      success: true,
      data: updatedComments,
      summary,
      message: `Successfully ${validatedUpdate.action}ed ${updatedComments?.length || 0} comment(s)`
    })

  } catch (error) {
    console.error('Comments moderation API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Comments moderation API request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/comments/moderate - Get moderation queue and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Apply security middleware
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply rate limiting
    const rateLimitCheck = await RateLimitMiddleware.getCommentsModerationRateLimit()(request)
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded',
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
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Check admin privileges
    const isAdmin = await checkAdminPrivileges(supabase, user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges. Admin access required.' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const platform = url.searchParams.get('platform')
    const priority = url.searchParams.get('priority') // 'high', 'medium', 'low'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Build moderation queue query
    let queueQuery = supabase
      .from('comments')
      .select(`
        *,
        social_posts (
          platform,
          platform_post_id,
          title,
          url
        ),
        profiles!comments_user_id_fkey (
          email,
          full_name
        )
      `)
      .in('status', ['pending', 'flagged'])
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (platform) {
      queueQuery = queueQuery.eq('platform', platform)
    }

    // Add priority filtering based on sentiment and flags
    if (priority === 'high') {
      queueQuery = queueQuery.or('sentiment_score.lt.-0.5,moderation_flags.neq.{}')
    } else if (priority === 'medium') {
      queueQuery = queueQuery
        .gte('sentiment_score', -0.5)
        .lte('sentiment_score', 0)
    } else if (priority === 'low') {
      queueQuery = queueQuery.gt('sentiment_score', 0)
    }

    const { data: queueComments, error: queueError, count } = await queueQuery

    if (queueError) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to fetch moderation queue',
        details: {
          error: queueError.message,
          userId: user.id
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to fetch moderation queue' },
        { status: 500 }
      )
    }

    // Get moderation statistics
    const { data: stats } = await supabase
      .from('comments')
      .select('status, platform, sentiment_score, moderation_flags')

    const moderationStats = stats ? calculateModerationStats(stats) : null

    // Process comments for response (mask sensitive data)
    const processedComments = queueComments?.map(comment => ({
      ...comment,
      platform_user_id: comment.platform_user_id?.substring(0, 8) + '***',
      profiles: comment.profiles ? {
        email: comment.profiles.email?.substring(0, 3) + '***@***',
        full_name: comment.profiles.full_name
      } : null
    })) || []

    // Log successful request
    await SecureLogger.logAPIRequest(
      '/api/comments/moderate',
      'GET',
      200,
      processedComments.length,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      moderation_queue: processedComments,
      statistics: moderationStats,
      pagination: {
        offset,
        limit,
        total: count,
        hasMore: count ? offset + limit < count : false
      },
      filters: {
        platform,
        priority
      }
    })

  } catch (error) {
    console.error('Moderation queue API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Moderation queue API request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate moderation statistics
 */
function calculateModerationStats(comments: any[]) {
  const total = comments.length
  const statusCounts = comments.reduce((acc, comment) => {
    acc[comment.status] = (acc[comment.status] || 0) + 1
    return acc
  }, {})

  const platformCounts = comments.reduce((acc, comment) => {
    acc[comment.platform] = (acc[comment.platform] || 0) + 1
    return acc
  }, {})

  // Sentiment distribution
  const sentimentBuckets = comments.reduce((acc, comment) => {
    if (comment.sentiment_score === null) {
      acc.unknown++
    } else if (comment.sentiment_score < -0.5) {
      acc.negative++
    } else if (comment.sentiment_score > 0.5) {
      acc.positive++
    } else {
      acc.neutral++
    }
    return acc
  }, { positive: 0, neutral: 0, negative: 0, unknown: 0 })

  // Flagged comments
  const flaggedComments = comments.filter(c => 
    c.moderation_flags && c.moderation_flags.length > 0
  ).length

  return {
    overview: {
      total_comments: total,
      pending_moderation: statusCounts.pending || 0,
      flagged_comments: flaggedComments,
      approved_comments: statusCounts.approved || 0,
      rejected_comments: statusCounts.rejected || 0,
      spam_comments: statusCounts.spam || 0
    },
    by_platform: platformCounts,
    sentiment_distribution: sentimentBuckets,
    priority_queue: {
      high_priority: comments.filter(c => 
        c.sentiment_score < -0.5 || (c.moderation_flags && c.moderation_flags.length > 0)
      ).length,
      medium_priority: comments.filter(c => 
        c.sentiment_score >= -0.5 && c.sentiment_score <= 0
      ).length,
      low_priority: comments.filter(c => 
        c.sentiment_score > 0
      ).length
    }
  }
}