import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'
import { InputSanitizer } from './input-sanitizer'

/**
 * Comprehensive validation schemas for comments system
 * Enhanced with XSS protection and SQL injection prevention
 */

// Base sanitization options for comments
const COMMENT_SANITIZATION_OPTIONS = {
  allowHtml: false,
  maxLength: 10000,
  encodeEntities: true
}

// Allowed platforms
const PLATFORMS = ['instagram', 'tiktok', 'facebook'] as const
type Platform = typeof PLATFORMS[number]

// Comment status options
const COMMENT_STATUSES = ['pending', 'approved', 'rejected', 'spam'] as const
type CommentStatus = typeof COMMENT_STATUSES[number]

// Reply status options
const REPLY_STATUSES = ['sent', 'pending', 'failed'] as const
type ReplyStatus = typeof REPLY_STATUSES[number]

/**
 * Enhanced string sanitization specifically for comments
 */
function sanitizeCommentString(input: unknown, maxLength: number = 10000): string {
  if (typeof input !== 'string') return ''
  
  let sanitized = input.trim()
  
  // 1. Remove potential XSS vectors
  sanitized = DOMPurify.sanitize(sanitized, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    SANITIZE_DOM: true
  })
  
  // 2. Remove SQL injection patterns
  const sqlPatterns = [
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE){0,1}|INSERT( +INTO){0,1}|MERGE|SELECT|UPDATE|UNION( +ALL){0,1})\b)/gi,
    /(\/\*[\s\S]*?\*\/)/g,
    /(--[^\r\n]*)/g,
    /('|(\\')|(;)|(\\;)|(\|)|(\*)|(%)|(<)|(>)|(\^)|(\?)|(\[)|(\])|(\{)|(\})|(\$)|(\+)|(\=))/g
  ]
  
  for (const pattern of sqlPatterns) {
    sanitized = sanitized.replace(pattern, '')
  }
  
  // 3. Escape HTML entities
  sanitized = validator.escape(sanitized)
  
  // 4. Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()
  
  // 5. Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  
  return sanitized
}

/**
 * Advanced XSS detection patterns
 */
