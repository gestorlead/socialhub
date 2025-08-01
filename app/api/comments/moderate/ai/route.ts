import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { SecureLogger } from '@/lib/secure-logger'
import { AutomatedModerationService, AutoModerationRequest, BulkModerationRequest } from '@/lib/automated-moderation'
import { OpenAIModerationService, ModerationRequest } from '@/lib/openai-moderation'
import { SentimentAnalysisService, SentimentRequest } from '@/lib/sentiment-analysis'
import { SpamDetectionService, SpamDetectionRequest } from '@/lib/spam-detection'
import { z } from 'zod'

/**
 * AI-Powered Content Moderation API
 * Phase 2.3 - Advanced moderation with OpenAI, sentiment analysis, and spam detection
 * 
 * Endpoints:
 * - POST /api/comments/moderate/ai - Single comment AI moderation
 * - POST /api/comments/moderate/ai/batch - Batch AI moderation
 * - POST /api/comments/moderate/ai/analyze - Analysis only (no DB updates)
 * - GET /api/comments/moderate/ai/policies - Get moderation policies
 * 
 * Features:
 * - OpenAI Moderation API integration
 * - Intelligent sentiment analysis
 * - Advanced spam detection
 * - Automated decision making
 * - Human-in-the-loop workflows
 * - Comprehensive audit logging
 */

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

// Admin Supabase client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schemas
const SingleModerationSchema = z.object({
  commentId: z.string().uuid(),
  options: z.object({
    applyPolicies: z.array(z.string()).optional(),
    requireHumanReview: z.boolean().optional(),
    skipCache: z.boolean().optional()
  }).optional()
})

const BatchModerationSchema = z.object({
  commentIds: z.array(z.string().uuid()).min(1).max(50),
  options: z.object({
    parallelProcessing: z.boolean().optional(),
    maxConcurrency: z.number().min(1).max(10).optional(),
    continueOnError: z.boolean().optional(),
    applyPolicies: z.array(z.string()).optional()
  }).optional()
})

const AnalysisOnlySchema = z.object({
  content: z.string().min(1).max(10000),
  platform: z.string().min(1),
  language: z.string().optional(),
  options: z.object({
    includeOpenAI: z.boolean().optional(),
    includeSentiment: z.boolean().optional(),
    includeSpam: z.boolean().optional(),
    includeEmotions: z.boolean().optional()
  }).optional()
})

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
 * POST /api/comments/moderate/ai - Single comment AI moderation
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const endpoint = url.pathname.split('/').pop()
  
  // Route to specific handler based on endpoint
  if (endpoint === 'batch') {
    return handleBatchModeration(request)
  } else if (endpoint === 'analyze') {
    return handleAnalysisOnly(request)
  } else {
    return handleSingleModeration(request)
  }
}

/**
 * GET /api/comments/moderate/ai/policies - Get moderation policies
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

    // Get moderation policies
    const policies = AutomatedModerationService.getPolicies()

    await SecureLogger.logAPIRequest(
      '/api/comments/moderate/ai/policies',
      'GET',
      200,
      policies.length,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      data: policies,
      message: 'Moderation policies retrieved successfully'
    })

  } catch (error) {
    console.error('AI moderation policies API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'AI moderation policies API request failed',
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
 * Handle single comment AI moderation
 */
