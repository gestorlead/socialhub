/**
 * Comprehensive Security Tests for Comments System
 * Phase 1, Step 1.2: Token Encryption & Input Validation Tests
 */

import { CommentsCrypto, KeyRotation } from '@/lib/comments-crypto'
import { 
  CommentsValidator,
  CreateCommentSchema,
  CommentContentSchema,
  detectAdvancedXSS,
  detectAdvancedSQLInjection,
  sanitizeCommentString
} from '@/lib/comments-validation'
import { RateLimiter, createUpstashClient } from '@/lib/rate-limiter'

// Mock environment variables
const MOCK_ENCRYPTION_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes
process.env.COMMENTS_ENCRYPTION_KEY = MOCK_ENCRYPTION_KEY

describe('Comments Crypto Security Tests', () => {
  describe('AES-256-GCM Encryption', () => {
    test('should encrypt and decrypt token successfully', () => {
      const token = 'test-access-token-12345'
      const userId = 'user-123'
      const platform = 'instagram'

      const encrypted = CommentsCrypto.encryptToken(token, userId, platform)
      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(token)
      expect(encrypted.length).toBeGreaterThan(token.length)

      const decrypted = CommentsCrypto.decryptToken(encrypted, userId, platform)
      expect(decrypted).toBe(token)
    })

    test('should fail decryption with wrong context', () => {
      const token = 'test-access-token-12345'
      const userId = 'user-123'
      const platform = 'instagram'

      const encrypted = CommentsCrypto.encryptToken(token, userId, platform)

      // Wrong user ID
      expect(() => {
        CommentsCrypto.decryptToken(encrypted, 'wrong-user', platform)
      }).toThrow('Failed to decrypt data')

      // Wrong platform
      expect(() => {
        CommentsCrypto.decryptToken(encrypted, userId, 'tiktok')
      }).toThrow('Failed to decrypt data')
    })

    test('should encrypt comment data with comment context', () => {
      const commentData = 'This is sensitive comment data'
      const commentId = 'comment-123'

      const encrypted = CommentsCrypto.encryptCommentData(commentData, commentId)
      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(commentData)

      const decrypted = CommentsCrypto.decryptCommentData(encrypted, commentId)
      expect(decrypted).toBe(commentData)
    })

    test('should generate secure content hashes', () => {
      const content = 'Test comment content'
      const userId = 'user-123'

      const hash1 = CommentsCrypto.hashContent(content, userId)
      const hash2 = CommentsCrypto.hashContent(content, userId)
      const hash3 = CommentsCrypto.hashContent(content, 'different-user')

      expect(hash1).toBe(hash2) // Same content + user = same hash
      expect(hash1).not.toBe(hash3) // Different user = different hash
      expect(hash1).toMatch(/^[a-f0-9]{64}$/) // Valid SHA-256 hex
    })

    test('should verify content hashes in constant time', () => {
      const content = 'Test comment content'
      const userId = 'user-123'
      const validHash = CommentsCrypto.hashContent(content, userId)
      const invalidHash = 'a'.repeat(64)

      expect(CommentsCrypto.verifyContentHash(content, userId, validHash)).toBe(true)
      expect(CommentsCrypto.verifyContentHash(content, userId, invalidHash)).toBe(false)
    })

    test('should encrypt and decrypt multiple fields', () => {
      const obj = {
        name: 'John Doe',
        token: 'secret-token',
        data: 'sensitive-data',
        number: 123
      }
      const context = 'test-context'

      const encrypted = CommentsCrypto.encryptFields(obj, ['name', 'token', 'data'], context)
      expect(encrypted.name).not.toBe(obj.name)
      expect(encrypted.token).not.toBe(obj.token)
      expect(encrypted.data).not.toBe(obj.data)
      expect(encrypted.number).toBe(obj.number) // Not encrypted

      const decrypted = CommentsCrypto.decryptFields(encrypted, ['name', 'token', 'data'], context)
      expect(decrypted.name).toBe(obj.name)
      expect(decrypted.token).toBe(obj.token)
      expect(decrypted.data).toBe(obj.data)
      expect(decrypted.number).toBe(obj.number)
    })

    test('should handle empty and invalid inputs gracefully', () => {
      expect(() => CommentsCrypto.encrypt('')).toThrow('Plaintext cannot be empty')
      expect(() => CommentsCrypto.decrypt('')).toThrow('Encrypted data cannot be empty')
      expect(() => CommentsCrypto.decrypt('invalid-base64')).toThrow('Failed to decrypt data')
    })

    test('should validate encryption key format', () => {
      expect(CommentsCrypto.validateEncryptionKey(MOCK_ENCRYPTION_KEY)).toBe(true)
      expect(CommentsCrypto.validateEncryptionKey('short')).toBe(false)
      expect(CommentsCrypto.validateEncryptionKey('z'.repeat(64))).toBe(false) // Invalid hex
      expect(CommentsCrypto.validateEncryptionKey(null as any)).toBe(false)
    })

    test('should generate valid encryption keys', () => {
      const key = CommentsCrypto.generateEncryptionKey()
      expect(key).toMatch(/^[a-f0-9]{64}$/)
      expect(CommentsCrypto.validateEncryptionKey(key)).toBe(true)
    })

    test('should generate secure API keys', () => {
      const apiKey = CommentsCrypto.generateAPIKey()
      expect(apiKey).toMatch(/^shc_[a-z0-9]+_[a-f0-9]{32}$/)
      expect(apiKey.length).toBeGreaterThan(40)
    })
  })

  describe('Key Rotation', () => {
    test('should rotate keys successfully', async () => {
      const originalData = ['data1', 'data2', 'data3']
      const context = 'test-context'

      // Encrypt with current key
      const encrypted = originalData.map(data => CommentsCrypto.encrypt(data, context))

      // Set up old key for rotation
      process.env.COMMENTS_ENCRYPTION_KEY_OLD = MOCK_ENCRYPTION_KEY
      process.env.COMMENTS_ENCRYPTION_KEY = CommentsCrypto.generateEncryptionKey()

      // Rotate keys
      const rotated = await KeyRotation.rotateKey(encrypted, context)

      expect(rotated).toHaveLength(originalData.length)
      expect(KeyRotation.verifyRotation(originalData.length, rotated, context)).toBe(true)

      // Verify decryption with new key
      const decrypted = rotated.map(data => CommentsCrypto.decrypt(data, context))
      expect(decrypted).toEqual(originalData)
    })
  })
})

