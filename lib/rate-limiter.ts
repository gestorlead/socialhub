import { NextRequest } from 'next/server'

/**
 * Advanced Rate Limiting System with Redis/Upstash
 * Implements sliding window, token bucket, and fixed window algorithms
 */

// Rate limit configuration types
export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  algorithm: 'fixed' | 'sliding' | 'token_bucket'
  blockDuration?: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
  blocked: boolean
}

export interface TokenBucketConfig extends RateLimitConfig {
  algorithm: 'token_bucket'
  capacity: number
  refillRate: number // tokens per second
  refillInterval: number // milliseconds
}

// Default configurations for different endpoints
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  // Comments API endpoints
  'comments-read': {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    algorithm: 'sliding'
  },
  'comments-write': {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
    algorithm: 'token_bucket',
    capacity: 20,
    refillRate: 2,
    refillInterval: 60 * 1000 // 1 minute
  } as TokenBucketConfig,
  'comments-bulk': {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    algorithm: 'fixed',
    blockDuration: 5 * 60 * 1000 // 5 minutes
  },
  'comments-moderate': {
    maxRequests: 50,
    windowMs: 15 * 60 * 1000,
    algorithm: 'sliding'
  },
  // Real-time presence API endpoints
  'presence-update': {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    algorithm: 'token_bucket',
    capacity: 30,
    refillRate: 0.5, // 30 tokens per minute = 0.5 per second
    refillInterval: 1000 // 1 second
  } as TokenBucketConfig,
  'presence-read': {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
    algorithm: 'sliding'
  },
  // WebSocket real-time endpoints
  'realtime-connect': {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    algorithm: 'fixed',
    blockDuration: 2 * 60 * 1000 // 2 minutes block on abuse
  },
  'realtime-message': {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    algorithm: 'token_bucket',
    capacity: 100,
    refillRate: 1.67, // ~100 per minute
    refillInterval: 1000 // 1 second
  } as TokenBucketConfig,
  'global': {
    maxRequests: 1000,
    windowMs: 15 * 60 * 1000,
    algorithm: 'sliding'
  }
}

/**
 * Redis client interface (supports both Redis and Upstash)
 */
interface RedisInterface {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options?: { px?: number, ex?: number }): Promise<string | null>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  del(key: string): Promise<number>
  zremrangebyscore(key: string, min: string | number, max: string | number): Promise<number>
  zadd(key: string, score: number, member: string): Promise<number>
  zcard(key: string): Promise<number>
  zrange(key: string, start: number, stop: number): Promise<string[]>
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<any>
}

/**
 * Upstash Redis client wrapper
 */
class UpstashRedis implements RedisInterface {
  private baseUrl: string
  private token: string

