/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GET as CommentsGET, POST as CommentsPOST } from '@/app/api/comments/route'
import { GET as CommentGET, PUT as CommentPUT, DELETE as CommentDELETE } from '@/app/api/comments/[id]/route'
import { GET as ModerationGET, POST as ModerationPOST } from '@/app/api/comments/moderate/route'
import { CommentsCrypto } from '@/lib/comments-crypto'
import { RateLimiter } from '@/lib/rate-limiter'
import { SecurityMiddleware } from '@/lib/security-middleware'

// Mock dependencies
jest.mock('@supabase/supabase-js')
jest.mock('@/lib/comments-crypto')
jest.mock('@/lib/rate-limiter')
jest.mock('@/lib/security-middleware')
jest.mock('@/lib/secure-logger')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockCommentsCrypto = CommentsCrypto as jest.Mocked<typeof CommentsCrypto>
const mockSecurityMiddleware = SecurityMiddleware as jest.Mocked<typeof SecurityMiddleware>

describe('Comments API Integration Tests', () => {
  let mockSupabaseClient: any
  let mockAuthToken: string
  let mockUser: any
  let mockRequest: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.COMMENTS_ENCRYPTION_KEY = 'a'.repeat(64)

    // Setup mock user and token
    mockAuthToken = 'valid-auth-token'
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
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        textSearch: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn()
      }))
    }

    mockCreateClient.mockReturnValue(mockSupabaseClient)

    // Setup mock security middleware
    mockSecurityMiddleware.handle = jest.fn().mockResolvedValue(null)

    // Setup mock crypto functions
    mockCommentsCrypto.encryptToken = jest.fn().mockReturnValue('encrypted-token')
    mockCommentsCrypto.decryptToken = jest.fn().mockReturnValue('decrypted-token')
    mockCommentsCrypto.encryptCommentData = jest.fn().mockReturnValue('encrypted-data')
    mockCommentsCrypto.decryptCommentData = jest.fn().mockReturnValue('decrypted-data')
    mockCommentsCrypto.hashContent = jest.fn().mockReturnValue('a'.repeat(64))
    mockCommentsCrypto.verifyContentHash = jest.fn().mockReturnValue(true)

    // Create mock request
    mockRequest = {
      headers: new Map([
        ['authorization', `Bearer ${mockAuthToken}`],
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
        'authorization': `Bearer ${mockAuthToken}`,
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1'
      }
      return headers[key.toLowerCase()] || null
    })
  })

  describe('GET /api/comments - List Comments', () => {
    it('should return paginated comments successfully', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          content: 'Test comment 1',
          platform: 'instagram',
          status: 'approved',
          user_id: mockUser.id,
          platform_user_id: 'encrypted-user-id',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'comment-2', 
          content: 'Test comment 2',
          platform: 'tiktok',
          status: 'pending',
          user_id: mockUser.id,
          platform_user_id: 'encrypted-user-id',
          created_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockComments,
        error: null,
        count: 2
      })

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toHaveLength(2)
      expect(responseData.pagination).toBeDefined()
      expect(responseData.pagination.total).toBe(2)
      expect(responseData.data[0].platform_user_id).toBe('encrypted***') // Masked
    })

    it('should apply query filters correctly', async () => {
      mockRequest.url = 'http://localhost:3000/api/comments?platform=instagram&status=approved&limit=10&offset=0'
      mockRequest.nextUrl.searchParams = new URLSearchParams('platform=instagram&status=approved&limit=10&offset=0')

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.filters.platform).toBe('instagram')
      expect(responseData.filters.status).toBe('approved')
    })

    it('should handle missing authentication', async () => {
      mockRequest.headers.get = jest.fn().mockReturnValue(null)

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Authentication required')
    })

    it('should handle invalid authentication token', async () => {
      mockSupabaseClient.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Invalid authentication')
    })

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      })

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Failed to fetch comments')
    })

    it('should validate query parameters', async () => {
      mockRequest.url = 'http://localhost:3000/api/comments?limit=invalid&offset=invalid'
      mockRequest.nextUrl.searchParams = new URLSearchParams('limit=invalid&offset=invalid')

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Invalid query parameters')
    })
  })

  describe('POST /api/comments - Create Comment', () => {
    const validCommentData = {
      platform: 'instagram',
      platform_comment_id: 'comment123',
      platform_post_id: 'post123',
      platform_user_id: 'user123',
      author_username: 'testuser',
      content: 'This is a test comment',
      engagement_metrics: { likes: 5, replies: 2 }
    }

    beforeEach(() => {
      mockRequest.method = 'POST'
      mockRequest.json = jest.fn().mockResolvedValue(validCommentData)
    })

    it('should create comment successfully', async () => {
      const mockCreatedComment = {
        id: 'comment-new',
        ...validCommentData,
        user_id: mockUser.id,
        status: 'pending',
        content_hash: 'hash123',
        created_at: '2024-01-01T00:00:00Z'
      }

      // Mock duplicate check (no existing comment)
      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No duplicate
        .mockResolvedValueOnce({ data: mockCreatedComment, error: null }) // Created comment

      const response = await CommentsPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(201)
      expect(responseData.success).toBe(true)
      expect(responseData.data.id).toBe('comment-new')
      expect(responseData.data.status).toBe('pending')
      expect(mockCommentsCrypto.hashContent).toHaveBeenCalledWith(validCommentData.content, mockUser.id)
    })

    it('should reject duplicate content', async () => {
      const existingComment = {
        id: 'existing-comment',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: existingComment,
        error: null
      })

      const response = await CommentsPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(409)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('Duplicate comment detected')
    })

    it('should reject malicious content with XSS', async () => {
      const maliciousData = {
        ...validCommentData,
        content: '<script>alert("xss")</script>Legitimate content'
      }

      mockRequest.json = jest.fn().mockResolvedValue(maliciousData)

      const response = await CommentsPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('Potential XSS attack detected')
    })

    it('should reject SQL injection attempts', async () => {
      const maliciousData = {
        ...validCommentData,
        content: "'; DROP TABLE comments; --"
      }

      mockRequest.json = jest.fn().mockResolvedValue(maliciousData)

      const response = await CommentsPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('Potential SQL injection detected')
    })

    it('should validate required fields', async () => {
      const incompleteData = {
        platform: 'instagram',
        content: 'Test comment'
        // Missing required fields
      }

      mockRequest.json = jest.fn().mockResolvedValue(incompleteData)

      const response = await CommentsPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Validation failed')
    })

    it('should handle invalid JSON in request body', async () => {
      mockRequest.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'))

      const response = await CommentsPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Invalid JSON in request body')
    })

    it('should encrypt sensitive data', async () => {
      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No duplicate
        .mockResolvedValueOnce({ 
          data: { ...validCommentData, id: 'new-comment' }, 
          error: null 
        })

      await CommentsPOST(mockRequest)

      expect(mockCommentsCrypto.encryptCommentData).toHaveBeenCalledWith(
        validCommentData.platform_user_id,
        `${mockUser.id}:${validCommentData.platform}`
      )
    })
  })

  describe('GET /api/comments/[id] - Get Individual Comment', () => {
    const commentId = 'comment-123'
    const mockParams = { params: { id: commentId } }

    it('should return comment successfully', async () => {
      const mockComment = {
        id: commentId,
        content: 'Test comment',
        platform: 'instagram',
        status: 'approved',
        user_id: mockUser.id,
        platform_user_id: 'encrypted-user-id',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockComment,
        error: null
      })

      const response = await CommentGET(mockRequest, mockParams)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.id).toBe(commentId)
      expect(responseData.data.platform_user_id).toBe('encrypted***') // Masked
    })

    it('should validate UUID format', async () => {
      const invalidParams = { params: { id: 'invalid-uuid' } }

      const response = await CommentGET(mockRequest, invalidParams)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Invalid comment ID format')
    })

    it('should return 404 for non-existent comment', async () => {
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      })

      const response = await CommentGET(mockRequest, mockParams)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Comment not found')
    })
  })

  describe('PUT /api/comments/[id] - Update Comment', () => {
    const commentId = 'comment-123'
    const mockParams = { params: { id: commentId } }
    const updateData = {
      content: 'Updated comment content',
      status: 'approved'
    }

    beforeEach(() => {
      mockRequest.method = 'PUT'
      mockRequest.json = jest.fn().mockResolvedValue(updateData)
    })

    it('should update comment successfully', async () => {
      const mockUpdatedComment = {
        id: commentId,
        ...updateData,
        user_id: mockUser.id,
        updated_at: '2024-01-01T12:00:00Z'
      }

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockUpdatedComment,
        error: null
      })

      const response = await CommentPUT(mockRequest, mockParams)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.content).toBe(updateData.content)
      expect(responseData.message).toBe('Comment updated successfully')
    })

    it('should return 404 for non-existent comment', async () => {
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      })

      const response = await CommentPUT(mockRequest, mockParams)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Comment not found or access denied')
    })

    it('should validate update data', async () => {
      const invalidUpdateData = {
        content: '<script>alert("xss")</script>',
        status: 'invalid-status'
      }

      mockRequest.json = jest.fn().mockResolvedValue(invalidUpdateData)

      const response = await CommentPUT(mockRequest, mockParams)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Invalid update data')
    })
  })

  describe('DELETE /api/comments/[id] - Delete Comment', () => {
    const commentId = 'comment-123'
    const mockParams = { params: { id: commentId } }

    beforeEach(() => {
      mockRequest.method = 'DELETE'
    })

    it('should soft delete comment successfully', async () => {
      const mockCommentToDelete = {
        id: commentId,
        platform: 'instagram',
        platform_comment_id: 'comment123',
        status: 'approved',
        created_at: '2024-01-01T00:00:00Z'
      }

      const mockDeletedComment = {
        id: commentId,
        status: 'deleted',
        updated_at: '2024-01-01T12:00:00Z'
      }

      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: mockCommentToDelete, error: null }) // Fetch comment
        .mockResolvedValueOnce({ data: mockDeletedComment, error: null }) // Delete comment

      const response = await CommentDELETE(mockRequest, mockParams)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.status).toBe('deleted')
      expect(responseData.message).toBe('Comment deleted successfully')
    })

    it('should return 404 for non-existent comment', async () => {
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      })

      const response = await CommentDELETE(mockRequest, mockParams)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Comment not found or access denied')
    })
  })

  describe('GET /api/comments/moderate - Moderation Queue', () => {
    beforeEach(() => {
      // Mock admin user
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: { id: mockUser.id, role_id: 2 }, // Admin role
        error: null
      })
    })

    it('should return moderation queue for admin users', async () => {
      const mockQueueComments = [
        {
          id: 'comment-1',
          content: 'Pending comment 1',
          status: 'pending',
          platform: 'instagram',
          sentiment_score: -0.3,
          user_id: 'other-user',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockStats = [
        { status: 'pending', platform: 'instagram', sentiment_score: -0.3, moderation_flags: [] },
        { status: 'approved', platform: 'tiktok', sentiment_score: 0.5, moderation_flags: [] }
      ]

      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: { id: mockUser.id, role_id: 2 }, error: null }) // Admin check
          .mockResolvedValueOnce({ data: mockQueueComments, error: null, count: 1 }) // Queue
          .mockResolvedValueOnce({ data: mockStats, error: null }) // Stats
      }))

      const response = await ModerationGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.moderation_queue).toHaveLength(1)
      expect(responseData.statistics).toBeDefined()
      expect(responseData.pagination).toBeDefined()
    })

    it('should reject non-admin users', async () => {
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: { id: mockUser.id, role_id: 1 }, // Regular user
        error: null
      })

      const response = await ModerationGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(403)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Insufficient privileges. Admin access required.')
    })
  })

  describe('POST /api/comments/moderate - Bulk Moderation', () => {
    const moderationData = {
      comment_ids: ['comment-1', 'comment-2'],
      action: 'approve',
      reason: 'Content reviewed and approved'
    }

    beforeEach(() => {
      mockRequest.method = 'POST'
      mockRequest.json = jest.fn().mockResolvedValue(moderationData)
      
      // Mock admin user
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: { id: mockUser.id, role_id: 2 }, // Admin role
        error: null
      })
    })

    it('should perform bulk moderation successfully', async () => {
      const mockExistingComments = [
        { id: 'comment-1', user_id: mockUser.id, status: 'pending', content: 'Comment 1' },
        { id: 'comment-2', user_id: mockUser.id, status: 'pending', content: 'Comment 2' }
      ]

      const mockUpdatedComments = [
        { id: 'comment-1', status: 'approved', updated_at: '2024-01-01T12:00:00Z' },
        { id: 'comment-2', status: 'approved', updated_at: '2024-01-01T12:00:00Z' }
      ]

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

      const response = await ModerationPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.summary.successfully_updated).toBe(2)
      expect(responseData.summary.action).toBe('approve')
    })

    it('should reject moderation by non-admin users', async () => {
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: { id: mockUser.id, role_id: 1 }, // Regular user
        error: null
      })

      const response = await ModerationPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(403)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Insufficient privileges. Admin access required.')
    })

    it('should validate moderation action', async () => {
      const invalidModerationData = {
        comment_ids: ['comment-1'],
        action: 'invalid-action',
        reason: 'Test reason'
      }

      mockRequest.json = jest.fn().mockResolvedValue(invalidModerationData)

      const response = await ModerationPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Invalid moderation data')
    })

    it('should prevent moderating other users comments without super admin', async () => {
      const mockExistingComments = [
        { id: 'comment-1', user_id: 'other-user', status: 'pending', content: 'Comment 1' }
      ]

      let callCount = 0
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => {
          callCount++
          if (callCount === 1) return Promise.resolve({ data: { id: mockUser.id, role_id: 2 }, error: null }) // Admin check
          if (callCount === 2) return Promise.resolve({ data: mockExistingComments, error: null }) // Fetch comments
          return Promise.resolve({ data: { id: mockUser.id, role_id: 2 }, error: null }) // Admin profile check (not super admin)
        })
      }))

      const response = await ModerationPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(403)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('Cannot moderate comments from other users')
    })
  })

  describe('Rate Limiting Tests', () => {
    let mockRateLimiter: any

    beforeEach(() => {
      mockRateLimiter = {
        checkLimit: jest.fn()
      }
      
      // Mock the rate limit middleware to return our mock limiter
      jest.doMock('@/lib/rate-limiter', () => ({
        RateLimitMiddleware: {
          getCommentsRateLimit: () => () => mockRateLimiter.checkLimit(),
          getCommentsWriteRateLimit: () => () => mockRateLimiter.checkLimit(),
          getCommentsModerationRateLimit: () => () => mockRateLimiter.checkLimit()
        }
      }))
    })

    it('should enforce rate limits on GET requests', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue({
        success: false,
        limit: 100,
        remaining: 0,
        retryAfter: 60,
        resetTime: Date.now() + 60000
      })

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(429)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Rate limit exceeded')
      expect(responseData.retryAfter).toBe(60)
    })

    it('should enforce rate limits on POST requests', async () => {
      mockRequest.json = jest.fn().mockResolvedValue({
        platform: 'instagram',
        content: 'Test comment'
      })

      mockRateLimiter.checkLimit.mockResolvedValue({
        success: false,
        limit: 20,
        remaining: 0,
        retryAfter: 60,
        resetTime: Date.now() + 60000
      })

      const response = await CommentsPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(429)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Rate limit exceeded for comment creation')
    })

    it('should include rate limit headers in response', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue({
        success: false,
        limit: 100,
        remaining: 0,
        retryAfter: 60,
        resetTime: Date.now() + 60000
      })

      const response = await CommentsGET(mockRequest)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(response.headers.get('Retry-After')).toBe('60')
    })
  })

  describe('Security Middleware Integration', () => {
    it('should apply security middleware to all endpoints', async () => {
      await CommentsGET(mockRequest)
      
      expect(mockSecurityMiddleware.handle).toHaveBeenCalledWith(
        mockRequest,
        expect.objectContaining({
          enableRateLimit: true,
          enableRequestSanitization: true,
          enableAuditLogging: true
        })
      )
    })

    it('should block requests when security middleware fails', async () => {
      const securityResponse = NextResponse.json(
        { success: false, error: 'Security check failed' },
        { status: 403 }
      )
      
      mockSecurityMiddleware.handle = jest.fn().mockResolvedValue(securityResponse)

      const response = await CommentsGET(mockRequest)

      expect(response).toBe(securityResponse)
      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    })

    it('should enforce stricter limits for write operations', async () => {
      mockRequest.json = jest.fn().mockResolvedValue({
        platform: 'instagram',
        content: 'Test'
      })

      await CommentsPOST(mockRequest)

      expect(mockSecurityMiddleware.handle).toHaveBeenCalledWith(
        mockRequest,
        expect.objectContaining({
          maxRequestSize: 1024 * 1024 // 1MB for creation
        })
      )
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Force an unexpected error
      mockSupabaseClient.auth.getUser = jest.fn().mockRejectedValue(new Error('Unexpected error'))

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Internal server error')
    })

    it('should handle network timeouts', async () => {
      mockSupabaseClient.from().single = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100)
        })
      })

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
    })

    it('should sanitize error messages in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      mockSupabaseClient.auth.getUser = jest.fn().mockRejectedValue(new Error('Database password: secret123'))

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(responseData.details).toBeUndefined() // Should not leak sensitive info in production
      
      process.env.NODE_ENV = originalEnv
    })

    it('should handle malformed request headers', async () => {
      mockRequest.headers.get = jest.fn().mockImplementation((key) => {
        if (key === 'authorization') return 'Invalid Bearer Format'
        return null
      })

      const response = await CommentsGET(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error).toBe('Authentication required')
    })

    it('should handle very large request payloads', async () => {
      const largeContent = 'a'.repeat(2000000) // 2MB content
      const largePayload = {
        platform: 'instagram',
        content: largeContent,
        platform_comment_id: 'test'
      }

      mockRequest.json = jest.fn().mockResolvedValue(largePayload)

      const response = await CommentsPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })
  })

  describe('Database Consistency and RLS', () => {
    it('should respect RLS policies for user isolation', async () => {
      // Mock scenario where user tries to access another user's comments
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: null, // RLS should prevent access
        error: { code: 'PGRST116' } // No rows returned due to RLS
      })

      const response = await CommentGET(mockRequest, { params: { id: 'comment-from-other-user' } })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.error).toBe('Comment not found')
    })

    it('should maintain data consistency during bulk operations', async () => {
      const moderationData = {
        comment_ids: ['comment-1', 'comment-2', 'comment-3'],
        action: 'approve',
        reason: 'Bulk approval'
      }

      mockRequest.json = jest.fn().mockResolvedValue(moderationData)

      // Simulate partial failure
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: { id: mockUser.id, role_id: 2 }, error: null }) // Admin check
          .mockResolvedValueOnce({ // Fetch comments - only 2 found
            data: [
              { id: 'comment-1', user_id: mockUser.id, status: 'pending' },
              { id: 'comment-2', user_id: mockUser.id, status: 'pending' }
            ], 
            error: null 
          })
          .mockResolvedValueOnce({ data: { id: mockUser.id, role_id: 2 }, error: null }) // Admin profile check
          .mockResolvedValueOnce({ // Update result - 2 updated
            data: [
              { id: 'comment-1', status: 'approved' },
              { id: 'comment-2', status: 'approved' }
            ], 
            error: null 
          })
      }))

      const response = await ModerationPOST(mockRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.summary.total_requested).toBe(3)
      expect(responseData.summary.successfully_updated).toBe(2)
      expect(responseData.summary.failed).toBe(1)
    })
  })
})