import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt, maskSecret } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface InstagramIntegrationSettings {
  id?: string
  platform: 'instagram'
  app_id?: string
  app_secret?: string
  api_version: string
  environment: 'development' | 'production'
  is_active: boolean
  oauth_redirect_uri?: string
  webhook_url?: string
  webhook_verify_token?: string
  permissions?: string[]
  config_data?: Record<string, any>
}

// Verify Super Admin access
async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[Instagram Integration API] No authorization header provided')
    return { error: 'No authorization token provided', status: 401 }
  }

  const token = authHeader.substring(7)
  console.log('[Instagram Integration API] Verifying token for Super Admin access')
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('[Instagram Integration API] Invalid token:', authError)
      return { error: 'Invalid token', status: 401 }
    }

    console.log('[Instagram Integration API] User authenticated:', user.id)

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
      console.error('[Instagram Integration API] Profile query error:', profileError)
      return { error: 'Failed to verify user permissions', status: 500 }
    }

    if (!profile || !profile.roles || profile.roles.level < 3) {
      console.error('[Instagram Integration API] Insufficient permissions. User level:', profile?.roles?.level)
      return { error: 'Super Admin access required', status: 403 }
    }

    console.log('[Instagram Integration API] Super Admin access verified')
    return { user, profile }
  } catch (error) {
    console.error('[Instagram Integration API] Auth verification error:', error)
    return { error: 'Authentication failed', status: 500 }
  }
}

// GET - Retrieve Instagram integration settings
export async function GET(request: NextRequest) {
  console.log('[Instagram Integration API] GET request')
  
  const authResult = await verifySuperAdmin(request)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    // Get settings from database
    const { data: dbSettings, error: dbError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'instagram')
      .single()

    let settings: InstagramIntegrationSettings

    if (dbError && dbError.code !== 'PGRST116') { // Not "no rows returned"
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    if (!dbSettings) {
      // Fallback to environment variables
      console.log('[Instagram Integration API] Using .env fallback')
      settings = {
        platform: 'instagram',
        app_id: process.env.INSTAGRAM_APP_ID,
        app_secret: process.env.INSTAGRAM_APP_SECRET,
        api_version: process.env.INSTAGRAM_API_VERSION || 'v23.0',
        environment: (process.env.INSTAGRAM_ENVIRONMENT as 'development' | 'production') || 'development',
        is_active: process.env.INSTAGRAM_IS_ACTIVE !== 'false',
        oauth_redirect_uri: process.env.INSTAGRAM_OAUTH_REDIRECT_URI,
        webhook_url: process.env.INSTAGRAM_WEBHOOK_URL,
        webhook_verify_token: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
        permissions: process.env.INSTAGRAM_PERMISSIONS?.split(',') || ['instagram_business_basic'],
        config_data: {
          source: 'environment'
        }
      }
    } else {
      console.log('[Instagram Integration API] Using database settings')
      // Decrypt sensitive fields
      const decryptedSettings = { ...dbSettings }
      try {
        if (decryptedSettings.app_secret) {
          decryptedSettings.app_secret = decrypt(decryptedSettings.app_secret)
        }
        if (decryptedSettings.webhook_verify_token) {
          decryptedSettings.webhook_verify_token = decrypt(decryptedSettings.webhook_verify_token)
        }
      } catch (decryptError) {
        console.error('[Instagram Integration API] Decryption error:', decryptError)
        // If decryption fails, use the values as-is (they might not be encrypted)
      }

      settings = {
        ...decryptedSettings,
        config_data: {
          source: 'database',
          last_updated_by: dbSettings.updated_by,
          last_updated_at: dbSettings.updated_at
        }
      }
    }

    // Mask sensitive data for client
    const maskedSettings = { ...settings }
    if (maskedSettings.app_secret) {
      maskedSettings.app_secret = maskSecret(maskedSettings.app_secret)
    }
    if (maskedSettings.webhook_verify_token) {
      maskedSettings.webhook_verify_token = maskSecret(maskedSettings.webhook_verify_token)
    }

    console.log('[Instagram Integration API] Settings retrieved successfully')
    return NextResponse.json({
      success: true,
      data: maskedSettings
    })

  } catch (error) {
    console.error('[Instagram Integration API] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update Instagram integration settings
export async function PUT(request: NextRequest) {
  console.log('[Instagram Integration API] PUT request')
  
  const authResult = await verifySuperAdmin(request)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { user } = authResult

  try {
    const body = await request.json()
    const settings: InstagramIntegrationSettings = body

    console.log('[Instagram Integration API] Updating settings for user:', user.id)

    // Validate required fields
    if (!settings.app_id || !settings.app_secret) {
      return NextResponse.json(
        { error: 'App ID and App Secret are required' },
        { status: 400 }
      )
    }

    // Check if settings already exist
    const { data: existingSettings } = await supabase
      .from('integration_settings')
      .select('id')
      .eq('platform', 'instagram')
      .single()

    // Prepare settings data
    const settingsData = {
      platform: 'instagram' as const,
      app_id: settings.app_id,
      app_secret: encrypt(settings.app_secret),
      api_version: settings.api_version || 'v23.0',
      environment: settings.environment || 'development',
      is_active: settings.is_active ?? true,
      oauth_redirect_uri: settings.oauth_redirect_uri,
      webhook_url: settings.webhook_url,
      webhook_verify_token: settings.webhook_verify_token ? encrypt(settings.webhook_verify_token) : null,
      permissions: settings.permissions || ['instagram_business_basic'],
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    let result
    if (existingSettings) {
      console.log('[Instagram Integration API] Updating existing settings')
      // Update existing settings
      result = await supabase
        .from('integration_settings')
        .update(settingsData)
        .eq('id', existingSettings.id)
        .select()
        .single()
    } else {
      console.log('[Instagram Integration API] Creating new settings')
      // Create new settings
      result = await supabase
        .from('integration_settings')
        .insert({
          ...settingsData,
          created_by: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('[Instagram Integration API] Database error:', result.error)
      return NextResponse.json(
        { error: 'Failed to save settings', details: result.error.message },
        { status: 500 }
      )
    }

    console.log('[Instagram Integration API] Settings saved successfully')
    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      data: result.data
    })

  } catch (error) {
    console.error('[Instagram Integration API] PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}