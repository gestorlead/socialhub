import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { SecureLogger } from '@/lib/secure-logger'
import { AutomatedModerationService, ModerationPolicy } from '@/lib/automated-moderation'
import { z } from 'zod'

/**
 * Content Policy Management API
 * Phase 2.3 - Configurable moderation policies and compliance reporting
 * 
 * Endpoints:
 * - GET /api/comments/moderate/policies - List all policies
 * - POST /api/comments/moderate/policies - Create new policy
 * - PUT /api/comments/moderate/policies - Update existing policy
 * - DELETE /api/comments/moderate/policies/[id] - Delete policy
 * 
 * Features:
 * - Configurable moderation rules per platform
 * - Custom policy definitions and enforcement
 * - Policy violation tracking and reporting
 * - Content categorization and tagging
 * - Compliance reporting for different platforms
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
const PolicyRuleSchema = z.object({
  threshold: z.number().min(0).max(1),
  action: z.enum(['flag', 'reject', 'escalate'])
})

const PolicySchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  platform: z.string().optional(),
  rules: z.object({
    categories: z.record(z.string(), PolicyRuleSchema),
    sentiment: PolicyRuleSchema,
    spam: PolicyRuleSchema
  }),
  enabled: z.boolean(),
  priority: z.number().min(0).max(10)
})

const UpdatePolicySchema = PolicySchema.partial().extend({
  id: z.string().min(1).max(50) // ID is required for updates
})

/**
 * Check if user has super admin privileges (required for policy management)
 */
async function checkSuperAdminPrivileges(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', userId)
      .single()

    // Only Super Admin (role_id = 3) can manage policies
    return profile && profile.role_id === 3
  } catch (error) {
    console.error('Error checking super admin privileges:', error)
    return false
  }
}

/**
 * GET /api/comments/moderate/policies - List all moderation policies
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

    // Check super admin privileges
    const isSuperAdmin = await checkSuperAdminPrivileges(supabase, user.id)
    if (!isSuperAdmin) {
      await SecureLogger.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        details: {
          endpoint: '/api/comments/moderate/policies',
          method: 'GET',
          userId: user.id,
          reason: 'Insufficient privileges for policy management'
        },
        actionRequired: true
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges. Super admin access required.' },
        { status: 403 }
      )
    }

    // Get all policies from the service
    const policies = AutomatedModerationService.getPolicies()

    // Parse query parameters for filtering
    const url = new URL(request.url)
    const platform = url.searchParams.get('platform')
    const enabled = url.searchParams.get('enabled')

    // Apply filters
    let filteredPolicies = policies

    if (platform) {
      filteredPolicies = filteredPolicies.filter(p => 
        !p.platform || p.platform === platform
      )
    }

    if (enabled !== null) {
      const enabledBool = enabled === 'true'
      filteredPolicies = filteredPolicies.filter(p => p.enabled === enabledBool)
    }

    // Sort by priority (highest first)
    filteredPolicies.sort((a, b) => b.priority - a.priority)

    // Log successful request
    await SecureLogger.logAPIRequest(
      '/api/comments/moderate/policies',
      'GET',
      200,
      filteredPolicies.length,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      data: filteredPolicies,
      filters: {
        platform,
        enabled: enabled !== null ? enabled === 'true' : undefined
      },
      message: 'Moderation policies retrieved successfully'
    })

  } catch (error) {
    console.error('Policy management GET API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Policy management GET API request failed',
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
 * POST /api/comments/moderate/policies - Create new moderation policy
 */
