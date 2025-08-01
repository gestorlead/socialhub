import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { CommentsQuerySchema, CommentsValidator } from '@/lib/comments-validation'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { SecureLogger } from '@/lib/secure-logger'

// Supported platforms
const SUPPORTED_PLATFORMS = ['instagram', 'tiktok', 'facebook'] as const
type Platform = typeof SUPPORTED_PLATFORMS[number]

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
 * Validate platform parameter
 */
function isValidPlatform(platform: string): platform is Platform {
  return SUPPORTED_PLATFORMS.includes(platform as Platform)
}

/**
 * GET /api/comments/platforms/[platform] - Get platform-specific comments with analytics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
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
          endpoint: `/api/comments/platforms/${params.platform}`,
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

    // Validate platform
    if (!isValidPlatform(params.platform)) {
      return NextResponse.json(
        { success: false, error: `Unsupported platform: ${params.platform}` },
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
          endpoint: `/api/comments/platforms/${params.platform}`,
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
      validatedQuery = CommentsQuerySchema.parse({
        ...queryParams,
        platform: params.platform // Override platform from URL
      })
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error },
        { status: 400 }
      )
    }

    // Check if user has connection to this platform
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('platform, platform_user_id, status, last_sync_at')
      .eq('platform', params.platform)
      .eq('user_id', user.id)
      .single()

    if (connectionError && connectionError.code !== 'PGRST116') {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to check platform connection',
        details: {
          error: connectionError.message,
          platform: params.platform,
          userId: user.id
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Failed to verify platform connection' },
        { status: 500 }
      )
    }

    if (!connection) {
      return NextResponse.json(
        { 
          success: false, 
          error: `No ${params.platform} connection found. Please connect your account first.` 
        },
        { status: 404 }
      )
    }

    // Build query for platform-specific comments
    let query = supabase
      .from('comments')
      .select(`
        *,
        social_posts (
          platform,
          platform_post_id,
          title,
          url,
          thumbnail_url,
          post_type,
          metrics,
          created_at_platform
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
      .eq('platform', params.platform)

    // Apply additional filters
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
        message: 'Failed to fetch platform comments',
        details: {
          error: queryError.message,
          platform: params.platform,
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

    // Process comments for response
    const processedComments = comments?.map(comment => ({
      ...comment,
      platform_user_id: comment.platform_user_id?.substring(0, 8) + '***'
    })) || []

    // Calculate platform-specific analytics
    const analytics = await calculatePlatformAnalytics(
      supabase, 
      params.platform, 
      user.id, 
      validatedQuery
    )

    // Log successful request
    await SecureLogger.logAPIRequest(
      `/api/comments/platforms/${params.platform}`,
      'GET',
      200,
      processedComments.length,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      platform: params.platform,
      connection: {
        status: connection.status,
        last_sync: connection.last_sync_at,
        platform_user_id: connection.platform_user_id?.substring(0, 8) + '***'
      },
      data: processedComments,
      analytics,
      pagination: {
        offset: validatedQuery.offset,
        limit: validatedQuery.limit,
        total: count,
        hasMore: count ? validatedQuery.offset + validatedQuery.limit < count : false
      },
      filters: {
        platform: params.platform,
        status: validatedQuery.status,
        search: validatedQuery.search,
        date_range: {
          from: validatedQuery.date_from,
          to: validatedQuery.date_to
        }
      }
    })

  } catch (error) {
    console.error('Platform comments GET API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Platform comments API GET request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: params.platform,
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
 * POST /api/comments/platforms/[platform] - Sync comments from platform
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    // Apply security middleware with strict settings for sync operations
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 2 * 1024 * 1024 // 2MB limit for sync operations
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply stricter rate limiting for sync operations
    const rateLimitCheck = await RateLimitMiddleware.getCommentsBulkRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        details: {
          endpoint: `/api/comments/platforms/${params.platform}`,
          method: 'POST',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded for sync operations',
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

    // Validate platform
    if (!isValidPlatform(params.platform)) {
      return NextResponse.json(
        { success: false, error: `Unsupported platform: ${params.platform}` },
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
          endpoint: `/api/comments/platforms/${params.platform}`,
          method: 'POST',
          error: authError?.message || 'Invalid token'
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Check platform connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('platform', params.platform)
      .eq('user_id', user.id)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { 
          success: false, 
          error: `No active ${params.platform} connection found. Please reconnect your account.` 
        },
        { status: 404 }
      )
    }

    // Parse request body for sync options
    let syncOptions = {}
    try {
      if (request.headers.get('content-type')?.includes('application/json')) {
        syncOptions = await request.json()
      }
    } catch (error) {
      // Use default sync options if no valid JSON provided
    }

    // Start sync operation
    const syncResult = await performPlatformSync(
      supabase,
      params.platform,
      connection,
      user.id,
      syncOptions
    )

    // Update connection last sync time
    await supabase
      .from('social_connections')
      .update({ 
        last_sync_at: new Date().toISOString(),
        status: syncResult.success ? 'active' : 'error'
      })
      .eq('id', connection.id)

    // Log sync operation
    await SecureLogger.logAPIRequest(
      `/api/comments/platforms/${params.platform}`,
      'POST',
      syncResult.success ? 200 : 500,
      syncResult.processed || 0,
      user.id,
      request
    )

    await SecureLogger.log({
      level: syncResult.success ? 'INFO' : 'ERROR',
      category: 'SYNC',
      message: `Platform sync ${syncResult.success ? 'completed' : 'failed'}`,
      details: {
        platform: params.platform,
        userId: user.id,
        ...syncResult
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: syncResult.success,
      platform: params.platform,
      sync_result: syncResult,
      message: syncResult.success 
        ? `Successfully synced ${syncResult.processed} comments from ${params.platform}`
        : `Sync failed: ${syncResult.error}`
    }, { 
      status: syncResult.success ? 200 : 500 
    })

  } catch (error) {
    console.error('Platform sync API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Platform sync API request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: params.platform,
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
 * Calculate platform-specific analytics
 */
