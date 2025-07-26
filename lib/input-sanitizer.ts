import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'
import { z } from 'zod'

export interface SanitizationOptions {
  allowHtml?: boolean
  maxLength?: number
  allowedTags?: string[]
  encodeEntities?: boolean
}

export class InputSanitizer {
  /**
   * Sanitiza string removendo XSS e validando
   */
  static sanitizeString(
    input: unknown, 
    options: SanitizationOptions = {}
  ): string {
    if (typeof input !== 'string') {
      return ''
    }
    
    const {
      allowHtml = false,
      maxLength = 1000,
      allowedTags = [],
      encodeEntities = true
    } = options
    
    let sanitized = input.trim()
    
    // 1. Limitar comprimento
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength)
    }
    
    // 2. Sanitizar HTML se permitido
    if (allowHtml && allowedTags.length > 0) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: ['href', 'title', 'alt'],
        KEEP_CONTENT: true
      })
    } else if (!allowHtml) {
      // Remover todas as tags HTML
      sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] })
    }
    
    // 3. Escapar entidades se necessário
    if (encodeEntities) {
      sanitized = validator.escape(sanitized)
    }
    
    // 4. Normalizar espaços em branco
    sanitized = sanitized.replace(/\s+/g, ' ').trim()
    
    return sanitized
  }

  /**
   * Sanitiza objetos recursivamente
   */
  static sanitizeObject(
    obj: any, 
    schema?: z.ZodSchema
  ): any {
    if (obj === null || obj === undefined) {
      return obj
    }
    
    if (typeof obj === 'string') {
      return this.sanitizeString(obj)
    }
    
    if (typeof obj === 'number') {
      return isFinite(obj) ? obj : 0
    }
    
    if (typeof obj === 'boolean') {
      return obj
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, schema))
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {}
      
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key, { maxLength: 100 })
        if (sanitizedKey) {
          sanitized[sanitizedKey] = this.sanitizeObject(value, schema)
        }
      }
      
      // Validar com schema se fornecido
      if (schema) {
        try {
          return schema.parse(sanitized)
        } catch (error) {
          console.warn('Schema validation failed:', error)
          return sanitized
        }
      }
      
      return sanitized
    }
    
    return obj
  }

  /**
   * Sanitiza dados de publicação do TikTok
   */
  static sanitizeTikTokPublishData(data: any) {
    const schema = z.object({
      caption: z.string()
        .max(2200, 'Caption too long')
        .transform(str => this.sanitizeString(str, { maxLength: 2200 })),
      
      mediaUrl: z.string()
        .url('Invalid media URL')
        .refine(url => url.startsWith('https://'), 'HTTPS required'),
      
      settings: z.object({
        privacy: z.enum(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY']),
        allowComments: z.boolean(),
        allowDuet: z.boolean(),
        allowStitch: z.boolean(),
        coverTimestamp: z.number().min(0).max(3600).optional()
      })
    })
    
    return schema.parse(data)
  }

  /**
   * Valida e sanitiza dados de API Key
   */
  static sanitizeAPIKeyData(data: any) {
    const schema = z.object({
      name: z.string()
        .min(3).max(50)
        .regex(/^[a-zA-Z0-9\s\-_]+$/)
        .transform(str => this.sanitizeString(str, { maxLength: 50 })),
      
      description: z.string()
        .max(200)
        .optional()
        .transform(str => str ? this.sanitizeString(str, { maxLength: 200 }) : undefined),
      
      platforms: z.array(z.enum(['tiktok', 'instagram', 'facebook', 'youtube']))
        .min(1).max(4),
      
      scopes: z.array(z.enum(['read', 'publish', 'analytics', 'manage']))
        .min(1).max(4),
      
      expiresInDays: z.number().int().min(1).max(365).optional(),
      rateLimitPerHour: z.number().int().min(1).max(10000).optional(),
      allowedIPs: z.array(z.string().ip()).max(10).optional()
    })
    
    return schema.parse(data)
  }

  /**
   * Sanitiza dados do perfil de usuário
   */
  static sanitizeUserProfileData(data: any) {
    const schema = z.object({
      full_name: z.string()
        .min(2).max(100)
        .transform(str => this.sanitizeString(str, { maxLength: 100 })),
      
      email: z.string()
        .email()
        .transform(str => validator.normalizeEmail(str) || str),
      
      avatar_url: z.string()
        .url()
        .optional()
        .transform(url => url && url.startsWith('https://') ? url : undefined),
      
      preferred_language: z.enum(['pt', 'en', 'es', 'ja', 'zh-CN', 'zh-TW', 'ko'])
    })
    
    return schema.parse(data)
  }

  /**
   * Sanitiza dados de conexão social
   */
  static sanitizeSocialConnectionData(data: any) {
    const schema = z.object({
      platform: z.enum(['tiktok', 'instagram', 'facebook', 'youtube']),
      username: z.string()
        .min(1).max(50)
        .transform(str => this.sanitizeString(str, { 
          maxLength: 50, 
          encodeEntities: false // Usernames não precisam escapar HTML
        })),
      
      display_name: z.string()
        .max(100)
        .optional()
        .transform(str => str ? this.sanitizeString(str, { maxLength: 100 }) : undefined),
      
      avatar_url: z.string()
        .url()
        .optional()
        .transform(url => url && url.startsWith('https://') ? url : undefined),
      
      follower_count: z.number().int().min(0).optional(),
      following_count: z.number().int().min(0).optional(),
      is_verified: z.boolean().optional()
    })
    
    return schema.parse(data)
  }

  /**
   * Sanitiza query parameters da URL
   */
  static sanitizeQueryParams(params: Record<string, any>) {
    const sanitized: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(params)) {
      const cleanKey = this.sanitizeString(key, { maxLength: 50 })
      if (cleanKey) {
        if (typeof value === 'string') {
          sanitized[cleanKey] = this.sanitizeString(value, { maxLength: 200 })
        } else if (typeof value === 'number' && isFinite(value)) {
          sanitized[cleanKey] = value
        } else if (typeof value === 'boolean') {
          sanitized[cleanKey] = value
        }
      }
    }
    
    return sanitized
  }

  /**
   * Valida e sanitiza dados de configuração de integração
   */
  static sanitizeIntegrationConfig(data: any) {
    const schema = z.object({
      platform: z.enum(['tiktok', 'instagram', 'facebook', 'youtube']),
      app_id: z.string().min(1).max(200),
      client_secret: z.string().min(1).max(500),
      webhook_url: z.string().url().optional(),
      is_active: z.boolean().default(true),
      settings: z.record(z.any()).optional()
    })
    
    return schema.parse(data)
  }

  /**
   * Remove campos sensíveis de objetos para logs
   */
  static sanitizeForLogging(obj: any): any {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization',
      'access_token', 'refresh_token', 'client_secret', 'api_key',
      'private_key', 'certificate', 'passphrase'
    ]
    
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForLogging(item))
    }

    const sanitized = { ...obj }
    
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase()
      
      // Remover campos sensíveis
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]'
        continue
      }
      
      // Sanitizar recursivamente
      if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeForLogging(sanitized[key])
      }
      
      // Mascarar dados que parecem tokens
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 30) {
        const str = sanitized[key]
        if (/^[a-zA-Z0-9_\-\.]+$/.test(str)) {
          sanitized[key] = str.substring(0, 8) + '[MASKED]' + str.substring(str.length - 4)
        }
      }
    }
    
    return sanitized
  }

  /**
   * Valida email com múltiplas verificações
   */
  static validateEmail(email: string): { valid: boolean; normalized?: string; error?: string } {
    if (!email) {
      return { valid: false, error: 'Email is required' }
    }
    
    // Sanitizar
    const sanitized = this.sanitizeString(email, { maxLength: 254, encodeEntities: false })
    
    // Validar formato
    if (!validator.isEmail(sanitized)) {
      return { valid: false, error: 'Invalid email format' }
    }
    
    // Normalizar
    const normalized = validator.normalizeEmail(sanitized)
    if (!normalized) {
      return { valid: false, error: 'Email normalization failed' }
    }
    
    // Verificar domínios suspeitos
    const suspiciousDomains = ['tempmail.org', '10minutemail.com', 'mailinator.com']
    const domain = normalized.split('@')[1]
    if (suspiciousDomains.includes(domain)) {
      return { valid: false, error: 'Temporary email addresses not allowed' }
    }
    
    return { valid: true, normalized }
  }

  /**
   * Valida URL com verificações de segurança
   */
  static validateURL(url: string): { valid: boolean; sanitized?: string; error?: string } {
    if (!url) {
      return { valid: false, error: 'URL is required' }
    }
    
    // Sanitizar
    const sanitized = this.sanitizeString(url, { maxLength: 2048, encodeEntities: false })
    
    // Validar formato
    if (!validator.isURL(sanitized, { 
      protocols: ['https'],
      require_protocol: true,
      require_valid_protocol: true
    })) {
      return { valid: false, error: 'Invalid URL format or protocol' }
    }
    
    // Verificar domínios maliciosos (lista básica)
    const maliciousDomains = ['bit.ly', 'tinyurl.com', 'short.link']
    try {
      const urlObj = new URL(sanitized)
      if (maliciousDomains.includes(urlObj.hostname)) {
        return { valid: false, error: 'URL shorteners not allowed' }
      }
    } catch {
      return { valid: false, error: 'Invalid URL' }
    }
    
    return { valid: true, sanitized }
  }
}

// Função helper para uso simples
export function sanitizeInput(input: any, options?: SanitizationOptions): any {
  return InputSanitizer.sanitizeObject(input)
}