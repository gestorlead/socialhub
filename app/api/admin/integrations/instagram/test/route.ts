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
  business_account: TestResult
  api_access: TestResult
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
      .from('instagram_settings')
      .select('*')
      .limit(1)
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
        app_secret: process.env.INSTAGRAM_APP_SECRET,
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
        instagram_business_account_id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
        api_version: process.env.INSTAGRAM_API_VERSION || 'v18.0',
        environment: process.env.INSTAGRAM_ENVIRONMENT || 'development'
      }
    }

    if (!settings.app_id || !settings.app_secret) {
      return NextResponse.json({
        success: false,
        error: 'Instagram credentials not configured'
      })
    }

    const results: TestResults = {
      credentials: { passed: false, message: '' },
      permissions: { passed: false, message: '' },
      business_account: { passed: false, message: '' },
      api_access: { passed: false, message: '' }
    }

    let passedTests = 0
    const totalTests = 4

    // Test 1: Credentials validation
    try {
      if (settings.app_id && settings.app_secret) {
        results.credentials = {
          passed: true,
          message: 'App credentials are properly configured',
          details: {
            app_id_present: !!settings.app_id,
            app_secret_present: !!settings.app_secret,
            access_token_present: !!settings.access_token
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
      const requiredPermissions = ['instagram_basic', 'pages_show_list']
      const configuredPermissions = settings.permissions || []
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

    // Test 3: Business Account validation
    try {
      if (settings.instagram_business_account_id) {
        results.business_account = {
          passed: true,
          message: 'Instagram Business Account ID is configured',
          details: {
            account_id: settings.instagram_business_account_id
          }
        }
        passedTests++
      } else {
        results.business_account = {
          passed: false,
          message: 'Instagram Business Account ID not configured'
        }
      }
    } catch (error) {
      results.business_account = {
        passed: false,
        message: 'Error validating business account',
        details: error.message
      }
    }

    // Test 4: API Access Test (if access token is available)
    try {
      if (settings.access_token) {
        // Test API call to Instagram Graph API
        const testUrl = `https://graph.facebook.com/${settings.api_version}/me?access_token=${settings.access_token}`
        
        const response = await fetch(testUrl)
        
        if (response.ok) {
          const data = await response.json()
          results.api_access = {
            passed: true,
            message: 'API access successful',
            details: {
              user_id: data.id,
              name: data.name
            }
          }
          passedTests++
        } else {
          const errorData = await response.json()
          results.api_access = {
            passed: false,
            message: 'API access failed',
            details: errorData
          }
        }
      } else {
        results.api_access = {
          passed: false,
          message: 'No access token available for API testing'
        }
      }
    } catch (error) {
      results.api_access = {
        passed: false,
        message: 'Error testing API access',
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
        api_version: settings.api_version,
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