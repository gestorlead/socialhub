import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use anon key to respect RLS policies instead of bypassing them
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FacebookPage {
  id: string
  name: string
  access_token: string
  category: string
  is_active: boolean
}

interface FacebookSettings {
  app_id?: string
  app_secret?: string
  access_token?: string
  api_version: string
  environment: 'development' | 'production'
  is_active: boolean
  oauth_redirect_uri?: string
  webhook_url?: string
  webhook_verify_token?: string
  permissions?: string[]
  pages?: FacebookPage[]
  privacy_settings?: {
    default_privacy: 'PUBLIC' | 'FRIENDS' | 'ONLY_ME' | 'CUSTOM'
    allow_message_replies: boolean
    restrict_location: boolean
  }
  scheduling?: {
    enabled: boolean
    max_scheduled_posts: number
    min_schedule_minutes: number
  }
  audience_targeting?: {
    enabled: boolean
    default_age_min?: number
    default_age_max?: number
    default_countries?: string[]
  }
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

// GET - Retrieve Facebook settings
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Try to get settings from database first
    const { data: dbSettings, error: dbError } = await supabase
      .from('facebook_settings')
      .select('*')
      .limit(1)
      .single()

    let settings: FacebookSettings
    let source = 'environment'

    if (!dbError && dbSettings) {
      // Use database settings
      settings = {
        id: dbSettings.id,
        app_id: dbSettings.app_id,
        app_secret: dbSettings.app_secret,
        access_token: dbSettings.access_token,
        api_version: dbSettings.api_version || 'v18.0',
        environment: dbSettings.environment || 'development',
        is_active: dbSettings.is_active ?? true,
        oauth_redirect_uri: dbSettings.oauth_redirect_uri,
        webhook_url: dbSettings.webhook_url,
        webhook_verify_token: dbSettings.webhook_verify_token,
        permissions: dbSettings.permissions || [],
        pages: dbSettings.pages || [],
        privacy_settings: dbSettings.privacy_settings || {
          default_privacy: 'PUBLIC',
          allow_message_replies: true,
          restrict_location: false
        },
        scheduling: dbSettings.scheduling || {
          enabled: true,
          max_scheduled_posts: 50,
          min_schedule_minutes: 10
        },
        audience_targeting: dbSettings.audience_targeting || {
          enabled: false,
          default_age_min: 18,
          default_age_max: 65,
          default_countries: []
        },
        config_data: {
          source: 'database',
          last_updated_by: dbSettings.updated_by,
          last_updated_at: dbSettings.updated_at
        }
      }
      source = 'database'
    } else {
      // Fallback to environment variables
      settings = {
        app_id: process.env.FACEBOOK_APP_ID,
        app_secret: process.env.FACEBOOK_APP_SECRET,
        access_token: process.env.FACEBOOK_ACCESS_TOKEN,
        api_version: process.env.FACEBOOK_API_VERSION || 'v18.0',
        environment: (process.env.FACEBOOK_ENVIRONMENT as 'development' | 'production') || 'development',
        is_active: process.env.FACEBOOK_IS_ACTIVE !== 'false',
        oauth_redirect_uri: process.env.FACEBOOK_OAUTH_REDIRECT_URI,
        webhook_url: process.env.FACEBOOK_WEBHOOK_URL,
        webhook_verify_token: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
        permissions: process.env.FACEBOOK_PERMISSIONS?.split(',') || ['pages_show_list', 'pages_manage_posts'],
        pages: [],
        privacy_settings: {
          default_privacy: (process.env.FACEBOOK_DEFAULT_PRIVACY as 'PUBLIC' | 'FRIENDS' | 'SELF') || 'PUBLIC',
          allow_message_replies: process.env.FACEBOOK_ALLOW_MESSAGE_REPLIES !== 'false',
          restrict_location: process.env.FACEBOOK_RESTRICT_LOCATION === 'true'
        },
        scheduling: {
          enabled: process.env.FACEBOOK_SCHEDULING_ENABLED !== 'false',
          max_scheduled_posts: parseInt(process.env.FACEBOOK_MAX_SCHEDULED_POSTS || '50'),
          min_schedule_minutes: parseInt(process.env.FACEBOOK_MIN_SCHEDULE_MINUTES || '10')
        },
        audience_targeting: {
          enabled: process.env.FACEBOOK_AUDIENCE_TARGETING_ENABLED === 'true',
          default_age_min: parseInt(process.env.FACEBOOK_DEFAULT_AGE_MIN || '18'),
          default_age_max: parseInt(process.env.FACEBOOK_DEFAULT_AGE_MAX || '65'),
          default_countries: process.env.FACEBOOK_DEFAULT_COUNTRIES?.split(',') || []
        },
        config_data: {
          source: 'environment'
        }
      } as FacebookSettings
    }

    return NextResponse.json({
      success: true,
      data: settings,
      source
    })

  } catch (error) {
    console.error('Facebook settings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update Facebook settings
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const { user } = authResult

    const body = await request.json()
    const settings: FacebookSettings = body

    // Validate required fields
    if (!settings.app_id || !settings.app_secret) {
      return NextResponse.json(
        { error: 'App ID and App Secret are required' },
        { status: 400 }
      )
    }

    // Check if settings already exist
    const { data: existingSettings } = await supabase
      .from('facebook_settings')
      .select('id')
      .limit(1)
      .single()

    const settingsData = {
      app_id: settings.app_id,
      app_secret: settings.app_secret,
      access_token: settings.access_token,
      api_version: settings.api_version,
      environment: settings.environment,
      is_active: settings.is_active,
      oauth_redirect_uri: settings.oauth_redirect_uri,
      webhook_url: settings.webhook_url,
      webhook_verify_token: settings.webhook_verify_token,
      permissions: settings.permissions,
      pages: settings.pages,
      privacy_settings: settings.privacy_settings,
      scheduling: settings.scheduling,
      audience_targeting: settings.audience_targeting,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    let result
    if (existingSettings) {
      // Update existing settings
      result = await supabase
        .from('facebook_settings')
        .update(settingsData)
        .eq('id', existingSettings.id)
        .select()
        .single()
    } else {
      // Create new settings
      result = await supabase
        .from('facebook_settings')
        .insert({
          ...settingsData,
          created_by: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Facebook settings database error:', {
        error: result.error,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        user: user.id,
        timestamp: new Date().toISOString(),
        operation: existingSettings ? 'update' : 'insert'
      })
      
      return NextResponse.json(
        { 
          error: 'Failed to save settings',
          details: result.error.message,
          code: result.error.code,
          hint: result.error.hint 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      data: result.data
    })

  } catch (error) {
    console.error('Facebook settings PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}