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
  pages_access: TestResult
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

// POST - Test Facebook connection
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Get current settings
    const { data: dbSettings, error: dbError } = await supabase
      .from('facebook_settings')
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
        app_id: process.env.FACEBOOK_APP_ID,
        app_secret: process.env.FACEBOOK_APP_SECRET,
        access_token: process.env.FACEBOOK_ACCESS_TOKEN,
        api_version: process.env.FACEBOOK_API_VERSION || 'v18.0',
        environment: process.env.FACEBOOK_ENVIRONMENT || 'development',
        pages: []
      }
    }

    if (!settings.app_id || !settings.app_secret) {
      return NextResponse.json({
        success: false,
        error: 'Facebook credentials not configured'
      })
    }

    const results: TestResults = {
      credentials: { passed: false, message: '' },
      permissions: { passed: false, message: '' },
      pages_access: { passed: false, message: '' },
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
      const requiredPermissions = ['pages_show_list', 'pages_manage_posts']
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

    // Test 3: Pages access validation
    try {
      if (settings.pages && settings.pages.length > 0) {
        const activePages = settings.pages.filter(page => page.is_active)
        results.pages_access = {
          passed: activePages.length > 0,
          message: activePages.length > 0 
            ? `${activePages.length} active page(s) configured`
            : 'No active pages configured',
          details: {
            total_pages: settings.pages.length,
            active_pages: activePages.length,
            pages: settings.pages.map(p => ({
              id: p.id,
              name: p.name,
              category: p.category,
              is_active: p.is_active
            }))
          }
        }
        if (activePages.length > 0) passedTests++
      } else {
        results.pages_access = {
          passed: false,
          message: 'No Facebook pages configured'
        }
      }
    } catch (error) {
      results.pages_access = {
        passed: false,
        message: 'Error validating pages access',
        details: error.message
      }
    }

    // Test 4: API Access Test (if access token is available)
    try {
      if (settings.access_token) {
        // Test API call to Facebook Graph API
        const testUrl = `https://graph.facebook.com/${settings.api_version}/me?access_token=${settings.access_token}&fields=id,name`
        
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
    console.error('Facebook test error:', error)
    return NextResponse.json(
      { error: 'Internal server error during testing' },
      { status: 500 }
    )
  }
}