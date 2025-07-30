import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface InstagramSettings {
  app_id?: string
  app_secret?: string
  access_token?: string
  instagram_business_account_id?: string
  api_version: string
  environment: 'development' | 'production'
  is_active: boolean
  oauth_redirect_uri?: string
  webhook_url?: string
  webhook_verify_token?: string
  permissions?: string[]
  content_types?: {
    posts: boolean
    stories: boolean
    reels: boolean
    igtv: boolean
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

// GET - Retrieve Instagram settings
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Try to get settings from database first
    const { data: dbSettings, error: dbError } = await supabase
      .from('instagram_settings')
      .select('*')
      .limit(1)
      .single()

    let settings: InstagramSettings
    let source = 'environment'

    if (!dbError && dbSettings) {
      // Use database settings
      settings = {
        id: dbSettings.id,
        app_id: dbSettings.app_id,
        app_secret: dbSettings.app_secret,
        access_token: dbSettings.access_token,
        instagram_business_account_id: dbSettings.instagram_business_account_id,
        api_version: dbSettings.api_version || 'v18.0',
        environment: dbSettings.environment || 'development',
        is_active: dbSettings.is_active ?? true,
        oauth_redirect_uri: dbSettings.oauth_redirect_uri,
        webhook_url: dbSettings.webhook_url,
        webhook_verify_token: dbSettings.webhook_verify_token,
        permissions: dbSettings.permissions || [],
        content_types: dbSettings.content_types || {
          posts: true,
          stories: true,
          reels: true,
          igtv: false
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
        app_id: process.env.INSTAGRAM_APP_ID,
        app_secret: process.env.INSTAGRAM_APP_SECRET,
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
        instagram_business_account_id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
        api_version: process.env.INSTAGRAM_API_VERSION || 'v18.0',
        environment: (process.env.INSTAGRAM_ENVIRONMENT as 'development' | 'production') || 'development',
        is_active: process.env.INSTAGRAM_IS_ACTIVE !== 'false',
        oauth_redirect_uri: process.env.INSTAGRAM_OAUTH_REDIRECT_URI,
        webhook_url: process.env.INSTAGRAM_WEBHOOK_URL,
        webhook_verify_token: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
        permissions: process.env.INSTAGRAM_PERMISSIONS?.split(',') || ['instagram_basic', 'instagram_content_publish'],
        content_types: {
          posts: process.env.INSTAGRAM_CONTENT_POSTS !== 'false',
          stories: process.env.INSTAGRAM_CONTENT_STORIES !== 'false',
          reels: process.env.INSTAGRAM_CONTENT_REELS !== 'false',
          igtv: process.env.INSTAGRAM_CONTENT_IGTV === 'true'
        },
        config_data: {
          source: 'environment'
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: settings,
      source
    })

  } catch (error) {
    console.error('Instagram settings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update Instagram settings
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const { user } = authResult

    const body = await request.json()
    const settings: InstagramSettings = body

    // Validate required fields
    if (!settings.app_id || !settings.app_secret) {
      return NextResponse.json(
        { error: 'App ID and App Secret are required' },
        { status: 400 }
      )
    }

    // Check if settings already exist
    const { data: existingSettings } = await supabase
      .from('instagram_settings')
      .select('id')
      .limit(1)
      .single()

    const settingsData = {
      app_id: settings.app_id,
      app_secret: settings.app_secret,
      access_token: settings.access_token,
      instagram_business_account_id: settings.instagram_business_account_id,
      api_version: settings.api_version,
      environment: settings.environment,
      is_active: settings.is_active,
      oauth_redirect_uri: settings.oauth_redirect_uri,
      webhook_url: settings.webhook_url,
      webhook_verify_token: settings.webhook_verify_token,
      permissions: settings.permissions,
      content_types: settings.content_types,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    let result
    if (existingSettings) {
      // Update existing settings
      result = await supabase
        .from('instagram_settings')
        .update(settingsData)
        .eq('id', existingSettings.id)
        .select()
        .single()
    } else {
      // Create new settings
      result = await supabase
        .from('instagram_settings')
        .insert({
          ...settingsData,
          created_by: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Database error:', result.error)
      return NextResponse.json(
        { error: 'Failed to save settings', details: result.error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      data: result.data
    })

  } catch (error) {
    console.error('Instagram settings PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}