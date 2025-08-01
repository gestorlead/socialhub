import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { SecureLogger } from '@/lib/secure-logger'
import { moderationConfigValidator } from '@/lib/moderation-config-validator'

/**
 * AI Moderation System Validation API
 * Phase 2.3 - Configuration validation and system health check
 * 
 * Endpoint: GET /api/admin/validate-moderation
 * 
 * Features:
 * - Complete configuration validation
 * - API connectivity testing
 * - Database schema verification
 * - Performance benchmarking
 * - Security compliance checking
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

/**
 * Check if user has super admin privileges
 */
async function checkSuperAdminPrivileges(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', userId)
      .single()

    // Only Super Admin (role_id = 3) can access validation
    return profile && profile.role_id === 3
  } catch (error) {
    console.error('Error checking super admin privileges:', error)
    return false
  }
}

/**
 * GET /api/admin/validate-moderation - Validate AI moderation system
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
          endpoint: '/api/admin/validate-moderation',
          method: 'GET',
          userId: user.id,
          reason: 'Insufficient privileges for moderation validation'
        },
        actionRequired: true
      }, request)
      
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges. Super admin access required.' },
        { status: 403 }
      )
    }

    // Run comprehensive validation
    const validationStart = Date.now()
    const validationResult = await moderationConfigValidator.validateConfiguration()
    const validationTime = Date.now() - validationStart

    // Generate configuration summary
    const configSummary = moderationConfigValidator.generateConfigSummary(validationResult)

    // Parse query parameters for detailed output
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json' // json or text
    const includeConfig = url.searchParams.get('includeConfig') === 'true'

    // Prepare response data
    const responseData = {
      validation: {
        valid: validationResult.valid,
        validationTime,
        timestamp: new Date().toISOString()
      },
      summary: {
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length,
        recommendations: validationResult.recommendations.length
      },
      issues: {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        recommendations: validationResult.recommendations
      },
      ...(includeConfig && { config: validationResult.config })
    }

    // Log validation request
    await SecureLogger.log({
      level: validationResult.valid ? 'INFO' : 'WARN',
      category: 'ADMIN',
      message: 'AI moderation system validation performed',
      details: {
        userId: user.id,
        valid: validationResult.valid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        validationTime,
        format,
        includeConfig
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Return appropriate format
    if (format === 'text') {
      return new NextResponse(configSummary, {
        status: validationResult.valid ? 200 : 422,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Validation-Status': validationResult.valid ? 'valid' : 'invalid',
          'X-Validation-Errors': validationResult.errors.length.toString(),
          'X-Validation-Warnings': validationResult.warnings.length.toString()
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      message: validationResult.valid 
        ? 'AI moderation system configuration is valid' 
        : 'AI moderation system configuration has issues'
    }, { 
      status: validationResult.valid ? 200 : 422,
      headers: {
        'X-Validation-Status': validationResult.valid ? 'valid' : 'invalid',
        'X-Validation-Errors': validationResult.errors.length.toString(),
        'X-Validation-Warnings': validationResult.warnings.length.toString(),
        'X-Validation-Time': validationTime.toString()
      }
    })

  } catch (error) {
    console.error('Moderation validation API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Moderation validation API request failed',
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
 * POST /api/admin/validate-moderation - Run specific validation tests
 */
export async function POST(request: NextRequest) {
  try {
    // Similar auth and security checks as GET
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: true
    })
    
    if (securityResult) {
      return securityResult
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

    // Parse request body for specific tests
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const tests = requestBody.tests || ['all']
    const testContent = requestBody.testContent || 'This is a test message for AI moderation.'

    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    }

    // Run OpenAI test if requested
    if (tests.includes('all') || tests.includes('openai')) {
      try {
        const { OpenAIModerationService } = await import('@/lib/openai-moderation')
        
        const startTime = Date.now()
        const moderationResult = await OpenAIModerationService.moderateContent({
          content: testContent,
          context: {
            platform: 'test',
            userId: user.id
          }
        })
        
        results.tests.openai = {
          success: true,
          responseTime: Date.now() - startTime,
          flagged: moderationResult.flagged,
          confidence: moderationResult.confidence,
          recommendation: moderationResult.recommendation
        }
      } catch (error) {
        results.tests.openai = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Run sentiment analysis test if requested
    if (tests.includes('all') || tests.includes('sentiment')) {
      try {
        const { SentimentAnalysisService } = await import('@/lib/sentiment-analysis')
        
        const startTime = Date.now()
        const sentimentResult = await SentimentAnalysisService.analyzeSentiment({
          content: testContent,
          context: {
            platform: 'test',
            userId: user.id
          }
        })
        
        results.tests.sentiment = {
          success: true,
          responseTime: Date.now() - startTime,
          score: sentimentResult.score,
          classification: sentimentResult.classification,
          confidence: sentimentResult.confidence
        }
      } catch (error) {
        results.tests.sentiment = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Run spam detection test if requested
    if (tests.includes('all') || tests.includes('spam')) {
      try {
        const { SpamDetectionService } = await import('@/lib/spam-detection')
        
        const startTime = Date.now()
        const spamResult = await SpamDetectionService.detectSpam({
          content: testContent,
          userId: user.id,
          platform: 'test'
        })
        
        results.tests.spam = {
          success: true,
          responseTime: Date.now() - startTime,
          isSpam: spamResult.isSpam,
          probability: spamResult.probability,
          confidence: spamResult.confidence,
          recommendation: spamResult.recommendation
        }
      } catch (error) {
        results.tests.spam = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Calculate overall test results
    const testNames = Object.keys(results.tests)
    const successfulTests = testNames.filter(name => results.tests[name].success).length
    const failedTests = testNames.length - successfulTests

    results.summary = {
      total: testNames.length,
      successful: successfulTests,
      failed: failedTests,
      allPassed: failedTests === 0
    }

    // Log test execution
    await SecureLogger.log({
      level: results.summary.allPassed ? 'INFO' : 'WARN',
      category: 'ADMIN',
      message: 'AI moderation system tests executed',
      details: {
        userId: user.id,
        tests: testNames,
        successful: successfulTests,
        failed: failedTests,
        testContent: testContent.substring(0, 100) + (testContent.length > 100 ? '...' : '')
      },
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: results,
      message: results.summary.allPassed 
        ? 'All AI moderation tests passed' 
        : `${failedTests} out of ${testNames.length} tests failed`
    }, { 
      status: results.summary.allPassed ? 200 : 422,
      headers: {
        'X-Tests-Total': testNames.length.toString(),
        'X-Tests-Successful': successfulTests.toString(),
        'X-Tests-Failed': failedTests.toString()
      }
    })

  } catch (error) {
    console.error('Moderation test API error:', error)
    
    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Moderation test API request failed',
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