import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { CreateCommentSchema, CommentsQuerySchema, CommentsValidator } from '@/lib/comments-validation'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { SecureLogger } from '@/lib/secure-logger'

// Performance optimization imports
import { databaseOptimizer } from '@/lib/database-optimizer'
import { performanceCache, CacheStrategies, CACHE_CONFIGS } from '@/lib/performance-cache'
import { withPerformanceMonitoring } from '@/lib/performance-monitor'

/**
 * High-Performance Comments API with Multi-Layer Caching
 * 
 * Performance Features:
 * - Multi-layer caching (L1: memory, L2: Redis)
 * - Database connection pooling
 * - Cursor-based pagination
 * - Query optimization and batching
 * - Performance monitoring
 * 
 * Performance Targets:
 * - API Response Time: 95% < 200ms
 * - Cache Hit Rate: >80%
 * - Database Query Time: <100ms
 */

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Create authenticated Supabase client with connection pooling
function createAuthenticatedClient(authToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false // Disable for performance
      },
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Connection-Pool': 'true'
        }
      }
    }
  )
}

/**
 * GET /api/comments/optimized - High-performance comments listing
 */
const GET_Handler = async function(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Apply security middleware (with caching for repeated checks)
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply rate limiting with intelligent caching
    const rateLimitCheck = await RateLimitMiddleware.getCommentsRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/comments/optimized',
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

    // Verify user authentication with caching
    const userCacheKey = `user:auth:${token.slice(-8)}`
    let user = await performanceCache.get(userCacheKey)
    
    if (!user) {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData.user) {
        await SecureLogger.logSecurityEvent({
          type: 'UNAUTHORIZED_ACCESS',
          severity: 'MEDIUM',
          details: {
            endpoint: '/api/comments/optimized',
            method: 'GET',
            error: authError?.message || 'Invalid token'
          }
        }, request)
        
        return NextResponse.json(
          { success: false, error: 'Invalid authentication' },
          { status: 401 }
        )
      }
      
      user = userData.user
      // Cache user data for 5 minutes
      await performanceCache.set(userCacheKey, user, {
        ttl: 5 * 60 * 1000,
        tags: ['user', 'auth'],
        priority: 'high'
      })
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

    // Generate cache key for this specific query
    const cacheKey = CacheStrategies.generateCommentsKey(user.id, validatedQuery)
    
    // Try to get from cache first
    const cachedResult = await performanceCache.get(cacheKey)
    if (cachedResult) {
      // Add cache hit headers
      const response = NextResponse.json({
        ...cachedResult,
        meta: {
          ...cachedResult.meta,
          fromCache: true,
          responseTime: Date.now() - startTime,
          cacheHit: true
        }
      })
      
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
      return response
    }

    // Use optimized database query with connection pooling
    const result = await databaseOptimizer.getComments(
      user.id,
      validatedQuery,
      validatedQuery.cursor ? {
        column: 'created_at',
        value: validatedQuery.cursor,
        direction: validatedQuery.order === 'asc' ? 'asc' : 'desc'
      } : undefined,
      validatedQuery.limit
    )

    if (result.error) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to fetch comments (optimized)',
        details: {
          error: result.error.message,
          userId: user.id,
          query: CommentsValidator.sanitizeForLogging(validatedQuery),
          responseTime: Date.now() - startTime
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to fetch comments' },
        { status: 500 }
      )
    }

    // Process comments for API response (with streaming for large datasets)
    const processedComments = result.data?.map(comment => {
      // Decrypt sensitive fields if needed
      return {
        ...comment,
        platform_user_id: comment.platform_user_id?.substring(0, 8) + '***'
      }
    }) || []

    // Prepare response data
    const responseData = {
      success: true,
      data: processedComments,
      pagination: {
        offset: validatedQuery.offset,
        limit: validatedQuery.limit,
        hasMore: processedComments.length === validatedQuery.limit,
        nextCursor: processedComments.length > 0 ? 
          processedComments[processedComments.length - 1].created_at : null
      },
      filters: {
        platform: validatedQuery.platform,
        status: validatedQuery.status,
        search: validatedQuery.search,
        date_range: {
          from: validatedQuery.date_from,
          to: validatedQuery.date_to
        }
      },
      meta: {
        fromCache: false,
        responseTime: Date.now() - startTime,
        queryTime: result.metrics?.latency || 0,
        cacheHit: false
      }
    }

    // Cache the result for future requests
    await performanceCache.set(cacheKey, responseData, {
      ...CACHE_CONFIGS.COMMENTS_LIST,
      tags: CacheStrategies.getTags('comments', [user.id, validatedQuery.platform || 'all'])
    })

    // Log successful request with performance metrics
    await SecureLogger.logAPIRequest(
      '/api/comments/optimized',
      'GET',
      200,
      processedComments.length,
      user.id,
      request,
      {
        responseTime: Date.now() - startTime,
        cacheHit: false,
        queryTime: result.metrics?.latency
      }
    )

    const response = NextResponse.json(responseData)
    
    // Add performance headers
    response.headers.set('X-Cache', 'MISS')
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    response.headers.set('X-Query-Time', `${result.metrics?.latency || 0}ms`)
    
    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error('Optimized Comments GET API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Optimized Comments API GET request failed',
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
 * POST /api/comments/optimized - High-performance comment creation
 */
const POST_Handler = async function(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Apply security middleware with stricter settings for write operations
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 1024 * 1024 // 1MB limit
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
          endpoint: '/api/comments/optimized',
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

    // Verify user authentication (with caching)
    const userCacheKey = `user:auth:${token.slice(-8)}`
    let user = await performanceCache.get(userCacheKey)
    
    if (!user) {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData.user) {
        await SecureLogger.logSecurityEvent({
          type: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          details: {
            endpoint: '/api/comments/optimized',
            method: 'POST',
            error: authError?.message || 'Invalid token'
          }
        }, request)
        
        return NextResponse.json(
          { success: false, error: 'Invalid authentication' },
          { status: 401 }
        )
      }
      
      user = userData.user
      // Cache user data
      await performanceCache.set(userCacheKey, user, {
        ttl: 5 * 60 * 1000,
        tags: ['user', 'auth'],
        priority: 'high'
      })
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
          endpoint: '/api/comments/optimized',
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

    // Check for duplicate content (prevent spam) with caching
    const contentHash = CommentsCrypto.hashContent(validatedComment.content, user.id)
    const duplicateCheckKey = `duplicate:${contentHash}`
    
    let isDuplicate = await performanceCache.get(duplicateCheckKey)
    if (isDuplicate === null) {
      const { data: existingComment } = await supabase
        .from('comments')
        .select('id, created_at')
        .eq('content_hash', contentHash)
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single()
      
      isDuplicate = !!existingComment
      // Cache duplicate check for 5 minutes
      await performanceCache.set(duplicateCheckKey, isDuplicate, {
        ttl: 5 * 60 * 1000,
        tags: ['duplicate-check'],
        priority: 'medium'
      })
    }

    if (isDuplicate) {
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
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Insert comment with optimized query
    const insertResult = await databaseOptimizer.executeQuery(
      supabase
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
        .single(),
      {
        priority: 'high'
      }
    )

    if (insertResult.error) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to create comment (optimized)',
        details: {
          error: insertResult.error.message,
          userId: user.id,
          data: CommentsValidator.sanitizeForLogging(commentData),
          responseTime: Date.now() - startTime
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to create comment' },
        { status: 500 }
      )
    }

    const newComment = insertResult.data

    // Invalidate related caches
    await performanceCache.invalidateByTags([
      'comments',
      `comments:${user.id}`,
      `comments:${newComment.platform}`
    ])

    // Decrypt sensitive fields for response
    const processedComment = {
      ...newComment,
      platform_user_id: CommentsCrypto.decryptCommentData(
        newComment.platform_user_id,
        `${user.id}:${newComment.platform}`
      )?.substring(0, 8) + '***'
    }

    // Log successful comment creation with performance metrics
    await SecureLogger.logAPIRequest(
      '/api/comments/optimized',
      'POST',
      201,
      1,
      user.id,
      request,
      {
        responseTime: Date.now() - startTime,
        queryTime: insertResult.metrics?.latency
      }
    )

    await SecureLogger.log({
      level: 'INFO',
      category: 'COMMENT',
      message: 'Comment created successfully (optimized)',
      details: {
        commentId: newComment.id,
        platform: newComment.platform,
        userId: user.id,
        responseTime: Date.now() - startTime
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    const response = NextResponse.json({
      success: true,
      data: processedComment,
      message: 'Comment created successfully',
      meta: {
        responseTime: Date.now() - startTime,
        queryTime: insertResult.metrics?.latency
      }
    }, { status: 201 })
    
    // Add performance headers
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    response.headers.set('X-Query-Time', `${insertResult.metrics?.latency || 0}ms`)
    
    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error('Optimized Comments POST API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Optimized Comments API POST request failed',
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

// Export handlers with performance monitoring
export const GET = withPerformanceMonitoring(GET_Handler)
export const POST = withPerformanceMonitoring(POST_Handler)