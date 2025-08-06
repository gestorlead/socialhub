import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt, maskSecret } from '@/lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface YouTubeIntegrationSettings {
  id?: string
  platform: 'youtube'
  app_id?: string
  client_key?: string
  client_secret?: string
  environment?: 'sandbox' | 'production'
  is_audited?: boolean
  webhook_url?: string
  callback_url?: string
  is_active: boolean
  config_data?: {
    project_id?: string
    auth_uri?: string
    token_uri?: string
    auth_provider_x509_cert_url?: string
    redirect_uris?: string[]
    [key: string]: unknown
  }
}

// Verify Super Admin access
async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[YouTube Integration API] No authorization header provided')
    return { error: 'No authorization token provided', status: 401 }
  }

  const token = authHeader.substring(7)
  console.log('[YouTube Integration API] Verifying token for Super Admin access')
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('[YouTube Integration API] Invalid token:', authError)
      return { error: 'Invalid token', status: 401 }
    }

    console.log('[YouTube Integration API] User authenticated:', user.id)

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
      console.error('[YouTube Integration API] Failed to get user profile:', profileError)
      return { error: 'User profile not found', status: 404 }
    }

    const userRole = profile.roles.level
    if (userRole < 3) {
      console.error('[YouTube Integration API] Insufficient permissions. User role:', userRole)
      return { error: 'Super Admin access required', status: 403 }
    }

    console.log('[YouTube Integration API] Super Admin access verified')
    return { user, profile }
  } catch (error) {
    console.error('[YouTube Integration API] Authentication error:', error)
    return { error: 'Authentication failed', status: 500 }
  }
}

// GET /api/admin/integrations/youtube - Get YouTube integration settings
export async function GET(request: NextRequest) {
  console.log('[YouTube Integration API] GET request received')

  try {
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // Try to get settings from database
    const { data: settings, error: dbError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('platform', 'youtube')
      .single()

    let result: YouTubeIntegrationSettings = {
      platform: 'youtube',
      environment: 'production',
      is_audited: true,
      is_active: true,
      config_data: {
        source: 'environment',
        project_id: undefined,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        redirect_uris: [],
        last_updated_at: new Date().toISOString()
      }
    }

    if (settings && !dbError) {
      console.log('[YouTube Integration API] Found database settings')
      
      try {
        // Decrypt sensitive fields
        result = {
          ...result,
          id: settings.id,
          app_id: settings.app_id ? decrypt(settings.app_id) : undefined,
          client_key: settings.client_key ? decrypt(settings.client_key) : undefined,
          client_secret: settings.client_secret ? decrypt(settings.client_secret) : undefined,
          environment: settings.environment || 'production',
          is_audited: settings.is_audited || true,
          webhook_url: settings.webhook_url,
          callback_url: settings.callback_url ? decrypt(settings.callback_url) : undefined,
          is_active: settings.is_active,
          config_data: {
            source: 'database',
            last_updated_by: settings.updated_by,
            last_updated_at: settings.updated_at,
            project_id: settings.config_data?.project_id,
            auth_uri: settings.config_data?.auth_uri || 'https://accounts.google.com/o/oauth2/auth',
            token_uri: settings.config_data?.token_uri || 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: settings.config_data?.auth_provider_x509_cert_url || 'https://www.googleapis.com/oauth2/v1/certs',
            redirect_uris: settings.config_data?.redirect_uris || [],
            ...settings.config_data
          }
        }
      } catch (decryptError) {
        console.error('[YouTube Integration API] Decryption failed, using environment fallback:', decryptError)
        result.config_data!.source = 'environment'
      }
    } else {
      console.log('[YouTube Integration API] No database settings found, using environment variables')
      
      // Try to get from environment variables
      result.app_id = process.env.YOUTUBE_PROJECT_ID
      result.client_key = process.env.YOUTUBE_CLIENT_ID
      result.client_secret = process.env.YOUTUBE_CLIENT_SECRET
      result.callback_url = process.env.YOUTUBE_CALLBACK_URL || 
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/auth/youtube/callback`
      
      if (result.callback_url) {
        result.config_data!.redirect_uris = [result.callback_url]
      }
      
      result.config_data!.project_id = process.env.YOUTUBE_PROJECT_ID
    }

    // Mask secrets for response
    const response = {
      ...result,
      app_id: result.app_id,
      client_key: result.client_key ? maskSecret(result.client_key) : undefined,
      client_secret: result.client_secret ? maskSecret(result.client_secret) : undefined
    }

    console.log('[YouTube Integration API] Settings retrieved successfully')
    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('[YouTube Integration API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get integration settings', details: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/integrations/youtube - Update YouTube integration settings
export async function PUT(request: NextRequest) {
  console.log('[YouTube Integration API] PUT request received')

  try {
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { user } = authResult
    const body = await request.json()
    console.log('[YouTube Integration API] Request body received:', {
      ...body,
      client_secret: body.client_secret ? '***' : undefined
    })

    // Validate required fields
    if (!body.client_id || !body.client_secret || !body.project_id) {
      return NextResponse.json(
        { error: 'Client ID, Client Secret and Project ID are required' },
        { status: 400 }
      )
    }

    // Prepare data for storage
    const settingsData = {
      platform: 'youtube',
      app_id: encrypt(body.project_id),
      client_key: encrypt(body.client_id),
      client_secret: encrypt(body.client_secret),
      environment: 'production',
      is_audited: true,
      webhook_url: null,
      callback_url: body.callback_url ? encrypt(body.callback_url) : null,
      is_active: body.is_active !== undefined ? body.is_active : true,
      config_data: {
        project_id: body.project_id,
        auth_uri: body.auth_uri || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: body.token_uri || 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: body.auth_provider_x509_cert_url || 'https://www.googleapis.com/oauth2/v1/certs',
        redirect_uris: body.redirect_uris || [],
        source: 'database',
        last_updated_by: user.email,
        last_updated_at: new Date().toISOString(),
        encrypted: true
      },
      updated_by: user.id
    }

    console.log('[YouTube Integration API] Prepared settings data (encrypted)')

    // Check if settings exist
    const { data: existing } = await supabase
      .from('integration_settings')
      .select('id')
      .eq('platform', 'youtube')
      .single()

    let result
    if (existing) {
      console.log('[YouTube Integration API] Updating existing settings')
      result = await supabase
        .from('integration_settings')
        .update(settingsData)
        .eq('platform', 'youtube')
        .select('*')
        .single()
    } else {
      console.log('[YouTube Integration API] Creating new settings')
      result = await supabase
        .from('integration_settings')
        .insert([{
          ...settingsData,
          created_by: user.id,
          created_at: new Date().toISOString()
        }])
        .select('*')
        .single()
    }

    if (result.error) {
      console.error('[YouTube Integration API] Database operation failed:', result.error)
      return NextResponse.json(
        { error: 'Failed to save settings', details: result.error.message },
        { status: 500 }
      )
    }

    console.log('[YouTube Integration API] Settings saved successfully')

    // Test encryption/decryption
    try {
      decrypt(result.data.client_secret)
      console.log('[YouTube Integration API] Encryption test passed')
    } catch (encError) {
      console.error('[YouTube Integration API] Encryption test failed:', encError)
    }

    return NextResponse.json({
      success: true,
      message: 'YouTube integration settings saved successfully',
      data: {
        id: result.data.id,
        platform: result.data.platform,
        is_active: result.data.is_active,
        updated_at: result.data.updated_at
      }
    })

  } catch (error) {
    console.error('[YouTube Integration API] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update integration settings', details: error.message },
      { status: 500 }
    )
  }
}