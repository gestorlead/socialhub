import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface XIntegrationSettings {
  id?: string
  api_key?: string
  api_secret?: string
  client_id?: string
  client_secret?: string
  bearer_token?: string
  environment: 'development' | 'production'
  callback_url?: string
  is_active: boolean
  updated_by?: string
  updated_at?: string
}

// GET - Retrieve X integration settings
export async function GET(request: NextRequest) {
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

    // Try to get settings from integration_settings table
    const { data: dbSettings, error: dbError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'x')
      .maybeSingle()

    if (dbError && dbError.code !== 'PGRST116') {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
    }

    // If no database settings, use environment variables as fallback
    const settings: XIntegrationSettings = dbSettings ? {
      id: dbSettings.id,
      api_key: dbSettings.config_data?.api_key,
      api_secret: dbSettings.config_data?.api_secret,
      client_id: dbSettings.client_key,
      client_secret: dbSettings.client_secret,
      bearer_token: dbSettings.config_data?.bearer_token,
      environment: dbSettings.environment as 'development' | 'production',
      callback_url: dbSettings.callback_url,
      is_active: dbSettings.is_active,
      updated_by: dbSettings.updated_by,
      updated_at: dbSettings.updated_at
    } : {
      api_key: process.env.X_API_KEY || '',
      api_secret: process.env.X_API_SECRET || '',
      client_id: process.env.X_CLIENT_ID || '',
      client_secret: process.env.X_CLIENT_SECRET || '',
      bearer_token: process.env.X_BEARER_TOKEN || '',
      environment: (process.env.X_ENVIRONMENT || 'development') as 'development' | 'production',
      callback_url: process.env.X_CALLBACK_URL || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/x/callback`,
      is_active: process.env.X_IS_ACTIVE === 'true'
    }

    // Mask sensitive data for security
    const maskedSettings = {
      ...settings,
      api_key: settings.api_key ? `${settings.api_key.substring(0, 6)}...` : '',
      api_secret: settings.api_secret ? `${settings.api_secret.substring(0, 6)}...` : '',
      client_secret: settings.client_secret ? `${settings.client_secret.substring(0, 6)}...` : '',
      bearer_token: settings.bearer_token ? `${settings.bearer_token.substring(0, 10)}...` : ''
    }

    return NextResponse.json({ 
      data: maskedSettings,
      message: 'Settings loaded successfully'
    })
  } catch (error) {
    console.error('Error in GET /api/admin/integrations/x:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update X integration settings
export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    
    // Prepare data for integration_settings table
    const integrationData = {
      platform: 'x',
      app_id: null,
      client_key: body.client_id,
      client_secret: body.client_secret,
      environment: body.environment || 'development',
      callback_url: body.callback_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/x/callback`,
      is_active: body.is_active !== false,
      config_data: {
        api_key: body.api_key,
        api_secret: body.api_secret,
        bearer_token: body.bearer_token
      },
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    // Check if settings exist
    const { data: existingSettings } = await supabase
      .from('integration_settings')
      .select('id')
      .eq('platform', 'x')
      .maybeSingle()

    let result
    if (existingSettings) {
      // Update existing settings
      result = await supabase
        .from('integration_settings')
        .update(integrationData)
        .eq('id', existingSettings.id)
        .select()
        .single()
    } else {
      // Insert new settings
      result = await supabase
        .from('integration_settings')
        .insert({
          ...integrationData,
          created_by: user.id
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Database error:', result.error)
      return NextResponse.json({ 
        error: 'Failed to save settings',
        details: result.error.message 
      }, { status: 500 })
    }

    // Log the action in audit table
    await supabase
      .from('integration_settings_audit')
      .insert({
        integration_id: result.data.id,
        platform: 'x',
        action: existingSettings ? 'update' : 'create',
        new_values: integrationData,
        changed_by: user.id
      })

    return NextResponse.json({ 
      data: result.data,
      message: 'Settings saved successfully'
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/integrations/x:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}