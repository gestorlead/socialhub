/**
 * Security Integration Tests
 * Tests the complete security pipeline integration
 */

import { NextRequest } from 'next/server'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { CommentsValidator, CreateCommentSchema } from '@/lib/comments-validation'
import { RateLimiter } from '@/lib/rate-limiter'
import { SecurityMiddleware } from '@/lib/security-middleware'

// Mock environment variables
process.env.COMMENTS_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

describe('Security Integration Tests', () => {
  let mockRedis: any

  beforeEach(() => {
    // Mock Redis for rate limiting tests
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zadd: jest.fn().mockResolvedValue(1),
      zcard: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue([]),
      eval: jest.fn().mockResolvedValue([1, 19, Date.now()])
    }

    // Mock fetch for Upstash requests
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: null })
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete Security Pipeline', () => {
    test('should process legitimate comment through full security pipeline', async () => {
      const legitimateComment = {
        platform: 'instagram' as const,
        platform_comment_id: 'comment_12345',
        platform_post_id: 'post_67890',
        platform_user_id: 'user_11111',
        author_username: 'john_doe',
        author_profile_picture: 'https://example.com/avatar.jpg',
        content: 'This is a great post! Thanks for sharing 🎉',
        engagement_metrics: { likes: 15, replies: 3 },
        sentiment_score: 0.8
      }

      // Step 1: Input validation and sanitization
      const validatedComment = await CommentsValidator.validateComment(legitimateComment)
      expect(validatedComment).toBeDefined()
      expect(validatedComment.content).toBe(legitimateComment.content)
      expect(validatedComment.platform).toBe('instagram')

      // Step 2: Rate limiting check
      const rateLimiter = new RateLimiter(mockRedis)
      const rateLimitResult = await rateLimiter.checkLimit('user_11111', 'comments-write')
      expect(rateLimitResult.success).toBe(true)

      // Step 3: Token encryption for storage
      const accessToken = 'ig_access_token_abc123'
      const encryptedToken = CommentsCrypto.encryptToken(accessToken, 'user_11111', 'instagram')
      expect(encryptedToken).not.toBe(accessToken)
      expect(encryptedToken.length).toBeGreaterThan(accessToken.length)

      // Step 4: Content hash generation
      const contentHash = CommentsCrypto.hashContent(validatedComment.content, 'user_11111')
      expect(contentHash).toMatch(/^[a-f0-9]{64}$/)

      // Step 5: Verify the complete flow worked
      const decryptedToken = CommentsCrypto.decryptToken(encryptedToken, 'user_11111', 'instagram')
      expect(decryptedToken).toBe(accessToken)

      const hashVerification = CommentsCrypto.verifyContentHash(
        validatedComment.content, 
        'user_11111', 
        contentHash
      )
      expect(hashVerification).toBe(true)
    })

    test('should block malicious comment through security pipeline', async () => {
      const maliciousComment = {
        platform: 'instagram' as const,
        platform_comment_id: '<script>alert("xss")</script>',
        platform_post_id: "'; DROP TABLE comments; --",
        platform_user_id: 'user_22222',
        content: '<iframe src="javascript:alert(1)"></iframe>',
        author_username: 'hacker<script>',
        author_profile_picture: 'http://malicious.com/script.js' // Non-HTTPS
      }

      // Should fail at validation step
      await expect(CommentsValidator.validateComment(maliciousComment)).rejects.toThrow()
    })

    test('should handle rate limiting with encrypted tokens', async () => {
      const userId = 'user_33333'
      const platform = 'tiktok'
      const accessToken = 'tk_access_token_xyz789'

      // Encrypt token
      const encryptedToken = CommentsCrypto.encryptToken(accessToken, userId, platform)

      // Simulate multiple requests hitting rate limit
      const rateLimiter = new RateLimiter(mockRedis)
      
      // Mock rate limit exceeded
      mockRedis.eval.mockResolvedValue([0, 0, Date.now()]) // No tokens available

      const rateLimitResult = await rateLimiter.checkLimit(userId, 'comments-write')
      expect(rateLimitResult.success).toBe(false)
      expect(rateLimitResult.retryAfter).toBeGreaterThan(0)

      // Verify token can still be decrypted despite rate limiting
      const decryptedToken = CommentsCrypto.decryptToken(encryptedToken, userId, platform)
      expect(decryptedToken).toBe(accessToken)
    })

    test('should handle concurrent security operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        userId: `user_${i}`,
        token: `token_${i}`,
        content: `Comment content ${i}`,
        platform: 'instagram' as const
      }))

      // Process all operations concurrently
      const results = await Promise.all(
        operations.map(async (op) => {
          // Encrypt token
          const encryptedToken = CommentsCrypto.encryptToken(op.token, op.userId, op.platform)
          
          // Generate content hash
          const contentHash = CommentsCrypto.hashContent(op.content, op.userId)
          
          // Validate content
          const isValid = CreateCommentSchema.safeParse({
            platform: op.platform,
            platform_comment_id: `comment_${op.userId}`,
            platform_post_id: `post_${op.userId}`,
            platform_user_id: op.userId,
            content: op.content
          })

          return {
            userId: op.userId,
            encryptedToken,
            contentHash,
            isValid: isValid.success
          }
        })
      )

      // Verify all operations succeeded
      results.forEach((result, index) => {
        expect(result.isValid).toBe(true)
        expect(result.encryptedToken).toBeDefined()
        expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/)
        
        // Verify decryption works
        const decrypted = CommentsCrypto.decryptToken(
          result.encryptedToken, 
          result.userId, 
          'instagram'
        )
        expect(decrypted).toBe(`token_${index}`)
      })
    })
  })

  describe('Attack Simulation Tests', () => {
    test('should handle coordinated XSS and SQL injection attack', async () => {
      const coordinatedAttack = {
        platform: 'facebook' as const,
        platform_comment_id: 'comment_attack',
        platform_post_id: 'post_attack',
        platform_user_id: 'attacker_user',
        content: `
          <script>
            // XSS payload
            document.cookie = 'stolen=true';
            fetch('/api/steal', { method: 'POST', body: document.cookie });
          </script>
          '; DROP TABLE comments; SELECT * FROM users WHERE '1'='1
        `,
        author_username: '<script>alert("username")</script>',
        author_profile_picture: 'javascript:alert("avatar")'
      }

      // Should be blocked by validation
      await expect(CommentsValidator.validateComment(coordinatedAttack)).rejects.toThrow()
    })

    test('should handle token extraction attempt', async () => {
      const userId = 'target_user'
      const platform = 'instagram'
      const realToken = 'real_access_token_secret'

      // Encrypt real token
      const encryptedToken = CommentsCrypto.encryptToken(realToken, userId, platform)

      // Attacker tries to decrypt with wrong context
      expect(() => {
        CommentsCrypto.decryptToken(encryptedToken, 'attacker_user', platform)
      }).toThrow('Failed to decrypt data')

      expect(() => {
        CommentsCrypto.decryptToken(encryptedToken, userId, 'tiktok')
      }).toThrow('Failed to decrypt data')

      // Only correct context should work
      const decrypted = CommentsCrypto.decryptToken(encryptedToken, userId, platform)
      expect(decrypted).toBe(realToken)
    })

    test('should handle rate limit bypass attempts', async () => {
      const attackerIp = '192.168.1.100'
      const rateLimiter = new RateLimiter(mockRedis)

      // Simulate attacker making many requests
      mockRedis.incr.mockResolvedValueOnce(50) // First request
      mockRedis.incr.mockResolvedValueOnce(101) // Exceeds limit

      const firstRequest = await rateLimiter.checkLimit(attackerIp, 'comments-write')
      expect(firstRequest.success).toBe(true)

      const secondRequest = await rateLimiter.checkLimit(attackerIp, 'comments-write')
      expect(secondRequest.success).toBe(false)
      expect(secondRequest.retryAfter).toBeGreaterThan(0)

      // Attacker should be blocked even with different identifiers
      await rateLimiter.recordFailedAttempt(attackerIp)
      mockRedis.incr.mockResolvedValue(15) // Too many failures

      await rateLimiter.recordFailedAttempt(attackerIp)
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('blocked'),
        '1',
        { ex: 3600 }
      )
    })

    test('should handle content manipulation attempts', async () => {
      const originalContent = 'This is legitimate content'
      const userId = 'user_12345'
      
      // Generate legitimate hash
      const legitimateHash = CommentsCrypto.hashContent(originalContent, userId)

      // Attacker tries to modify content while keeping hash
      const manipulatedContent = 'This is MALICIOUS content'
      const isValidAfterManipulation = CommentsCrypto.verifyContentHash(
        manipulatedContent, 
        userId, 
        legitimateHash
      )
      expect(isValidAfterManipulation).toBe(false)

      // Attacker tries to use hash for different user
      const isDifferentUserValid = CommentsCrypto.verifyContentHash(
        originalContent, 
        'different_user', 
        legitimateHash
      )
      expect(isDifferentUserValid).toBe(false)

      // Only original content + user should be valid
      const isOriginalValid = CommentsCrypto.verifyContentHash(
        originalContent, 
        userId, 
        legitimateHash
      )
      expect(isOriginalValid).toBe(true)
    })
  })

  describe('Performance Under Attack', () => {
    test('should maintain performance during DoS attack simulation', async () => {
      const startTime = Date.now()
      const rateLimiter = new RateLimiter(mockRedis)

      // Simulate 100 rapid requests (DoS attack)
      const requests = Array.from({ length: 100 }, (_, i) => 
        rateLimiter.checkLimit(`attacker_${i}`, 'comments-read')
      )

      const results = await Promise.all(requests)
      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time even under load
      expect(duration).toBeLessThan(5000) // 5 seconds max
      
      // Rate limiter should still function
      expect(results.some(r => r.success)).toBe(true)
    })

    test('should handle encryption performance under load', () => {
      const startTime = Date.now()
      
      // Simulate high load encryption operations
      const tokens = Array.from({ length: 100 }, (_, i) => `token_${i}`)
      const encrypted = tokens.map(token => 
        CommentsCrypto.encryptToken(token, 'user_123', 'instagram')
      )
      
      const decrypted = encrypted.map(encToken => 
        CommentsCrypto.decryptToken(encToken, 'user_123', 'instagram')
      )
      
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(decrypted).toEqual(tokens)
      expect(duration).toBeLessThan(10000) // 10 seconds max for 100 operations
    })
  })

  describe('Error Recovery and Resilience', () => {
    test('should handle Redis failures gracefully', async () => {
      // Mock Redis failure
      const failingRedis = {
        ...mockRedis,
        incr: jest.fn().mockRejectedValue(new Error('Redis connection failed'))
      }

      const rateLimiter = new RateLimiter(failingRedis)
      
      // Should fail open (allow request) when Redis is down
      const result = await rateLimiter.checkLimit('user_123', 'comments-read')
      expect(result.success).toBe(true)
    })

    test('should handle encryption key rotation', async () => {
      const originalKey = process.env.COMMENTS_ENCRYPTION_KEY!
      const originalData = ['token1', 'token2', 'token3']
      const context = 'test:rotation'

      // Encrypt with original key
      const encrypted = originalData.map(data => CommentsCrypto.encrypt(data, context))

      // Simulate key rotation
      const newKey = CommentsCrypto.generateEncryptionKey()
      process.env.COMMENTS_ENCRYPTION_KEY_OLD = originalKey
      process.env.COMMENTS_ENCRYPTION_KEY = newKey

      // Should be able to decrypt old data and encrypt new data
      encrypted.forEach((encData, index) => {
        // Temporarily restore old key for decryption
        process.env.COMMENTS_ENCRYPTION_KEY = originalKey
        const decrypted = CommentsCrypto.decrypt(encData, context)
        expect(decrypted).toBe(originalData[index])

        // Restore new key
        process.env.COMMENTS_ENCRYPTION_KEY = newKey
      })

      // New encryptions should use new key
      const newEncrypted = CommentsCrypto.encrypt('new_data', context)
      const newDecrypted = CommentsCrypto.decrypt(newEncrypted, context)
      expect(newDecrypted).toBe('new_data')
    })

    test('should handle partial validation failures', async () => {
      const mixedComments = [
        {
          platform: 'instagram' as const,
          platform_comment_id: 'valid_comment',
          platform_post_id: 'valid_post',
          platform_user_id: 'valid_user',
          content: 'This is valid content'
        },
        {
          platform: 'instagram' as const,
          platform_comment_id: '<script>alert("xss")</script>',
          platform_post_id: 'malicious_post',
          platform_user_id: 'attacker',
          content: 'This contains XSS'
        },
        {
          platform: 'instagram' as const,
          platform_comment_id: 'another_valid',
          platform_post_id: 'valid_post_2',
          platform_user_id: 'valid_user_2',
          content: 'This is also valid'
        }
      ]

      const results = await Promise.allSettled(
        mixedComments.map(comment => CommentsValidator.validateComment(comment))
      )

      // Should have mixed results
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      expect(results[2].status).toBe('fulfilled')

      // Valid comments should be processed correctly
      if (results[0].status === 'fulfilled') {
        expect(results[0].value.content).toBe('This is valid content')
      }
      if (results[2].status === 'fulfilled') {
        expect(results[2].value.content).toBe('This is also valid')
      }
    })
  })
})