function detectAdvancedXSS(input: string): boolean {
  const xssPatterns = [
    // Script tags (various encodings)
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /&lt;script[\s\S]*?&gt;[\s\S]*?&lt;\/script&gt;/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    
    // Event handlers
    /on\w+\s*=/gi,
    /on[a-z]+[\s]*=[\s]*['"]/gi,
    
    // HTML injection
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /<form[\s\S]*?>/gi,
    
    // CSS injection
    /expression\s*\(/gi,
    /behavior:\s*url/gi,
    /@import/gi,
    
    // Advanced vectors
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
    /document\.write/gi,
    /document\.cookie/gi,
    /window\.location/gi,
    /localStorage/gi,
    /sessionStorage/gi,
    
    // Encoded variants
    /&#x[0-9a-f]+;/gi,
    /&#[0-9]+;/gi,
    /%3C%73%63%72%69%70%74/gi, // <script
    /%3E/gi, // >
    /\\u[0-9a-f]{4}/gi,
    /\\x[0-9a-f]{2}/gi
  ]
  
  return xssPatterns.some(pattern => pattern.test(input))
}

/**
 * Advanced SQL injection detection
 */
function detectAdvancedSQLInjection(input: string): boolean {
  const sqlPatterns = [
    // Common SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(\b(OR|AND)\s+[^=]*=\s*[^=]*)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(';\s*(DROP|DELETE|INSERT|UPDATE))/gi,
    
    // Advanced patterns
    /(\|\||\+\+|--|\*\/|\/\*)/g,
    /(WAITFOR\s+DELAY)/gi,
    /(BENCHMARK\s*\()/gi,
    /(SLEEP\s*\()/gi,
    /(pg_sleep\s*\()/gi,
    
    // Blind SQL injection
    /(IF\s*\(\s*\d+\s*=\s*\d+)/gi,
    /(CASE\s+WHEN)/gi,
    /(HAVING\s+\d+\s*=\s*\d+)/gi,
    
    // Database functions
    /(user\(\)|version\(\)|database\(\))/gi,
    /(@@version|@@servername)/gi,
    /(information_schema|sys\.)/gi,
    
    // Hex and char functions
    /(0x[0-9a-f]+)/gi,
    /(char\s*\(\s*\d+)/gi,
    /(ascii\s*\(\s*)/gi,
    /(concat\s*\(\s*)/gi
  ]
  
  return sqlPatterns.some(pattern => pattern.test(input))
}

/**
 * Comment content validation schema
 */
export const CommentContentSchema = z.string()
  .min(1, 'Comment content cannot be empty')
  .max(10000, 'Comment content too long (max 10,000 characters)')
  .transform((val) => sanitizeCommentString(val))
  .refine((val) => val.length > 0, 'Comment content cannot be empty after sanitization')
  .refine((val) => !detectAdvancedXSS(val), 'Potential XSS attack detected')
  .refine((val) => !detectAdvancedSQLInjection(val), 'Potential SQL injection detected')

/**
 * Platform ID validation
 */
export const PlatformIdSchema = z.string()
  .min(1, 'Platform ID required')
  .max(100, 'Platform ID too long')
  .regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid platform ID format')
  .transform((val) => validator.escape(val))

/**
 * Username validation
 */
export const UsernameSchema = z.string()
  .min(1, 'Username required')
  .max(100, 'Username too long')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Invalid username format')
  .transform((val) => sanitizeCommentString(val, 100))

/**
 * Main comment creation schema
 */
export const CreateCommentSchema = z.object({
  platform: z.enum(PLATFORMS, { required_error: 'Platform is required' }),
  
  platform_comment_id: PlatformIdSchema,
  platform_post_id: PlatformIdSchema,
  platform_user_id: PlatformIdSchema,
  
  author_username: UsernameSchema.optional(),
  
  author_profile_picture: z.string()
    .url('Invalid profile picture URL')
    .max(2048, 'Profile picture URL too long')
    .refine((url) => url.startsWith('https://'), 'Profile picture must use HTTPS')
    .optional(),
  
  content: CommentContentSchema,
  
  reply_to_comment_id: z.string()
    .uuid('Invalid reply comment ID')
    .optional(),
  
  sentiment_score: z.number()
    .min(-1, 'Sentiment score must be between -1 and 1')
    .max(1, 'Sentiment score must be between -1 and 1')
    .optional(),
  
  engagement_metrics: z.record(z.any())
    .default({})
    .refine((metrics) => {
      // Validate engagement metrics structure
      const allowedKeys = ['likes', 'replies', 'shares', 'views']
      const keys = Object.keys(metrics)
      return keys.every(key => allowedKeys.includes(key)) && 
             keys.every(key => typeof metrics[key] === 'number' && metrics[key] >= 0)
    }, 'Invalid engagement metrics'),
  
  moderation_flags: z.array(z.string().max(50))
    .max(10, 'Too many moderation flags')
    .default([]),
  
  created_at_platform: z.string()
    .datetime('Invalid platform creation date')
    .optional()
})

/**
 * Comment update schema
 */
export const UpdateCommentSchema = z.object({
  status: z.enum(COMMENT_STATUSES).optional(),
  
  sentiment_score: z.number()
    .min(-1)
    .max(1)
    .optional(),
  
  engagement_metrics: z.record(z.any()).optional(),
  
  moderation_flags: z.array(z.string().max(50))
    .max(10)
    .optional()
})

/**
 * Comment reply creation schema
 */
export const CreateReplySchema = z.object({
  comment_id: z.string().uuid('Invalid comment ID'),
  
  platform: z.enum(PLATFORMS),
  
  content: z.string()
    .min(1, 'Reply content cannot be empty')
    .max(2000, 'Reply content too long (max 2,000 characters)')
    .transform((val) => sanitizeCommentString(val, 2000))
    .refine((val) => val.length > 0, 'Reply content cannot be empty after sanitization')
    .refine((val) => !detectAdvancedXSS(val), 'Potential XSS attack detected')
    .refine((val) => !detectAdvancedSQLInjection(val), 'Potential SQL injection detected'),
  
  platform_reply_id: PlatformIdSchema.optional()
})

/**
 * Comment reply update schema
 */
export const UpdateReplySchema = z.object({
  status: z.enum(REPLY_STATUSES).optional(),
  platform_reply_id: PlatformIdSchema.optional()
})

/**
 * Social post creation schema
 */
export const CreateSocialPostSchema = z.object({
  platform: z.enum(PLATFORMS),
  platform_post_id: PlatformIdSchema,
  platform_user_id: PlatformIdSchema,
  
  title: z.string()
    .max(500, 'Title too long')
    .transform((val) => sanitizeCommentString(val, 500))
    .optional(),
  
  description: z.string()
    .max(5000, 'Description too long')
    .transform((val) => sanitizeCommentString(val, 5000))
    .optional(),
  
  url: z.string()
    .url('Invalid post URL')
    .max(2048, 'URL too long')
    .refine((url) => url.startsWith('https://'), 'Post URL must use HTTPS')
    .optional(),
  
  thumbnail_url: z.string()
    .url('Invalid thumbnail URL')
    .max(2048, 'Thumbnail URL too long')
    .refine((url) => url.startsWith('https://'), 'Thumbnail URL must use HTTPS')
    .optional(),
  
  post_type: z.enum(['image', 'video', 'carousel', 'reel', 'story']).optional(),
  
  metrics: z.record(z.any()).default({}),
  
  created_at_platform: z.string()
    .datetime('Invalid platform creation date')
    .optional()
})

/**
 * Moderation settings schema
 */
export const ModerationSettingsSchema = z.object({
  platform: z.enum(PLATFORMS),
  
  auto_approve: z.boolean().default(false),
  
  keywords_block: z.array(z.string().max(100))
    .max(100, 'Too many blocked keywords')
    .default([])
    .transform((keywords) => keywords.map(k => sanitizeCommentString(k, 100))),
  
  keywords_flag: z.array(z.string().max(100))
    .max(100, 'Too many flagged keywords')
    .default([])
    .transform((keywords) => keywords.map(k => sanitizeCommentString(k, 100))),
  
  sentiment_threshold: z.number()
    .min(-1, 'Sentiment threshold must be between -1 and 1')
    .max(1, 'Sentiment threshold must be between -1 and 1')
    .default(-0.5),
  
  spam_detection_enabled: z.boolean().default(true),
  auto_reply_enabled: z.boolean().default(false),
  
  auto_reply_templates: z.record(z.string().max(2000))
    .default({})
    .refine((templates) => {
      // Validate all templates are clean
      return Object.values(templates).every(template => 
        !detectAdvancedXSS(template) && !detectAdvancedSQLInjection(template)
      )
    }, 'Auto-reply templates contain potentially malicious content')
})

/**
 * Query parameters validation for comments API
 */
export const CommentsQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  
  status: z.enum(COMMENT_STATUSES).optional(),
  
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform((val) => parseInt(val))
    .refine((val) => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .default('20'),
  
  offset: z.string()
    .regex(/^\d+$/, 'Offset must be a number')
    .transform((val) => parseInt(val))
    .refine((val) => val >= 0, 'Offset must be non-negative')
    .default('0'),
  
  sort: z.enum(['created_at', 'updated_at', 'sentiment_score'])
    .default('created_at')
    .optional(),
  
  order: z.enum(['asc', 'desc'])
    .default('desc')
    .optional(),
  
  search: z.string()
    .max(200, 'Search query too long')
    .transform((val) => sanitizeCommentString(val, 200))
    .refine((val) => !detectAdvancedXSS(val), 'Search query contains XSS')
    .refine((val) => !detectAdvancedSQLInjection(val), 'Search query contains SQL injection')
    .optional(),
  
  date_from: z.string()
    .datetime('Invalid date format')
    .optional(),
  
  date_to: z.string()
    .datetime('Invalid date format')
    .optional()
})

/**
 * Bulk operations schema
 */
export const BulkUpdateCommentsSchema = z.object({
  comment_ids: z.array(z.string().uuid())
    .min(1, 'At least one comment ID required')
    .max(100, 'Too many comments (max 100)'),
  
  action: z.enum(['approve', 'reject', 'mark_spam', 'delete']),
  
  reason: z.string()
    .max(500, 'Reason too long')
    .transform((val) => sanitizeCommentString(val, 500))
    .optional()
})

/**
 * Advanced validation utilities
 */
export class CommentsValidator {
  /**
   * Validate and sanitize comment data with advanced security checks
   */
  static async validateComment(data: unknown): Promise<z.infer<typeof CreateCommentSchema>> {
    try {
      const result = CreateCommentSchema.parse(data)
      
      // Additional business logic validation
      await this.performSecurityChecks(result)
      
      return result
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`)
      }
      throw error
    }
  }

  /**
   * Perform additional security checks
   */
  private static async performSecurityChecks(data: any): Promise<void> {
    // Check for suspicious patterns
    if (this.hasSuspiciousPatterns(data.content)) {
      throw new Error('Content contains suspicious patterns')
    }
    
    // Check content length vs actual character count (detect encoding tricks)
    if (data.content.length !== [...data.content].length) {
      throw new Error('Content contains suspicious encoding')
    }
    
    // Validate platform-specific constraints
    await this.validatePlatformConstraints(data.platform, data)
  }

  /**
   * Check for suspicious patterns in content
   */
  private static hasSuspiciousPatterns(content: string): boolean {
    const suspiciousPatterns = [
      // Base64 encoded content
      /^[A-Za-z0-9+/]+=*$/,
      // Repeated characters (potential spam)
      /(.)\1{50,}/,
      // Multiple URLs
      /(https?:\/\/[^\s]+\s*){3,}/g,
      // Excessive punctuation
      /[!@#$%^&*()]{10,}/,
      // Binary data
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/
    ]
    
    return suspiciousPatterns.some(pattern => pattern.test(content))
  }

  /**
   * Validate platform-specific constraints
   */
  private static async validatePlatformConstraints(platform: Platform, data: any): Promise<void> {
    switch (platform) {
      case 'instagram':
        if (data.content.length > 2200) {
          throw new Error('Instagram comments cannot exceed 2200 characters')
        }
        break
      case 'tiktok':
        if (data.content.length > 300) {
          throw new Error('TikTok comments cannot exceed 300 characters')
        }
        break
      case 'facebook':
        if (data.content.length > 8000) {
          throw new Error('Facebook comments cannot exceed 8000 characters')
        }
        break
    }
  }

  /**
   * Sanitize object for logging (remove sensitive data)
   */
  static sanitizeForLogging(obj: any): any {
    return InputSanitizer.sanitizeForLogging(obj)
  }
}

// Export types
export type CreateCommentData = z.infer<typeof CreateCommentSchema>
export type UpdateCommentData = z.infer<typeof UpdateCommentSchema>
export type CreateReplyData = z.infer<typeof CreateReplySchema>
export type UpdateReplyData = z.infer<typeof UpdateReplySchema>
export type CreateSocialPostData = z.infer<typeof CreateSocialPostSchema>
export type ModerationSettingsData = z.infer<typeof ModerationSettingsSchema>
export type CommentsQueryData = z.infer<typeof CommentsQuerySchema>
export type BulkUpdateData = z.infer<typeof BulkUpdateCommentsSchema>

// Export validation functions
export {
  sanitizeCommentString,
  detectAdvancedXSS,
  detectAdvancedSQLInjection
}