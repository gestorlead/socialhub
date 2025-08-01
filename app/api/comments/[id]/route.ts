import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { UpdateCommentSchema, CommentsValidator } from '@/lib/comments-validation'
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

/**
 * Validate UUID parameter
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * GET /api/comments/[id] - Get specific comment by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const rateLimitCheck = await RateLimitMiddleware.getCommentsRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        details: {
          endpoint: `/api/comments/${params.id}`,
          method: 'GET',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
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

    // Validate comment ID
    if (!isValidUUID(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid comment ID format' },
        { status: 400 }
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
        severity: 'MEDIUM',
        details: {
          endpoint: `/api/comments/${params.id}`,
          method: 'GET',
          error: authError?.message || 'Invalid token'
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Fetch comment with RLS automatically applied
    const { data: comment, error: queryError } = await supabase
      .from('comments')
      .select(`
        *,
        social_posts (
          platform,
          platform_post_id,
          title,
          url,
          thumbnail_url
        ),
        comment_replies (
          id,
          content,
          status,
          platform_reply_id,
          created_at,
          updated_at
        )
      `)
      .eq('id', params.id)
      .single()

    if (queryError) {
      if (queryError.code === 'PGRST116') { // No rows returned
        return NextResponse.json(
          { success: false, error: 'Comment not found' },
          { status: 404 }
        )
      }

      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to fetch comment',
        details: {
          error: queryError.message,
          commentId: params.id,
          userId: user.id
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to fetch comment' },
        { status: 500 }
      )
    }

    // Decrypt sensitive fields for response (if user owns the comment)
    const processedComment = {
      ...comment,
      platform_user_id: comment.platform_user_id?.substring(0, 8) + '***'
    }

    // Log successful request
    await SecureLogger.logAPIRequest(
      `/api/comments/${params.id}`,
      'GET',
      200,
      1,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      data: processedComment
    })

  } catch (error) {
    console.error('Comment GET API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Comment GET API request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        commentId: params.id,
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
 * PUT /api/comments/[id] - Update specific comment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply security middleware with stricter settings for write operations
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 512 * 1024 // 512KB limit for comment updates
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply write-specific rate limiting
    const rateLimitCheck = await RateLimitMiddleware.getCommentsWriteRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        details: {
          endpoint: `/api/comments/${params.id}`,
          method: 'PUT',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded for comment updates',
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

    // Validate comment ID
    if (!isValidUUID(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid comment ID format' },
        { status: 400 }
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
          endpoint: `/api/comments/${params.id}`,
          method: 'PUT',
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

    // Validate update data
    let validatedUpdate
    try {
      validatedUpdate = UpdateCommentSchema.parse(requestBody)
    } catch (error) {
      await SecureLogger.logSecurityEvent({
        type: 'MALICIOUS_INPUT',
        severity: 'MEDIUM',
        details: {
          endpoint: `/api/comments/${params.id}`,
          method: 'PUT',
          error: error instanceof Error ? error.message : 'Validation failed',
          input: CommentsValidator.sanitizeForLogging(requestBody)
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid update data', details: error },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData = {
      ...validatedUpdate,
      updated_at: new Date().toISOString()
    }

    // Update comment with RLS automatically applied
    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        social_posts (
          platform,
          platform_post_id,
          title,
          url
        ),
        comment_replies (
          id,
          content,
          status,
          created_at
        )
      `)
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') { // No rows returned
        return NextResponse.json(
          { success: false, error: 'Comment not found or access denied' },
          { status: 404 }
        )
      }

      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to update comment',
        details: {
          error: updateError.message,
          commentId: params.id,
          userId: user.id,
          data: CommentsValidator.sanitizeForLogging(updateData)
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to update comment' },
        { status: 500 }
      )
    }

    // Process comment for response
    const processedComment = {
      ...updatedComment,
      platform_user_id: updatedComment.platform_user_id?.substring(0, 8) + '***'
    }

    // Log successful update
    await SecureLogger.logAPIRequest(
      `/api/comments/${params.id}`,
      'PUT',
      200,
      1,
      user.id,
      request
    )

    await SecureLogger.log({
      level: 'INFO',
      category: 'COMMENT',
      message: 'Comment updated successfully',
      details: {
        commentId: params.id,
        userId: user.id,
        changes: Object.keys(validatedUpdate)
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: processedComment,
      message: 'Comment updated successfully'
    })

  } catch (error) {
    console.error('Comment PUT API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Comment PUT API request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        commentId: params.id,
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
 * DELETE /api/comments/[id] - Delete specific comment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply security middleware with strict settings for delete operations
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply write-specific rate limiting
    const rateLimitCheck = await RateLimitMiddleware.getCommentsWriteRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        details: {
          endpoint: `/api/comments/${params.id}`,
          method: 'DELETE',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded for comment deletion',
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

    // Validate comment ID
    if (!isValidUUID(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid comment ID format' },
        { status: 400 }
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
          endpoint: `/api/comments/${params.id}`,
          method: 'DELETE',
          error: authError?.message || 'Invalid token'
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // First fetch the comment to log what's being deleted
    const { data: commentToDelete, error: fetchError } = await supabase
      .from('comments')
      .select('id, platform, platform_comment_id, status, created_at')
      .eq('id', params.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // No rows returned
        return NextResponse.json(
          { success: false, error: 'Comment not found or access denied' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to verify comment' },
        { status: 500 }
      )
    }

    // Soft delete - update status instead of hard delete for audit trail
    const { data: deletedComment, error: deleteError } = await supabase
      .from('comments')
      .update({ 
        status: 'deleted',
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select('id, status, updated_at')
      .single()

    if (deleteError) {
      if (deleteError.code === 'PGRST116') { // No rows returned
        return NextResponse.json(
          { success: false, error: 'Comment not found or access denied' },
          { status: 404 }
        )
      }

      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to delete comment',
        details: {
          error: deleteError.message,
          commentId: params.id,
          userId: user.id
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to delete comment' },
        { status: 500 }
      )
    }

    // Log successful deletion
    await SecureLogger.logAPIRequest(
      `/api/comments/${params.id}`,
      'DELETE',
      200,
      1,
      user.id,
      request
    )

    await SecureLogger.log({
      level: 'INFO',
      category: 'COMMENT',
      message: 'Comment deleted successfully',
      details: {
        commentId: params.id,
        platform: commentToDelete.platform,
        platformCommentId: commentToDelete.platform_comment_id,
        originalStatus: commentToDelete.status,
        userId: user.id
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: {
        id: deletedComment.id,
        status: deletedComment.status,
        deleted_at: deletedComment.updated_at
      },
      message: 'Comment deleted successfully'
    })

  } catch (error) {
    console.error('Comment DELETE API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Comment DELETE API request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        commentId: params.id,
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