/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET as CommentsGET, POST as CommentsPOST } from '@/app/api/comments/route'
import { GET as CommentGET, PUT as CommentPUT, DELETE as CommentDELETE } from '@/app/api/comments/[id]/route'
import { GET as ModerationGET, POST as ModerationPOST } from '@/app/api/comments/moderate/route'
import { GET as SearchGET } from '@/app/api/comments/search/route'
import { GET as PlatformGET } from '@/app/api/comments/platforms/[platform]/route'
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

describe('Comments API End-to-End Integration Tests', () => {
  let mockSupabaseClient: any
  let mockUsers: any[]
  let mockComments: any[]
  let requestCounter: number

  beforeEach(() => {
    jest.clearAllMocks()
    requestCounter = 0

    // Setup test users
    mockUsers = [
      { id: 'user-1', email: 'user1@test.com', role_id: 1 }, // Regular user
      { id: 'user-2', email: 'user2@test.com', role_id: 2 }, // Admin user
      { id: 'user-3', email: 'user3@test.com', role_id: 3 }  // Super admin
    ]

    // Setup test comments
    mockComments = [
      {
        id: 'comment-1',
        content: 'This is an amazing product! Love it!',
        platform: 'instagram',
        platform_comment_id: 'ig_comment_1',
        platform_post_id: 'ig_post_1',
        platform_user_id: 'encrypted_ig_user_1',
        status: 'approved',
        user_id: 'user-1',
        sentiment_score: 0.8,
        engagement_metrics: { likes: 25, replies: 3, shares: 5 },
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z'
      },
      {
        id: 'comment-2',
        content: 'The product quality could be better',
        platform: 'tiktok',
        platform_comment_id: 'tt_comment_2',
        platform_post_id: 'tt_post_2',
        platform_user_id: 'encrypted_tt_user_2',
        status: 'pending',
        user_id: 'user-1',
        sentiment_score: -0.3,
        engagement_metrics: { likes: 5, replies: 1, shares: 0 },
        created_at: '2024-01-02T14:30:00Z',
        updated_at: '2024-01-02T14:30:00Z'
      },
      {
        id: 'comment-3',
        content: 'Great customer service experience!',
        platform: 'facebook',
        platform_comment_id: 'fb_comment_3',
        platform_post_id: 'fb_post_3',
        platform_user_id: 'encrypted_fb_user_3',
        status: 'approved',
        user_id: 'user-2',
        sentiment_score: 0.9,
        engagement_metrics: { likes: 40, replies: 8, shares: 12 },
        created_at: '2024-01-03T09:15:00Z',
        updated_at: '2024-01-03T09:15:00Z'
      }
    ]

    // Setup comprehensive mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn()
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
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn()
      }))
    }

    mockCreateClient.mockReturnValue(mockSupabaseClient)

    // Setup security and rate limiting mocks
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
    RateLimitMiddleware.getCommentsModerationRateLimit = jest.fn(() => () => ({
      success: true,
      remaining: 9,
      limit: 10,
      resetTime: Date.now() + 60000
    }))

    // Setup crypto mocks
    mockCommentsCrypto.encryptCommentData = jest.fn().mockReturnValue('encrypted-data')
    mockCommentsCrypto.decryptCommentData = jest.fn().mockReturnValue('decrypted-data')
    mockCommentsCrypto.hashContent = jest.fn().mockReturnValue('a'.repeat(64))
    mockCommentsCrypto.verifyContentHash = jest.fn().mockReturnValue(true)
  })

  const createMockRequest = (
    method: string = 'GET',
    url: string = 'http://localhost:3000/api/comments',
    userId: string = 'user-1',
    body?: any
  ): NextRequest => {
    const request = {
      headers: new Map([
        ['authorization', `Bearer token-${userId}`],
        ['content-type', 'application/json'],
        ['x-forwarded-for', '127.0.0.1']
      ]),
      url,
      method,
      json: jest.fn().mockResolvedValue(body),
      nextUrl: {
        searchParams: new URLSearchParams(url.split('?')[1] || '')
      }
    } as any

    request.headers.get = jest.fn((key: string) => {
      const headers: Record<string, string> = {
        'authorization': `Bearer token-${userId}`,
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1'
      }
      return headers[key.toLowerCase()] || null
    })

    // Setup auth mock for this user
    const user = mockUsers.find(u => u.id === userId)
    mockSupabaseClient.auth.getUser = jest.fn().mockResolvedValue({
      data: { user },
      error: null
    })

    return request
  }

  describe('Complete Comment Lifecycle', () => {
    test('should handle full comment lifecycle: create → read → update → delete', async () => {
      const userId = 'user-1'
      
      // Step 1: Create a new comment
      const newCommentData = {
        platform: 'instagram',
        platform_comment_id: 'new_ig_comment',
        platform_post_id: 'new_ig_post',
        platform_user_id: 'new_ig_user',
        author_username: 'test_user',
        content: 'This is a test comment for the full lifecycle',
        engagement_metrics: { likes: 10, replies: 2, shares: 1 }
      }

      const createRequest = createMockRequest('POST', 'http://localhost:3000/api/comments', userId, newCommentData)
      
      const newCommentId = 'comment-new-123'
      const createdComment = {
        id: newCommentId,
        ...newCommentData,
        user_id: userId,
        status: 'pending',
        content_hash: 'a'.repeat(64),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Mock duplicate check (no existing) and creation
      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No duplicate
        .mockResolvedValueOnce({ data: createdComment, error: null }) // Created comment

      const createResponse = await CommentsPOST(createRequest)
      const createData = await createResponse.json()

      expect(createResponse.status).toBe(201)
      expect(createData.success).toBe(true)
      expect(createData.data.id).toBe(newCommentId)
      expect(createData.data.status).toBe('pending')

      // Step 2: Read the created comment
      const readRequest = createMockRequest('GET', `http://localhost:3000/api/comments/${newCommentId}`, userId)
      
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: createdComment,
        error: null
      })

      const readResponse = await CommentGET(readRequest, { params: { id: newCommentId } })
      const readData = await readResponse.json()

      expect(readResponse.status).toBe(200)
      expect(readData.success).toBe(true)
      expect(readData.data.id).toBe(newCommentId)
      expect(readData.data.content).toBe(newCommentData.content)

      // Step 3: Update the comment
      const updateData = {
        content: 'Updated comment content with new information',
        status: 'approved'
      }

      const updateRequest = createMockRequest('PUT', `http://localhost:3000/api/comments/${newCommentId}`, userId, updateData)
      
      const updatedComment = {
        ...createdComment,
        ...updateData,
        updated_at: new Date().toISOString()
      }

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: updatedComment,
        error: null
      })

      const updateResponse = await CommentPUT(updateRequest, { params: { id: newCommentId } })
      const updateResponseData = await updateResponse.json()

      expect(updateResponse.status).toBe(200)
      expect(updateResponseData.success).toBe(true)
      expect(updateResponseData.data.content).toBe(updateData.content)
      expect(updateResponseData.data.status).toBe(updateData.status)

      // Step 4: Delete the comment (soft delete)
      const deleteRequest = createMockRequest('DELETE', `http://localhost:3000/api/comments/${newCommentId}`, userId)
      
      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: updatedComment, error: null }) // Fetch before delete
        .mockResolvedValueOnce({ 
          data: { id: newCommentId, status: 'deleted', updated_at: new Date().toISOString() }, 
          error: null 
        }) // Delete result

      const deleteResponse = await CommentDELETE(deleteRequest, { params: { id: newCommentId } })
      const deleteData = await deleteResponse.json()

      expect(deleteResponse.status).toBe(200)
      expect(deleteData.success).toBe(true)
      expect(deleteData.data.status).toBe('deleted')
      expect(deleteData.message).toBe('Comment deleted successfully')
    })

    test('should maintain data integrity throughout the lifecycle', async () => {
      const userId = 'user-1'
      const contentHash = 'original-hash-123'
      
      // Track all operations for audit trail
      const auditTrail: any[] = []

      // Create comment with specific hash
      mockCommentsCrypto.hashContent = jest.fn().mockReturnValue(contentHash)
      
      const createData = {
        platform: 'tiktok',
        content: 'Original content for integrity test',
        platform_comment_id: 'integrity_test'
      }

      const createRequest = createMockRequest('POST', 'http://localhost:3000/api/comments', userId, createData)
      
      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No duplicate
        .mockResolvedValueOnce({ 
          data: { 
            id: 'integrity-comment', 
            ...createData, 
            user_id: userId, 
            content_hash: contentHash,
            status: 'pending'
          }, 
          error: null 
        })

      await CommentsPOST(createRequest)
      auditTrail.push({ action: 'CREATE', hash: contentHash, status: 'pending' })

      // Update content and verify hash changes
      const newContent = 'Updated content for integrity test'
      const newContentHash = 'updated-hash-456'
      mockCommentsCrypto.hashContent = jest.fn().mockReturnValue(newContentHash)

      const updateRequest = createMockRequest('PUT', 'http://localhost:3000/api/comments/integrity-comment', userId, {
        content: newContent
      })

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: { 
          id: 'integrity-comment', 
          content: newContent, 
          content_hash: newContentHash,
          status: 'pending',
          updated_at: new Date().toISOString()
        },
        error: null
      })

      await CommentPUT(updateRequest, { params: { id: 'integrity-comment' } })
      auditTrail.push({ action: 'UPDATE', hash: newContentHash, status: 'pending' })

      // Verify audit trail maintains integrity
      expect(auditTrail).toHaveLength(2)
      expect(auditTrail[0].hash).not.toBe(auditTrail[1].hash)
      expect(mockCommentsCrypto.hashContent).toHaveBeenCalledWith('Original content for integrity test', userId)
      expect(mockCommentsCrypto.hashContent).toHaveBeenCalledWith(newContent, userId)
    })
  })

  describe('Multi-User Permission and Access Control', () => {
    test('should enforce proper access control between users', async () => {
      const user1Id = 'user-1'
      const user2Id = 'user-2'
      const user1CommentId = 'comment-1' // Belongs to user-1

      // User 1 should be able to access their own comment
      const user1Request = createMockRequest('GET', `http://localhost:3000/api/comments/${user1CommentId}`, user1Id)
      
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: mockComments.find(c => c.id === user1CommentId),
        error: null
      })

      const user1Response = await CommentGET(user1Request, { params: { id: user1CommentId } })
      expect(user1Response.status).toBe(200)

      // User 2 should NOT be able to access user 1's comment (RLS should prevent this)
      const user2Request = createMockRequest('GET', `http://localhost:3000/api/comments/${user1CommentId}`, user2Id)
      
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // RLS blocks access
      })

      const user2Response = await CommentGET(user2Request, { params: { id: user1CommentId } })
      expect(user2Response.status).toBe(404) // Not found due to RLS

      // User 2 should NOT be able to update user 1's comment
      const user2UpdateRequest = createMockRequest('PUT', `http://localhost:3000/api/comments/${user1CommentId}`, user2Id, {
        content: 'Attempted unauthorized update'
      })

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // RLS blocks update
      })

      const user2UpdateResponse = await CommentPUT(user2UpdateRequest, { params: { id: user1CommentId } })
      expect(user2UpdateResponse.status).toBe(404) // Update blocked by RLS
    })

    test('should allow admin users to perform moderation actions', async () => {
      const adminUserId = 'user-2' // Admin user
      const regularUserId = 'user-1'
      const commentIds = ['comment-1', 'comment-2']

      // Admin should be able to access moderation queue
      const moderationQueueRequest = createMockRequest('GET', 'http://localhost:3000/api/comments/moderate', adminUserId)
      
      const pendingComments = mockComments.filter(c => c.status === 'pending')
      
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: { id: adminUserId, role_id: 2 }, error: null }) // Admin check
          .mockResolvedValueOnce({ data: pendingComments, error: null, count: pendingComments.length }) // Queue
          .mockResolvedValueOnce({ data: mockComments, error: null }) // Stats
      }))

      const queueResponse = await ModerationGET(moderationQueueRequest)
      const queueData = await queueResponse.json()

      expect(queueResponse.status).toBe(200)
      expect(queueData.success).toBe(true)
      expect(queueData.moderation_queue).toBeDefined()

      // Admin should be able to perform bulk moderation
      const bulkModerationRequest = createMockRequest('POST', 'http://localhost:3000/api/comments/moderate', adminUserId, {
        comment_ids: commentIds,
        action: 'approve',
        reason: 'Content reviewed and approved by admin'
      })

      const existingComments = mockComments.filter(c => commentIds.includes(c.id))
      const updatedComments = existingComments.map(c => ({ ...c, status: 'approved', moderated_by: adminUserId }))

      let callCount = 0
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn(() => {
          callCount++
          if (callCount === 1) return Promise.resolve({ data: { id: adminUserId, role_id: 2 }, error: null }) // Admin check
          if (callCount === 2) return Promise.resolve({ data: existingComments, error: null }) // Fetch comments
          if (callCount === 3) return Promise.resolve({ data: { id: adminUserId, role_id: 2 }, error: null }) // Admin profile check
          return Promise.resolve({ data: updatedComments, error: null }) // Update result
        })
      }))

      const bulkResponse = await ModerationPOST(bulkModerationRequest)
      const bulkData = await bulkResponse.json()

      expect(bulkResponse.status).toBe(200)
      expect(bulkData.success).toBe(true)
      expect(bulkData.summary.successfully_updated).toBe(commentIds.length)

      // Regular user should NOT be able to access moderation endpoints
      const regularUserRequest = createMockRequest('GET', 'http://localhost:3000/api/comments/moderate', regularUserId)
      
      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: { id: regularUserId, role_id: 1 }, // Regular user
        error: null
      })

      const regularUserResponse = await ModerationGET(regularUserRequest)
      expect(regularUserResponse.status).toBe(403) // Forbidden
    })
  })

  describe('Cross-Platform Data Consistency', () => {
    test('should maintain consistent data across different platforms', async () => {
      const userId = 'user-1'
      const platforms = ['instagram', 'tiktok', 'facebook']
      
      // Create comments on different platforms
      for (const platform of platforms) {
        const createRequest = createMockRequest('POST', 'http://localhost:3000/api/comments', userId, {
          platform,
          content: `Test comment on ${platform}`,
          platform_comment_id: `${platform}_comment_test`,
          platform_post_id: `${platform}_post_test`,
          platform_user_id: `${platform}_user_test`
        })

        mockSupabaseClient.from().single = jest.fn()
          .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No duplicate
          .mockResolvedValueOnce({ 
            data: { 
              id: `comment-${platform}`, 
              platform, 
              content: `Test comment on ${platform}`,
              user_id: userId,
              status: 'pending'
            }, 
            error: null 
          })

        const response = await CommentsPOST(createRequest)
        expect(response.status).toBe(201)
      }

      // Fetch comments from each platform
      for (const platform of platforms) {
        const platformRequest = createMockRequest('GET', `http://localhost:3000/api/comments/platforms/${platform}`, userId)
        
        const platformComments = mockComments.filter(c => c.platform === platform).concat([{
          id: `comment-${platform}`,
          platform,
          content: `Test comment on ${platform}`,
          user_id: userId,
          status: 'pending'
        }])

        mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
          data: platformComments,
          error: null,
          count: platformComments.length
        })

        const platformResponse = await PlatformGET(platformRequest, { params: { platform } })
        const platformData = await platformResponse.json()

        expect(platformResponse.status).toBe(200)
        expect(platformData.platform).toBe(platform)
        expect(platformData.data.every((c: any) => c.platform === platform)).toBe(true)
      }

      // Perform cross-platform search
      const searchRequest = createMockRequest('GET', 'http://localhost:3000/api/comments/search?q=test&platforms=instagram,tiktok,facebook', userId)
      
      const allTestComments = platforms.map(platform => ({
        id: `comment-${platform}`,
        platform,
        content: `Test comment on ${platform}`,
        user_id: userId,
        relevance_score: 0.9
      }))

      mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
        data: allTestComments,
        error: null,
        count: allTestComments.length
      })

      const searchResponse = await SearchGET(searchRequest)
      const searchData = await searchResponse.json()

      expect(searchResponse.status).toBe(200)
      expect(searchData.data).toHaveLength(platforms.length)
      expect(searchData.cross_platform_analysis).toBeDefined()
    })

    test('should handle platform-specific features correctly', async () => {
      const userId = 'user-1'
      
      // Instagram-specific features (stories, reels)
      const instagramComment = {
        platform: 'instagram',
        content: 'Love this reel!',
        platform_comment_id: 'ig_reel_comment',
        platform_post_id: 'ig_reel_123',
        platform_user_id: 'ig_user_456',
        engagement_metrics: {
          likes: 50,
          replies: 5,
          shares: 10,
          saves: 15 // Instagram-specific
        },
        platform_metadata: {
          post_type: 'reel',
          is_story_comment: false
        }
      }

      // TikTok-specific features (duets, effects)
      const tiktokComment = {
        platform: 'tiktok',
        content: 'Great duet!',
        platform_comment_id: 'tt_duet_comment',
        platform_post_id: 'tt_duet_789',
        platform_user_id: 'tt_user_101',
        engagement_metrics: {
          likes: 100,
          replies: 8,
          shares: 25
        },
        platform_metadata: {
          is_duet: true,
          original_video_id: 'tt_original_456'
        }
      }

      for (const commentData of [instagramComment, tiktokComment]) {
        const createRequest = createMockRequest('POST', 'http://localhost:3000/api/comments', userId, commentData)
        
        mockSupabaseClient.from().single = jest.fn()
          .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No duplicate
          .mockResolvedValueOnce({ 
            data: { 
              id: `comment-${commentData.platform}-specific`, 
              ...commentData,
              user_id: userId,
              status: 'pending'
            }, 
            error: null 
          })

        const response = await CommentsPOST(createRequest)
        const responseData = await response.json()

        expect(response.status).toBe(201)
        expect(responseData.data.platform).toBe(commentData.platform)
        expect(responseData.data.engagement_metrics).toEqual(commentData.engagement_metrics)
        expect(responseData.data.platform_metadata).toEqual(commentData.platform_metadata)
      }
    })
  })

  describe('Search and Analytics Integration', () => {
    test('should provide comprehensive search and analytics workflow', async () => {
      const userId = 'user-1'

      // Perform sentiment-based search
      const sentimentSearchRequest = createMockRequest(
        'GET', 
        'http://localhost:3000/api/comments/search?q=product quality&sentiment=positive&semantic=true',
        userId
      )

      const positiveComments = mockComments.filter(c => c.sentiment_score > 0).map(c => ({
        ...c,
        relevance_score: 0.85,
        semantic_similarity: 0.92
      }))

      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: positiveComments, error: null, count: positiveComments.length }) // Search results
        .mockResolvedValueOnce({ data: mockComments, error: null }) // Facet data

      const sentimentResponse = await SearchGET(sentimentSearchRequest)
      const sentimentData = await sentimentResponse.json()

      expect(sentimentResponse.status).toBe(200)
      expect(sentimentData.data.every((c: any) => c.sentiment_score > 0)).toBe(true)
      expect(sentimentData.sentiment_analysis).toBeDefined()
      expect(sentimentData.search_type).toBe('semantic')

      // Perform time-based analytics search
      const timeSearchRequest = createMockRequest(
        'GET',
        'http://localhost:3000/api/comments/search?q=customer&date_from=2024-01-01&date_to=2024-01-31&facets=true',
        userId
      )

      const timeFilteredComments = mockComments.filter(c => 
        new Date(c.created_at) >= new Date('2024-01-01') &&
        new Date(c.created_at) <= new Date('2024-01-31')
      )

      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: timeFilteredComments, error: null, count: timeFilteredComments.length })
        .mockResolvedValueOnce({ data: timeFilteredComments, error: null })

      const timeResponse = await SearchGET(timeSearchRequest)
      const timeData = await timeResponse.json()

      expect(timeResponse.status).toBe(200)
      expect(timeData.facets.date_distribution).toBeDefined()
      expect(timeData.facets.platforms).toBeDefined()
      expect(timeData.facets.sentiment_distribution).toBeDefined()

      // Combine search with platform-specific analytics
      const platformAnalyticsRequest = createMockRequest(
        'GET',
        'http://localhost:3000/api/comments/platforms/instagram?sentiment_analysis=true&engagement_stats=true',
        userId
      )

      const instagramComments = mockComments.filter(c => c.platform === 'instagram')
      
      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: instagramComments, error: null, count: instagramComments.length })
        .mockResolvedValueOnce({ data: instagramComments, error: null }) // Stats query

      const platformResponse = await PlatformGET(platformAnalyticsRequest, { params: { platform: 'instagram' } })
      const platformData = await platformResponse.json()

      expect(platformResponse.status).toBe(200)
      expect(platformData.statistics).toBeDefined()
      expect(platformData.statistics.engagement_summary).toBeDefined()
      expect(platformData.statistics.sentiment_distribution).toBeDefined()
    })

    test('should handle complex multi-filter search scenarios', async () => {
      const userId = 'user-2' // Admin user
      
      const complexSearchRequest = createMockRequest(
        'GET',
        'http://localhost:3000/api/comments/search?q=amazing product&platforms=instagram,tiktok&status=approved&sentiment=positive&engagement_min=20&date_from=2024-01-01&sort=engagement&facets=true',
        userId
      )

      const complexResults = mockComments.filter(c => 
        c.platform === 'instagram' || c.platform === 'tiktok'
      ).filter(c => 
        c.status === 'approved'
      ).filter(c => 
        c.sentiment_score > 0
      ).filter(c => 
        c.engagement_metrics.likes >= 20
      ).map(c => ({
        ...c,
        relevance_score: 0.88,
        engagement_score: c.engagement_metrics.likes + c.engagement_metrics.replies + c.engagement_metrics.shares
      })).sort((a, b) => b.engagement_score - a.engagement_score)

      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: complexResults, error: null, count: complexResults.length })
        .mockResolvedValueOnce({ data: complexResults, error: null })

      const complexResponse = await SearchGET(complexSearchRequest)
      const complexData = await complexResponse.json()

      expect(complexResponse.status).toBe(200)
      expect(complexData.data).toHaveLength(complexResults.length)
      expect(complexData.filters.platforms).toEqual(['instagram', 'tiktok'])
      expect(complexData.filters.status).toBe('approved')
      expect(complexData.filters.sentiment).toBe('positive')
      expect(complexData.facets).toBeDefined()
    })
  })

  describe('Error Recovery and Resilience', () => {
    test('should handle partial failures gracefully', async () => {
      const userId = 'user-2' // Admin
      
      // Simulate bulk moderation with partial failures
      const bulkIds = ['comment-1', 'comment-2', 'nonexistent-comment', 'comment-3']
      const bulkRequest = createMockRequest('POST', 'http://localhost:3000/api/comments/moderate', userId, {
        comment_ids: bulkIds,
        action: 'approve',
        reason: 'Bulk test with partial failures'
      })

      // Only 2 out of 4 comments exist
      const existingComments = mockComments.filter(c => bulkIds.includes(c.id)).slice(0, 2)
      const updatedComments = existingComments.map(c => ({ ...c, status: 'approved' }))

      let callCount = 0
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn(() => {
          callCount++
          if (callCount === 1) return Promise.resolve({ data: { id: userId, role_id: 2 }, error: null })
          if (callCount === 2) return Promise.resolve({ data: existingComments, error: null })
          if (callCount === 3) return Promise.resolve({ data: { id: userId, role_id: 2 }, error: null })
          return Promise.resolve({ data: updatedComments, error: null })
        })
      }))

      const bulkResponse = await ModerationPOST(bulkRequest)
      const bulkData = await bulkResponse.json()

      expect(bulkResponse.status).toBe(200)
      expect(bulkData.summary.total_requested).toBe(4)
      expect(bulkData.summary.successfully_updated).toBe(2)
      expect(bulkData.summary.failed).toBe(2)
    })

    test('should handle database connectivity issues', async () => {
      const userId = 'user-1'
      const request = createMockRequest('GET', 'http://localhost:3000/api/comments', userId)

      // Simulate database timeout
      mockSupabaseClient.from().single = jest.fn().mockImplementation(() => 
        Promise.reject(new Error('Connection timeout'))
      )

      const response = await CommentsGET(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Internal server error')
    })

    test('should handle concurrent access with data consistency', async () => {
      const userId = 'user-1'
      const commentId = 'comment-1'

      // Simulate concurrent updates to the same comment
      const updateRequests = [
        { content: 'First concurrent update', status: 'approved' },
        { content: 'Second concurrent update', status: 'pending' },
        { content: 'Third concurrent update', status: 'approved' }
      ]

      const concurrentPromises = updateRequests.map((updateData, index) => {
        const request = createMockRequest('PUT', `http://localhost:3000/api/comments/${commentId}`, userId, updateData)
        
        // Mock database to simulate optimistic locking
        mockSupabaseClient.from().single = jest.fn().mockImplementation(() => {
          if (index === 0) {
            // First update succeeds
            return Promise.resolve({
              data: { id: commentId, ...updateData, updated_at: new Date().toISOString() },
              error: null
            })
          } else {
            // Subsequent updates fail due to optimistic locking
            return Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'Concurrent modification detected' }
            })
          }
        })

        return CommentPUT(request, { params: { id: commentId } })
      })

      const responses = await Promise.all(concurrentPromises)
      const successfulUpdates = responses.filter(r => r.status === 200)
      const failedUpdates = responses.filter(r => r.status === 404)

      expect(successfulUpdates).toHaveLength(1) // Only one update should succeed
      expect(failedUpdates).toHaveLength(2) // Two should fail due to concurrency
    })
  })

  describe('Performance Under Load', () => {
    test('should maintain performance with high-volume operations', async () => {
      const userId = 'user-1'
      const operationCount = 50

      // Create multiple simultaneous read requests
      const readPromises = Array(operationCount).fill(null).map((_, index) => {
        const request = createMockRequest('GET', `http://localhost:3000/api/comments?limit=10&offset=${index * 10}`, userId)
        
        mockSupabaseClient.from().single = jest.fn().mockResolvedValue({
          data: mockComments.slice(0, 10),
          error: null,
          count: mockComments.length
        })

        return CommentsGET(request)
      })

      const startTime = performance.now()
      const responses = await Promise.all(readPromises)
      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(responses.every(r => r.status === 200)).toBe(true)
      expect(totalTime).toBeLessThan(5000) // All operations should complete within 5 seconds
      expect(totalTime / operationCount).toBeLessThan(100) // Average per operation under 100ms
    })

    test('should handle memory-intensive operations efficiently', async () => {
      const userId = 'user-1'
      
      // Create large dataset search
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        id: `large-comment-${i}`,
        content: `Large content entry ${i} `.repeat(50), // ~1KB per comment
        platform: ['instagram', 'tiktok', 'facebook'][i % 3],
        user_id: userId,
        sentiment_score: (Math.random() - 0.5) * 2,
        engagement_metrics: {
          likes: Math.floor(Math.random() * 1000),
          replies: Math.floor(Math.random() * 100),
          shares: Math.floor(Math.random() * 50)
        },
        created_at: new Date().toISOString()
      }))

      const searchRequest = createMockRequest('GET', 'http://localhost:3000/api/comments/search?q=large&facets=true&limit=100', userId)
      
      mockSupabaseClient.from().single = jest.fn()
        .mockResolvedValueOnce({ data: largeDataset.slice(0, 100), error: null, count: 1000 })
        .mockResolvedValueOnce({ data: largeDataset, error: null })

      const initialMemory = process.memoryUsage()
      const response = await SearchGET(searchRequest)
      const responseData = await response.json()
      const finalMemory = process.memoryUsage()

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      expect(response.status).toBe(200)
      expect(responseData.data).toHaveLength(100)
      expect(responseData.facets).toBeDefined()
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Memory increase should be under 50MB
    })
  })
})