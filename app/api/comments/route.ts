import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { CreateCommentSchema, CommentsQuerySchema, CommentsValidator } from '@/lib/comments-validation'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { SecureLogger } from '@/lib/secure-logger'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
 * GET /api/comments - List comments with pagination, filtering, and search
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
    const rateLimitCheck = await RateLimitMiddleware.getCommentsRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/comments',
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
          endpoint: '/api/comments',
          method: 'GET',
          error: authError?.message || 'Invalid token'
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Parse and validate query parameters
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    
    let validatedQuery
    try {
      validatedQuery = CommentsQuerySchema.parse(queryParams)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error },
        { status: 400 }
      )
    }

    // Build query with RLS (Row Level Security) automatically applied
    let query = supabase
      .from('comments')
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

    // Apply filters
    if (validatedQuery.platform) {
      query = query.eq('platform', validatedQuery.platform)
    }

    if (validatedQuery.status) {
      query = query.eq('status', validatedQuery.status)
    }

    if (validatedQuery.search) {
      query = query.textSearch('content', validatedQuery.search)
    }

    if (validatedQuery.date_from) {
      query = query.gte('created_at', validatedQuery.date_from)
    }

    if (validatedQuery.date_to) {
      query = query.lte('created_at', validatedQuery.date_to)
    }

    // Apply sorting and pagination
    query = query
      .order(validatedQuery.sort || 'created_at', { 
        ascending: validatedQuery.order === 'asc' 
      })
      .range(validatedQuery.offset, validatedQuery.offset + validatedQuery.limit - 1)

    const { data: comments, error: queryError, count } = await query

    if (queryError) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to fetch comments',
        details: {
          error: queryError.message,
          userId: user.id,
          query: CommentsValidator.sanitizeForLogging(validatedQuery)
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to fetch comments' },
        { status: 500 }
      )
    }

    // Decrypt sensitive fields if any
    const processedComments = comments?.map(comment => {
      // Note: In a real implementation, you might want to decrypt certain fields
      // For now, we'll just return the comments as-is since RLS handles access control
      return {
        ...comment,
        // Remove or mask sensitive information for API response
        platform_user_id: comment.platform_user_id?.substring(0, 8) + '***'
      }
    }) || []

    // Log successful request
    await SecureLogger.logAPIRequest(
      '/api/comments',
      'GET',
      200,
      processedComments.length,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      data: processedComments,
      pagination: {
        offset: validatedQuery.offset,
        limit: validatedQuery.limit,
        total: count,
        hasMore: count ? validatedQuery.offset + validatedQuery.limit < count : false
      },
      filters: {
        platform: validatedQuery.platform,
        status: validatedQuery.status,
        search: validatedQuery.search,
        date_range: {
          from: validatedQuery.date_from,
          to: validatedQuery.date_to
        }
      }
    })

  } catch (error) {
    console.error('Comments GET API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Comments API GET request failed',
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
 * POST /api/comments - Create new comment with full security validation
 */
export async function POST(request: NextRequest) {
  try {
    // Apply security middleware with stricter settings for write operations
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 1024 * 1024 // 1MB limit for comment creation
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply write-specific rate limiting
    const rateLimitCheck = await RateLimitMiddleware.getCommentsWriteRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH', // Higher severity for write operations
        details: {
          endpoint: '/api/comments',
          method: 'POST',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded for comment creation',
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
          endpoint: '/api/comments',
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

    // Validate comment data with advanced security checks
    let validatedComment
    try {
      validatedComment = await CommentsValidator.validateComment(requestBody)
    } catch (error) {
      await SecureLogger.logSecurityEvent({
        type: 'MALICIOUS_INPUT',
        severity: 'HIGH',
        details: {
          endpoint: '/api/comments',
          method: 'POST',
          error: error instanceof Error ? error.message : 'Validation failed',
          input: CommentsValidator.sanitizeForLogging(requestBody)
        },
        actionRequired: true
      }, request)
      
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Validation failed' },
        { status: 400 }
      )
    }

    // Check for duplicate content (prevent spam)
    const contentHash = CommentsCrypto.hashContent(validatedComment.content, user.id)
    const { data: existingComment } = await supabase
      .from('comments')
      .select('id, created_at')
      .eq('content_hash', contentHash)
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .single()

    if (existingComment) {
      return NextResponse.json(
        { success: false, error: 'Duplicate comment detected. Please wait before posting similar content.' },
        { status: 409 }
      )
    }

    // Encrypt sensitive data if needed
    const encryptedPlatformUserId = CommentsCrypto.encryptCommentData(
      validatedComment.platform_user_id,
      `${user.id}:${validatedComment.platform}`
    )

    // Prepare comment data for insertion
    const commentData = {
      ...validatedComment,
      user_id: user.id,
      platform_user_id: encryptedPlatformUserId,
      content_hash: contentHash,
      status: 'pending', // Default status for new comments
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Insert comment with RLS automatically applied
    const { data: newComment, error: insertError } = await supabase
      .from('comments')
      .insert([commentData])
      .select(`
        *,
        social_posts (
          platform,
          platform_post_id,
          title,
          url
        )
      `)
      .single()

    if (insertError) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to create comment',
        details: {
          error: insertError.message,
          userId: user.id,
          data: CommentsValidator.sanitizeForLogging(commentData)
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to create comment' },
        { status: 500 }
      )
    }

    // Decrypt sensitive fields for response
    const processedComment = {
      ...newComment,
      platform_user_id: CommentsCrypto.decryptCommentData(
        newComment.platform_user_id,
        `${user.id}:${newComment.platform}`
      )?.substring(0, 8) + '***' // Mask for API response
    }

    // Log successful comment creation
    await SecureLogger.logAPIRequest(
      '/api/comments',
      'POST',
      201,
      1,
      user.id,
      request
    )

    await SecureLogger.log({
      level: 'INFO',
      category: 'COMMENT',
      message: 'Comment created successfully',
      details: {
        commentId: newComment.id,
        platform: newComment.platform,
        userId: user.id
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: processedComment,
      message: 'Comment created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Comments POST API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Comments API POST request failed',
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