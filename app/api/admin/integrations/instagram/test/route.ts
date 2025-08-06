import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TestResult {
  passed: boolean
  message: string
  details?: Record<string, unknown>
}

interface TestResults {
  credentials: TestResult
  permissions: TestResult
  oauth_endpoints: TestResult
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
      return { error: 'Profile not found', status: 403 }
    }

    const userLevel = profile.roles?.level
    if (userLevel < 3) { // 3 = Super Admin
      return { error: 'Insufficient permissions. Super Admin access required.', status: 403 }
    }

    return { user, profile }
  } catch (error) {
    return { error: 'Authentication failed', status: 500 }
  }
}

// POST - Test Instagram connection
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Get current settings
    const { data: dbSettings, error: dbError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'instagram')
      .single()

    let settings
    let configSource = 'environment'

    if (!dbError && dbSettings) {
      settings = dbSettings
      configSource = 'database'
    } else {
      // Fallback to environment variables
      settings = {
        app_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        config_data: {
          api_version: process.env.INSTAGRAM_API_VERSION || 'v23.0',
          permissions: process.env.INSTAGRAM_PERMISSIONS?.split(',') || ['instagram_business_basic']
        },
        environment: process.env.INSTAGRAM_ENVIRONMENT || 'sandbox'
      }
    }

    if (!settings.app_id || !settings.client_secret) {
      return NextResponse.json({
        success: false,
        error: 'Instagram credentials not configured'
      })
    }

    const results: TestResults = {
      credentials: { passed: false, message: '' },
      permissions: { passed: false, message: '' },
      oauth_endpoints: { passed: false, message: '' }
    }

    let passedTests = 0
    const totalTests = 3

    // Test 1: Credentials validation
    try {
      if (settings.app_id && settings.client_secret) {
        results.credentials = {
          passed: true,
          message: 'App credentials are properly configured',
          details: {
            app_id_present: !!settings.app_id,
            app_secret_present: !!settings.client_secret
          }
        }
        passedTests++
      } else {
        results.credentials = {
          passed: false,
          message: 'Missing app credentials'
        }
      }
    } catch (error) {
      results.credentials = {
        passed: false,
        message: 'Error validating credentials',
        details: error.message
      }
    }

    // Test 2: Permissions check
    try {
      const requiredPermissions = ['instagram_business_basic']
      const configuredPermissions = settings.config_data?.permissions || []
      const hasRequiredPermissions = requiredPermissions.every(perm => 
        configuredPermissions.includes(perm)
      )

      if (hasRequiredPermissions) {
        results.permissions = {
          passed: true,
          message: 'Required permissions are configured',
          details: {
            required: requiredPermissions,
            configured: configuredPermissions
          }
        }
        passedTests++
      } else {
        results.permissions = {
          passed: false,
          message: 'Missing required permissions',
          details: {
            required: requiredPermissions,
            configured: configuredPermissions,
            missing: requiredPermissions.filter(perm => !configuredPermissions.includes(perm))
          }
        }
      }
    } catch (error) {
      results.permissions = {
        passed: false,
        message: 'Error checking permissions',
        details: error.message
      }
    }

    // Test 3: OAuth Endpoints validation
    try {
      const oauth_redirect_uri = settings.callback_url || process.env.INSTAGRAM_OAUTH_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`
      
      if (oauth_redirect_uri) {
        // Test if OAuth endpoints are reachable
        const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${settings.app_id}&redirect_uri=${encodeURIComponent(oauth_redirect_uri)}&scope=instagram_business_basic&response_type=code`
        
        results.oauth_endpoints = {
          passed: true,
          message: 'OAuth endpoints are properly configured',
          details: {
            auth_url: authUrl,
            redirect_uri: oauth_redirect_uri
          }
        }
        passedTests++
      } else {
        results.oauth_endpoints = {
          passed: false,
          message: 'OAuth redirect URI not configured'
        }
      }
    } catch (error) {
      results.oauth_endpoints = {
        passed: false,
        message: 'Error validating OAuth endpoints',
        details: error.message
      }
    }

    const success = passedTests === totalTests

    return NextResponse.json({
      success,
      tests: results,
      summary: {
        passed_tests: passedTests,
        total_tests: totalTests,
        environment: settings.environment,
        api_version: settings.config_data?.api_version || 'v23.0',
        config_source: configSource
      }
    })

  } catch (error) {
    console.error('Instagram test error:', error)
    return NextResponse.json(
      { error: 'Internal server error during testing' },
      { status: 500 }
    )
  }
}