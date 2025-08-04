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

    if (profileError) {
      return { error: 'Failed to verify user permissions', status: 500 }
    }

    if (!profile || !profile.roles || profile.roles.level < 3) {
      return { error: 'Super Admin access required', status: 403 }
    }

    return { user, profile }
  } catch (error) {
    return { error: 'Authentication failed', status: 500 }
  }
}

// POST /api/admin/integrations/threads/test - Test Threads integration
export async function POST(request: NextRequest) {
  console.log('[Threads Test API] POST request')
  
  const authResult = await verifySuperAdmin(request)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    // Get settings from database
    const { data: settings, error: settingsError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'threads')
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({ 
        success: false, 
        error: 'No configuration found. Please save settings first.' 
      }, { status: 400 })
    }

    const tests: any = {
      credentials: {
        passed: false,
        message: 'Checking credentials...',
        details: {}
      },
      api_access: {
        passed: false,
        message: 'Testing API access...',
        details: {}
      }
    }

    // Decrypt credentials
    let app_id: string | undefined
    let client_secret: string | undefined

    try {
      app_id = settings.app_id ? decrypt(settings.app_id) : undefined
      client_secret = settings.client_secret ? decrypt(settings.client_secret) : undefined
    } catch (decryptError) {
      // Handle unencrypted data (fallback during development)
      app_id = settings.app_id?.startsWith('UNENCRYPTED:') 
        ? settings.app_id.replace('UNENCRYPTED:', '') 
        : settings.app_id
      client_secret = settings.client_secret?.startsWith('UNENCRYPTED:') 
        ? settings.client_secret.replace('UNENCRYPTED:', '') 
        : settings.client_secret
    }

    // Test 1: Check if credentials are present
    if (app_id && client_secret) {
      tests.credentials.passed = true
      tests.credentials.message = 'Credentials are configured'
      tests.credentials.details = {
        app_id_configured: true,
        client_secret_configured: true,
        callback_url_configured: !!settings.callback_url
      }
    } else {
      tests.credentials.message = 'Missing required credentials'
      tests.credentials.details = {
        app_id_configured: !!app_id,
        client_secret_configured: !!client_secret
      }
    }

    // Test 2: Test API Access
    // For Threads, we'll test by trying to get an app access token
    if (tests.credentials.passed && app_id && client_secret) {
      try {
        // Get app access token
        const tokenUrl = 'https://graph.threads.net/oauth/access_token'
        const params = new URLSearchParams({
          client_id: app_id,
          client_secret: client_secret,
          grant_type: 'client_credentials'
        })

        const tokenResponse = await fetch(`${tokenUrl}?${params}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        })

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json()
          if (tokenData.access_token) {
            tests.api_access.passed = true
            tests.api_access.message = 'Successfully connected to Threads API'
            tests.api_access.details = {
              token_type: tokenData.token_type || 'bearer',
              api_version: 'v1.0',
              endpoints_available: [
                'threads_business_basic'
              ],
              note: 'Using threads_business_basic permission scope'
            }
          } else {
            tests.api_access.message = 'Failed to obtain access token'
            tests.api_access.details = tokenData
          }
        } else {
          const errorData = await tokenResponse.json().catch(() => ({}))
          tests.api_access.message = 'API connection failed'
          tests.api_access.details = {
            status: tokenResponse.status,
            error: errorData.error || 'Unknown error',
            error_message: errorData.error_description || tokenResponse.statusText
          }
        }
      } catch (error: any) {
        tests.api_access.message = 'Network error while testing API'
        tests.api_access.details = {
          error: error.message || 'Unknown error'
        }
      }
    } else {
      tests.api_access.message = 'Skipped - credentials test failed'
    }

    // Calculate summary
    const passedTests = Object.values(tests).filter((test: any) => test.passed).length
    const totalTests = Object.keys(tests).length
    const allPassed = passedTests === totalTests

    const summary = {
      passed_tests: passedTests,
      total_tests: totalTests,
      environment: 'production',
      api_version: 'v1.0',
      config_source: 'database',
      is_active: settings.is_active
    }

    return NextResponse.json({
      success: allPassed,
      tests,
      summary
    })

  } catch (error) {
    console.error('[Threads Test API] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to run connectivity test' 
    }, { status: 500 })
  }
}