import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { SecureAPIManager } from './api-security'
import { InputSanitizer } from './input-sanitizer'
import { decrypt } from './crypto'
import { supabase } from './supabase'

export interface ProxyRequest {
  platform: 'tiktok' | 'instagram' | 'facebook' | 'youtube'
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  requiredScope: string
}

export interface ProxyResponse {
  success: boolean
  data?: any
  error?: string
  rateLimitRemaining?: number
}

/**
 * Secure Backend Proxy - handles external API calls without exposing tokens to frontend
 */
export class SecureProxy {
  private static readonly TIMEOUT_MS = 30000 // 30 seconds
  private static readonly MAX_RETRIES = 3
  
  private static readonly PLATFORM_CONFIGS = {
    tiktok: {
      baseUrl: 'https://open-api.tiktok.com',
      authHeader: 'Authorization',
      tokenPrefix: 'Bearer '
    },
    instagram: {
      baseUrl: 'https://graph.instagram.com',
      authHeader: 'Authorization', 
      tokenPrefix: 'Bearer '
    },
    facebook: {
      baseUrl: 'https://graph.facebook.com',
      authHeader: 'Authorization',
      tokenPrefix: 'Bearer '
    },
    youtube: {
      baseUrl: 'https://www.googleapis.com/youtube/v3',
      authHeader: 'Authorization',
      tokenPrefix: 'Bearer '
    }
  }

  /**
   * Main proxy handler with comprehensive security
   */
  static async handleProxyRequest(
    request: NextRequest,
    proxyConfig: ProxyRequest
  ): Promise<NextResponse> {
    const startTime = Date.now()
    
    try {
      // 1. Validate API Key and get user context
      const validation = await SecureAPIManager.validateAPIKey(
        request,
        proxyConfig.platform,
        proxyConfig.requiredScope
      )
      
      if (!validation.valid) {
        return this.createErrorResponse(validation.error || 'Invalid API key', 401)
      }

      // 2. Get user's encrypted token for platform
      const userToken = await this.getUserPlatformToken(
        validation.user_id!,
        proxyConfig.platform
      )
      
      if (!userToken) {
        const locale = this.getRequestLocale(request)
        const t = await getTranslations({ locale, namespace: 'errors' })
        
        return this.createErrorResponse(
          t('proxy.tokenNotFound', { platform: proxyConfig.platform }),
          403,
          { needsReconnect: true }
        )
      }

      // 3. Sanitize request body
      const sanitizedBody = proxyConfig.body ? 
        InputSanitizer.sanitizeObject(proxyConfig.body) : 
        undefined

      // 4. Make secure external API call
      const result = await this.makeSecureAPICall({
        ...proxyConfig,
        body: sanitizedBody
      }, userToken)

      // 5. Log successful request for audit
      await this.logProxyRequest({
        apiKeyId: validation.api_key_id!,
        platform: proxyConfig.platform,
        endpoint: proxyConfig.endpoint,
        method: proxyConfig.method,
        success: result.success,
        responseTime: Date.now() - startTime
      })

      return NextResponse.json(result)

    } catch (error) {
      console.error('Proxy request failed:', error)
      
      // Log failed request
      if (proxyConfig) {
        await this.logProxyRequest({
          apiKeyId: 'unknown',
          platform: proxyConfig.platform,
          endpoint: proxyConfig.endpoint,
          method: proxyConfig.method,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime
        })
      }

      return this.createErrorResponse('Internal server error', 500)
    }
  }

