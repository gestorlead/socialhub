import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    if (profileError || !profile || profile.roles.level < 3) {
      return { error: 'Super Admin access required', status: 403 }
    }

    return { user, profile }
  } catch (error) {
    console.error('Auth verification error:', error)
    return { error: 'Authentication failed', status: 500 }
  }
}

// Get TikTok configuration
async function getTikTokConfig() {
  // Try to get from database first
  const { data: dbSettings, error: dbError } = await supabase
    .from('integration_settings')
    .select('*')
    .eq('platform', 'tiktok')
    .single()

  if (!dbError && dbSettings) {
    return {
      app_id: decrypt(dbSettings.app_id),
      client_key: decrypt(dbSettings.client_key),
      client_secret: decrypt(dbSettings.client_secret),
      environment: dbSettings.environment,
      is_audited: dbSettings.is_audited,
      source: 'database'
    }
  }

  // Fallback to environment variables
  return {
    app_id: process.env.TIKTOK_APP_ID,
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    environment: process.env.NODE_ENV === 'production' && process.env.TIKTOK_APP_AUDITED === 'true' ? 'production' : 'sandbox',
    is_audited: process.env.TIKTOK_APP_AUDITED === 'true',
    source: 'env_fallback'
  }
}

// POST - Test TikTok integration connectivity
export async function POST(request: NextRequest) {
  console.log('[TikTok Integration Test] Starting connectivity test')
  
  const authResult = await verifySuperAdmin(request)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const config = await getTikTokConfig()
    
    if (!config.client_key || !config.client_secret) {
      return NextResponse.json({
        success: false,
        error: 'TikTok credentials not configured',
        tests: {
          credentials: { passed: false, message: 'Missing client key or secret' }
        }
      }, { status: 400 })
    }

    const testResults = {
      credentials: { passed: false, message: '', details: null as any },
      oauth_endpoints: { passed: false, message: '', details: null as any },
      api_access: { passed: false, message: '', details: null as any }
    }

    // Test 1: Validate credentials format
    console.log('[TikTok Test] Testing credential format...')
    try {
      if (config.client_key && config.client_secret && config.app_id) {
        testResults.credentials = {
          passed: true,
          message: 'Credentials format is valid',
          details: {
            app_id_length: config.app_id.length,
            client_key_length: config.client_key.length,
            client_secret_length: config.client_secret.length,
            environment: config.environment,
            is_audited: config.is_audited,
            source: config.source
          }
        }
      } else {
        testResults.credentials = {
          passed: false,
          message: 'Missing required credentials',
          details: null
        }
      }
    } catch (error) {
      testResults.credentials = {
        passed: false,
        message: 'Error validating credentials',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    // Test 2: Test OAuth endpoints accessibility
    console.log('[TikTok Test] Testing OAuth endpoints...')
    try {
      const authUrl = 'https://www.tiktok.com/v2/auth/authorize/'
      const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/'
      
      // Test auth endpoint (just check if it's reachable)
      const authResponse = await fetch(authUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      const authReachable = authResponse.status !== 0
      
      // Test token endpoint
      const tokenResponse = await fetch(tokenUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      })
      
      const tokenReachable = tokenResponse.status !== 0
      
      if (authReachable && tokenReachable) {
        testResults.oauth_endpoints = {
          passed: true,
          message: 'OAuth endpoints are accessible',
          details: {
            auth_endpoint: { url: authUrl, accessible: authReachable },
            token_endpoint: { url: tokenUrl, accessible: tokenReachable }
          }
        }
      } else {
        testResults.oauth_endpoints = {
          passed: false,
          message: 'Some OAuth endpoints are not accessible',
          details: {
            auth_endpoint: { url: authUrl, accessible: authReachable },
            token_endpoint: { url: tokenUrl, accessible: tokenReachable }
          }
        }
      }
    } catch (error) {
      testResults.oauth_endpoints = {
        passed: false,
        message: 'Failed to test OAuth endpoints',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    // Test 3: Test API access (if we have credentials)
    console.log('[TikTok Test] Testing API access...')
    try {
      // For now, we'll just test if the API base URL is reachable
      // In a real implementation, you might want to make an authenticated request
      const apiUrl = 'https://open.tiktokapis.com/v2/'
      
      const apiResponse = await fetch(apiUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      })
      
      if (apiResponse.status !== 0) {
        testResults.api_access = {
          passed: true,
          message: 'TikTok API is accessible',
          details: {
            api_base_url: apiUrl,
            response_status: apiResponse.status,
            note: 'Full API authentication test requires user tokens'
          }
        }
      } else {
        testResults.api_access = {
          passed: false,
          message: 'TikTok API is not accessible',
          details: {
            api_base_url: apiUrl,
            response_status: apiResponse.status
          }
        }
      }
    } catch (error) {
      testResults.api_access = {
        passed: false,
        message: 'Failed to test API access',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    // Log test action to audit table
    try {
      await supabase
        .from('integration_settings_audit')
        .insert({
          integration_id: null, // We might not have a DB record yet
          platform: 'tiktok',
          action: 'test',
          new_values: {
            test_results: testResults,
            tested_at: new Date().toISOString()
          },
          changed_by: authResult.user.id
        })
    } catch (auditError) {
      console.warn('Failed to log test action:', auditError)
    }

    const allTestsPassed = Object.values(testResults).every(test => test.passed)

    return NextResponse.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'All TikTok integration tests passed' 
        : 'Some TikTok integration tests failed',
      tests: testResults,
      summary: {
        total_tests: Object.keys(testResults).length,
        passed_tests: Object.values(testResults).filter(test => test.passed).length,
        environment: config.environment,
        is_audited: config.is_audited,
        config_source: config.source
      }
    })

  } catch (error) {
    console.error('[TikTok Integration Test] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed due to internal error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}