  constructor(url?: string, token?: string) {
    this.baseUrl = url || process.env.UPSTASH_REDIS_REST_URL!
    this.token = token || process.env.UPSTASH_REDIS_REST_TOKEN!

    if (!this.baseUrl || !this.token) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')
    }
  }

  private async request(command: string[]): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command)
    })

    if (!response.ok) {
      throw new Error(`Upstash request failed: ${response.statusText}`)
    }

    const result = await response.json()
    return result.result
  }

  async get(key: string): Promise<string | null> {
    return await this.request(['GET', key])
  }

  async set(key: string, value: string, options?: { px?: number, ex?: number }): Promise<string | null> {
    const args = ['SET', key, value]
    if (options?.px) args.push('PX', options.px.toString())
    if (options?.ex) args.push('EX', options.ex.toString())
    return await this.request(args)
  }

  async incr(key: string): Promise<number> {
    return await this.request(['INCR', key])
  }

  async expire(key: string, seconds: number): Promise<number> {
    return await this.request(['EXPIRE', key, seconds.toString()])
  }

  async del(key: string): Promise<number> {
    return await this.request(['DEL', key])
  }

  async zremrangebyscore(key: string, min: string | number, max: string | number): Promise<number> {
    return await this.request(['ZREMRANGEBYSCORE', key, min.toString(), max.toString()])
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.request(['ZADD', key, score.toString(), member])
  }

  async zcard(key: string): Promise<number> {
    return await this.request(['ZCARD', key])
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.request(['ZRANGE', key, start.toString(), stop.toString()])
  }

  async eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<any> {
    return await this.request(['EVAL', script, numkeys.toString(), ...args.map(String)])
  }
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private redis: RedisInterface
  private prefix: string

  constructor(redis?: RedisInterface, prefix: string = 'rl:') {
    this.redis = redis || new UpstashRedis()
    this.prefix = prefix
  }

  /**
   * Check rate limit for a request
   */
  async checkLimit(
    identifier: string,
    endpoint: string,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const config = {
      ...DEFAULT_CONFIGS[endpoint] || DEFAULT_CONFIGS.global,
      ...customConfig
    }

    const key = `${this.prefix}${endpoint}:${identifier}`

    try {
      switch (config.algorithm) {
        case 'fixed':
          return await this.fixedWindow(key, config)
        case 'sliding':
          return await this.slidingWindow(key, config)
        case 'token_bucket':
          return await this.tokenBucket(key, config as TokenBucketConfig)
        default:
          throw new Error(`Unknown algorithm: ${config.algorithm}`)
      }
    } catch (error) {
      console.error('Rate limiter error:', error)
      // Fail open - allow request if Redis is down
      return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        blocked: false
      }
    }
  }

  /**
   * Fixed window rate limiting
   */
  private async fixedWindow(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now()
    const window = Math.floor(now / config.windowMs) * config.windowMs
    const windowKey = `${key}:${window}`

    const current = await this.redis.incr(windowKey)
    
    if (current === 1) {
      await this.redis.expire(windowKey, Math.ceil(config.windowMs / 1000))
    }

    const resetTime = window + config.windowMs
    const remaining = Math.max(0, config.maxRequests - current)
    const success = current <= config.maxRequests

    // Check if blocked
    const blockKey = `${key}:blocked`
    const blockedUntil = await this.redis.get(blockKey)
    const blocked = blockedUntil ? parseInt(blockedUntil) > now : false

    if (!success && !blocked && config.blockDuration) {
      // Block user for configured duration
      await this.redis.set(blockKey, (now + config.blockDuration).toString(), {
        px: config.blockDuration
      })
    }

    return {
      success: success && !blocked,
      limit: config.maxRequests,
      remaining,
      resetTime,
      retryAfter: !success ? Math.ceil((resetTime - now) / 1000) : undefined,
      blocked
    }
  }

  /**
   * Sliding window rate limiting
   */
  private async slidingWindow(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now()
    const window = now - config.windowMs

    // Remove expired entries
    await this.redis.zremrangebyscore(key, 0, window)

    // Add current request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`)

    // Count requests in window
    const count = await this.redis.zcard(key)

    // Set expiration
    await this.redis.expire(key, Math.ceil(config.windowMs / 1000))

    const remaining = Math.max(0, config.maxRequests - count)
    const success = count <= config.maxRequests

    // Calculate reset time (when oldest request will expire)
    let resetTime = now + config.windowMs
    if (count > 0) {
      const oldest = await this.redis.zrange(key, 0, 0)
      if (oldest.length > 0) {
        const oldestTime = parseInt(oldest[0].split('-')[0])
        resetTime = oldestTime + config.windowMs
      }
    }

    return {
      success,
      limit: config.maxRequests,
      remaining,
      resetTime,
      retryAfter: !success ? Math.ceil((resetTime - now) / 1000) : undefined,
      blocked: false
    }
  }

  /**
   * Token bucket rate limiting
   */
  private async tokenBucket(key: string, config: TokenBucketConfig): Promise<RateLimitResult> {
    const now = Date.now()
    const bucketKey = `${key}:bucket`

    // Lua script for atomic token bucket operation
    const luaScript = `
      local bucket_key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local refill_interval = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', bucket_key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now
      
      -- Calculate tokens to add based on time elapsed
      local time_elapsed = now - last_refill
      local intervals_passed = math.floor(time_elapsed / refill_interval)
      local tokens_to_add = intervals_passed * refill_rate
      
      -- Add tokens (up to capacity)
      tokens = math.min(capacity, tokens + tokens_to_add)
      
      -- Update last refill time
      last_refill = last_refill + (intervals_passed * refill_interval)
      
      -- Check if we can consume a token
      local success = tokens > 0
      if success then
        tokens = tokens - 1
      end
      
      -- Update bucket state
      redis.call('HMSET', bucket_key, 'tokens', tokens, 'last_refill', last_refill)
      redis.call('EXPIRE', bucket_key, 3600) -- 1 hour TTL
      
      return {success and 1 or 0, tokens, last_refill}
    `

    const result = await this.redis.eval(
      luaScript,
      1,
      bucketKey,
      config.capacity,
      config.refillRate,
      config.refillInterval,
      now
    )

    const [success, tokens, lastRefill] = result
    const remaining = Math.max(0, tokens)

    // Calculate when next token will be available
    const nextRefill = lastRefill + config.refillInterval
    const resetTime = success ? nextRefill : Math.max(nextRefill, now)

    return {
      success: Boolean(success),
      limit: config.capacity,
      remaining,
      resetTime,
      retryAfter: !success ? Math.ceil((resetTime - now) / 1000) : undefined,
      blocked: false
    }
  }

  /**
   * Get identifier from request (IP + User ID if available)
   */
  static getIdentifier(request: NextRequest): string {
    const userId = request.headers.get('x-user-id')
    const ip = this.getClientIP(request)
    
    return userId ? `user:${userId}` : `ip:${ip}`
  }

  /**
   * Get client IP address
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
   * Reset rate limit for identifier
   */
  async resetLimit(identifier: string, endpoint: string): Promise<void> {
    const key = `${this.prefix}${endpoint}:${identifier}`
    await this.redis.del(key)
    await this.redis.del(`${key}:blocked`)
    await this.redis.del(`${key}:bucket`)
  }

  /**
   * Get current rate limit status
   */
  async getStatus(identifier: string, endpoint: string): Promise<RateLimitResult | null> {
    const config = DEFAULT_CONFIGS[endpoint] || DEFAULT_CONFIGS.global
    const key = `${this.prefix}${endpoint}:${identifier}`

    try {
      switch (config.algorithm) {
        case 'fixed': {
          const now = Date.now()
          const window = Math.floor(now / config.windowMs) * config.windowMs
          const windowKey = `${key}:${window}`
          const current = parseInt(await this.redis.get(windowKey) || '0')
          
          return {
            success: current < config.maxRequests,
            limit: config.maxRequests,
            remaining: Math.max(0, config.maxRequests - current),
            resetTime: window + config.windowMs,
            blocked: false
          }
        }
        
        case 'sliding': {
          const now = Date.now()
          const count = await this.redis.zcard(key)
          
          return {
            success: count < config.maxRequests,
            limit: config.maxRequests,
            remaining: Math.max(0, config.maxRequests - count),
            resetTime: now + config.windowMs,
            blocked: false
          }
        }
        
        case 'token_bucket': {
          const bucketKey = `${key}:bucket`
          const bucket = await this.redis.get(bucketKey)
          
          if (!bucket) {
            return {
              success: true,
              limit: config.maxRequests,
              remaining: config.maxRequests,
              resetTime: Date.now() + config.windowMs,
              blocked: false
            }
          }
          
          // Parse bucket data and return status
          // Implementation would depend on how bucket data is stored
          return null
        }
        
        default:
          return null
      }
    } catch (error) {
      console.error('Error getting rate limit status:', error)
      return null
    }
  }

  /**
   * Increment failed attempt counter
   */
  async recordFailedAttempt(identifier: string): Promise<void> {
    const key = `${this.prefix}failed:${identifier}`
    const count = await this.redis.incr(key)
    
    if (count === 1) {
      await this.redis.expire(key, 3600) // 1 hour
    }

    // Auto-block after too many failed attempts
    if (count >= 10) {
      const blockKey = `${this.prefix}blocked:${identifier}`
      await this.redis.set(blockKey, '1', { ex: 3600 }) // Block for 1 hour
    }
  }

  /**
   * Check if identifier is blocked due to failed attempts
   */
  async isBlocked(identifier: string): Promise<boolean> {
    const blockKey = `${this.prefix}blocked:${identifier}`
    const blocked = await this.redis.get(blockKey)
    return blocked !== null
  }
}