  /**
   * Make secure API call to external service
   */
  private static async makeSecureAPICall(
    config: ProxyRequest,
    userToken: string
  ): Promise<ProxyResponse> {
    const platformConfig = this.PLATFORM_CONFIGS[config.platform]
    const url = `${platformConfig.baseUrl}${config.endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SocialHub/1.0',
      [platformConfig.authHeader]: `${platformConfig.tokenPrefix}${userToken}`
    }

    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS)
        
        const response = await fetch(url, {
          method: config.method,
          headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        const responseData = await response.json()
        
        if (!response.ok) {
          // Handle specific API errors
          const error = this.handleAPIError(config.platform, response.status, responseData)
          
          if (this.shouldRetry(response.status) && attempt < this.MAX_RETRIES) {
            await this.delay(Math.pow(2, attempt) * 1000) // Exponential backoff
            continue
          }
          
          return {
            success: false,
            error: error.message,
            rateLimitRemaining: this.extractRateLimitInfo(response)
          }
        }
        
        return {
          success: true,
          data: this.sanitizeAPIResponse(responseData),
          rateLimitRemaining: this.extractRateLimitInfo(response)
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt < this.MAX_RETRIES) {
          await this.delay(Math.pow(2, attempt) * 1000)
          continue
        }
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Request failed after retries'
    }
  }

  /**
   * Get user's encrypted platform token
   */
  private static async getUserPlatformToken(
    userId: string, 
    platform: string
  ): Promise<string | null> {
    const { data } = await supabase
      .from('social_integrations')
      .select('encrypted_token')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('is_active', true)
      .single()
    
    if (!data?.encrypted_token) {
      return null
    }
    
    try {
      return decrypt(data.encrypted_token)
    } catch (error) {
      console.error('Failed to decrypt user token:', error)
      return null
    }
  }

  /**
   * Handle platform-specific API errors
   */
  private static handleAPIError(
    platform: string, 
    status: number, 
    responseData: any
  ): Error {
    switch (platform) {
      case 'tiktok':
        if (status === 401) {
          return new Error('TikTok token expired or invalid')
        }
        if (status === 429) {
          return new Error('TikTok rate limit exceeded')
        }
        if (responseData?.error?.message) {
          return new Error(`TikTok API: ${responseData.error.message}`)
        }
        break
        
      case 'instagram':
        if (status === 401) {
          return new Error('Instagram token expired or invalid')
        }
        if (responseData?.error?.message) {
          return new Error(`Instagram API: ${responseData.error.message}`)
        }
        break
        
      case 'facebook':
        if (status === 401) {
          return new Error('Facebook token expired or invalid')
        }
        if (responseData?.error?.message) {
          return new Error(`Facebook API: ${responseData.error.message}`)
        }
        break
        
      case 'youtube':
        if (status === 401) {
          return new Error('YouTube token expired or invalid')
        }
        if (responseData?.error?.message) {
          return new Error(`YouTube API: ${responseData.error.message}`)
        }
        break
    }
    
    return new Error(`API request failed with status ${status}`)
  }

  /**
   * Check if request should be retried
   */
  private static shouldRetry(status: number): boolean {
    return status >= 500 || status === 429 || status === 408
  }

  /**
   * Extract rate limit information from response headers
   */
  private static extractRateLimitInfo(response: Response): number | undefined {
    const remaining = response.headers.get('x-ratelimit-remaining') ||
                     response.headers.get('x-rate-limit-remaining')
    
    return remaining ? parseInt(remaining, 10) : undefined
  }

  /**
   * Sanitize API response data
   */
  private static sanitizeAPIResponse(data: any): any {
    return InputSanitizer.sanitizeObject(data)
  }

  /**
   * Log proxy request for audit and monitoring
   */
  private static async logProxyRequest(logData: {
    apiKeyId: string
    platform: string
    endpoint: string
    method: string
    success: boolean
    error?: string
    responseTime: number
  }): Promise<void> {
    try {
      await supabase.from('proxy_request_logs').insert({
        api_key_id: logData.apiKeyId,
        platform: logData.platform,
        endpoint: logData.endpoint,
        method: logData.method,
        success: logData.success,
        error_message: logData.error,
        response_time_ms: logData.responseTime,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to log proxy request:', error)
    }
  }

  /**
   * Create standardized error response
   */
  private static createErrorResponse(
    message: string, 
    status: number,
    extra?: Record<string, any>
  ): NextResponse {
    return NextResponse.json(
      {
        success: false,
        error: message,
        ...extra
      },
      { status }
    )
  }

  /**
   * Get request locale for error translations
   */
  private static getRequestLocale(request: NextRequest): string {
    const cookieLocale = request.cookies.get('PREFERRED_LOCALE')?.value
    const headerLocale = request.headers.get('accept-language')?.split(',')[0]?.split('-')[0]
    return cookieLocale || headerLocale || 'pt'
  }

  /**
   * Simple delay utility for retries
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * TikTok-specific proxy methods
 */
export class TikTokProxy {
  /**
   * Publish video to TikTok through secure proxy
   */
  static async publishVideo(
    request: NextRequest,
    videoData: {
      caption: string
      mediaUrl: string
      settings: {
        privacy: string
        allowComments: boolean
        allowDuet: boolean
        allowStitch: boolean
        coverTimestamp?: number
      }
    }
  ): Promise<NextResponse> {
    // Sanitize TikTok-specific data
    const sanitizedData = InputSanitizer.sanitizeTikTokPublishData(videoData)
    
    return SecureProxy.handleProxyRequest(request, {
      platform: 'tiktok',
      endpoint: '/v2/post/publish/video/init/',
      method: 'POST',
      body: sanitizedData,
      requiredScope: 'publish'
    })
  }

  /**
   * Get TikTok analytics through secure proxy
   */
  static async getAnalytics(
    request: NextRequest,
    params: {
      fields: string[]
      dateRange: {
        start: string
        end: string
      }
    }
  ): Promise<NextResponse> {
    const sanitizedParams = InputSanitizer.sanitizeObject(params)
    
    return SecureProxy.handleProxyRequest(request, {
      platform: 'tiktok',
      endpoint: `/v2/research/adlib/commercial_video/query/?${new URLSearchParams(sanitizedParams).toString()}`,
      method: 'GET',
      requiredScope: 'analytics'
    })
  }

  /**
   * Get user profile through secure proxy
   */
  static async getUserProfile(request: NextRequest): Promise<NextResponse> {
    return SecureProxy.handleProxyRequest(request, {
      platform: 'tiktok',
      endpoint: '/v2/user/info/',
      method: 'GET',
      requiredScope: 'read'
    })
  }
}