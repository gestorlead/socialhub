import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { CommentsValidator, sanitizeCommentString, detectAdvancedXSS, detectAdvancedSQLInjection } from '@/lib/comments-validation'
import { SecureLogger } from '@/lib/secure-logger'
import { z } from 'zod'

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

// Search parameters validation schema
const SearchQuerySchema = z.object({
  q: z.string()
    .min(1, 'Search query is required')
    .max(200, 'Search query too long (max 200 characters)')
    .transform((val) => sanitizeCommentString(val, 200))
    .refine((val) => val.length > 0, 'Search query cannot be empty after sanitization')
    .refine((val) => !detectAdvancedXSS(val), 'Search query contains potentially malicious content')
    .refine((val) => !detectAdvancedSQLInjection(val), 'Search query contains potentially malicious content'),
  
  platform: z.enum(['instagram', 'tiktok', 'facebook']).optional(),
  
  status: z.enum(['pending', 'approved', 'rejected', 'spam', 'deleted']).optional(),
  
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  
  date_from: z.string()
    .datetime('Invalid date format')
    .optional(),
  
  date_to: z.string()
    .datetime('Invalid date format')
    .optional(),
  
  sort: z.enum(['relevance', 'created_at', 'updated_at', 'sentiment_score'])
    .default('relevance'),
  
  order: z.enum(['asc', 'desc'])
    .default('desc'),
  
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform((val) => parseInt(val))
    .refine((val) => val >= 1 && val <= 50, 'Limit must be between 1 and 50')
    .default('20'),
  
  offset: z.string()
    .regex(/^\d+$/, 'Offset must be a number')
    .transform((val) => parseInt(val))
    .refine((val) => val >= 0, 'Offset must be non-negative')
    .default('0'),
  
  include_replies: z.string()
    .transform((val) => val === 'true')
    .default('false'),
  
  author_search: z.string()
    .max(100, 'Author search too long')
    .transform((val) => sanitizeCommentString(val, 100))
    .optional(),
  
  engagement_min: z.string()
    .regex(/^\d+$/, 'Engagement minimum must be a number')
    .transform((val) => parseInt(val))
    .optional(),
  
  content_length_min: z.string()
    .regex(/^\d+$/, 'Content length minimum must be a number')
    .transform((val) => parseInt(val))
    .optional(),
  
  content_length_max: z.string()
    .regex(/^\d+$/, 'Content length maximum must be a number')
    .transform((val) => parseInt(val))
    .optional()
})