async function handleSingleModeration(request: NextRequest) {
  try {
    // Apply security middleware with strict settings
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 512 * 1024 // 512KB limit
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply AI moderation rate limiting
    const rateLimitCheck = await RateLimitMiddleware.createCustomLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 AI moderation requests per minute
      keyGenerator: (req) => `ai-mod-${req.headers.get('x-forwarded-for') || 'unknown'}`,
      standardHeaders: true
    })(request)
    
    if (!rateLimitCheck.success) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        details: {
          endpoint: '/api/comments/moderate/ai',
          method: 'POST',
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining
        }
      }, request)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'AI moderation rate limit exceeded',
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
          endpoint: '/api/comments/moderate/ai',
          method: 'POST',
          error: authError?.message || 'Invalid token'
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Check admin privileges
    const isAdmin = await checkAdminPrivileges(supabase, user.id)
    if (!isAdmin) {
      await SecureLogger.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        details: {
          endpoint: '/api/comments/moderate/ai',
          method: 'POST',
          userId: user.id,
          reason: 'Insufficient privileges for AI moderation'
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

    // Validate request data
    let validatedData
    try {
      validatedData = SingleModerationSchema.parse(requestBody)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }

    // Fetch comment data
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select(`
        *,
        social_posts (
          platform,
          platform_post_id,
          title,
          url
        )
      `)
      .eq('id', validatedData.commentId)
      .single()

    if (fetchError || !comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      )
    }

    // Prepare AI moderation request
    const autoModerationRequest: AutoModerationRequest = {
      commentId: validatedData.commentId,
      content: comment.content,
      userId: comment.user_id,
      platform: comment.platform,
      context: {
        parentCommentId: comment.parent_comment_id,
        postId: comment.post_id
      },
      options: validatedData.options
    }

    // Execute AI moderation
    const moderationResult = await AutomatedModerationService.moderateComment(autoModerationRequest)

    // Log successful AI moderation
    await SecureLogger.logAPIRequest(
      '/api/comments/moderate/ai',
      'POST',
      200,
      1,
      user.id,
      request
    )

    await SecureLogger.log({
      level: 'INFO',
      category: 'AI_MODERATION',
      message: 'AI moderation completed successfully',
      details: {
        commentId: validatedData.commentId,
        action: moderationResult.decision.action,
        confidence: moderationResult.decision.confidence,
        automated: moderationResult.decision.automated,
        applied: moderationResult.applied,
        requiresHumanReview: moderationResult.decision.requiresHumanReview,
        processingTime: moderationResult.processingTime,
        moderatorId: user.id
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: moderationResult,
      message: `AI moderation completed: ${moderationResult.decision.action}`
    })

  } catch (error) {
    console.error('AI moderation API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'AI moderation API request failed',
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
 * Handle batch AI moderation
 */
async function handleBatchModeration(request: NextRequest) {
  try {
    // Similar security and auth checks as single moderation
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 2 * 1024 * 1024 // 2MB limit for batch
    })
    
    if (securityResult) {
      return securityResult
    }

    // Stricter rate limiting for batch operations
    const rateLimitCheck = await RateLimitMiddleware.createCustomLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 batch requests per 5 minutes
      keyGenerator: (req) => `ai-batch-${req.headers.get('x-forwarded-for') || 'unknown'}`,
      standardHeaders: true
    })(request)
    
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Batch AI moderation rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter
        },
        { status: 429 }
      )
    }

    // Auth and privilege checks (same as single)
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createAuthenticatedClient(token)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    const isAdmin = await checkAdminPrivileges(supabase, user.id)
    if (!isAdmin) {
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

    let validatedData
    try {
      validatedData = BatchModerationSchema.parse(requestBody)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }

    // Prepare bulk moderation request
    const bulkModerationRequest: BulkModerationRequest = {
      commentIds: validatedData.commentIds,
      userId: user.id,
      options: validatedData.options
    }

    // Execute bulk AI moderation
    const batchResult = await AutomatedModerationService.moderateCommentsBulk(bulkModerationRequest)

    // Log successful batch moderation
    await SecureLogger.logAPIRequest(
      '/api/comments/moderate/ai/batch',
      'POST',
      200,
      batchResult.summary.processed,
      user.id,
      request
    )

    await SecureLogger.log({
      level: 'INFO',
      category: 'AI_MODERATION',
      message: 'Batch AI moderation completed successfully',
      details: {
        ...batchResult.summary,
        moderatorId: user.id,
        automationRate: batchResult.summary.processed > 0 ? 
          ((batchResult.summary.approved + batchResult.summary.flagged + batchResult.summary.rejected) / batchResult.summary.processed) * 100 : 0
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: batchResult,
      message: `Batch AI moderation completed: ${batchResult.summary.processed}/${batchResult.summary.total} processed`
    })

  } catch (error) {
    console.error('Batch AI moderation API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Batch AI moderation API request failed',
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
 * Handle analysis-only requests (no DB updates)
 */
async function handleAnalysisOnly(request: NextRequest) {
  try {
    // Apply security middleware
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 256 * 1024 // 256KB limit
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply analysis rate limiting
    const rateLimitCheck = await RateLimitMiddleware.createCustomLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 analysis requests per minute
      keyGenerator: (req) => `ai-analyze-${req.headers.get('x-forwarded-for') || 'unknown'}`,
      standardHeaders: true
    })(request)
    
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Analysis rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter
        },
        { status: 429 }
      )
    }

    // Auth checks (same as others)
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createAuthenticatedClient(token)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    const isAdmin = await checkAdminPrivileges(supabase, user.id)
    if (!isAdmin) {
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

    let validatedData
    try {
      validatedData = AnalysisOnlySchema.parse(requestBody)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }

    const results: any = {}

    // Run requested analyses in parallel
    const analysisPromises: Promise<any>[] = []

    if (validatedData.options?.includeOpenAI !== false) {
      const moderationRequest: ModerationRequest = {
        content: validatedData.content,
        language: validatedData.language,
        context: {
          platform: validatedData.platform,
          userId: user.id
        },
        options: {
          enableSentimentAnalysis: false, // We'll do this separately
          enableSpamDetection: false
        }
      }
      
      analysisPromises.push(
        OpenAIModerationService.moderateContent(moderationRequest)
          .then(result => ({ openai: result }))
          .catch(error => ({ openai: { error: error.message } }))
      )
    }

    if (validatedData.options?.includeSentiment !== false) {
      const sentimentRequest: SentimentRequest = {
        content: validatedData.content,
        language: validatedData.language,
        context: {
          platform: validatedData.platform,
          userId: user.id
        },
        options: {
          includeEmotions: validatedData.options?.includeEmotions !== false,
          includeKeywords: true,
          includeConfidenceBreakdown: true
        }
      }
      
      analysisPromises.push(
        SentimentAnalysisService.analyzeSentiment(sentimentRequest)
          .then(result => ({ sentiment: result }))
          .catch(error => ({ sentiment: { error: error.message } }))
      )
    }

    if (validatedData.options?.includeSpam !== false) {
      const spamRequest: SpamDetectionRequest = {
        content: validatedData.content,
        userId: user.id,
        platform: validatedData.platform,
        context: {
          timestamp: new Date(),
          userAgent: request.headers.get('user-agent') || undefined,
          ipAddress: request.headers.get('x-forwarded-for') || undefined
        }
      }
      
      analysisPromises.push(
        SpamDetectionService.detectSpam(spamRequest)
          .then(result => ({ spam: result }))
          .catch(error => ({ spam: { error: error.message } }))
      )
    }

    // Wait for all analyses to complete
    const analysisResults = await Promise.all(analysisPromises)
    
    // Merge results
    for (const result of analysisResults) {
      Object.assign(results, result)
    }

    // Log successful analysis
    await SecureLogger.logAPIRequest(
      '/api/comments/moderate/ai/analyze',
      'POST',
      200,
      1,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Content analysis completed successfully'
    })

  } catch (error) {
    console.error('AI analysis API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'AI analysis API request failed',
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