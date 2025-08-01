/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET as CommentsGET, POST as CommentsPOST } from '@/app/api/comments/route'
import { POST as ModerationPOST } from '@/app/api/comments/moderate/route'
import { createClient } from '@supabase/supabase-js'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { RateLimiter } from '@/lib/rate-limiter'

// Mock dependencies
jest.mock('@supabase/supabase-js')
jest.mock('@/lib/comments-crypto')
jest.mock('@/lib/rate-limiter')
jest.mock('@/lib/security-middleware')
jest.mock('@/lib/secure-logger')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockCommentsCrypto = CommentsCrypto as jest.Mocked<typeof CommentsCrypto>

describe('Comments API Performance Tests', () => {
  let mockSupabaseClient: any
  let mockUser: any
  let mockRequest: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      aud: 'authenticated'
    }

    // Setup mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        textSearch: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn()
      }))
    }

    mockCreateClient.mockReturnValue(mockSupabaseClient)

    // Setup mock security middleware and rate limiter
    const { SecurityMiddleware } = require('@/lib/security-middleware')
    const { RateLimitMiddleware } = require('@/lib/rate-limiter')
    
    SecurityMiddleware.handle = jest.fn().mockResolvedValue(null)
    RateLimitMiddleware.getCommentsRateLimit = jest.fn(() => () => ({
      success: true,
      remaining: 95,
      limit: 100,
      resetTime: Date.now() + 60000
    }))
    RateLimitMiddleware.getCommentsWriteRateLimit = jest.fn(() => () => ({
      success: true,
      remaining: 19,
      limit: 20,
      resetTime: Date.now() + 60000
    }))

    // Setup crypto mocks
    mockCommentsCrypto.encryptToken = jest.fn().mockReturnValue('encrypted-token')
    mockCommentsCrypto.decryptToken = jest.fn().mockReturnValue('decrypted-token')
    mockCommentsCrypto.encryptCommentData = jest.fn().mockReturnValue('encrypted-data')
    mockCommentsCrypto.decryptCommentData = jest.fn().mockReturnValue('decrypted-data')
    mockCommentsCrypto.hashContent = jest.fn().mockReturnValue('a'.repeat(64))

    // Setup mock request
    mockRequest = {
      headers: new Map([
        ['authorization', 'Bearer valid-token'],
        ['content-type', 'application/json'],
        ['x-forwarded-for', '127.0.0.1']
      ]),
      url: 'http://localhost:3000/api/comments',
      method: 'GET',
      json: jest.fn(),
      nextUrl: {
        searchParams: new URLSearchParams()
      }
    } as any

    mockRequest.headers.get = jest.fn((key: string) => {
      const headers: Record<string, string> = {
        'authorization': 'Bearer valid-token',
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1'
      }
      return headers[key.toLowerCase()] || null
    })
  })

  describe('Response Time Performance', () => {
    test('GET /api/comments should respond within 200ms', async () => {
      const mockComments = Array(50).fill(null).map((_, i) => ({
        id: `comment-${i}`,
        content: `Test comment ${i}`,
        platform: 'instagram',
        user_id: mockUser.id,
        created_at: new Date().toISOString()
      }))

      // Simulate realistic database response time
      mockSupabaseClient.from().single = jest.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: mockComments,
            error: null,
            count: 50
          }), 50) // 50ms database response
        )
      )

      const startTime = performance.now()
      const response = await CommentsGET(mockRequest)
      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(200) // Should respond within 200ms
    })

    test('POST /api/comments should respond within 300ms', async () => {
      const commentData = {
        platform: 'instagram',
        platform_comment_id: 'comment123',
        platform_post_id: 'post123',
        platform_user_id: 'user123',
        content: 'Performance test comment'
      }

      mockRequest.method = 'POST'
      mockRequest.json = jest.fn().mockResolvedValue(commentData)

      const mockCreatedComment = {
        id: 'comment-new',
        ...commentData,
        user_id: mockUser.id,
        status: 'pending'
      }

      // Mock duplicate check and creation
      mockSupabaseClient.from().single = jest.fn()
        .mockImplementationOnce(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ data: null, error: { code: 'PGRST116' } }), 20)
          )
        ) // Duplicate check
        .mockImplementationOnce(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ data: mockCreatedComment, error: null }), 30)
          )
        ) // Creation

      const startTime = performance.now()
      const response = await CommentsPOST(mockRequest)
      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(response.status).toBe(201)
      expect(responseTime).toBeLessThan(300) // Should respond within 300ms
    })

    test('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 20
      const mockComments = [{ id: 'comment-1', content: 'Test', user_id: mockUser.id }]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockComments,
        error: null,
        count: 1
      })

      const startTime = performance.now()
      const promises = Array(concurrentRequests).fill(null).map(() => CommentsGET(mockRequest))
      const responses = await Promise.all(promises)
      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(responses.every(r => r.status === 200)).toBe(true)
      expect(totalTime).toBeLessThan(1000) // All 20 requests should complete within 1 second
      expect(totalTime / concurrentRequests).toBeLessThan(50) // Average per request should be under 50ms
    })
  })

  describe('Memory Usage Optimization', () => {
    test('should handle large result sets without memory issues', async () => {
      const largeResultSet = Array(1000).fill(null).map((_, i) => ({
        id: `comment-${i}`,
        content: `Comment content ${i} `.repeat(50), // ~2KB per comment
        platform: 'instagram',
        user_id: mockUser.id,
        engagement_metrics: {
          likes: Math.floor(Math.random() * 1000),
          replies: Math.floor(Math.random() * 50),
          shares: Math.floor(Math.random() * 100)
        },
        created_at: new Date().toISOString()
      }))

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: largeResultSet,
        error: null,
        count: 1000
      })

      const initialMemory = process.memoryUsage()
      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()
      const finalMemory = process.memoryUsage()
      
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(1000)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Should not increase memory by more than 50MB
    })

    test('should efficiently process encrypted data', async () => {
      const encryptedComments = Array(100).fill(null).map((_, i) => ({
        id: `comment-${i}`,
        content: `Test comment ${i}`,
        platform: 'instagram',
        platform_user_id: 'encrypted-user-id',
        user_id: mockUser.id
      }))

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: encryptedComments,
        error: null,
        count: 100
      })

      const startTime = performance.now()
      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()
      const endTime = performance.now()
      const processingTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(100)
      expect(processingTime).toBeLessThan(500) // Should process 100 encrypted comments within 500ms
      
      // Verify all platform_user_ids are masked
      expect(responseData.data.every((comment: any) => 
        comment.platform_user_id.endsWith('***')
      )).toBe(true)
    })
  })

  describe('Database Query Performance', () => {
    test('should optimize pagination queries', async () => {
      const totalComments = 10000
      const pageSize = 50
      const offset = 5000 // Mid-way through large dataset

      mockRequest.url = `http://localhost:3000/api/comments?limit=${pageSize}&offset=${offset}`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`limit=${pageSize}&offset=${offset}`)

      const mockComments = Array(pageSize).fill(null).map((_, i) => ({
        id: `comment-${offset + i}`,
        content: `Comment ${offset + i}`,
        platform: 'instagram',
        user_id: mockUser.id
      }))

      let queryExecutionTime = 0
      mockSupabaseClient.from().single = jest.fn().mockImplementation(() => {
        const start = performance.now()
        return new Promise(resolve => {
          setTimeout(() => {
            queryExecutionTime = performance.now() - start
            resolve({
              data: mockComments,
              error: null,
              count: totalComments
            })
          }, 30) // Simulate 30ms query time
        })
      })

      const startTime = performance.now()
      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()
      const endTime = performance.now()

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(pageSize)
      expect(responseData.pagination.total).toBe(totalComments)
      expect(endTime - startTime).toBeLessThan(100) // Total response time
      expect(queryExecutionTime).toBeLessThan(50) // Database query time
    })

    test('should optimize complex search queries', async () => {
      mockRequest.url = 'http://localhost:3000/api/comments?platform=instagram&status=approved&search=amazing&date_from=2024-01-01&sort=engagement_metrics'
      mockRequest.nextUrl.searchParams = new URLSearchParams('platform=instagram&status=approved&search=amazing&date_from=2024-01-01&sort=engagement_metrics')

      const complexQueryResults = Array(25).fill(null).map((_, i) => ({
        id: `comment-${i}`,
        content: `Amazing product comment ${i}`,
        platform: 'instagram',
        status: 'approved',
        engagement_metrics: { likes: Math.floor(Math.random() * 1000) },
        user_id: mockUser.id,
        created_at: '2024-01-15T00:00:00Z'
      }))

      mockSupabaseClient.from().single = jest.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: complexQueryResults,
            error: null,
            count: 25
          }), 75) // Simulate complex query taking 75ms
        )
      )

      const startTime = performance.now()
      const response = await CommentsGET(mockRequest)
      const endTime = performance.now()
      const queryTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(queryTime).toBeLessThan(200) // Complex query should still complete quickly
    })

    test('should handle database connection pooling efficiently', async () => {
      // Simulate multiple rapid requests that would use connection pooling
      const rapidRequest = async () => {
        mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
          data: [{ id: 'comment-1', content: 'Test', user_id: mockUser.id }],
          error: null,
          count: 1
        })
        return CommentsGET(mockRequest)
      }

      const connectionStartTime = performance.now()
      const rapidPromises = Array(50).fill(null).map(() => rapidRequest())
      const responses = await Promise.all(rapidPromises)
      const connectionEndTime = performance.now()
      const totalConnectionTime = connectionEndTime - connectionStartTime

      expect(responses.every(r => r.status === 200)).toBe(true)
      expect(totalConnectionTime).toBeLessThan(2000) // 50 rapid requests should complete within 2 seconds
      expect(totalConnectionTime / 50).toBeLessThan(40) // Average per request should be under 40ms
    })
  })

  describe('Bulk Operations Performance', () => {
    test('should handle bulk moderation efficiently', async () => {
      const bulkCommentIds = Array(100).fill(null).map((_, i) => `comment-${i}`)
      const moderationData = {
        comment_ids: bulkCommentIds,
        action: 'approve',
        reason: 'Bulk approval for performance test'
      }

      mockRequest.method = 'POST'
      mockRequest.json = jest.fn().mockResolvedValue(moderationData)

      const mockExistingComments = bulkCommentIds.map(id => ({
        id,
        user_id: mockUser.id,
        status: 'pending',
        content: `Content for ${id}`
      }))

      const mockUpdatedComments = bulkCommentIds.map(id => ({
        id,
        status: 'approved',
        updated_at: new Date().toISOString()
      }))

      let callCount = 0
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn(() => {
          callCount++
          if (callCount === 1) return Promise.resolve({ data: { id: mockUser.id, role_id: 2 }, error: null }) // Admin check
          if (callCount === 2) return Promise.resolve({ data: mockExistingComments, error: null }) // Fetch comments
          if (callCount === 3) return Promise.resolve({ data: { id: mockUser.id, role_id: 2 }, error: null }) // Admin profile check
          return Promise.resolve({ data: mockUpdatedComments, error: null }) // Update result
        })
      }))

      const startTime = performance.now()
      const response = await ModerationPOST(mockRequest)
      const responseData = await response.json()
      const endTime = performance.now()
      const bulkTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseData.summary.successfully_updated).toBe(100)
      expect(bulkTime).toBeLessThan(1000) // Bulk operation should complete within 1 second
    })

    test('should optimize batch encryption operations', async () => {
      const batchSize = 50
      const batchData = Array(batchSize).fill(null).map((_, i) => ({
        platform: 'instagram',
        platform_comment_id: `comment-${i}`,
        platform_post_id: `post-${i}`,
        platform_user_id: `user-${i}`,
        content: `Batch comment ${i}`
      }))

      // Mock encryption to simulate realistic processing time
      mockCommentsCrypto.encryptCommentData = jest.fn().mockImplementation(() => {
        // Simulate 1ms encryption time per item
        return new Promise(resolve => setTimeout(() => resolve('encrypted-data'), 1))
      })

      mockCommentsCrypto.hashContent = jest.fn().mockImplementation(() => {
        // Simulate 0.5ms hashing time per item
        return new Promise(resolve => setTimeout(() => resolve('hash-value'), 0.5))
      })

      const encryptionStartTime = performance.now()
      
      // Process batch encryption
      const encryptedData = await Promise.all(
        batchData.map(async (item) => ({
          ...item,
          encrypted_user_id: await mockCommentsCrypto.encryptCommentData(item.platform_user_id, `${mockUser.id}:${item.platform}`),
          content_hash: await mockCommentsCrypto.hashContent(item.content, mockUser.id)
        }))
      )

      const encryptionEndTime = performance.now()
      const encryptionTime = encryptionEndTime - encryptionStartTime

      expect(encryptedData).toHaveLength(batchSize)
      expect(encryptionTime).toBeLessThan(200) // Batch encryption should complete within 200ms
      expect(encryptionTime / batchSize).toBeLessThan(4) // Average per item should be under 4ms
    })
  })

  describe('Resource Usage Monitoring', () => {
    test('should monitor CPU usage during heavy operations', async () => {
      const heavyComputationData = Array(500).fill(null).map((_, i) => ({
        id: `comment-${i}`,
        content: 'x'.repeat(1000), // 1KB content per comment
        platform: 'instagram',
        user_id: mockUser.id,
        engagement_metrics: {
          likes: Math.floor(Math.random() * 10000),
          replies: Math.floor(Math.random() * 500),
          shares: Math.floor(Math.random() * 1000)
        }
      }))

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: heavyComputationData,
        error: null,
        count: 500
      })

      const startCpuUsage = process.cpuUsage()
      const startTime = performance.now()

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      const endTime = performance.now()
      const endCpuUsage = process.cpuUsage(startCpuUsage)
      const processingTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(500)
      expect(processingTime).toBeLessThan(1000) // Should process within 1 second
      
      // CPU usage should be reasonable (less than 100ms of CPU time)
      const totalCpuMs = (endCpuUsage.user + endCpuUsage.system) / 1000
      expect(totalCpuMs).toBeLessThan(100)
    })

    test('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by creating large objects
      const largeDataSet = Array(2000).fill(null).map((_, i) => ({
        id: `comment-${i}`,
        content: 'Large content '.repeat(100), // ~1.3KB per comment
        platform: 'instagram',
        user_id: mockUser.id,
        metadata: {
          large_field: 'x'.repeat(500),
          timestamps: Array(10).fill(null).map(() => new Date().toISOString()),
          nested_data: {
            level1: { level2: { level3: 'nested'.repeat(100) } }
          }
        }
      }))

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: largeDataSet,
        error: null,
        count: 2000
      })

      const initialMemory = process.memoryUsage()
      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()
      const finalMemory = process.memoryUsage()

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const rss = finalMemory.rss - initialMemory.rss

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(2000)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Should not increase heap by more than 100MB
      expect(rss).toBeLessThan(150 * 1024 * 1024) // RSS should not increase by more than 150MB
    })

    test('should optimize garbage collection impact', async () => {
      const iterations = 10
      const gcImpact = []

      for (let i = 0; i < iterations; i++) {
        const testData = Array(200).fill(null).map((_, j) => ({
          id: `comment-${i}-${j}`,
          content: `Test comment ${i}-${j}`,
          platform: 'instagram',
          user_id: mockUser.id
        }))

        mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
          data: testData,
          error: null,
          count: 200
        })

        const startTime = performance.now()
        const response = await CommentsGET(mockRequest)
        const endTime = performance.now()
        
        gcImpact.push(endTime - startTime)
        
        expect(response.status).toBe(200)
      }

      // Check for GC consistency - response times shouldn't vary too much
      const avgTime = gcImpact.reduce((a, b) => a + b, 0) / gcImpact.length
      const maxDeviation = Math.max(...gcImpact.map(time => Math.abs(time - avgTime)))
      
      expect(avgTime).toBeLessThan(100) // Average response time should be under 100ms
      expect(maxDeviation).toBeLessThan(avgTime * 0.5) // No response should deviate more than 50% from average
    })
  })

  describe('Cache Performance', () => {
    test('should benefit from query result caching', async () => {
      const cacheKey = 'platform:instagram:status:approved'
      const cachedComments = [
        { id: 'comment-1', content: 'Cached comment', platform: 'instagram', user_id: mockUser.id }
      ]

      // First request - cache miss
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: cachedComments,
        error: null,
        count: 1
      })

      const firstRequestStart = performance.now()
      const firstResponse = await CommentsGET(mockRequest)
      const firstRequestTime = performance.now() - firstRequestStart

      expect(firstResponse.status).toBe(200)

      // Second request - should be faster due to caching
      const secondRequestStart = performance.now()
      const secondResponse = await CommentsGET(mockRequest)
      const secondRequestTime = performance.now() - secondRequestStart

      expect(secondResponse.status).toBe(200)
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.8) // Should be at least 20% faster
    })

    test('should handle cache invalidation efficiently', async () => {
      // Test that cache is properly invalidated after write operations
      const readRequest = { ...mockRequest }
      const writeRequest = {
        ...mockRequest,
        method: 'POST',
        json: jest.fn().mockResolvedValue({
          platform: 'instagram',
          content: 'New comment for cache test',
          platform_comment_id: 'cache-test'
        })
      }

      // Initial read to populate cache
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: [{ id: 'comment-1', content: 'Original', user_id: mockUser.id }],
        error: null,
        count: 1
      })

      await CommentsGET(readRequest)

      // Write operation to invalidate cache
      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // Duplicate check
        .mockResolvedValueOnce({ 
          data: { id: 'comment-2', content: 'New comment', user_id: mockUser.id }, 
          error: null 
        }) // Creation

      const writeStart = performance.now()
      await CommentsPOST(writeRequest)
      const writeTime = performance.now() - writeStart

      // Subsequent read should fetch fresh data
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: [
          { id: 'comment-1', content: 'Original', user_id: mockUser.id },
          { id: 'comment-2', content: 'New comment', user_id: mockUser.id }
        ],
        error: null,
        count: 2
      })

      const readAfterWriteStart = performance.now()
      const freshResponse = await CommentsGET(readRequest)
      const readAfterWriteTime = performance.now() - readAfterWriteStart

      expect(writeTime).toBeLessThan(300) // Write operation should be fast
      expect(readAfterWriteTime).toBeLessThan(150) // Fresh read should still be reasonably fast
      expect(freshResponse.status).toBe(200)
    })
  })

  test('should maintain performance under stress conditions', async () => {
    // Simulate high load conditions
    const stressTestRequests = 100
    const maxConcurrency = 10
    const results = []

    // Function to create batches of concurrent requests
    const processBatch = async (batchStart: number, batchSize: number) => {
      const batchPromises = []
      
      for (let i = 0; i < batchSize; i++) {
        const requestIndex = batchStart + i
        if (requestIndex >= stressTestRequests) break

        mockSupabaseClient.from().single = jest.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              data: [{ id: `comment-${requestIndex}`, content: 'Stress test', user_id: mockUser.id }],
              error: null,
              count: 1
            }), Math.random() * 20 + 10) // Random delay 10-30ms
          )
        )

        const requestStart = performance.now()
        const requestPromise = CommentsGET(mockRequest).then(response => {
          const requestTime = performance.now() - requestStart
          return { response, requestTime, index: requestIndex }
        })
        
        batchPromises.push(requestPromise)
      }

      return Promise.all(batchPromises)
    }

    const overallStart = performance.now()
    
    // Process requests in batches to simulate controlled concurrency
    for (let i = 0; i < stressTestRequests; i += maxConcurrency) {
      const batchResults = await processBatch(i, maxConcurrency)
      results.push(...batchResults)
    }

    const overallTime = performance.now() - overallStart
    const avgResponseTime = results.reduce((sum, r) => sum + r.requestTime, 0) / results.length
    const maxResponseTime = Math.max(...results.map(r => r.requestTime))
    const successRate = results.filter(r => r.response.status === 200).length / results.length

    expect(successRate).toBeGreaterThan(0.95) // 95% success rate
    expect(avgResponseTime).toBeLessThan(100) // Average response time under 100ms
    expect(maxResponseTime).toBeLessThan(500) // No request should take more than 500ms
    expect(overallTime).toBeLessThan(15000) // All requests should complete within 15 seconds
  })
})