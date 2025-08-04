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
  client_secret?: string // Using existing field name
  environment: 'sandbox' | 'production'
  is_active: boolean
  callback_url?: string // Using existing field name  
  webhook_url?: string
  config_data?: Record<string, any> // Will store api_version, permissions, webhook_verify_token
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
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        environment: (process.env.INSTAGRAM_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
        is_active: process.env.INSTAGRAM_IS_ACTIVE !== 'false',
        callback_url: process.env.INSTAGRAM_OAUTH_REDIRECT_URI,
        webhook_url: process.env.INSTAGRAM_WEBHOOK_URL,
        config_data: {
          source: 'environment',
          api_version: process.env.INSTAGRAM_API_VERSION || 'v23.0',
          webhook_verify_token: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
          permissions: process.env.INSTAGRAM_PERMISSIONS?.split(',') || ['instagram_business_basic']
        }
      }
    } else {
      console.log('[Instagram Integration API] Using database settings')
      // Decrypt sensitive fields
      const decryptedSettings = { ...dbSettings }
      try {
        if (decryptedSettings.client_secret) {
          decryptedSettings.client_secret = decrypt(decryptedSettings.client_secret)
        }
        // Decrypt webhook_verify_token from config_data if exists
        if (decryptedSettings.config_data?.webhook_verify_token) {
          decryptedSettings.config_data.webhook_verify_token = decrypt(decryptedSettings.config_data.webhook_verify_token)
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
    if (maskedSettings.client_secret) {
      maskedSettings.client_secret = maskSecret(maskedSettings.client_secret)
    }
    if (maskedSettings.config_data?.webhook_verify_token) {
      maskedSettings.config_data.webhook_verify_token = maskSecret(maskedSettings.config_data.webhook_verify_token)
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
    if (!settings.app_id || !settings.client_secret) {
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
      client_secret: encrypt(settings.client_secret!),
      environment: settings.environment || 'sandbox',
      is_active: settings.is_active ?? true,
      callback_url: settings.callback_url,
      webhook_url: settings.webhook_url,
      config_data: {
        api_version: settings.config_data?.api_version || 'v23.0',
        permissions: settings.config_data?.permissions || ['instagram_business_basic'],
        webhook_verify_token: settings.config_data?.webhook_verify_token ? encrypt(settings.config_data.webhook_verify_token) : null
      },
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