describe('XSS and SQL Injection Protection', () => {
  describe('XSS Detection', () => {
    const xssVectors = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<svg onload="alert(1)">',
      '<body onload="alert(1)">',
      '<div style="background-image:url(javascript:alert(1))">',
      '&#60;script&#62;alert(1)&#60;/script&#62;',
      '%3Cscript%3Ealert(1)%3C/script%3E',
      '<script>document.cookie="xss"</script>',
      'eval("alert(1)")',
      'setTimeout("alert(1)", 1000)',
      '<object data="data:text/html,<script>alert(1)</script>"></object>'
    ]

    test.each(xssVectors)('should detect XSS vector: %s', (vector) => {
      expect(detectAdvancedXSS(vector)).toBe(true)
    })

    test('should not flag legitimate content as XSS', () => {
      const legitimateContent = [
        'This is a normal comment',
        'I love this post! 🎉',
        'Check out my website: https://example.com',
        'Great work on the new feature',
        'Script writers are amazing',
        'JavaScript is a programming language'
      ]

      legitimateContent.forEach(content => {
        expect(detectAdvancedXSS(content)).toBe(false)
      })
    })
  })

  describe('SQL Injection Detection', () => {
    const sqlVectors = [
      "'; DROP TABLE comments; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      "' OR 1=1 --",
      "admin'--",
      "' OR 'x'='x",
      "'; EXEC xp_cmdshell('format c:'); --",
      "1'; WAITFOR DELAY '00:00:10'; --",
      "' OR SLEEP(5) --",
      "'; BENCHMARK(10000000,MD5(1)); --",
      "' HAVING 1=1 --",
      "' GROUP BY 1 HAVING 1=1 --",
      "'; SELECT pg_sleep(10); --"
    ]

    test.each(sqlVectors)('should detect SQL injection vector: %s', (vector) => {
      expect(detectAdvancedSQLInjection(vector)).toBe(true)
    })

    test('should not flag legitimate content as SQL injection', () => {
      const legitimateContent = [
        'I love the new UPDATE feature',
        'Can you SELECT the best option?',
        'This will DROP the beat',
        'We should CREATE more content',
        'DELETE this comment if inappropriate'
      ]

      legitimateContent.forEach(content => {
        expect(detectAdvancedSQLInjection(content)).toBe(false)
      })
    })
  })

  describe('Content Sanitization', () => {
    test('should sanitize XSS attempts', () => {
      const maliciousContent = '<script>alert("xss")</script>Hello World'
      const sanitized = sanitizeCommentString(maliciousContent)
      
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert')
      expect(sanitized).toContain('Hello World')
    })

    test('should remove SQL injection patterns', () => {
      const maliciousContent = "Hello'; DROP TABLE comments; --"
      const sanitized = sanitizeCommentString(maliciousContent)
      
      expect(sanitized).not.toContain('DROP')
      expect(sanitized).not.toContain('TABLE')
      expect(sanitized).not.toContain('--')
      expect(sanitized).toContain('Hello')
    })

    test('should normalize whitespace', () => {
      const content = 'Hello    \n\n   World   \t\t  !'
      const sanitized = sanitizeCommentString(content)
      
      expect(sanitized).toBe('Hello World !')
    })

    test('should limit content length', () => {
      const longContent = 'a'.repeat(15000)
      const sanitized = sanitizeCommentString(longContent, 1000)
      
      expect(sanitized.length).toBe(1000)
    })

    test('should escape HTML entities', () => {
      const content = '<div>Hello & "World"</div>'
      const sanitized = sanitizeCommentString(content)
      
      expect(sanitized).toContain('&lt;')
      expect(sanitized).toContain('&gt;')
      expect(sanitized).toContain('&amp;')
      expect(sanitized).toContain('&quot;')
    })
  })
})

