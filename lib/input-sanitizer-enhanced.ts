import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'

/**
 * Enhanced input sanitization with XSS protection
 */

interface SanitizeOptions {
  maxLength?: number
  allowHtml?: boolean
  removeEmpty?: boolean
  trimWhitespace?: boolean
}

/**
 * Sanitizes general text input
 */
export function sanitizeText(
  input: unknown, 
  options: SanitizeOptions = {}
): string {
  const {
    maxLength = 10000,
    allowHtml = false,
    removeEmpty = true,
    trimWhitespace = true
  } = options
  
  // Handle non-string inputs
  if (typeof input !== 'string') {
    if (input === null || input === undefined) return ''
    input = String(input)
  }
  
  let text = input as string
  
  // Trim whitespace if requested
  if (trimWhitespace) {
    text = text.trim()
  }
  
  // Remove empty strings if requested
  if (removeEmpty && text === '') {
    return ''
  }
  
  // Truncate to max length
  if (text.length > maxLength) {
    text = text.substring(0, maxLength)
  }
  
  // Sanitize HTML content
  if (allowHtml) {
    text = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target'],
      ALLOW_DATA_ATTR: false
    })
  } else {
    // Remove all HTML tags
    text = text.replace(/<[^>]*>/g, '')
  }
  
  // Remove potentially dangerous characters
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  return text
}

/**
 * Sanitizes URLs with validation
 */
export function sanitizeUrl(input: unknown): string {
  if (typeof input !== 'string') return ''
  
  const url = sanitizeText(input, { maxLength: 2048 })
  
  // Validate URL format
  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_host: true,
    require_valid_protocol: true,
    allow_underscores: false,
    host_whitelist: [],
    host_blacklist: [],
    allow_trailing_dot: false,
    allow_protocol_relative_urls: false,
    disallow_auth: true
  })) {
    return ''
  }
  
  return url
}

/**
 * Sanitizes email addresses
 */
export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return ''
  
  const email = sanitizeText(input, { maxLength: 254 }).toLowerCase()
  
  if (!validator.isEmail(email)) {
    return ''
  }
  
  return email
}

/**
 * Sanitizes numeric input
 */
export function sanitizeNumber(
  input: unknown, 
  options: { min?: number; max?: number; integer?: boolean } = {}
): number | null {
  const { min, max, integer = false } = options
  
  let num: number
  
  if (typeof input === 'number') {
    num = input
  } else if (typeof input === 'string') {
    const parsed = integer ? parseInt(input, 10) : parseFloat(input)
    if (isNaN(parsed)) return null
    num = parsed
  } else {
    return null
  }
  
  // Check bounds
  if (min !== undefined && num < min) return null
  if (max !== undefined && num > max) return null
  
  // Check if it's a valid finite number
  if (!isFinite(num)) return null
  
  return num
}

/**
 * Sanitizes boolean input
 */
export function sanitizeBoolean(input: unknown): boolean {
  if (typeof input === 'boolean') return input
  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim()
    if (lower === 'true' || lower === '1' || lower === 'yes') return true
    if (lower === 'false' || lower === '0' || lower === 'no') return false
  }
  if (typeof input === 'number') {
    return input !== 0
  }
  return false
}

/**
 * Sanitizes array input
 */
export function sanitizeArray<T>(
  input: unknown, 
  itemSanitizer: (item: unknown) => T | null,
  maxItems: number = 100
): T[] {
  if (!Array.isArray(input)) return []
  
  const sanitized: T[] = []
  
  for (let i = 0; i < Math.min(input.length, maxItems); i++) {
    const sanitizedItem = itemSanitizer(input[i])
    if (sanitizedItem !== null) {
      sanitized.push(sanitizedItem)
    }
  }
  
  return sanitized
}

/**
 * Sanitizes object input with schema validation
 */
export function sanitizeObject<T extends Record<string, any>>(
  input: unknown,
  schema: Record<keyof T, (value: unknown) => T[keyof T] | null>
): Partial<T> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }
  
  const sanitized: Partial<T> = {}
  const obj = input as Record<string, unknown>
  
  for (const [key, sanitizer] of Object.entries(schema)) {
    if (key in obj) {
      const sanitizedValue = sanitizer(obj[key])
      if (sanitizedValue !== null) {
        sanitized[key as keyof T] = sanitizedValue
      }
    }
  }
  
  return sanitized
}

/**
 * Sanitizes OAuth-specific parameters
 */
export function sanitizeOAuthCode(code: unknown): string {
  if (typeof code !== 'string') return ''
  
  const sanitized = sanitizeText(code, { maxLength: 2048 })
  
  // OAuth codes should only contain alphanumeric chars and specific symbols
  if (!/^[a-zA-Z0-9._-]+$/.test(sanitized)) {
    return ''
  }
  
  return sanitized
}