/**
 * GET /api/comments/search - Full-text search with advanced filtering
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

    // Apply rate limiting (slightly stricter for search operations)
    const rateLimitCheck = await RateLimitMiddleware.getCommentsRateLimit()(request)
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/comments/search',
          method: 'GET',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded for search operations',
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
          endpoint: '/api/comments/search',
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
      validatedQuery = SearchQuerySchema.parse(queryParams)
    } catch (error) {
      await SecureLogger.logSecurityEvent({
        type: 'MALICIOUS_INPUT',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/comments/search',
          method: 'GET',
          error: error instanceof Error ? error.message : 'Validation failed',
          input: CommentsValidator.sanitizeForLogging(queryParams)
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid search parameters', details: error },
        { status: 400 }
      )
    }

    // Log search query for analytics and security monitoring
    await SecureLogger.log({
      level: 'INFO',
      category: 'SEARCH',
      message: 'Comment search performed',
      details: {
        query: validatedQuery.q,
        platform: validatedQuery.platform,
        status: validatedQuery.status,
        sentiment: validatedQuery.sentiment,
        userId: user.id
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Build base search query with RLS automatically applied
    let searchQuery = supabase
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

    // Apply full-text search
    if (validatedQuery.sort === 'relevance') {
      // Use PostgreSQL full-text search with ranking
      searchQuery = searchQuery.textSearch('content', validatedQuery.q, {
        type: 'websearch',
        config: 'english'
      })
    } else {
      // Use ilike for other sort orders (simpler but less efficient)
      searchQuery = searchQuery.ilike('content', `%${validatedQuery.q}%`)
    }

    // Apply filters
    if (validatedQuery.platform) {
      searchQuery = searchQuery.eq('platform', validatedQuery.platform)
    }

    if (validatedQuery.status) {
      searchQuery = searchQuery.eq('status', validatedQuery.status)
    }

    // Sentiment filtering
    if (validatedQuery.sentiment) {
      switch (validatedQuery.sentiment) {
        case 'positive':
          searchQuery = searchQuery.gt('sentiment_score', 0.1)
          break
        case 'negative':
          searchQuery = searchQuery.lt('sentiment_score', -0.1)
          break
        case 'neutral':
          searchQuery = searchQuery
            .gte('sentiment_score', -0.1)
            .lte('sentiment_score', 0.1)
          break
      }
    }

    // Date range filtering
    if (validatedQuery.date_from) {
      searchQuery = searchQuery.gte('created_at', validatedQuery.date_from)
    }

    if (validatedQuery.date_to) {
      searchQuery = searchQuery.lte('created_at', validatedQuery.date_to)
    }

    // Content length filtering
    if (validatedQuery.content_length_min || validatedQuery.content_length_max) {
      // This would require a computed column or custom function in PostgreSQL
      // For now, we'll filter client-side if needed
    }

    // Author search (if provided)
    if (validatedQuery.author_search) {
      searchQuery = searchQuery.ilike('author_username', `%${validatedQuery.author_search}%`)
    }

    // Engagement filtering (if provided)
    if (validatedQuery.engagement_min) {
      // This requires complex JSON querying - would need custom SQL
      // For now, we'll implement basic filtering
    }

    // Apply sorting and pagination
    if (validatedQuery.sort === 'relevance') {
      // PostgreSQL FTS ranking - would need custom implementation
      searchQuery = searchQuery.order('created_at', { ascending: validatedQuery.order === 'asc' })
    } else {
      searchQuery = searchQuery.order(validatedQuery.sort, { ascending: validatedQuery.order === 'asc' })
    }

    searchQuery = searchQuery.range(
      validatedQuery.offset, 
      validatedQuery.offset + validatedQuery.limit - 1
    )

    // Execute search
    const { data: searchResults, error: searchError, count } = await searchQuery

    if (searchError) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Comment search query failed',
        details: {
          error: searchError.message,
          query: CommentsValidator.sanitizeForLogging(validatedQuery),
          userId: user.id
        },
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json(
        { success: false, error: 'Search query failed' },
        { status: 500 }
      )
    }

    // Process results for response
    let processedResults = searchResults?.map(comment => ({
      ...comment,
      platform_user_id: comment.platform_user_id?.substring(0, 8) + '***',
      // Add search relevance score (would be calculated in a real implementation)
      _relevance_score: calculateRelevanceScore(comment.content, validatedQuery.q)
    })) || []

    // Client-side filtering for features not supported by database query
    if (validatedQuery.content_length_min) {
      processedResults = processedResults.filter(c => 
        c.content && c.content.length >= validatedQuery.content_length_min!
      )
    }

    if (validatedQuery.content_length_max) {
      processedResults = processedResults.filter(c => 
        c.content && c.content.length <= validatedQuery.content_length_max!
      )
    }

    if (validatedQuery.engagement_min) {
      processedResults = processedResults.filter(c => {
        const totalEngagement = Object.values(c.engagement_metrics || {})
          .reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0)
        return totalEngagement >= validatedQuery.engagement_min!
      })
    }

    // Calculate search analytics
    const searchAnalytics = calculateSearchAnalytics(processedResults, validatedQuery)

    // Include related replies if requested
    if (validatedQuery.include_replies && processedResults.length > 0) {
      const commentIds = processedResults.map(c => c.id)
      
      const { data: replies } = await supabase
        .from('comment_replies')
        .select('*')
        .in('comment_id', commentIds)
        .ilike('content', `%${validatedQuery.q}%`)

      // Attach matching replies to comments
      processedResults = processedResults.map(comment => ({
        ...comment,
        _matching_replies: replies?.filter(r => r.comment_id === comment.id) || []
      }))
    }

    // Log successful search
    await SecureLogger.logAPIRequest(
      '/api/comments/search',
      'GET',
      200,
      processedResults.length,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      query: {
        search_term: validatedQuery.q,
        filters: {
          platform: validatedQuery.platform,
          status: validatedQuery.status,
          sentiment: validatedQuery.sentiment,
          date_range: {
            from: validatedQuery.date_from,
            to: validatedQuery.date_to
          },
          author: validatedQuery.author_search,
          content_length: {
            min: validatedQuery.content_length_min,
            max: validatedQuery.content_length_max
          },
          engagement_min: validatedQuery.engagement_min
        },
        sort: validatedQuery.sort,
        order: validatedQuery.order
      },
      results: processedResults,
      analytics: searchAnalytics,
      pagination: {
        offset: validatedQuery.offset,
        limit: validatedQuery.limit,
        total: count || processedResults.length,
        hasMore: count ? validatedQuery.offset + validatedQuery.limit < count : false
      }
    })

  } catch (error) {
    console.error('Comment search API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Comment search API request failed',
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
 * POST /api/comments/search - Advanced search with complex criteria
 */