async function calculatePlatformAnalytics(
  supabase: any,
  platform: Platform,
  userId: string,
  queryParams: any
) {
  try {
    // Base analytics query
    const { data: stats } = await supabase
      .from('comments')
      .select('status, sentiment_score, engagement_metrics, created_at')
      .eq('platform', platform)
      .eq('user_id', userId)

    if (!stats || stats.length === 0) {
      return null
    }

    // Calculate statistics
    const totalComments = stats.length
    const statusCounts = stats.reduce((acc, comment) => {
      acc[comment.status] = (acc[comment.status] || 0) + 1
      return acc
    }, {})

    // Sentiment analysis
    const sentimentScores = stats
      .filter(c => c.sentiment_score !== null)
      .map(c => c.sentiment_score)
    
    const avgSentiment = sentimentScores.length > 0 
      ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length
      : 0

    // Engagement metrics
    const totalEngagement = stats.reduce((acc, comment) => {
      const metrics = comment.engagement_metrics || {}
      acc.likes += metrics.likes || 0
      acc.replies += metrics.replies || 0
      acc.shares += metrics.shares || 0
      return acc
    }, { likes: 0, replies: 0, shares: 0 })

    // Time-based analysis (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentComments = stats.filter(c => 
      new Date(c.created_at) >= thirtyDaysAgo
    )

    return {
      overview: {
        total_comments: totalComments,
        status_breakdown: statusCounts,
        average_sentiment: Math.round(avgSentiment * 100) / 100,
        total_engagement: totalEngagement
      },
      recent_activity: {
        comments_last_30_days: recentComments.length,
        daily_average: Math.round((recentComments.length / 30) * 100) / 100
      },
      platform_specific: getPlatformSpecificMetrics(platform, stats)
    }
  } catch (error) {
    console.error('Analytics calculation error:', error)
    return null
  }
}

/**
 * Get platform-specific metrics
 */
function getPlatformSpecificMetrics(platform: Platform, stats: any[]) {
  switch (platform) {
    case 'instagram':
      return {
        avg_likes_per_comment: stats.reduce((sum, c) => 
          sum + ((c.engagement_metrics?.likes || 0)), 0) / stats.length,
        stories_vs_posts: stats.reduce((acc, c) => {
          const postType = c.social_posts?.post_type
          if (postType === 'story') acc.stories++
          else acc.posts++
          return acc
        }, { stories: 0, posts: 0 })
      }
    
    case 'tiktok':
      return {
        avg_views_per_comment: stats.reduce((sum, c) => 
          sum + ((c.engagement_metrics?.views || 0)), 0) / stats.length,
        video_performance: stats.length > 0 ? 'Available' : 'No data'
      }
    
    case 'facebook':
      return {
        avg_shares_per_comment: stats.reduce((sum, c) => 
          sum + ((c.engagement_metrics?.shares || 0)), 0) / stats.length,
        page_vs_profile: stats.reduce((acc, c) => {
          // This would need to be determined from the social post data
          acc.page++
          return acc
        }, { page: 0, profile: 0 })
      }
    
    default:
      return {}
  }
}

/**
 * Perform platform-specific sync operation
 */
async function performPlatformSync(
  supabase: any,
  platform: Platform,
  connection: any,
  userId: string,
  options: any
) {
  try {
    // This is a placeholder for the actual sync implementation
    // In a real implementation, you would:
    // 1. Use the platform's API to fetch new comments
    // 2. Process and validate the data
    // 3. Store new comments in the database
    // 4. Handle rate limiting and error recovery
    
    // For now, return a mock success response
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
    
    return {
      success: true,
      processed: 0, // Number of comments processed
      new_comments: 0,
      updated_comments: 0,
      errors: [],
      next_sync_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      processed: 0
    }
  }
}