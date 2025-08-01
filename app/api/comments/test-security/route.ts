import { NextRequest, NextResponse } from 'next/server'
import { SecurityMiddleware } from '@/lib/security-middleware'
import { RateLimitMiddleware } from '@/lib/rate-limiter'
import { CommentsValidator, detectAdvancedXSS, detectAdvancedSQLInjection } from '@/lib/comments-validation'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { SecureLogger } from '@/lib/secure-logger'

/**
 * GET /api/comments/test-security - Test security integration
 * This endpoint validates that all security components are properly integrated
 */
export async function GET(request: NextRequest) {
  try {
    // Test 1: Security Middleware Integration
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: false, // Disable rate limiting for test
      enableRequestSanitization: true,
      enableAuditLogging: true
    })
    
    if (securityResult) {
      return securityResult
    }

    // Test 2: Input Validation
    const testInputs = [
      { input: '<script>alert("xss")</script>', expected: 'XSS_DETECTED' },
      { input: "'; DROP TABLE users; --", expected: 'SQL_INJECTION_DETECTED' },
      { input: 'Normal comment content', expected: 'CLEAN' }
    ]

    const validationResults = testInputs.map(test => ({
      input: test.input,
      expected: test.expected,
      xss_detected: detectAdvancedXSS(test.input),
      sql_detected: detectAdvancedSQLInjection(test.input),
      status: (
        (test.expected === 'XSS_DETECTED' && detectAdvancedXSS(test.input)) ||
        (test.expected === 'SQL_INJECTION_DETECTED' && detectAdvancedSQLInjection(test.input)) ||
        (test.expected === 'CLEAN' && !detectAdvancedXSS(test.input) && !detectAdvancedSQLInjection(test.input))
      ) ? 'PASS' : 'FAIL'
    }))

    // Test 3: Encryption/Decryption
    let cryptoTest = { status: 'FAIL', error: '' }
    try {
      const testData = 'sensitive_user_token_12345'
      const userId = 'test-user-id'
      const platform = 'instagram'
      
      const encrypted = CommentsCrypto.encryptToken(testData, userId, platform)
      const decrypted = CommentsCrypto.decryptToken(encrypted, userId, platform)
      
      cryptoTest = {
        status: testData === decrypted ? 'PASS' : 'FAIL',
        error: testData === decrypted ? '' : 'Decrypted data does not match original'
      }
    } catch (error) {
      cryptoTest = {
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown crypto error'
      }
    }

    // Test 4: Secure Logging
    let loggingTest = { status: 'PASS', error: '' }
    try {
      await SecureLogger.log({
        level: 'INFO',
        category: 'API',
        message: 'Security integration test',
        details: {
          test: 'security_integration',
          timestamp: new Date().toISOString()
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'test-ip'
      })
    } catch (error) {
      loggingTest = {
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown logging error'
      }
    }

    // Test 5: Comments Validator
    let validatorTest = { status: 'FAIL', error: '' }
    try {
      const testComment = {
        platform: 'instagram',
        platform_comment_id: 'test_comment_123',
        platform_post_id: 'test_post_456',
        platform_user_id: 'test_user_789',
        content: 'This is a test comment for validation',
        author_username: 'testuser'
      }

      const validated = await CommentsValidator.validateComment(testComment)
      validatorTest = {
        status: validated.content ? 'PASS' : 'FAIL',
        error: validated.content ? '' : 'Content validation failed'
      }
    } catch (error) {
      validatorTest = {
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown validation error'
      }
    }

    // Compile test results
    const testResults = {
      security_middleware: { status: 'PASS', message: 'Security middleware executed successfully' },
      input_validation: {
        status: validationResults.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL',
        details: validationResults
      },
      encryption: cryptoTest,
      logging: loggingTest,
      validation: validatorTest
    }

    const overallStatus = Object.values(testResults).every(test => test.status === 'PASS') ? 'PASS' : 'FAIL'

    // Log test completion
    await SecureLogger.logAPIRequest(
      '/api/comments/test-security',
      'GET',
      200,
      1,
      undefined,
      request
    )

    return NextResponse.json({
      success: true,
      test_status: overallStatus,
      message: `Security integration test ${overallStatus === 'PASS' ? 'passed' : 'failed'}`,
      results: testResults,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Security test error:', error)

    await SecureLogger.log({
      level: 'ERROR',
      category: 'API',
      message: 'Security integration test failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json(
      { 
        success: false,
        test_status: 'FAIL', 
        error: 'Security integration test failed',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}