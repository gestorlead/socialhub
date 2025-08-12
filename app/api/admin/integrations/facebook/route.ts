import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface FacebookPage {
  id: string
  name: string
  access_token: string
  category: string
  is_active: boolean
}

interface FacebookSettings {
  id?: string
  app_id?: string
  app_secret?: string
  oauth_redirect_uri?: string
  is_active: boolean
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
      console.error('Facebook API auth error:', authError)
      return { error: 'Invalid token', status: 401 }
    }
    
    console.log('Facebook API authenticated user:', user.id)

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
      console.error('Facebook API profile error:', profileError)
      return { error: 'Profile not found', status: 403 }
    }

    const userLevel = (profile.roles as any)?.level || (Array.isArray(profile.roles) ? profile.roles[0]?.level : 0)
    console.log('Facebook API user level:', userLevel)
    
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
      .from('integration_settings')
      .select('*')
      .eq('platform', 'facebook')
      .single()

    let settings: FacebookSettings
    let source = 'environment'

    if (!dbError && dbSettings) {
      // Use database settings - map from integration_settings fields
      settings = {
        id: dbSettings.id,
        app_id: dbSettings.app_id,
        app_secret: dbSettings.client_secret, // Note: field name is client_secret in integration_settings
        oauth_redirect_uri: dbSettings.callback_url, // Note: field name is callback_url in integration_settings
        is_active: dbSettings.is_active ?? true
      }
      source = 'database'
    } else {
      // Fallback to environment variables
      settings = {
        app_id: process.env.FACEBOOK_APP_ID,
        app_secret: process.env.FACEBOOK_APP_SECRET,
        oauth_redirect_uri: process.env.FACEBOOK_OAUTH_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/facebook/callback`,
        is_active: process.env.FACEBOOK_IS_ACTIVE !== 'false'
      }
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
    console.log('Facebook API PUT body received:', {
      has_app_id: !!body.app_id,
      has_app_secret: !!body.app_secret,
      has_oauth_redirect_uri: !!body.oauth_redirect_uri,
      is_active: body.is_active
    })

    // Validate required fields
    if (!body.app_id || !body.app_secret) {
      return NextResponse.json(
        { error: 'App ID and App Secret are required' },
        { status: 400 }
      )
    }

    // Check if settings already exist
    const existingCheck = await supabase
      .from('integration_settings')
      .select('id')
      .eq('platform', 'facebook')
      .single()
    
    console.log('Facebook API existing settings check:', {
      data: existingCheck.data,
      error: existingCheck.error,
      hasExisting: !!existingCheck.data
    })
    
    const existingSettings = existingCheck.data

    const now = new Date().toISOString()
    const settingsData = {
      app_id: body.app_id,
      app_secret: body.app_secret,
      oauth_redirect_uri: body.oauth_redirect_uri || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/facebook/callback`,
      is_active: body.is_active !== undefined ? body.is_active : true,
      updated_by: user.id,
      updated_at: now
    }
    
    console.log('Facebook API settings data prepared:', {
      ...settingsData,
      app_secret: '[MASKED]'
    })

    let result
    if (existingSettings) {
      // Update existing settings
      result = await supabase
        .from('integration_settings')
        .update({
          platform: 'facebook',
          app_id: settingsData.app_id,
          client_secret: settingsData.app_secret, // Note: field name is client_secret in integration_settings
          callback_url: settingsData.oauth_redirect_uri,
          is_active: settingsData.is_active,
          config_data: {},
          updated_by: settingsData.updated_by,
          updated_at: settingsData.updated_at
        })
        .eq('id', existingSettings.id)
        .select()
        .single()
    } else {
      // Create new settings with default JSONB values
      const insertData = {
        ...settingsData,
        api_version: 'v23.0', // Add api_version explicitly
        environment: 'development', // Add environment explicitly
        // Add default JSONB fields as defined in the database schema
        permissions: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
        pages: [],
        privacy_settings: {
          default_privacy: "PUBLIC",
          allow_message_replies: true,
          restrict_location: false
        },
        scheduling: {
          enabled: true,
          max_scheduled_posts: 50,
          min_schedule_minutes: 10
        },
        audience_targeting: {
          enabled: false,
          default_age_min: 18,
          default_age_max: 65,
          default_countries: []
        },
        created_by: user.id,
        created_at: now
      }
      
      console.log('Facebook API attempting insert with data:', {
        ...insertData,
        app_secret: '[MASKED]'
      })
      
      // Try insert without single() first to get better error messages
      const insertResult = await supabase
        .from('integration_settings')
        .insert({
          platform: 'facebook',
          app_id: settingsData.app_id,
          client_secret: settingsData.app_secret, // Note: field name is client_secret in integration_settings
          callback_url: settingsData.oauth_redirect_uri,
          environment: 'production', // integration_settings uses sandbox/production
          is_active: settingsData.is_active,
          config_data: {},
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_by: settingsData.updated_by,
          updated_at: settingsData.updated_at
        })
        .select()
      
      console.log('Facebook API insert result:', {
        data: insertResult.data,
        error: insertResult.error,
        count: insertResult.count,
        status: insertResult.status,
        statusText: insertResult.statusText
      })
      
      if (insertResult.error) {
        result = insertResult
      } else if (insertResult.data && insertResult.data.length > 0) {
        result = { 
          data: insertResult.data[0], 
          error: null,
          count: insertResult.count,
          status: insertResult.status,
          statusText: insertResult.statusText
        }
      } else {
        result = {
          data: null,
          error: { message: 'No data returned from insert' },
          count: 0,
          status: 500,
          statusText: 'Internal Server Error'
        }
      }
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
        operation: existingSettings ? 'update' : 'insert',
        settingsData: {
          ...settingsData,
          app_secret: settingsData.app_secret ? '[MASKED]' : undefined
        }
      })
      
      return NextResponse.json(
        { 
          error: 'Failed to save settings',
          details: result.error.message || 'Unknown database error',
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