describe('Input Validation Tests', () => {
  describe('Comment Content Validation', () => {
    test('should validate legitimate comment content', () => {
      const validContent = 'This is a great post! Thanks for sharing 👍'
      
      expect(() => CommentContentSchema.parse(validContent)).not.toThrow()
      const result = CommentContentSchema.parse(validContent)
      expect(result).toBe(validContent)
    })

    test('should reject empty content', () => {
      expect(() => CommentContentSchema.parse('')).toThrow('Comment content cannot be empty')
      expect(() => CommentContentSchema.parse('   ')).toThrow('Comment content cannot be empty after sanitization')
    })

    test('should reject content that is too long', () => {
      const longContent = 'a'.repeat(15000)
      expect(() => CommentContentSchema.parse(longContent)).toThrow('Comment content too long')
    })

    test('should reject XSS attempts', () => {
      const xssContent = '<script>alert("xss")</script>'
      expect(() => CommentContentSchema.parse(xssContent)).toThrow('Potential XSS attack detected')
    })

    test('should reject SQL injection attempts', () => {
      const sqlContent = "'; DROP TABLE comments; --"
      expect(() => CommentContentSchema.parse(sqlContent)).toThrow('Potential SQL injection detected')
    })
  })

  describe('Create Comment Validation', () => {
    const validCommentData = {
      platform: 'instagram' as const,
      platform_comment_id: 'comment123',
      platform_post_id: 'post123',
      platform_user_id: 'user123',
      author_username: 'testuser',
      content: 'This is a test comment',
      engagement_metrics: { likes: 5, replies: 2 }
    }

    test('should validate complete comment data', async () => {
      const result = await CommentsValidator.validateComment(validCommentData)
      expect(result.platform).toBe('instagram')
      expect(result.content).toBe('This is a test comment')
    })

    test('should reject invalid platform', async () => {
      const invalidData = { ...validCommentData, platform: 'invalid' }
      await expect(CommentsValidator.validateComment(invalidData)).rejects.toThrow()
    })

    test('should reject invalid engagement metrics', async () => {
      const invalidData = { 
        ...validCommentData, 
        engagement_metrics: { invalid_metric: 'not_a_number' }
      }
      await expect(CommentsValidator.validateComment(invalidData)).rejects.toThrow()
    })

    test('should validate profile picture URLs', async () => {
      const dataWithHttps = {
        ...validCommentData,
        author_profile_picture: 'https://example.com/avatar.jpg'
      }
      await expect(CommentsValidator.validateComment(dataWithHttps)).resolves.toBeDefined()

      const dataWithHttp = {
        ...validCommentData,
        author_profile_picture: 'http://example.com/avatar.jpg'
      }
      await expect(CommentsValidator.validateComment(dataWithHttp)).rejects.toThrow()
    })

    test('should validate sentiment scores', async () => {
      const validSentiment = { ...validCommentData, sentiment_score: 0.75 }
      await expect(CommentsValidator.validateComment(validSentiment)).resolves.toBeDefined()

      const invalidSentiment = { ...validCommentData, sentiment_score: 1.5 }
      await expect(CommentsValidator.validateComment(invalidSentiment)).rejects.toThrow()
    })
  })

  describe('Suspicious Pattern Detection', () => {
    test('should detect repeated characters (spam)', () => {
      const spamContent = 'a'.repeat(100)
      expect(() => CommentContentSchema.parse(spamContent)).toThrow()
    })

    test('should detect multiple URLs (spam)', () => {
      const urlSpam = 'Check https://spam1.com and https://spam2.com and https://spam3.com'
      expect(() => CommentContentSchema.parse(urlSpam)).toThrow()
    })

    test('should detect excessive punctuation', () => {
      const punctuationSpam = '!!!!!!!!!!!!!!!!!!!!!'
      expect(() => CommentContentSchema.parse(punctuationSpam)).toThrow()
    })

    test('should detect binary data', () => {
      const binaryData = String.fromCharCode(0, 1, 2, 3, 4) + 'Hello'
      expect(() => CommentContentSchema.parse(binaryData)).toThrow()
    })
  })
})

