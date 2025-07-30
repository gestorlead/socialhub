import { NextRequest } from 'next/server'
import { generateOAuthState, generatePKCE, safeCompare } from './crypto-secure'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface OAuthState {
  state: string
  codeVerifier?: string
  codeChallenge?: string
  redirectUri: string
  provider: 'instagram' | 'facebook'
  userId?: string
  createdAt: number
  expiresAt: number
}

/**
 * Creates secure OAuth state with PKCE support
 */
export async function createOAuthState(
  provider: 'instagram' | 'facebook',
  redirectUri: string,
  userId?: string,
  usePKCE: boolean = true
): Promise<{ state: string; codeChallenge?: string }> {
  const state = generateOAuthState()
  const pkce = usePKCE ? generatePKCE() : undefined
  
  const oauthState: OAuthState = {
    state,
    codeVerifier: pkce?.codeVerifier,
    codeChallenge: pkce?.codeChallenge,
    redirectUri,
    provider,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
  }
  
  // Store state in database with expiration
  await supabase
    .from('oauth_states')
    .insert({
      state,
      provider,
      data: oauthState,
      expires_at: new Date(oauthState.expiresAt).toISOString(),
      created_at: new Date().toISOString()
    })
  
  return {
    state,
    codeChallenge: pkce?.codeChallenge
  }
}

/**
 * Validates OAuth state and retrieves stored data
 */
export async function validateOAuthState(
  state: string,
  provider: 'instagram' | 'facebook'
): Promise<OAuthState | null> {
  try {
    // Retrieve and validate state
    const { data: stateData, error } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', provider)
      .gte('expires_at', new Date().toISOString())
      .single()
    
    if (error || !stateData) {
      console.warn('OAuth state validation failed:', { state, provider, error })
      return null
    }
    
    // Delete used state (one-time use)
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state)
    
    return stateData.data as OAuthState
  } catch (error) {
    console.error('Error validating OAuth state:', error)
    return null
  }
}

/**
 * Validates OAuth callback parameters
 */
export function validateOAuthCallback(request: NextRequest): {
  isValid: boolean
  code?: string
  state?: string
  error?: string
  errorDescription?: string
} {
  const { searchParams } = new URL(request.url)
  
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  
  // Validate required parameters
  if (error) {
    return {
      isValid: false,
      error,
      errorDescription
    }
  }
  
  if (!code || !state) {
    return {
      isValid: false,
      error: 'missing_parameters',
      errorDescription: 'Missing required OAuth parameters'
    }
  }
  
  // Basic parameter validation
  if (code.length > 2048 || state.length > 512) {
    return {
      isValid: false,
      error: 'invalid_parameters',
      errorDescription: 'OAuth parameters exceed maximum length'
    }
  }
  
  // Validate parameter format (no suspicious characters)
  const validCodePattern = /^[a-zA-Z0-9._-]+$/
  const validStatePattern = /^[a-zA-Z0-9._-]+$/
  
  if (!validCodePattern.test(code) || !validStatePattern.test(state)) {
    return {
      isValid: false,
      error: 'invalid_format',
      errorDescription: 'OAuth parameters contain invalid characters'
    }
  }
  
  return {
    isValid: true,
    code,
    state
  }
}

/**
 * Sanitizes OAuth token response data
 */
export function sanitizeTokenResponse(tokenData: Record<string, unknown>): {
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  tokenType?: string
  scope?: string
  userId?: string
} {
  if (!tokenData || typeof tokenData !== 'object') {
    return {}
  }
  
  return {
    accessToken: typeof tokenData.access_token === 'string' ? tokenData.access_token : undefined,
    refreshToken: typeof tokenData.refresh_token === 'string' ? tokenData.refresh_token : undefined,
    expiresIn: typeof tokenData.expires_in === 'number' ? tokenData.expires_in : undefined,
    tokenType: typeof tokenData.token_type === 'string' ? tokenData.token_type : undefined,
    scope: typeof tokenData.scope === 'string' ? tokenData.scope : undefined,
    userId: typeof tokenData.user_id === 'string' ? tokenData.user_id : undefined
  }
}

/**
 * Validates API response data
 */
export function validateApiResponse(data: Record<string, unknown>, requiredFields: string[] = []): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }
  
  // Check required fields exist and are not empty
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      return false
    }
  }
  
  return true
}

/**
 * Creates secure redirect URI with validation
 */
export function createSecureRedirectUri(baseUrl: string, provider: string): string {
  // Validate base URL
  try {
    const url = new URL(baseUrl)
    
    // Only allow HTTPS in production
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new Error('HTTPS required in production')
    }
    
    // Validate domain (implement your domain whitelist here)
    const allowedDomains = process.env.ALLOWED_OAUTH_DOMAINS?.split(',') || []
    if (allowedDomains.length > 0 && !allowedDomains.includes(url.hostname)) {
      throw new Error('Domain not allowed for OAuth redirects')
    }
    
    return `${baseUrl}/api/auth/${provider}/callback`
  } catch (error) {
    throw new Error(`Invalid redirect URI: ${error.message}`)
  }
}

/**
 * Rate limiting for OAuth endpoints
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkOAuthRateLimit(
  identifier: string, 
  maxRequests: number = 10, 
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = `oauth:${identifier}`
  
  let record = rateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + windowMs
    }
  }
  
  record.count++
  rateLimitStore.set(key, record)
  
  const allowed = record.count <= maxRequests
  const remaining = Math.max(0, maxRequests - record.count)
  
  // Cleanup expired entries
  if (Math.random() < 0.01) { // 1% chance to cleanup
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k)
      }
    }
  }
  
  return {
    allowed,
    remaining,
    resetTime: record.resetTime
  }
}

/**
 * Logs OAuth security events
 */
export function logOAuthSecurityEvent(
  event: 'state_validation_failed' | 'rate_limit_exceeded' | 'invalid_callback' | 'token_exchange_failed',
  details: Record<string, unknown>,
  request?: NextRequest
) {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    ip: request?.ip || 'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown',
    details
  }
  
  // In production, send to your security monitoring system
  console.warn('[OAuth Security Event]', logData)
  
  // TODO: Implement alerting for critical events
  if (['rate_limit_exceeded', 'state_validation_failed'].includes(event)) {
    // Send alert to security team
  }
}