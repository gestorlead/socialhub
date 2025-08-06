import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TestResult {
  passed: boolean
  message: string
  details?: unknown
}

interface TestResults {
  credentials: TestResult
  oauth_endpoints: TestResult
  api_access: TestResult
  quota_check: TestResult
}

// Verify Super Admin access
async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No authorization token provided', status: 401 }
  }

  const token = authHeader.substring(7)
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return { error: 'Invalid token', status: 401 }
    }

    // Check if user is Super Admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        roles!inner (
          level
        )
      `)
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { error: 'User profile not found', status: 404 }
    }

    const userRole = profile.roles.level
    if (userRole < 3) {
      return { error: 'Super Admin access required', status: 403 }
    }

    return { user, profile }
  } catch {
    return { error: 'Authentication failed', status: 500 }
  }
}

// POST /api/admin/integrations/youtube/test - Test YouTube integration
export async function POST(request: NextRequest) {
  console.log('[YouTube Integration Test] Test request received')

  try {
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // Get current settings
    const { data: settings, error: dbError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'youtube')
      .single()

    let clientId: string | undefined
    let clientSecret: string | undefined
    let projectId: string | undefined
    let callbackUrl: string | undefined
    let configSource = 'environment'

    if (settings && !dbError) {
      try {
        configSource = 'database'
        clientId = settings.client_key ? decrypt(settings.client_key) : undefined
        clientSecret = settings.client_secret ? decrypt(settings.client_secret) : undefined
        projectId = settings.app_id ? decrypt(settings.app_id) : settings.config_data?.project_id
        callbackUrl = settings.callback_url ? decrypt(settings.callback_url) : undefined
      } catch (decryptError) {
        console.error('[YouTube Integration Test] Decryption failed:', decryptError)
        configSource = 'environment'
      }
    }

    // Fallback to environment variables
    if (!clientId || !clientSecret || !projectId) {
      clientId = clientId || process.env.YOUTUBE_CLIENT_ID
      clientSecret = clientSecret || process.env.YOUTUBE_CLIENT_SECRET
      projectId = projectId || process.env.YOUTUBE_PROJECT_ID
      callbackUrl = callbackUrl || process.env.YOUTUBE_CALLBACK_URL || 
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/auth/youtube/callback`
    }

    const tests: TestResults = {
      credentials: { passed: false, message: '' },
      oauth_endpoints: { passed: false, message: '' },
      api_access: { passed: false, message: '' },
      quota_check: { passed: false, message: '' }
    }

    // Test 1: Credentials validation
    console.log('[YouTube Integration Test] Testing credentials...')
    if (!clientId || !clientSecret || !projectId) {
      tests.credentials = {
        passed: false,
        message: 'Missing required credentials (Client ID, Client Secret, or Project ID)',
        details: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          hasProjectId: !!projectId,
          hasCallbackUrl: !!callbackUrl
        }
      }
    } else {
      tests.credentials = {
        passed: true,
        message: 'All required credentials are present',
        details: {
          clientIdLength: clientId.length,
          clientSecretLength: clientSecret.length,
          projectId: projectId,
          callbackUrl: callbackUrl
        }
      }
    }

    // Test 2: OAuth endpoints accessibility
    console.log('[YouTube Integration Test] Testing OAuth endpoints...')
    try {
      const authUri = 'https://accounts.google.com/o/oauth2/auth'
      const tokenUri = 'https://oauth2.googleapis.com/token'
      
      // Test auth endpoint
      const authResponse = await fetch(authUri, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      
      // Test token endpoint connectivity (expect 400 for invalid request, not 404)
      const tokenResponse = await fetch(tokenUri, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '', // Empty body to test endpoint accessibility
        signal: AbortSignal.timeout(5000)
      })

      // 400 is expected for invalid request, 404 means endpoint doesn't exist
      const tokenAccessible = tokenResponse.status !== 404
      
      if (authResponse.ok && tokenAccessible) {
        tests.oauth_endpoints = {
          passed: true,
          message: 'OAuth endpoints are accessible',
          details: {
            authUri: authUri,
            tokenUri: tokenUri,
            authStatus: authResponse.status,
            tokenStatus: tokenResponse.status
          }
        }
      } else {
        tests.oauth_endpoints = {
          passed: false,
          message: 'OAuth endpoints not accessible',
          details: {
            authStatus: authResponse.status,
            tokenStatus: tokenResponse.status,
            tokenAccessible: tokenAccessible
          }
        }
      }
    } catch (error) {
      tests.oauth_endpoints = {
        passed: false,
        message: 'Failed to connect to OAuth endpoints',
        details: { error: error.message }
      }
    }

    // Test 3: YouTube API access (basic check)
    console.log('[YouTube Integration Test] Testing YouTube API access...')
    try {
      if (clientId && clientSecret) {
        // Test YouTube API discovery document
        const discoveryResponse = await fetch(
          'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest',
          { signal: AbortSignal.timeout(5000) }
        )

        if (discoveryResponse.ok) {
          const discoveryData = await discoveryResponse.json()
          tests.api_access = {
            passed: true,
            message: 'YouTube Data API v3 is accessible',
            details: {
              apiVersion: discoveryData.version,
              title: discoveryData.title,
              baseUrl: discoveryData.baseUrl
            }
          }
        } else {
          tests.api_access = {
            passed: false,
            message: 'YouTube Data API v3 is not accessible',
            details: { status: discoveryResponse.status }
          }
        }
      } else {
        tests.api_access = {
          passed: false,
          message: 'Cannot test API access without valid credentials'
        }
      }
    } catch (error) {
      tests.api_access = {
        passed: false,
        message: 'Failed to connect to YouTube API',
        details: { error: error.message }
      }
    }

    // Test 4: Quota check (basic validation)
    console.log('[YouTube Integration Test] Testing quota configuration...')
    try {
      // This is a basic check since we can't test actual quota without making authenticated requests
      if (tests.api_access.passed) {
        tests.quota_check = {
          passed: true,
          message: 'Quota system appears to be configured (API is accessible)',
          details: {
            note: 'Actual quota limits can only be verified with authenticated requests',
            defaultQuotaPerDay: 10000,
            recommendedUsage: 'Monitor usage in Google Cloud Console'
          }
        }
      } else {
        tests.quota_check = {
          passed: false,
          message: 'Cannot verify quota configuration - API not accessible'
        }
      }
    } catch (error) {
      tests.quota_check = {
        passed: false,
        message: 'Failed to check quota configuration',
        details: { error: error.message }
      }
    }

    // Calculate summary
    const passedTests = Object.values(tests).filter(test => test.passed).length
    const totalTests = Object.keys(tests).length
    const allPassed = passedTests === totalTests

    const summary = {
      passed_tests: passedTests,
      total_tests: totalTests,
      success_rate: Math.round((passedTests / totalTests) * 100),
      project_id: projectId || 'Not configured',
      config_source: configSource,
      callback_url: callbackUrl,
      timestamp: new Date().toISOString()
    }

    console.log('[YouTube Integration Test] Test completed:', {
      success: allPassed,
      passedTests,
      totalTests
    })

    return NextResponse.json({
      success: allPassed,
      tests,
      summary,
      message: allPassed 
        ? 'All YouTube integration tests passed successfully' 
        : `${passedTests}/${totalTests} tests passed. Please review failed tests.`
    })

  } catch (error) {
    console.error('[YouTube Integration Test] Test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to run YouTube integration tests',
        details: error.message 
      },
      { status: 500 }
    )
  }
}