describe('Rate Limiting Tests', () => {
  let rateLimiter: RateLimiter
  let mockRedis: any

  beforeEach(() => {
    // Mock Redis client
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

    rateLimiter = new RateLimiter(mockRedis, 'test:')
  })

  describe('Fixed Window Rate Limiting', () => {
    test('should allow requests within limit', async () => {
      mockRedis.incr.mockResolvedValue(5) // 5 requests made

      const result = await rateLimiter.checkLimit('user123', 'comments-read')
      
      expect(result.success).toBe(true)
      expect(result.remaining).toBeGreaterThan(0)
      expect(result.limit).toBe(100)
    })

    test('should block requests exceeding limit', async () => {
      mockRedis.incr.mockResolvedValue(101) // Exceeded limit

      const result = await rateLimiter.checkLimit('user123', 'comments-read')
      
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeDefined()
    })

    test('should handle Redis errors gracefully', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'))

      const result = await rateLimiter.checkLimit('user123', 'comments-read')
      
      // Should fail open (allow request) when Redis is down
      expect(result.success).toBe(true)
    })
  })

  describe('Token Bucket Rate Limiting', () => {
    test('should consume tokens from bucket', async () => {
      mockRedis.eval.mockResolvedValue([1, 19, Date.now()]) // Success, 19 tokens remaining

      const result = await rateLimiter.checkLimit('user123', 'comments-write')
      
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(19)
    })

    test('should reject when bucket is empty', async () => {
      mockRedis.eval.mockResolvedValue([0, 0, Date.now()]) // No tokens available

      const result = await rateLimiter.checkLimit('user123', 'comments-write')
      
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('Failed Attempts Tracking', () => {
    test('should record failed attempts', async () => {
      await rateLimiter.recordFailedAttempt('user123')
      
      expect(mockRedis.incr).toHaveBeenCalledWith('test:failed:user123')
      expect(mockRedis.expire).toHaveBeenCalled()
    })

    test('should auto-block after too many failures', async () => {
      mockRedis.incr.mockResolvedValue(10) // 10 failed attempts

      await rateLimiter.recordFailedAttempt('user123')
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:blocked:user123', 
        '1', 
        { ex: 3600 }
      )
    })

    test('should detect blocked users', async () => {
      mockRedis.get.mockResolvedValue('1') // User is blocked

      const isBlocked = await rateLimiter.isBlocked('user123')
      
      expect(isBlocked).toBe(true)
    })
  })

  describe('Rate Limit Status', () => {
    test('should get current status', async () => {
      mockRedis.get.mockResolvedValue('50') // 50 requests made

      const status = await rateLimiter.getStatus('user123', 'comments-read')
      
      expect(status?.success).toBe(true)
      expect(status?.remaining).toBe(50) // 100 - 50
    })

    test('should reset rate limits', async () => {
      await rateLimiter.resetLimit('user123', 'comments-read')
      
      expect(mockRedis.del).toHaveBeenCalledTimes(3) // Main key + blocked + bucket
    })
  })
})

describe('Integration Security Tests', () => {
  describe('End-to-End Security Flow', () => {
    test('should handle complete comment creation with security', async () => {
      const commentData = {
        platform: 'instagram' as const,
        platform_comment_id: 'comment123',
        platform_post_id: 'post123',
        platform_user_id: 'user123',
        content: 'This is a legitimate comment with some emojis! 🎉 Great post!'
      }

      // 1. Validate input
      const validatedData = await CommentsValidator.validateComment(commentData)
      expect(validatedData.content).toBe(commentData.content)

      // 2. Encrypt sensitive data
      const encryptedToken = CommentsCrypto.encryptToken('access-token-123', 'user123', 'instagram')
      expect(encryptedToken).toBeDefined()
      expect(encryptedToken).not.toBe('access-token-123')

      // 3. Generate content hash
      const contentHash = CommentsCrypto.hashContent(validatedData.content, 'user123')
      expect(contentHash).toMatch(/^[a-f0-9]{64}$/)

      // 4. Verify hash
      const isValidHash = CommentsCrypto.verifyContentHash(validatedData.content, 'user123', contentHash)
      expect(isValidHash).toBe(true)
    })

    test('should reject malicious comment with multiple attack vectors', async () => {
      const maliciousData = {
        platform: 'instagram' as const,
        platform_comment_id: '<script>alert("xss")</script>',
        platform_post_id: "'; DROP TABLE comments; --",
        platform_user_id: 'user123',
        content: '<iframe src="javascript:alert(1)"></iframe> AND 1=1 --'
      }

      await expect(CommentsValidator.validateComment(maliciousData)).rejects.toThrow()
    })
  })

  describe('Performance and Load Testing', () => {
    test('should handle multiple encryption operations efficiently', () => {
      const startTime = Date.now()
      const testData = Array.from({ length: 100 }, (_, i) => `test-token-${i}`)
      
      const encrypted = testData.map(token => 
        CommentsCrypto.encryptToken(token, 'user123', 'instagram')
      )
      
      const decrypted = encrypted.map(encryptedToken => 
        CommentsCrypto.decryptToken(encryptedToken, 'user123', 'instagram')
      )
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      expect(decrypted).toEqual(testData)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    test('should handle large content validation efficiently', () => {
      const largeContent = 'This is a test comment. '.repeat(200) // ~5KB content
      const startTime = Date.now()
      
      const sanitized = sanitizeCommentString(largeContent)
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      expect(sanitized).toBeDefined()
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  test('should handle malformed encryption data', () => {
    expect(() => CommentsCrypto.decrypt('not-base64!@#', 'context')).toThrow()
    expect(() => CommentsCrypto.decrypt('dGVzdA==', 'context')).toThrow() // Valid base64 but wrong format
  })

  test('should handle unicode and special characters', () => {
    const unicodeContent = '🎉 Hello 世界! Émojis and spëcial châractërs 🌟'
    const sanitized = sanitizeCommentString(unicodeContent)
    
    expect(sanitized).toContain('🎉')
    expect(sanitized).toContain('世界')
    expect(sanitized).toContain('🌟')
  })

  test('should handle extremely long inputs gracefully', () => {
    const extremeContent = 'a'.repeat(1000000) // 1MB string
    
    expect(() => sanitizeCommentString(extremeContent, 10000)).not.toThrow()
    const result = sanitizeCommentString(extremeContent, 10000)
    expect(result.length).toBe(10000)
  })

  test('should handle null and undefined inputs', () => {
    expect(sanitizeCommentString(null)).toBe('')
    expect(sanitizeCommentString(undefined)).toBe('')
    expect(sanitizeCommentString(123 as any)).toBe('')
    expect(sanitizeCommentString({} as any)).toBe('')
  })
})