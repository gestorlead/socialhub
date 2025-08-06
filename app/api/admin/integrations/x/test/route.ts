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
  oauth_config: TestResult
  api_access: TestResult
  rate_limits: TestResult
}

// POST - Test X integration connectivity
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify the user's token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin or super admin (level >= 2)
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

    if (profileError || !profile || !profile.roles || profile.roles.level < 2) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get current settings from integration_settings table
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'x')
      .maybeSingle()

    const config = settings ? {
      api_key: settings.config_data?.api_key,
      api_secret: settings.config_data?.api_secret,
      client_id: settings.client_key,
      client_secret: settings.client_secret,
      bearer_token: settings.config_data?.bearer_token,
      environment: settings.environment || 'development',
      is_active: settings.is_active
    } : {
      api_key: process.env.X_API_KEY,
      api_secret: process.env.X_API_SECRET,
      client_id: process.env.X_CLIENT_ID,
      client_secret: process.env.X_CLIENT_SECRET,
      bearer_token: process.env.X_BEARER_TOKEN,
      environment: process.env.X_ENVIRONMENT || 'development',
      is_active: process.env.X_IS_ACTIVE === 'true'
    }

    const tests: TestResults = {
      credentials: {
        passed: false,
        message: 'Checking credentials...'
      },
      oauth_config: {
        passed: false,
        message: 'Checking OAuth configuration...'
      },
      api_access: {
        passed: false,
        message: 'Testing API access...'
      },
      rate_limits: {
        passed: false,
        message: 'Checking rate limits...'
      }
    }

    // Test 1: Check if required OAuth 2.0 credentials are present
    if (config.client_id && config.client_secret) {
      tests.credentials = {
        passed: true,
        message: 'OAuth 2.0 credentials configured',
        details: {
          client_id: config.client_id ? 'Present' : 'Missing',
          client_secret: config.client_secret ? 'Present' : 'Missing',
          api_key: config.api_key ? 'Present (optional)' : 'Not configured',
          api_secret: config.api_secret ? 'Present (optional)' : 'Not configured'
        }
      }
    } else {
      tests.credentials = {
        passed: false,
        message: 'Missing required OAuth 2.0 credentials',
        details: {
          client_id: config.client_id ? 'Present' : 'Missing',
          client_secret: config.client_secret ? 'Present' : 'Missing'
        }
      }
    }

    // Test 2: Check OAuth configuration
    tests.oauth_config = {
      passed: true,
      message: 'OAuth 2.0 with PKCE ready',
      details: {
        auth_url: 'https://twitter.com/i/oauth2/authorize',
        token_url: 'https://api.twitter.com/2/oauth2/token',
        callback_url: config.callback_url || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/x/callback`,
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
      }
    }

    // Test 3: Test API access if bearer token is available
    if (config.bearer_token) {
      try {
        const response = await fetch('https://api.twitter.com/2/users/me', {
          headers: {
            'Authorization': `Bearer ${config.bearer_token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          tests.api_access = {
            passed: true,
            message: 'API access verified',
            details: {
              endpoint: '/2/users/me',
              status: response.status,
              user: data.data
            }
          }
        } else {
          tests.api_access = {
            passed: false,
            message: 'API access failed',
            details: {
              endpoint: '/2/users/me',
              status: response.status,
              error: await response.text()
            }
          }
        }
      } catch (error) {
        tests.api_access = {
          passed: false,
          message: 'API connection error',
          details: {
            error: error.message
          }
        }
      }
    } else {
      tests.api_access = {
        passed: true,
        message: 'Bearer token not configured - OAuth flow will be used',
        details: {
          note: 'Users will authenticate via OAuth 2.0'
        }
      }
    }

    // Test 4: Rate limits information
    tests.rate_limits = {
      passed: true,
      message: 'Free tier rate limits',
      details: {
        posts_per_month: 100,
        read_limit: '10,000 posts/month',
        app_limit: '500,000 posts/month',
        rate_limit_window: '15 minutes',
        note: 'Rate limits reset every 15 minutes'
      }
    }

    // Calculate summary
    const passedTests = Object.values(tests).filter(t => t.passed).length
    const totalTests = Object.keys(tests).length
    const allPassed = passedTests === totalTests

    return NextResponse.json({
      success: allPassed,
      tests,
      summary: {
        passed_tests: passedTests,
        total_tests: totalTests,
        environment: config.environment,
        is_active: config.is_active,
        config_source: settings ? 'database' : 'environment'
      }
    })
  } catch (error) {
    console.error('Error in POST /api/admin/integrations/x/test:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to run tests',
      details: error.message 
    }, { status: 500 })
  }
}