export async function POST(request: NextRequest) {
  try {
    // Apply security middleware with larger request size for complex searches
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 512 * 1024 // 512KB for complex search queries
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply stricter rate limiting for POST searches
    const rateLimitCheck = await RateLimitMiddleware.getCommentsWriteRateLimit()(request)
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded for advanced search',
          retryAfter: rateLimitCheck.retryAfter
        },
        { status: 429 }
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

    // Parse request body
    let searchCriteria
    try {
      searchCriteria = await request.json()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Advanced search would include:
    // - Boolean search operators (AND, OR, NOT)
    // - Phrase matching
    // - Wildcard searches
    // - Regular expression searches (with safety checks)
    // - Semantic similarity searches
    // - Custom scoring algorithms

    // For now, return a placeholder response
    await SecureLogger.log({
      level: 'INFO',
      category: 'SEARCH',
      message: 'Advanced comment search performed',
      details: {
        criteria: CommentsValidator.sanitizeForLogging(searchCriteria),
        userId: user.id
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Advanced search functionality coming soon',
      criteria: searchCriteria
    })

  } catch (error) {
    console.error('Advanced search API error:', error)
    
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
 * Calculate relevance score for search results
 */
function calculateRelevanceScore(content: string, searchTerm: string): number {
  if (!content || !searchTerm) return 0

  const contentLower = content.toLowerCase()
  const searchLower = searchTerm.toLowerCase()
  const searchTerms = searchLower.split(/\s+/)
  
  let score = 0
  
  // Exact phrase match
  if (contentLower.includes(searchLower)) {
    score += 10
  }
  
  // Individual term matches
  searchTerms.forEach(term => {
    if (contentLower.includes(term)) {
      score += 2
    }
  })
  
  // Position bonus (earlier matches score higher)
  const firstMatch = contentLower.indexOf(searchLower)
  if (firstMatch !== -1) {
    score += Math.max(0, 5 - (firstMatch / 100))
  }
  
  // Length penalty (very short or very long content scores lower)
  const lengthFactor = Math.min(1, Math.max(0.1, content.length / 200))
  score *= lengthFactor
  
  return Math.round(score * 100) / 100
}

/**
 * Calculate search analytics
 */
function calculateSearchAnalytics(results: any[], query: any) {
  if (!results.length) {
    return {
      total_results: 0,
      avg_relevance: 0,
      platform_distribution: {},
      sentiment_distribution: {},
      status_distribution: {}
    }
  }

  const platformDist = results.reduce((acc, r) => {
    acc[r.platform] = (acc[r.platform] || 0) + 1
    return acc
  }, {})

  const statusDist = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  const sentimentDist = results.reduce((acc, r) => {
    if (r.sentiment_score === null) {
      acc.unknown++
    } else if (r.sentiment_score > 0.1) {
      acc.positive++
    } else if (r.sentiment_score < -0.1) {
      acc.negative++
    } else {
      acc.neutral++
    }
    return acc
  }, { positive: 0, neutral: 0, negative: 0, unknown: 0 })

  const avgRelevance = results.reduce((sum, r) => sum + (r._relevance_score || 0), 0) / results.length

  return {
    total_results: results.length,
    avg_relevance: Math.round(avgRelevance * 100) / 100,
    platform_distribution: platformDist,
    sentiment_distribution: sentimentDist,
    status_distribution: statusDist
  }
}