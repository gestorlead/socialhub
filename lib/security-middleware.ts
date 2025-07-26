import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { SecureLogger } from './secure-logger'
import { InputSanitizer } from './input-sanitizer'
import { SecureAPIManager } from './api-security'

export interface SecurityConfig {
  enableCSP: boolean
  enableRateLimit: boolean
  enableIPWhitelist: boolean
  enableRequestSanitization: boolean
  enableSecurityHeaders: boolean
  enableAuditLogging: boolean
  maxRequestSize: number
  allowedOrigins: string[]
  blockedIPs: string[]
  trustedProxies: string[]
}

export interface SecurityContext {
  ipAddress: string
  userAgent: string
  locale: string
  sessionId?: string
  userId?: string
  isBot: boolean
  riskScore: number
  countryCode?: string
}

/**
 * Comprehensive security middleware with i18n support
 */
export class SecurityMiddleware {
  private static readonly DEFAULT_CONFIG: SecurityConfig = {
    enableCSP: true,
    enableRateLimit: true,
    enableIPWhitelist: false,
    enableRequestSanitization: true,
    enableSecurityHeaders: true,
    enableAuditLogging: true,
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    allowedOrigins: [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ],
    blockedIPs: [],
    trustedProxies: ['cloudflare']
  }

  private static config: SecurityConfig = this.DEFAULT_CONFIG
  private static readonly RATE_LIMIT_CACHE = new Map<string, { count: number; resetTime: number }>()