/**
 * Rate limiting middleware helper
 */
export class RateLimitMiddleware {
  private rateLimiter: RateLimiter

  constructor(rateLimiter?: RateLimiter) {
    this.rateLimiter = rateLimiter || new RateLimiter()
  }

  /**
   * Create rate limit middleware for specific endpoint
   */
  createMiddleware(endpoint: string, customConfig?: Partial<RateLimitConfig>) {
    return async (request: NextRequest) => {
      const identifier = RateLimiter.getIdentifier(request)
      
      // Check if blocked
      if (await this.rateLimiter.isBlocked(identifier)) {
        return {
          success: false,
          limit: 0,
          remaining: 0,
          resetTime: Date.now() + 3600000, // 1 hour
          retryAfter: 3600,
          blocked: true
        }
      }

      return await this.rateLimiter.checkLimit(identifier, endpoint, customConfig)
    }
  }

  /**
   * Apply rate limiting to comments endpoints
   */
  static getCommentsRateLimit() {
    return new RateLimitMiddleware().createMiddleware('comments-read')
  }

  static getCommentsWriteRateLimit() {
    return new RateLimitMiddleware().createMiddleware('comments-write')
  }

  static getCommentsBulkRateLimit() {
    return new RateLimitMiddleware().createMiddleware('comments-bulk')
  }

  static getCommentsModerationRateLimit() {
    return new RateLimitMiddleware().createMiddleware('comments-moderate')
  }

  /**
   * Apply rate limiting to real-time presence endpoints
   */
  static getPresenceRateLimit() {
    return new RateLimitMiddleware().createMiddleware('presence-update')
  }

  static getPresenceReadRateLimit() {
    return new RateLimitMiddleware().createMiddleware('presence-read')
  }

  /**
   * Apply rate limiting to real-time WebSocket endpoints
   */
  static getRealtimeConnectRateLimit() {
    return new RateLimitMiddleware().createMiddleware('realtime-connect')
  }

  static getRealtimeMessageRateLimit() {
    return new RateLimitMiddleware().createMiddleware('realtime-message')
  }
}

// Export default configurations
export const RATE_LIMIT_CONFIGS = DEFAULT_CONFIGS

// Export utility functions
export const createRateLimiter = (config?: { redis?: RedisInterface, prefix?: string }) => 
  new RateLimiter(config?.redis, config?.prefix)

export const createUpstashClient = (url?: string, token?: string) => 
  new UpstashRedis(url, token)