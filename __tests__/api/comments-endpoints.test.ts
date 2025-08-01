/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET as PlatformGET } from '@/app/api/comments/platforms/[platform]/route'
import { GET as SearchGET } from '@/app/api/comments/search/route'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@supabase/supabase-js')
jest.mock('@/lib/security-middleware')
jest.mock('@/lib/rate-limiter')
jest.mock('@/lib/secure-logger')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('Comments Platform and Search Endpoints', () => {
  let mockSupabaseClient: any
  let mockRequest: NextRequest
  let mockUser: any

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
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        textSearch: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn()
      }))
    }

    mockCreateClient.mockReturnValue(mockSupabaseClient)

    // Mock security middleware and rate limiter
    const { SecurityMiddleware } = require('@/lib/security-middleware')
    const { RateLimitMiddleware } = require('@/lib/rate-limiter')
    
    SecurityMiddleware.handle = jest.fn().mockResolvedValue(null)
    RateLimitMiddleware.getCommentsRateLimit = jest.fn(() => () => ({
      success: true,
      remaining: 95,
      limit: 100,
      resetTime: Date.now() + 60000
    }))

    // Setup mock request
    mockRequest = {
      headers: new Map([
        ['authorization', 'Bearer valid-token'],
        ['content-type', 'application/json'],
        ['x-forwarded-for', '127.0.0.1']
      ]),
      method: 'GET',
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

  describe('GET /api/comments/platforms/[platform] - Platform-Specific Comments', () => {
    const testPlatforms = ['instagram', 'tiktok', 'facebook', 'twitter', 'youtube', 'linkedin']

    test.each(testPlatforms)('should fetch %s comments successfully', async (platform) => {
      const mockComments = [
        {
          id: 'comment-1',
          content: `Test ${platform} comment 1`,
          platform: platform,
          status: 'approved',
          user_id: mockUser.id,
          engagement_metrics: { likes: 10, replies: 2 },
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'comment-2',
          content: `Test ${platform} comment 2`,
          platform: platform,
          status: 'pending',
          user_id: mockUser.id,
          engagement_metrics: { likes: 5, replies: 0 },
          created_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockComments,
        error: null,
        count: 2
      })

      mockRequest.url = `http://localhost:3000/api/comments/platforms/${platform}`
      
      const response = await PlatformGET(mockRequest, { params: { platform } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toHaveLength(2)
      expect(responseData.platform).toBe(platform)
      expect(responseData.data.every((comment: any) => comment.platform === platform)).toBe(true)
    })

    test('should validate platform parameter', async () => {
      const invalidPlatform = 'invalid-platform'
      
      const response = await PlatformGET(mockRequest, { params: { platform: invalidPlatform } })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Invalid platform')
      expect(responseData.valid_platforms).toEqual(testPlatforms)
    })

    test('should apply platform-specific filtering', async () => {
      const platform = 'instagram'
      mockRequest.url = `http://localhost:3000/api/comments/platforms/${platform}?status=approved&date_from=2024-01-01`
      mockRequest.nextUrl.searchParams = new URLSearchParams('status=approved&date_from=2024-01-01')

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const response = await PlatformGET(mockRequest, { params: { platform } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.filters.platform).toBe(platform)
      expect(responseData.filters.status).toBe('approved')
      expect(responseData.filters.date_from).toBe('2024-01-01')
    })

    test('should handle pagination for platform comments', async () => {
      const platform = 'tiktok'
      const totalComments = 150
      const limit = 50
      const offset = 100

      mockRequest.url = `http://localhost:3000/api/comments/platforms/${platform}?limit=${limit}&offset=${offset}`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`limit=${limit}&offset=${offset}`)

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: Array(50).fill(null).map((_, i) => ({
          id: `comment-${i + offset}`,
          content: `TikTok comment ${i + offset}`,
          platform: platform,
          user_id: mockUser.id
        })),
        error: null,
        count: totalComments
      })

      const response = await PlatformGET(mockRequest, { params: { platform } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.pagination.offset).toBe(offset)
      expect(responseData.pagination.limit).toBe(limit)
      expect(responseData.pagination.total).toBe(totalComments)
      expect(responseData.pagination.hasMore).toBe(true)
    })

    test('should return platform-specific engagement metrics', async () => {
      const platform = 'instagram'
      const mockComments = [
        {
          id: 'comment-1',
          content: 'Instagram comment with metrics',
          platform: platform,
          user_id: mockUser.id,
          engagement_metrics: {
            likes: 25,
            replies: 5,
            shares: 2 // Instagram-specific
          },
          platform_metrics: {
            reach: 1000,
            impressions: 1500
          }
        }
      ]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockComments,
        error: null,
        count: 1
      })

      const response = await PlatformGET(mockRequest, { params: { platform } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data[0].engagement_metrics.shares).toBe(2)
      expect(responseData.data[0].platform_metrics.reach).toBe(1000)
    })

    test('should handle empty results for platform', async () => {
      const platform = 'linkedin'
      
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const response = await PlatformGET(mockRequest, { params: { platform } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toHaveLength(0)
      expect(responseData.pagination.total).toBe(0)
      expect(responseData.platform).toBe(platform)
    })

    test('should include platform-specific statistics', async () => {
      const platform = 'tiktok'
      const mockComments = Array(10).fill(null).map((_, i) => ({
        id: `comment-${i}`,
        content: `TikTok comment ${i}`,
        platform: platform,
        status: i % 3 === 0 ? 'approved' : i % 3 === 1 ? 'pending' : 'rejected',
        sentiment_score: (Math.random() - 0.5) * 2, // -1 to 1
        engagement_metrics: { likes: Math.floor(Math.random() * 100) },
        user_id: mockUser.id
      }))

      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: mockComments, error: null, count: 10 }) // Comments query
        .mockResolvedValueOnce({ data: mockComments, error: null }) // Stats query

      const response = await PlatformGET(mockRequest, { params: { platform } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.statistics).toBeDefined()
      expect(responseData.statistics.total_comments).toBe(10)
      expect(responseData.statistics.by_status).toBeDefined()
      expect(responseData.statistics.sentiment_distribution).toBeDefined()
      expect(responseData.statistics.engagement_summary).toBeDefined()
    })
  })

  describe('GET /api/comments/search - Comment Search', () => {
    test('should search comments by content', async () => {
      const searchQuery = 'amazing product'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(searchQuery)}`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(searchQuery)}`)

      const mockSearchResults = [
        {
          id: 'comment-1',
          content: 'This is an amazing product! Love it!',
          platform: 'instagram',
          status: 'approved',
          user_id: mockUser.id,
          relevance_score: 0.95,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'comment-2',
          content: 'The product quality is amazing, highly recommend',
          platform: 'tiktok',
          status: 'approved',
          user_id: mockUser.id,
          relevance_score: 0.87,
          created_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockSearchResults,
        error: null,
        count: 2
      })

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toHaveLength(2)
      expect(responseData.query).toBe(searchQuery)
      expect(responseData.data[0].relevance_score).toBeGreaterThan(responseData.data[1].relevance_score)
    })

    test('should validate search query parameters', async () => {
      // Test empty query
      mockRequest.url = 'http://localhost:3000/api/comments/search?q='
      mockRequest.nextUrl.searchParams = new URLSearchParams('q=')

      let response = await SearchGET(mockRequest)
      let responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Search query is required')

      // Test query too short
      mockRequest.url = 'http://localhost:3000/api/comments/search?q=ab'
      mockRequest.nextUrl.searchParams = new URLSearchParams('q=ab')

      response = await SearchGET(mockRequest)
      responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Search query must be at least 3 characters')
    })

    test('should apply search filters', async () => {
      const searchQuery = 'great'
      const filters = {
        platform: 'instagram',
        status: 'approved',
        sentiment: 'positive',
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      }

      const queryParams = new URLSearchParams({
        q: searchQuery,
        ...filters
      })

      mockRequest.url = `http://localhost:3000/api/comments/search?${queryParams}`
      mockRequest.nextUrl.searchParams = queryParams

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.filters.platform).toBe(filters.platform)
      expect(responseData.filters.status).toBe(filters.status)
      expect(responseData.filters.sentiment).toBe(filters.sentiment)
      expect(responseData.filters.date_range.from).toBe(filters.date_from)
      expect(responseData.filters.date_range.to).toBe(filters.date_to)
    })

    test('should support advanced search operators', async () => {
      const advancedQueries = [
        'amazing AND product',
        'love OR like',
        'NOT spam',
        '"exact phrase"',
        'quality -defect',
        'instagram:great', // Platform-specific search
        '@username mentioned', // User mention search
        '#hashtag trending' // Hashtag search
      ]

      for (const query of advancedQueries) {
        mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(query)}`
        mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(query)}`)

        mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
          data: [
            {
              id: 'comment-1',
              content: `Test comment for: ${query}`,
              platform: 'instagram',
              user_id: mockUser.id,
              relevance_score: 0.8
            }
          ],
          error: null,
          count: 1
        })

        const response = await SearchGET(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(200)
        expect(responseData.query).toBe(query)
        expect(responseData.search_type).toBeDefined()
      }
    })

    test('should rank results by relevance', async () => {
      const searchQuery = 'excellent service'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(searchQuery)}`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(searchQuery)}`)

      const mockResults = [
        {
          id: 'comment-1',
          content: 'Excellent service, highly recommend!',
          relevance_score: 0.95,
          platform: 'instagram',
          user_id: mockUser.id
        },
        {
          id: 'comment-2',
          content: 'The service was excellent and professional',
          relevance_score: 0.88,
          platform: 'tiktok',
          user_id: mockUser.id
        },
        {
          id: 'comment-3',
          content: 'Good service, could be excellent with improvements',
          relevance_score: 0.72,
          platform: 'facebook',
          user_id: mockUser.id
        }
      ]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockResults,
        error: null,
        count: 3
      })

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(3)
      
      // Verify results are ordered by relevance score (descending)
      for (let i = 0; i < responseData.data.length - 1; i++) {
        expect(responseData.data[i].relevance_score).toBeGreaterThanOrEqual(
          responseData.data[i + 1].relevance_score
        )
      }
    })

    test('should support faceted search results', async () => {
      const searchQuery = 'product quality'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(searchQuery)}&facets=true`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(searchQuery)}&facets=true`)

      const mockResults = Array(20).fill(null).map((_, i) => ({
        id: `comment-${i}`,
        content: `Comment about product quality ${i}`,
        platform: ['instagram', 'tiktok', 'facebook'][i % 3],
        status: ['approved', 'pending', 'rejected'][i % 3],
        sentiment_score: (Math.random() - 0.5) * 2,
        user_id: mockUser.id,
        relevance_score: Math.random()
      }))

      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: mockResults.slice(0, 10), error: null, count: 20 }) // Search results
        .mockResolvedValueOnce({ data: mockResults, error: null }) // Facet data

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.facets).toBeDefined()
      expect(responseData.facets.platforms).toBeDefined()
      expect(responseData.facets.statuses).toBeDefined()
      expect(responseData.facets.sentiment_distribution).toBeDefined()
      expect(responseData.facets.date_distribution).toBeDefined()
    })

    test('should handle search suggestions and corrections', async () => {
      const misspelledQuery = 'amzing prodct' // Misspelled "amazing product"
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(misspelledQuery)}`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(misspelledQuery)}`)

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(0)
      expect(responseData.suggestions).toBeDefined()
      expect(responseData.suggestions.corrected_query).toBe('amazing product')
      expect(responseData.suggestions.alternative_queries).toContain('amazing products')
    })

    test('should support semantic search', async () => {
      const semanticQuery = 'unhappy customers complaining'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(semanticQuery)}&semantic=true`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(semanticQuery)}&semantic=true`)

      const mockSemanticResults = [
        {
          id: 'comment-1',
          content: 'Disappointed with the service quality',
          platform: 'instagram',
          sentiment_score: -0.7,
          semantic_similarity: 0.89,
          user_id: mockUser.id
        },
        {
          id: 'comment-2',
          content: 'Not satisfied with my purchase experience',
          platform: 'tiktok',
          sentiment_score: -0.5,
          semantic_similarity: 0.82,
          user_id: mockUser.id
        }
      ]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockSemanticResults,
        error: null,
        count: 2
      })

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.search_type).toBe('semantic')
      expect(responseData.data[0].semantic_similarity).toBeGreaterThan(0.8)
      expect(responseData.data.every((item: any) => item.sentiment_score < 0)).toBe(true)
    })

    test('should handle search performance and caching', async () => {
      const popularQuery = 'great product'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(popularQuery)}`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(popularQuery)}`)

      const startTime = Date.now()

      mockSupabaseClient.from().single = jest.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: [{ id: 'comment-1', content: 'Great product!', user_id: mockUser.id }],
            error: null,
            count: 1
          }), 50) // Simulate 50ms database response
        )
      )

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()
      const endTime = Date.now()

      expect(response.status).toBe(200)
      expect(responseData.performance).toBeDefined()
      expect(responseData.performance.search_time_ms).toBeLessThan(200)
      expect(responseData.performance.total_time_ms).toBe(endTime - startTime)
      expect(responseData.performance.cached).toBeDefined()
    })

    test('should limit search results to prevent abuse', async () => {
      const searchQuery = 'test'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(searchQuery)}&limit=500`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(searchQuery)}&limit=500`)

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Search limit too high. Maximum allowed: 100')
    })

    test('should sanitize search query for security', async () => {
      const maliciousQueries = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE comments; --",
        'javascript:alert(1)',
        '<img src="x" onerror="alert(1)">'
      ]

      for (const maliciousQuery of maliciousQueries) {
        mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(maliciousQuery)}`
        mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(maliciousQuery)}`)

        const response = await SearchGET(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(400)
        expect(responseData.error).toBe('Invalid search query detected')
        expect(responseData.sanitized_query).toBeDefined()
        expect(responseData.sanitized_query).not.toContain('<script>')
        expect(responseData.sanitized_query).not.toContain('DROP TABLE')
      }
    })
  })

  describe('Cross-Platform Search Integration', () => {
    test('should search across multiple platforms simultaneously', async () => {
      const searchQuery = 'customer feedback'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(searchQuery)}&platforms=instagram,tiktok,facebook`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(searchQuery)}&platforms=instagram,tiktok,facebook`)

      const mockCrossResults = [
        { id: 'c1', content: 'Customer feedback on Instagram', platform: 'instagram', user_id: mockUser.id },
        { id: 'c2', content: 'Customer feedback on TikTok', platform: 'tiktok', user_id: mockUser.id },
        { id: 'c3', content: 'Customer feedback on Facebook', platform: 'facebook', user_id: mockUser.id }
      ]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockCrossResults,
        error: null,
        count: 3
      })

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(3)
      expect(responseData.cross_platform_analysis).toBeDefined()
      expect(responseData.cross_platform_analysis.platform_breakdown).toEqual({
        instagram: 1,
        tiktok: 1,
        facebook: 1
      })
    })

    test('should provide unified sentiment analysis across platforms', async () => {
      const searchQuery = 'product review'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(searchQuery)}&sentiment_analysis=true`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(searchQuery)}&sentiment_analysis=true`)

      const mockResults = [
        { id: 'c1', content: 'Great product!', platform: 'instagram', sentiment_score: 0.8, user_id: mockUser.id },
        { id: 'c2', content: 'Not satisfied', platform: 'tiktok', sentiment_score: -0.6, user_id: mockUser.id },
        { id: 'c3', content: 'Average quality', platform: 'facebook', sentiment_score: 0.1, user_id: mockUser.id }
      ]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockResults,
        error: null,
        count: 3
      })

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.sentiment_analysis).toBeDefined()
      expect(responseData.sentiment_analysis.overall_sentiment).toBeDefined()
      expect(responseData.sentiment_analysis.by_platform).toBeDefined()
      expect(responseData.sentiment_analysis.sentiment_trends).toBeDefined()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle database timeouts gracefully', async () => {
      mockRequest.url = 'http://localhost:3000/api/comments/search?q=test'
      mockRequest.nextUrl.searchParams = new URLSearchParams('q=test')

      mockSupabaseClient.from().single = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 100)
        )
      )

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Search request timed out')
    })

    test('should handle malformed search parameters', async () => {
      const malformedParams = [
        'limit=not-a-number',
        'offset=negative-10',
        'date_from=invalid-date',
        'sentiment=invalid-sentiment'
      ]

      for (const param of malformedParams) {
        mockRequest.url = `http://localhost:3000/api/comments/search?q=test&${param}`
        mockRequest.nextUrl.searchParams = new URLSearchParams(`q=test&${param}`)

        const response = await SearchGET(mockRequest)
        const responseData = await response.json()

        expect(response.status).toBe(400)
        expect(responseData.success).toBe(false)
        expect(responseData.error).toContain('Invalid parameter')
      }
    })

    test('should handle no results gracefully', async () => {
      const searchQuery = 'nonexistent-term-xyz123'
      mockRequest.url = `http://localhost:3000/api/comments/search?q=${encodeURIComponent(searchQuery)}`
      mockRequest.nextUrl.searchParams = new URLSearchParams(`q=${encodeURIComponent(searchQuery)}`)

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const response = await SearchGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toHaveLength(0)
      expect(responseData.message).toBe('No comments found matching your search criteria')
      expect(responseData.suggestions).toBeDefined()
    })
  })
})