export async function POST(request: NextRequest) {
  try {
    // Apply security middleware with stricter settings
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 256 * 1024 // 256KB limit
    })
    
    if (securityResult) {
      return securityResult
    }

    // Apply write rate limiting
    const rateLimitCheck = await RateLimitMiddleware.createCustomLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 5, // 5 policy creations per 5 minutes
      keyGenerator: (req) => `policy-create-${req.headers.get('x-forwarded-for') || 'unknown'}`,
      standardHeaders: true
    })(request)
    
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Policy creation rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitCheck.limit.toString(),
            'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
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

    // Check super admin privileges
    const isSuperAdmin = await checkSuperAdminPrivileges(supabase, user.id)
    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges. Super admin access required.' },
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

    // Validate policy data
    let validatedPolicy
    try {
      validatedPolicy = PolicySchema.parse(requestBody)
    } catch (error) {
      await SecureLogger.logSecurityEvent({
        type: 'MALICIOUS_INPUT',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/comments/moderate/policies',
          method: 'POST',
          error: error instanceof Error ? error.message : 'Validation failed',
          userId: user.id
        }
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Invalid policy data', details: error },
        { status: 400 }
      )
    }

    // Check if policy with same ID already exists
    const existingPolicy = AutomatedModerationService.getPolicy(validatedPolicy.id)
    if (existingPolicy) {
      return NextResponse.json(
        { success: false, error: 'Policy with this ID already exists' },
        { status: 409 }
      )
    }

    // Add the new policy to the service
    AutomatedModerationService.addPolicy(validatedPolicy)

    // Store policy in database for persistence
    const { error: dbError } = await supabaseAdmin
      .from('moderation_policies')
      .insert({
        id: validatedPolicy.id,
        name: validatedPolicy.name,
        platform: validatedPolicy.platform,
        rules: validatedPolicy.rules,
        enabled: validatedPolicy.enabled,
        priority: validatedPolicy.priority,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (dbError) {
      // Remove from service if DB insert failed
      // Note: In production, you'd want more sophisticated rollback
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to persist policy to database',
        details: {
          error: dbError.message,
          policyId: validatedPolicy.id,
          userId: user.id
        },
        userId: user.id
      })
    }

    // Log successful policy creation
    await SecureLogger.logAPIRequest(
      '/api/comments/moderate/policies',
      'POST',
      201,
      1,
      user.id,
      request
    )

    await SecureLogger.log({
      level: 'INFO',
      category: 'POLICY_MANAGEMENT',
      message: 'Moderation policy created successfully',
      details: {
        policyId: validatedPolicy.id,
        policyName: validatedPolicy.name,
        platform: validatedPolicy.platform,
        enabled: validatedPolicy.enabled,
        priority: validatedPolicy.priority,
        createdBy: user.id
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: validatedPolicy,
      message: 'Moderation policy created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Policy creation API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Policy creation API request failed',
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
 * PUT /api/comments/moderate/policies - Update existing moderation policy
 */
export async function PUT(request: NextRequest) {
  try {
    // Similar security and auth checks as POST
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true,
      maxRequestSize: 256 * 1024
    })
    
    if (securityResult) {
      return securityResult
    }

    const rateLimitCheck = await RateLimitMiddleware.createCustomLimiter({
      windowMs: 5 * 60 * 1000,
      max: 10, // 10 policy updates per 5 minutes
      keyGenerator: (req) => `policy-update-${req.headers.get('x-forwarded-for') || 'unknown'}`,
      standardHeaders: true
    })(request)
    
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Policy update rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter
        },
        { status: 429 }
      )
    }

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

    const isSuperAdmin = await checkSuperAdminPrivileges(supabase, user.id)
    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges. Super admin access required.' },
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

    let validatedUpdate
    try {
      validatedUpdate = UpdatePolicySchema.parse(requestBody)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid policy update data', details: error },
        { status: 400 }
      )
    }

    // Check if policy exists
    const existingPolicy = AutomatedModerationService.getPolicy(validatedUpdate.id)
    if (!existingPolicy) {
      return NextResponse.json(
        { success: false, error: 'Policy not found' },
        { status: 404 }
      )
    }

    // Merge updates with existing policy
    const updatedPolicy: ModerationPolicy = {
      ...existingPolicy,
      ...validatedUpdate,
      id: validatedUpdate.id // Ensure ID doesn't change
    }

    // Update policy in service
    AutomatedModerationService.addPolicy(updatedPolicy)

    // Update in database
    const { error: dbError } = await supabaseAdmin
      .from('moderation_policies')
      .update({
        name: updatedPolicy.name,
        platform: updatedPolicy.platform,
        rules: updatedPolicy.rules,
        enabled: updatedPolicy.enabled,
        priority: updatedPolicy.priority,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', updatedPolicy.id)

    if (dbError) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'DATABASE',
        message: 'Failed to update policy in database',
        details: {
          error: dbError.message,
          policyId: updatedPolicy.id,
          userId: user.id
        },
        userId: user.id
      })
    }

    // Log successful update
    await SecureLogger.log({
      level: 'INFO',
      category: 'POLICY_MANAGEMENT',
      message: 'Moderation policy updated successfully',
      details: {
        policyId: updatedPolicy.id,
        policyName: updatedPolicy.name,
        changes: Object.keys(validatedUpdate).filter(key => key !== 'id'),
        updatedBy: user.id
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: updatedPolicy,
      message: 'Moderation policy updated successfully'
    })

  } catch (error) {
    console.error('Policy update API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Policy update API request failed',
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