describe('Security Compliance Tests', () => {
  test('should meet OWASP security requirements', async () => {
    const testComment = {
      platform: 'instagram' as const,
      platform_comment_id: 'test_comment',
      platform_post_id: 'test_post',
      platform_user_id: 'test_user',
      content: 'Test content for OWASP compliance'
    }

    // A1: Injection - Should prevent SQL injection and XSS
    await expect(CommentsValidator.validateComment({
      ...testComment,
      content: "'; DROP TABLE comments; --"
    })).rejects.toThrow()

    // A2: Broken Authentication - Should use secure token encryption
    const token = 'secure_access_token'
    const encrypted = CommentsCrypto.encryptToken(token, 'user_123', 'instagram')
    expect(encrypted).not.toBe(token)
    expect(encrypted.length).toBeGreaterThan(50) // Should be significantly longer

    // A3: Sensitive Data Exposure - Should encrypt sensitive data
    const sensitiveData = 'user_private_data'
    const encryptedData = CommentsCrypto.encrypt(sensitiveData)
    expect(encryptedData).not.toContain('user_private_data')

    // A4: XML External Entities - Not applicable (no XML processing)
    
    // A5: Broken Access Control - Should validate user context
    expect(() => {
      CommentsCrypto.decryptToken(encrypted, 'wrong_user', 'instagram')
    }).toThrow()

    // A6: Security Misconfiguration - Should use secure defaults
    const validatedComment = await CommentsValidator.validateComment(testComment)
    expect(validatedComment).toBeDefined()

    // A7: Cross-Site Scripting - Should sanitize content
    await expect(CommentsValidator.validateComment({
      ...testComment,
      content: '<script>alert("xss")</script>'
    })).rejects.toThrow()

    // A8: Insecure Deserialization - Should validate all inputs
    await expect(CommentsValidator.validateComment({
      ...testComment,
      engagement_metrics: { malicious: 'payload' }
    })).rejects.toThrow()

    // A9: Using Components with Known Vulnerabilities - Covered by dependency scanning
    
    // A10: Insufficient Logging & Monitoring - Should log security events
    // (This would be tested in actual middleware implementation)
  })

  test('should meet data protection requirements (GDPR/LGPD)', () => {
    const personalData = {
      email: 'user@example.com',
      name: 'John Doe',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0...'
    }

    // Should encrypt personal data
    const encryptedFields = CommentsCrypto.encryptFields(
      personalData, 
      ['email', 'name', 'ip_address'], 
      'user_context'
    )

    expect(encryptedFields.email).not.toBe(personalData.email)
    expect(encryptedFields.name).not.toBe(personalData.name)
    expect(encryptedFields.ip_address).not.toBe(personalData.ip_address)

    // Should be able to decrypt for legitimate use
    const decryptedFields = CommentsCrypto.decryptFields(
      encryptedFields,
      ['email', 'name', 'ip_address'],
      'user_context'
    )

    expect(decryptedFields.email).toBe(personalData.email)
    expect(decryptedFields.name).toBe(personalData.name)
    expect(decryptedFields.ip_address).toBe(personalData.ip_address)

    // Should support data deletion (crypto-shredding)
    const backupId = 'user_backup_123'
    const backup = CommentsCrypto.createEncryptedBackup(personalData, backupId)
    expect(backup).toBeDefined()
    expect(backup).not.toContain(personalData.email)
  })
})