/**
 * Sanitizes OAuth state parameter
 */
export function sanitizeOAuthState(state: unknown): string {
  if (typeof state !== 'string') return ''
  
  const sanitized = sanitizeText(state, { maxLength: 512 })
  
  // State should be base64url encoded
  if (!/^[a-zA-Z0-9._-]+$/.test(sanitized)) {
    return ''
  }
  
  return sanitized
}

/**
 * Sanitizes API tokens
 */
export function sanitizeApiToken(token: unknown): string {
  if (typeof token !== 'string') return ''
  
  const sanitized = sanitizeText(token, { maxLength: 4096 })
  
  // Remove any suspicious characters that shouldn't be in tokens
  return sanitized.replace(/[<>"'&]/g, '')
}

/**
 * Sanitizes Instagram-specific data
 */
export function sanitizeInstagramData(data: unknown): {
  appId?: string
  appSecret?: string
  accessToken?: string
  businessAccountId?: string
  permissions?: string[]
} {
  return sanitizeObject(data, {
    appId: (val) => {
      const sanitized = sanitizeText(val, { maxLength: 100 })
      return /^\d+$/.test(sanitized) ? sanitized : null
    },
    appSecret: (val) => sanitizeApiToken(val) || null,
    accessToken: (val) => sanitizeApiToken(val) || null,
    businessAccountId: (val) => {
      const sanitized = sanitizeText(val, { maxLength: 100 })
      return /^\d+$/.test(sanitized) ? sanitized : null
    },
    permissions: (val) => sanitizeArray(val, (item) => {
      const perm = sanitizeText(item, { maxLength: 100 })
      return /^[a-z_]+$/.test(perm) ? perm : null
    }, 20)
  })
}

/**
 * Sanitizes Facebook-specific data
 */
export function sanitizeFacebookData(data: unknown): {
  appId?: string
  appSecret?: string
  accessToken?: string
  permissions?: string[]
  pages?: Array<{
    id: string
    name: string
    accessToken: string
    category: string
    isActive: boolean
  }>
} {
  return sanitizeObject(data, {
    appId: (val) => {
      const sanitized = sanitizeText(val, { maxLength: 100 })
      return /^\d+$/.test(sanitized) ? sanitized : null
    },
    appSecret: (val) => sanitizeApiToken(val) || null,
    accessToken: (val) => sanitizeApiToken(val) || null,
    permissions: (val) => sanitizeArray(val, (item) => {
      const perm = sanitizeText(item, { maxLength: 100 })
      return /^[a-z_]+$/.test(perm) ? perm : null
    }, 20),
    pages: (val) => sanitizeArray(val, (page) => {
      const sanitizedPage = sanitizeObject(page, {
        id: (id) => {
          const sanitized = sanitizeText(id, { maxLength: 100 })
          return /^\d+$/.test(sanitized) ? sanitized : null
        },
        name: (name) => sanitizeText(name, { maxLength: 200 }) || null,
        accessToken: (token) => sanitizeApiToken(token) || null,
        category: (cat) => sanitizeText(cat, { maxLength: 100 }) || null,
        isActive: (active) => sanitizeBoolean(active)
      })
      
      return (sanitizedPage.id && sanitizedPage.name && sanitizedPage.accessToken) 
        ? sanitizedPage as any : null
    }, 50)
  })
}

/**
 * Sanitizes webhook payload
 */
export function sanitizeWebhookPayload(payload: unknown): Record<string, any> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {}
  }
  
  const sanitized: Record<string, any> = {}
  const obj = payload as Record<string, unknown>
  
  // Only allow specific webhook fields
  const allowedFields = [
    'object', 'entry', 'id', 'time', 'changes', 'field', 'value',
    'verb', 'item', 'user_id', 'media_id', 'comment_id'
  ]
  
  for (const field of allowedFields) {
    if (field in obj) {
      if (typeof obj[field] === 'string') {
        sanitized[field] = sanitizeText(obj[field], { maxLength: 1000 })
      } else if (typeof obj[field] === 'number') {
        sanitized[field] = sanitizeNumber(obj[field])
      } else if (Array.isArray(obj[field])) {
        sanitized[field] = sanitizeArray(obj[field], (item) => {
          if (typeof item === 'object') {
            return sanitizeWebhookPayload(item)
          }
          return sanitizeText(item, { maxLength: 500 })
        }, 100)
      } else if (typeof obj[field] === 'object') {
        sanitized[field] = sanitizeWebhookPayload(obj[field])
      }
    }
  }
  
  return sanitized
}