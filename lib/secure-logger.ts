import { NextRequest } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { InputSanitizer } from './input-sanitizer'
import { supabase } from './supabase'
import { nanoid } from 'nanoid'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
export type LogCategory = 'AUTH' | 'API' | 'SECURITY' | 'INTEGRATION' | 'SYSTEM' | 'USER_ACTION'

export interface LogEntry {
  id?: string
  level: LogLevel
  category: LogCategory
  message: string
  details?: Record<string, any>
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  locale?: string
  timestamp?: string
  correlationId?: string
}

export interface SecurityEvent {
  type: 'LOGIN_FAILED' | 'TOKEN_EXPIRED' | 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY' | 'DATA_BREACH_ATTEMPT' | 'UNAUTHORIZED_ACCESS'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  userId?: string
  details: Record<string, any>
  actionRequired?: boolean
}

/**
 * Secure logging system with multilingual support and LGPD/GDPR compliance
 */
export class SecureLogger {
  private static readonly MAX_LOG_LENGTH = 10000
  private static readonly SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'key', 'authorization',
    'access_token', 'refresh_token', 'client_secret', 'api_key',
    'private_key', 'certificate', 'passphrase', 'credit_card',
    'ssn', 'cpf', 'cnpj', 'phone', 'email'
  ]

  /**
   * Main logging method with automatic sanitization
   */
  static async log(entry: LogEntry): Promise<void> {
    try {
      // Generate unique ID
      const logId = entry.id || nanoid()
      
      // Sanitize and prepare log entry
      const sanitizedEntry: LogEntry = {
        id: logId,
        level: entry.level,
        category: entry.category,
        message: this.truncateMessage(entry.message),
        details: entry.details ? InputSanitizer.sanitizeForLogging(entry.details) : undefined,
        userId: entry.userId,
        sessionId: entry.sessionId,
        ipAddress: entry.ipAddress ? this.hashIP(entry.ipAddress) : undefined, // Hash IP for privacy
        userAgent: entry.userAgent ? this.sanitizeUserAgent(entry.userAgent) : undefined,
        locale: entry.locale || 'pt',
        timestamp: entry.timestamp || new Date().toISOString(),
        correlationId: entry.correlationId
      }

      // Store in database
      await this.storeLog(sanitizedEntry)
      
      // Handle critical logs
      if (entry.level === 'CRITICAL' || entry.level === 'ERROR') {
        await this.handleCriticalLog(sanitizedEntry)
      }
      
      // Console log for development
      if (process.env.NODE_ENV === 'development') {
        this.consoleLog(sanitizedEntry)
      }

    } catch (error) {
      console.error('Failed to log entry:', error)
      // Fallback to console in case of logging system failure
      console.log('FALLBACK LOG:', {
        level: entry.level,
        category: entry.category,
        message: entry.message,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Log security events with automatic threat detection
   */
  static async logSecurityEvent(event: SecurityEvent, request?: NextRequest): Promise<void> {
    const locale = request ? this.getRequestLocale(request) : 'pt'
    const t = await getTranslations({ locale, namespace: 'security' })
    
    const logEntry: LogEntry = {
      level: this.getLogLevelForSeverity(event.severity),
      category: 'SECURITY',
      message: t(`events.${event.type.toLowerCase()}` as any) || `Security event: ${event.type}`,
      details: {
        eventType: event.type,
        severity: event.severity,
        actionRequired: event.actionRequired,
        ...InputSanitizer.sanitizeForLogging(event.details)
      },
      userId: event.userId,
      sessionId: request ? this.getSessionId(request) : undefined,
      ipAddress: request ? this.getClientIP(request) : undefined,
      userAgent: request?.headers.get('user-agent') || undefined,
      locale,
      correlationId: nanoid()
    }

    await this.log(logEntry)

    // Trigger security alerts for high severity events
    if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
      await this.triggerSecurityAlert(event, logEntry)
    }
  }

  /**
   * Log user actions with privacy compliance
   */
  static async logUserAction(
    action: string,
    userId: string,
    details: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    const locale = request ? this.getRequestLocale(request) : 'pt'
    
    await this.log({
      level: 'INFO',
      category: 'USER_ACTION',
      message: `User action: ${action}`,
      details: {
        action,
        ...InputSanitizer.sanitizeForLogging(details)
      },
      userId,
      sessionId: request ? this.getSessionId(request) : undefined,
      ipAddress: request ? this.getClientIP(request) : undefined,
      userAgent: request?.headers.get('user-agent') || undefined,
      locale,
      correlationId: nanoid()
    })
  }

  /**
   * Log API requests with performance metrics
   */
  static async logAPIRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    request?: NextRequest
  ): Promise<void> {
    const level: LogLevel = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO'
    
    await this.log({
      level,
      category: 'API',
      message: `${method} ${endpoint} - ${statusCode} (${responseTime}ms)`,
      details: {
        endpoint,
        method,
        statusCode,
        responseTime,
        isError: statusCode >= 400
      },
      userId,
      sessionId: request ? this.getSessionId(request) : undefined,
      ipAddress: request ? this.getClientIP(request) : undefined,
      userAgent: request?.headers.get('user-agent') || undefined,
      locale: request ? this.getRequestLocale(request) : 'pt',
      correlationId: nanoid()
    })
  }

  /**
   * Log integration events (OAuth, API connections, etc.)
   */
  static async logIntegrationEvent(
    platform: string,
    event: string,
    success: boolean,
    userId: string,
    details?: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    await this.log({
      level: success ? 'INFO' : 'WARN',
      category: 'INTEGRATION',
      message: `${platform} integration: ${event}`,
      details: {
        platform,
        event,
        success,
        ...InputSanitizer.sanitizeForLogging(details || {})
      },
      userId,
      sessionId: request ? this.getSessionId(request) : undefined,
      ipAddress: request ? this.getClientIP(request) : undefined,
      userAgent: request?.headers.get('user-agent') || undefined,
      locale: request ? this.getRequestLocale(request) : 'pt',
      correlationId: nanoid()
    })
  }

  /**
   * Store log entry in database
   */
  private static async storeLog(entry: LogEntry): Promise<void> {
    await supabase.from('security_logs').insert({
      id: entry.id,
      level: entry.level,
      category: entry.category,
      message: entry.message,
      details: entry.details,
      user_id: entry.userId,
      session_id: entry.sessionId,
      ip_address_hash: entry.ipAddress,
      user_agent_hash: entry.userAgent,
      locale: entry.locale,
      timestamp: entry.timestamp,
      correlation_id: entry.correlationId
    })
  }

  /**
   * Handle critical log entries
   */
  private static async handleCriticalLog(entry: LogEntry): Promise<void> {
    // Store in high-priority audit table
    await supabase.from('critical_security_events').insert({
      log_id: entry.id,
      level: entry.level,
      category: entry.category,
      message: entry.message,
      details: entry.details,
      user_id: entry.userId,
      requires_review: true,
      timestamp: entry.timestamp
    })

    // Send immediate alert to security team (placeholder)
    console.error('CRITICAL SECURITY EVENT:', {
      id: entry.id,
      message: entry.message,
      timestamp: entry.timestamp
    })
  }

  /**
   * Trigger security alert for high-severity events
   */
  private static async triggerSecurityAlert(
    event: SecurityEvent,
    logEntry: LogEntry
  ): Promise<void> {
    // Create security alert record
    await supabase.from('security_alerts').insert({
      id: nanoid(),
      event_type: event.type,
      severity: event.severity,
      log_id: logEntry.id,
      user_id: event.userId,
      description: logEntry.message,
      status: 'OPEN',
      action_required: event.actionRequired || false,
      created_at: new Date().toISOString()
    })

    // TODO: Integrate with external alerting system (email, Slack, etc.)
    console.warn('SECURITY ALERT TRIGGERED:', {
      type: event.type,
      severity: event.severity,
      userId: event.userId
    })
  }

  /**
   * Get log level for security event severity
   */
  private static getLogLevelForSeverity(severity: SecurityEvent['severity']): LogLevel {
    switch (severity) {
      case 'LOW': return 'INFO'
      case 'MEDIUM': return 'WARN'
      case 'HIGH': return 'ERROR'
      case 'CRITICAL': return 'CRITICAL'
    }
  }

  /**
   * Hash IP address for privacy compliance
   */
  private static hashIP(ip: string): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(ip + process.env.IP_HASH_SALT || 'default-salt').digest('hex').substring(0, 16)
  }

  /**
   * Sanitize user agent string
   */
  private static sanitizeUserAgent(userAgent: string): string {
    // Hash long user agent strings for privacy
    if (userAgent.length > 200) {
      const crypto = require('crypto')
      return crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 32)
    }
    return userAgent
  }

  /**
   * Truncate message to prevent log overflow
   */
  private static truncateMessage(message: string): string {
    if (message.length <= this.MAX_LOG_LENGTH) {
      return message
    }
    return message.substring(0, this.MAX_LOG_LENGTH - 3) + '...'
  }

  /**
   * Console logging for development
   */
  private static consoleLog(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp!).toISOString()
    const logMessage = `[${timestamp}] ${entry.level} ${entry.category}: ${entry.message}`
    
    switch (entry.level) {
      case 'DEBUG':
        console.debug(logMessage, entry.details)
        break
      case 'INFO':
        console.info(logMessage, entry.details)
        break
      case 'WARN':
        console.warn(logMessage, entry.details)
        break
      case 'ERROR':
      case 'CRITICAL':
        console.error(logMessage, entry.details)
        break
    }
  }

  /**
   * Get client IP with multiple fallbacks
   */
  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cloudflareIP = request.headers.get('cf-connecting-ip')
    
    if (cloudflareIP) return cloudflareIP
    if (forwarded) return forwarded.split(',')[0].trim()
    if (realIP) return realIP
    
    return 'unknown'
  }

  /**
   * Get session ID from request
   */
  private static getSessionId(request: NextRequest): string | undefined {
    return request.cookies.get('session_id')?.value || 
           request.headers.get('x-session-id') || 
           undefined
  }

  /**
   * Get locale from request
   */
  private static getRequestLocale(request: NextRequest): string {
    const cookieLocale = request.cookies.get('PREFERRED_LOCALE')?.value
    const headerLocale = request.headers.get('accept-language')?.split(',')[0]?.split('-')[0]
    return cookieLocale || headerLocale || 'pt'
  }

  /**
   * LGPD/GDPR compliance: Get user logs with proper filtering
   */
  static async getUserLogs(
    userId: string,
    options: {
      startDate?: string
      endDate?: string
      categories?: LogCategory[]
      includeDetails?: boolean
      limit?: number
    } = {}
  ): Promise<LogEntry[]> {
    let query = supabase
      .from('security_logs')
      .select(`
        id,
        level,
        category,
        message,
        ${options.includeDetails ? 'details,' : ''}
        timestamp,
        locale
      `)
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })

    if (options.startDate) {
      query = query.gte('timestamp', options.startDate)
    }
    
    if (options.endDate) {
      query = query.lte('timestamp', options.endDate)
    }
    
    if (options.categories?.length) {
      query = query.in('category', options.categories)
    }
    
    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data } = await query
    return data || []
  }

  /**
   * LGPD/GDPR compliance: Delete user logs
   */
  static async deleteUserLogs(userId: string): Promise<void> {
    await supabase
      .from('security_logs')
      .delete()
      .eq('user_id', userId)
  }
}