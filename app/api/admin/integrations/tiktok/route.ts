import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt, maskSecret } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TikTokIntegrationSettings {
  id?: string
  platform: 'tiktok'
  app_id?: string
  client_key?: string
  client_secret?: string
  environment: 'sandbox' | 'production'
  is_audited: boolean
  webhook_url?: string
  callback_url?: string
  is_active: boolean
  config_data?: Record<string, any>
}

// Verify Super Admin access
async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[TikTok Integration API] No authorization header provided')
    return { error: 'No authorization token provided', status: 401 }
  }

  const token = authHeader.substring(7)
  console.log('[TikTok Integration API] Verifying token for Super Admin access')
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('[TikTok Integration API] Invalid token:', authError)
      return { error: 'Invalid token', status: 401 }
    }

    console.log('[TikTok Integration API] User authenticated:', user.id)

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
      console.error('[TikTok Integration API] Profile query error:', profileError)
      return { error: 'Failed to verify user permissions', status: 500 }
    }

    if (!profile || !profile.roles || profile.roles.level < 3) {
      console.error('[TikTok Integration API] Insufficient permissions. User level:', profile?.roles?.level)
      return { error: 'Super Admin access required', status: 403 }
    }

    console.log('[TikTok Integration API] Super Admin access verified')
    return { user, profile }
  } catch (error) {
    console.error('[TikTok Integration API] Auth verification error:', error)
    return { error: 'Authentication failed', status: 500 }
  }
}

// GET - Retrieve TikTok integration settings
export async function GET(request: NextRequest) {
  console.log('[TikTok Integration API] GET request')
  
  const authResult = await verifySuperAdmin(request)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    // Get settings from database
    const { data: dbSettings, error: dbError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'tiktok')
      .single()

    let settings: TikTokIntegrationSettings

    if (dbError && dbError.code !== 'PGRST116') { // Not "no rows returned"
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    if (!dbSettings) {
      // Fallback to environment variables
      console.log('[TikTok Integration API] Using .env fallback')
      settings = {
        platform: 'tiktok',
        app_id: process.env.TIKTOK_APP_ID,
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        environment: process.env.NODE_ENV === 'production' && process.env.TIKTOK_APP_AUDITED === 'true' ? 'production' : 'sandbox',
        is_audited: process.env.TIKTOK_APP_AUDITED === 'true',
        callback_url: `${process.env.FRONTEND_URL}/auth/tiktok/callback`,
        is_active: true,
        config_data: {
          source: 'env_fallback'
        }
      }
    } else {
      // Decrypt sensitive data
      settings = {
        ...dbSettings,
        app_id: dbSettings.app_id ? decrypt(dbSettings.app_id) : undefined,
        client_key: dbSettings.client_key ? decrypt(dbSettings.client_key) : undefined,
        client_secret: dbSettings.client_secret ? decrypt(dbSettings.client_secret) : undefined,
        config_data: {
          ...dbSettings.config_data,
          source: 'database'
        }
      }
    }

    // Mask sensitive data for response
    const responseSettings = {
      ...settings,
      app_id: settings.app_id ? maskSecret(settings.app_id) : undefined,
      client_key: settings.client_key ? maskSecret(settings.client_key) : undefined,
      client_secret: settings.client_secret ? maskSecret(settings.client_secret) : undefined,
    }

    return NextResponse.json({
      success: true,
      data: responseSettings
    })

  } catch (error) {
    console.error('[TikTok Integration API] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update TikTok integration settings
export async function PUT(request: NextRequest) {
  console.log('[TikTok Integration API] PUT request')
  
  const authResult = await verifySuperAdmin(request)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()
    const {
      app_id,
      client_key,
      client_secret,
      environment,
      is_audited,
      webhook_url,
      callback_url,
      is_active
    } = body

    console.log('[TikTok Integration API] PUT request body parsed:', {
      has_app_id: !!app_id,
      has_client_key: !!client_key,
      has_client_secret: !!client_secret,
      environment,
      is_audited,
      is_active
    })

    // Validate required fields
    if (!app_id || !client_key || !client_secret) {
      console.error('[TikTok Integration API] Missing required fields')
      return NextResponse.json(
        { error: 'App ID, Client Key, and Client Secret are required' },
        { status: 400 }
      )
    }

    // Validate environment
    if (!['sandbox', 'production'].includes(environment)) {
      console.error('[TikTok Integration API] Invalid environment:', environment)
      return NextResponse.json(
        { error: 'Environment must be either "sandbox" or "production"' },
        { status: 400 }
      )
    }

    // Encrypt sensitive data
    console.log('[TikTok Integration API] Encrypting sensitive data...')
    let encryptedData
    try {
      // Test encryption first
      const testEncryption = encrypt('test')
      console.log('[TikTok Integration API] Test encryption successful')
      
      encryptedData = {
        platform: 'tiktok',
        app_id: encrypt(app_id),
        client_key: encrypt(client_key),
        client_secret: encrypt(client_secret),
        environment,
        is_audited: Boolean(is_audited),
        webhook_url: webhook_url || null,
        callback_url: callback_url || `${process.env.FRONTEND_URL}/auth/tiktok/callback`,
        is_active: Boolean(is_active),
        config_data: {
          source: 'database',
          last_updated_by: authResult.user.email,
          last_updated_at: new Date().toISOString(),
          encrypted: true
        },
        updated_by: authResult.user.id
      }
      
      console.log('[TikTok Integration API] Data encrypted successfully')
    } catch (encryptError) {
      console.error('[TikTok Integration API] Encryption error, saving without encryption for debug:', encryptError)
      
      // Fallback: save without encryption for debugging
      encryptedData = {
        platform: 'tiktok',
        app_id: `UNENCRYPTED:${app_id}`,
        client_key: `UNENCRYPTED:${client_key}`,
        client_secret: `UNENCRYPTED:${client_secret}`,
        environment,
        is_audited: Boolean(is_audited),
        webhook_url: webhook_url || null,
        callback_url: callback_url || `${process.env.FRONTEND_URL}/auth/tiktok/callback`,
        is_active: Boolean(is_active),
        config_data: {
          source: 'database',
          last_updated_by: authResult.user.email,
          last_updated_at: new Date().toISOString(),
          encrypted: false,
          encryption_error: encryptError instanceof Error ? encryptError.message : 'Unknown error'
        },
        updated_by: authResult.user.id
      }
      
      console.log('[TikTok Integration API] Using fallback unencrypted storage')
    }

    // Upsert settings
    console.log('[TikTok Integration API] Upserting data to database...')
    const { data, error } = await supabase
      .from('integration_settings')
      .upsert(encryptedData, {
        onConflict: 'platform'
      })
      .select()
      .single()

    if (error) {
      console.error('[TikTok Integration API] Database upsert error:', error)
      return NextResponse.json(
        { error: 'Failed to save settings', details: error.message },
        { status: 500 }
      )
    }
    
    console.log('[TikTok Integration API] Settings saved successfully:', data?.id)

    // Return success (without sensitive data)
    return NextResponse.json({
      success: true,
      message: 'TikTok integration settings updated successfully',
      data: {
        id: data.id,
        platform: data.platform,
        environment: data.environment,
        is_audited: data.is_audited,
        is_active: data.is_active,
        updated_at: data.updated_at
      }
    })

  } catch (error) {
    console.error('[TikTok Integration API] PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}