  /**
   * Main middleware handler
   */
  static async handle(
    request: NextRequest,
    config: Partial<SecurityConfig> = {}
  ): Promise<NextResponse | null> {
    // Merge configuration
    const activeConfig = { ...this.config, ...config }
    
    try {
      // 1. Build security context
      const context = await this.buildSecurityContext(request)
      
      // 2. Apply security checks
      const securityChecks = await Promise.allSettled([
        this.checkRateLimit(request, context, activeConfig),
        this.checkIPRestrictions(request, context, activeConfig),
        this.checkRequestSize(request, activeConfig),
        this.checkSuspiciousActivity(request, context),
        this.sanitizeRequest(request, activeConfig)
      ])

      // 3. Process security check results
      for (const [index, result] of securityChecks.entries()) {
        if (result.status === 'rejected') {
          await this.handleSecurityViolation(
            request,
            context,
            this.getCheckName(index),
            result.reason
          )
          return this.createSecurityResponse(request, result.reason, 403)
        }
        
        if (result.status === 'fulfilled' && result.value) {
          return result.value // Return early if check returned a response
        }
      }

      // 4. Log successful request
      if (activeConfig.enableAuditLogging) {
        await SecureLogger.logAPIRequest(
          request.nextUrl.pathname,
          request.method,
          200,
          0, // Will be updated by response middleware
          context.userId,
          request
        )
      }

      // 5. Apply security headers to response
      return this.addSecurityHeaders(request, null, activeConfig)

    } catch (error) {
      console.error('Security middleware error:', error)
      
      await SecureLogger.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: request.nextUrl.pathname,
          method: request.method
        },
        actionRequired: true
      }, request)

      return this.createSecurityResponse(request, 'Security check failed', 500)
    }
  }

  /**
   * Build comprehensive security context
   */
  private static async buildSecurityContext(request: NextRequest): Promise<SecurityContext> {
    const ipAddress = this.getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''
    const locale = this.getRequestLocale(request)
    
    return {
      ipAddress,
      userAgent,
      locale,
      sessionId: request.cookies.get('session_id')?.value,
      userId: request.headers.get('x-user-id') || undefined,
      isBot: this.detectBot(userAgent),
      riskScore: await this.calculateRiskScore(request, ipAddress, userAgent),
      countryCode: await this.getCountryCode(ipAddress)
    }
  }

  /**
   * Rate limiting with intelligent thresholds
   */
  private static async checkRateLimit(
    request: NextRequest,
    context: SecurityContext,
    config: SecurityConfig
  ): Promise<NextResponse | null> {
    if (!config.enableRateLimit) return null

    const key = `${context.ipAddress}:${request.nextUrl.pathname}`
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window
    const limit = this.getRateLimitForEndpoint(request.nextUrl.pathname, context)

    // Clean expired entries
    for (const [k, v] of this.RATE_LIMIT_CACHE.entries()) {
      if (v.resetTime < now) {
        this.RATE_LIMIT_CACHE.delete(k)
      }
    }

    const current = this.RATE_LIMIT_CACHE.get(key)
    
    if (!current) {
      this.RATE_LIMIT_CACHE.set(key, { count: 1, resetTime: now + windowMs })
      return null
    }

    if (current.count >= limit) {
      await SecureLogger.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        details: {
          ipAddress: context.ipAddress,
          endpoint: request.nextUrl.pathname,
          limit,
          current: current.count
        }
      }, request)

      const t = await getTranslations({ locale: context.locale, namespace: 'errors' })
      return this.createSecurityResponse(
        request,
        t('security.rateLimitExceeded'),
        429,
        {
          'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString(),
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0'
        }
      )
    }

    current.count++
    return null
  }

  /**
   * IP restrictions and geolocation checks
   */
  private static async checkIPRestrictions(
    request: NextRequest,
    context: SecurityContext,
    config: SecurityConfig
  ): Promise<NextResponse | null> {
    // Check blocked IPs
    if (config.blockedIPs.includes(context.ipAddress)) {
      await SecureLogger.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        details: {
          ipAddress: context.ipAddress,
          reason: 'IP blocked'
        },
        actionRequired: true
      }, request)

      const t = await getTranslations({ locale: context.locale, namespace: 'errors' })
      return this.createSecurityResponse(request, t('security.accessDenied'), 403)
    }

    // Check suspicious countries (if enabled)
    if (context.countryCode && this.isSuspiciousCountry(context.countryCode)) {
      await SecureLogger.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        details: {
          ipAddress: context.ipAddress,
          countryCode: context.countryCode,
          reason: 'Suspicious geolocation'
        }
      }, request)
    }

    return null
  }

  /**
   * Request size validation
   */
  private static async checkRequestSize(
    request: NextRequest,
    config: SecurityConfig
  ): Promise<NextResponse | null> {
    const contentLength = request.headers.get('content-length')
    
    if (contentLength && parseInt(contentLength) > config.maxRequestSize) {
      const t = await getTranslations({ 
        locale: this.getRequestLocale(request), 
        namespace: 'errors' 
      })
      
      return this.createSecurityResponse(
        request,
        t('security.requestTooLarge'),
        413
      )
    }

    return null
  }

  /**
   * Advanced suspicious activity detection
   */
  private static async checkSuspiciousActivity(
    request: NextRequest,
    context: SecurityContext
  ): Promise<NextResponse | null> {
    let suspicionPoints = 0
    const reasons: string[] = []

    // High risk score
    if (context.riskScore > 0.8) {
      suspicionPoints += 3
      reasons.push('High risk score')
    }

    // Suspicious user agent patterns
    if (this.hasSuspiciousUserAgent(context.userAgent)) {
      suspicionPoints += 2
      reasons.push('Suspicious user agent')
    }

    // Bot detection (non-legitimate bots)
    if (context.isBot && !this.isLegitimateBot(context.userAgent)) {
      suspicionPoints += 2
      reasons.push('Malicious bot detected')
    }

    // Suspicious request patterns
    if (this.hasSuspiciousRequestPattern(request)) {
      suspicionPoints += 2
      reasons.push('Suspicious request pattern')
    }

    // SQL injection attempts
    if (this.detectSQLInjection(request)) {
      suspicionPoints += 5
      reasons.push('SQL injection attempt')
    }

    // XSS attempts
    if (this.detectXSSAttempt(request)) {
      suspicionPoints += 5
      reasons.push('XSS attempt')
    }

    if (suspicionPoints >= 5) {
      await SecureLogger.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: suspicionPoints >= 8 ? 'CRITICAL' : 'HIGH',
        details: {
          suspicionPoints,
          reasons,
          userAgent: context.userAgent,
          path: request.nextUrl.pathname
        },
        actionRequired: suspicionPoints >= 8
      }, request)

      const t = await getTranslations({ locale: context.locale, namespace: 'errors' })
      return this.createSecurityResponse(request, t('security.suspiciousActivity'), 403)
    }

    return null
  }

  /**
   * Request sanitization
   */
  private static async sanitizeRequest(
    request: NextRequest,
    config: SecurityConfig
  ): Promise<NextResponse | null> {
    if (!config.enableRequestSanitization) return null

    try {
      // Sanitize query parameters
      const url = new URL(request.url)
      const originalParams = Object.fromEntries(url.searchParams.entries())
      const sanitizedParams = InputSanitizer.sanitizeQueryParams(originalParams)
      
      // Check if sanitization changed anything
      const hasChanges = JSON.stringify(originalParams) !== JSON.stringify(sanitizedParams)
      
      if (hasChanges) {
        await SecureLogger.log({
          level: 'WARN',
          category: 'SECURITY',
          message: 'Request parameters sanitized',
          details: {
            original: originalParams,
            sanitized: sanitizedParams,
            path: request.nextUrl.pathname
          },
          ipAddress: this.getClientIP(request),
          locale: this.getRequestLocale(request)
        })
      }

    } catch (error) {
      console.error('Request sanitization failed:', error)
    }

    return null
  }

  /**
   * Add comprehensive security headers
   */
  private static addSecurityHeaders(
    request: NextRequest,
    response: NextResponse | null,
    config: SecurityConfig
  ): NextResponse {
    const res = response || NextResponse.next()

    if (!config.enableSecurityHeaders) return res

    // Content Security Policy
    if (config.enableCSP) {
      res.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https: blob:; " +
        "connect-src 'self' https: wss:; " +
        "media-src 'self' https: blob:; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'"
      )
    }

    // Security headers
    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('X-XSS-Protection', '1; mode=block')
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    
    // HSTS (only in production with HTTPS)
    if (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:') {
      res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }

    // CORS headers
    const origin = request.headers.get('origin')
    if (origin && config.allowedOrigins.includes(origin)) {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    return res
  }

  /**
   * Calculate risk score based on multiple factors
   */
  private static async calculateRiskScore(
    request: NextRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<number> {
    let score = 0

    // Recent failed attempts from this IP
    const recentFailures = await this.getRecentFailures(ipAddress)
    score += Math.min(recentFailures * 0.1, 0.3)

    // User agent analysis
    if (!userAgent || userAgent.length < 10) score += 0.2
    if (this.hasSuspiciousUserAgent(userAgent)) score += 0.3
    if (this.detectBot(userAgent) && !this.isLegitimateBot(userAgent)) score += 0.4

    // Request patterns
    if (this.hasSuspiciousRequestPattern(request)) score += 0.2

    // Time-based analysis (unusual hours)
    const hour = new Date().getHours()
    if (hour < 6 || hour > 22) score += 0.1

    return Math.min(score, 1.0)
  }

  // Helper methods
  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cloudflareIP = request.headers.get('cf-connecting-ip')
    
    if (cloudflareIP) return cloudflareIP
    if (forwarded) return forwarded.split(',')[0].trim()
    if (realIP) return realIP
    
    return 'unknown'
  }

  private static getRequestLocale(request: NextRequest): string {
    const cookieLocale = request.cookies.get('PREFERRED_LOCALE')?.value
    const headerLocale = request.headers.get('accept-language')?.split(',')[0]?.split('-')[0]
    return cookieLocale || headerLocale || 'pt'
  }

  private static getRateLimitForEndpoint(pathname: string, context: SecurityContext): number {
    // Bot-specific limits
    if (context.isBot) return 10
    
    // Endpoint-specific limits
    if (pathname.includes('/api/v1/')) return 100
    if (pathname.includes('/auth/')) return 20
    if (pathname.includes('/upload')) return 10
    
    return 200 // Default limit
  }

  private static detectBot(userAgent: string): boolean {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
      /axios/i, /python/i, /java/i, /go-http/i, /postman/i
    ]
    
    return botPatterns.some(pattern => pattern.test(userAgent))
  }

  private static isLegitimateBot(userAgent: string): boolean {
    const legitimateBots = [
      /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
      /baiduspider/i, /yandexbot/i, /facebookexternalhit/i,
      /twitterbot/i, /linkedinbot/i, /whatsapp/i
    ]
    
    return legitimateBots.some(pattern => pattern.test(userAgent))
  }

  private static hasSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /sqlmap/i, /nikto/i, /nessus/i, /masscan/i, /nmap/i,
      /\<script\>/i, /javascript:/i, /vbscript:/i, /onload=/i
    ]
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent))
  }

  private static hasSuspiciousRequestPattern(request: NextRequest): boolean {
    const path = request.nextUrl.pathname
    const query = request.nextUrl.search
    
    // Directory traversal attempts
    if (path.includes('../') || path.includes('..\\')) return true
    
    // Common attack paths
    const suspiciousPaths = ['/admin', '/.env', '/config', '/backup', '/phpmyadmin', '/wp-admin']
    if (suspiciousPaths.some(p => path.includes(p))) return true
    
    // Suspicious query parameters
    if (query.includes('<script>') || query.includes('javascript:')) return true
    
    return false
  }

  private static detectSQLInjection(request: NextRequest): boolean {
    const searchString = request.nextUrl.search.toLowerCase()
    const sqlPatterns = [
      /union\s+select/i, /or\s+1\s*=\s*1/i, /drop\s+table/i,
      /insert\s+into/i, /delete\s+from/i, /update\s+set/i,
      /exec\s*\(/i, /sleep\s*\(/i, /benchmark\s*\(/i
    ]
    
    return sqlPatterns.some(pattern => pattern.test(searchString))
  }

  private static detectXSSAttempt(request: NextRequest): boolean {
    const searchString = request.nextUrl.search
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /eval\s*\(/gi,
      document.createElement
    ]
    
    return xssPatterns.some(pattern => 
      typeof pattern === 'string' ? 
        searchString.includes(pattern) : 
        pattern.test(searchString)
    )
  }

  private static async getCountryCode(ipAddress: string): Promise<string | undefined> {
    // TODO: Implement geolocation lookup (use CloudflareCountry header or GeoIP service)
    return undefined
  }

  private static isSuspiciousCountry(countryCode: string): boolean {
    // TODO: Implement country-based risk assessment
    const highRiskCountries = ['CN', 'RU', 'KP'] // Example
    return highRiskCountries.includes(countryCode)
  }

  private static async getRecentFailures(ipAddress: string): Promise<number> {
    // TODO: Implement failure counting from database
    return 0
  }

  private static getCheckName(index: number): string {
    const checks = ['rate_limit', 'ip_restrictions', 'request_size', 'suspicious_activity', 'sanitization']
    return checks[index] || 'unknown'
  }

  private static async handleSecurityViolation(
    request: NextRequest,
    context: SecurityContext,
    checkName: string,
    reason: any
  ): Promise<void> {
    await SecureLogger.logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS',
      severity: 'MEDIUM',
      details: {
        check: checkName,
        reason: reason instanceof Error ? reason.message : String(reason),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        path: request.nextUrl.pathname
      }
    }, request)
  }

  private static async createSecurityResponse(
    request: NextRequest,
    message: string,
    status: number,
    additionalHeaders: Record<string, string> = {}
  ): Promise<NextResponse> {
    const locale = this.getRequestLocale(request)
    
    const response = NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      },
      { status }
    )

    // Add additional headers
    Object.entries(additionalHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }
}