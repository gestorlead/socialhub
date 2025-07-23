import { createClient } from '@supabase/supabase-js'
import { decrypt } from './crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TikTokConfig {
  app_id: string
  client_key: string
  client_secret: string
  environment: 'sandbox' | 'production'
  is_audited: boolean
  callback_url?: string
  webhook_url?: string
  is_active: boolean
  source: 'database' | 'env_fallback'
}

export class IntegrationConfigManager {
  private static configCache: { [platform: string]: { config: any, timestamp: number } } = {}
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get TikTok configuration with fallback to environment variables
   */
  static async getTikTokConfig(): Promise<TikTokConfig> {
    console.log('[Integration Config] Getting TikTok configuration')
    
    // Check cache first
    const cacheKey = 'tiktok'
    const cached = this.configCache[cacheKey]
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log('[Integration Config] Using cached configuration')
      return cached.config
    }

    try {
      // Try to get from database first
      const { data: dbSettings, error: dbError } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('platform', 'tiktok')
        .eq('is_active', true)
        .single()

      if (!dbError && dbSettings) {
        console.log('[Integration Config] Using database configuration')
        
        const config: TikTokConfig = {
          app_id: decrypt(dbSettings.app_id),
          client_key: decrypt(dbSettings.client_key),
          client_secret: decrypt(dbSettings.client_secret),
          environment: dbSettings.environment,
          is_audited: dbSettings.is_audited,
          callback_url: dbSettings.callback_url,
          webhook_url: dbSettings.webhook_url,
          is_active: dbSettings.is_active,
          source: 'database'
        }

        // Cache the configuration
        this.configCache[cacheKey] = {
          config,
          timestamp: Date.now()
        }

        return config
      }
    } catch (error) {
      console.warn('[Integration Config] Database query failed, falling back to env:', error)
    }

    // Fallback to environment variables
    console.log('[Integration Config] Using environment variable fallback')
    
    const config: TikTokConfig = {
      app_id: process.env.TIKTOK_APP_ID || '',
      client_key: process.env.TIKTOK_CLIENT_KEY || '',
      client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
      environment: (process.env.NODE_ENV === 'production' && process.env.TIKTOK_APP_AUDITED === 'true') ? 'production' : 'sandbox',
      is_audited: process.env.TIKTOK_APP_AUDITED === 'true',
      callback_url: `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL}/auth/tiktok/callback`,
      is_active: true,
      source: 'env_fallback'
    }

    // Cache the fallback configuration (shorter TTL)
    this.configCache[cacheKey] = {
      config,
      timestamp: Date.now() - (this.CACHE_TTL / 2) // Shorter cache for fallback
    }

    return config
  }

  /**
   * Get OAuth URLs for TikTok based on current configuration
   */
  static async getTikTokOAuthUrls(): Promise<{
    authUrl: string
    tokenUrl: string
    baseApiUrl: string
  }> {
    const config = await this.getTikTokConfig()
    
    return {
      authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
      tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
      baseApiUrl: 'https://open.tiktokapis.com/v2'
    }
  }

  /**
   * Check if TikTok integration is properly configured
   */
  static async isTikTokConfigured(): Promise<boolean> {
    try {
      const config = await this.getTikTokConfig()
      return !!(config.app_id && config.client_key && config.client_secret && config.is_active)
    } catch (error) {
      console.error('[Integration Config] Failed to check TikTok configuration:', error)
      return false
    }
  }

  /**
   * Get environment-specific settings
   */
  static async getTikTokEnvironmentSettings(): Promise<{
    isProduction: boolean
    isSandbox: boolean
    isAudited: boolean
    privacyLevel: string
  }> {
    const config = await this.getTikTokConfig()
    
    const isProduction = config.environment === 'production' && config.is_audited
    const isSandbox = config.environment === 'sandbox' || !config.is_audited
    
    return {
      isProduction,
      isSandbox,
      isAudited: config.is_audited,
      privacyLevel: isProduction ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY'
    }
  }

  /**
   * Clear configuration cache (useful when settings are updated)
   */
  static clearCache(platform?: string): void {
    if (platform) {
      delete this.configCache[platform]
      console.log(`[Integration Config] Cleared cache for ${platform}`)
    } else {
      this.configCache = {}
      console.log('[Integration Config] Cleared all configuration cache')
    }
  }

  /**
   * Get configuration source information
   */
  static async getConfigurationSource(platform: string): Promise<{
    source: string
    lastUpdated?: string
    isHealthy: boolean
  }> {
    try {
      if (platform === 'tiktok') {
        const config = await this.getTikTokConfig()
        return {
          source: config.source,
          isHealthy: !!(config.app_id && config.client_key && config.client_secret)
        }
      }
      
      return {
        source: 'unknown',
        isHealthy: false
      }
    } catch (error) {
      return {
        source: 'error',
        isHealthy: false
      }
    }
  }
}