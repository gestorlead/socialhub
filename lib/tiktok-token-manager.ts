import { createClient } from '@supabase/supabase-js'
import { IntegrationConfigManager } from './integration-config-manager'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TikTokConnection {
  access_token: string
  refresh_token: string
  expires_at: string
  scope: string
}

export interface TokenStatus {
  status: 'valid' | 'expiring' | 'expired' | 'refresh_expired' | 'not_found'
  access_token_expires_at?: string
  refresh_token_expires_at?: string
  time_until_expiry?: { hours: number, minutes: number }
  needs_refresh: boolean
  needs_reconnect: boolean
}

export class TikTokTokenManager {
  /**
   * Get a valid access token for a user, refreshing if necessary
   */
  static async getValidAccessToken(userId: string): Promise<string | null> {
    console.log(`[TikTok Token Manager] Getting valid access token for user: ${userId}`)
    
    try {
      // Get current connection
      const { data: connection, error } = await supabase
        .from('social_connections')
        .select('access_token, refresh_token, expires_at, scope, created_at')
        .eq('user_id', userId)
        .eq('platform', 'tiktok')
        .single()

      if (error || !connection) {
        console.warn(`[TikTok Token Manager] TikTok connection not found for user: ${userId}`)
        return null
      }

      console.log(`[TikTok Token Manager] Found connection, expires at: ${connection.expires_at}`)

      // Check if token is expired or close to expiring (within 10 minutes)
      const expiresAt = new Date(connection.expires_at)
      const now = new Date()
      const tenMinutes = 10 * 60 * 1000
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()

      if (timeUntilExpiry > tenMinutes) {
        // Token is still valid
        console.log(`[TikTok Token Manager] Token is valid, ${Math.round(timeUntilExpiry / (60 * 1000))} minutes remaining`)
        return connection.access_token
      }

      // Token needs refresh
      console.log(`[TikTok Token Manager] Token expired or expiring soon (${Math.round(timeUntilExpiry / (60 * 1000))} minutes), refreshing...`)
      const newAccessToken = await this.refreshAccessToken(userId, connection.refresh_token)
      
      if (!newAccessToken) {
        console.error(`[TikTok Token Manager] Failed to refresh TikTok token for user: ${userId}`)
        return null
      }

      console.log(`[TikTok Token Manager] Token refreshed successfully for user: ${userId}`)
      return newAccessToken
    } catch (error) {
      console.error('[TikTok Token Manager] Error getting valid access token:', error)
      return null
    }
  }

  /**
   * Refresh an access token using a refresh token
   */
  private static async refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
    try {
      // Get TikTok configuration from database or env fallback
      const config = await IntegrationConfigManager.getTikTokConfig()
      
      if (!config.client_key || !config.client_secret) {
        console.error('[TikTok Token Manager] Missing TikTok credentials in configuration')
        return null
      }

      console.log(`[TikTok Token Manager] Using ${config.source} configuration for token refresh`)

      const refreshResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        },
        body: new URLSearchParams({
          client_key: config.client_key,
          client_secret: config.client_secret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      })

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error('Failed to refresh TikTok token:', refreshResponse.status, errorText)
        return null
      }

      const tokenData = await refreshResponse.json()
      
      // Calculate new expiration time
      const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

      // Update the connection with new tokens
      const { error: updateError } = await supabase
        .from('social_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token, // Use new refresh token if provided
          expires_at: newExpiresAt,
          scope: tokenData.scope,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('platform', 'tiktok')

      if (updateError) {
        console.error('Error updating refreshed tokens:', updateError)
        return null
      }

      console.log('TikTok token refreshed successfully for user:', userId)
      return tokenData.access_token
    } catch (error) {
      console.error('Error refreshing access token:', error)
      return null
    }
  }

  /**
   * Check if a connection needs token refresh
   */
  static isTokenExpiringSoon(expiresAt: string, bufferMinutes: number = 10): boolean {
    const expiry = new Date(expiresAt)
    const now = new Date()
    const buffer = bufferMinutes * 60 * 1000
    
    return (expiry.getTime() - now.getTime()) <= buffer
  }

  /**
   * Get time remaining until token expires
   */
  static getTimeUntilExpiry(expiresAt: string): { hours: number, minutes: number } {
    const expiry = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiry.getTime() - now.getTime()
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    return { hours: Math.max(0, hours), minutes: Math.max(0, minutes) }
  }

  /**
   * Get comprehensive token status for a user
   */
  static async getTokenStatus(userId: string): Promise<TokenStatus> {
    console.log(`[TikTok Token Manager] Getting token status for user: ${userId}`)
    
    try {
      const { data: connection, error } = await supabase
        .from('social_connections')
        .select('access_token, refresh_token, expires_at, created_at')
        .eq('user_id', userId)
        .eq('platform', 'tiktok')
        .single()

      if (error || !connection) {
        return {
          status: 'not_found',
          needs_refresh: false,
          needs_reconnect: true
        }
      }

      const now = new Date()
      const accessTokenExpiry = new Date(connection.expires_at)
      const refreshTokenExpiry = new Date(new Date(connection.created_at).getTime() + 365 * 24 * 60 * 60 * 1000) // 365 days from creation

      // Check if refresh token is expired (365 days)
      if (now > refreshTokenExpiry) {
        return {
          status: 'refresh_expired',
          access_token_expires_at: connection.expires_at,
          refresh_token_expires_at: refreshTokenExpiry.toISOString(),
          needs_refresh: false,
          needs_reconnect: true
        }
      }

      const timeUntilAccessExpiry = accessTokenExpiry.getTime() - now.getTime()
      const twoHours = 2 * 60 * 60 * 1000
      const tenMinutes = 10 * 60 * 1000

      let status: TokenStatus['status']
      let needsRefresh = false

      if (timeUntilAccessExpiry <= 0) {
        status = 'expired'
        needsRefresh = true
      } else if (timeUntilAccessExpiry <= tenMinutes) {
        status = 'expiring'
        needsRefresh = true
      } else if (timeUntilAccessExpiry <= twoHours) {
        status = 'expiring'
        needsRefresh = false // Will auto-refresh when needed
      } else {
        status = 'valid'
        needsRefresh = false
      }

      return {
        status,
        access_token_expires_at: connection.expires_at,
        refresh_token_expires_at: refreshTokenExpiry.toISOString(),
        time_until_expiry: this.getTimeUntilExpiry(connection.expires_at),
        needs_refresh: needsRefresh,
        needs_reconnect: false
      }
    } catch (error) {
      console.error('[TikTok Token Manager] Error getting token status:', error)
      return {
        status: 'not_found',
        needs_refresh: false,
        needs_reconnect: true
      }
    }
  }
}