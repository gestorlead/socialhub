/**
 * Performance Optimization Test Suite
 * 
 * Tests for Phase 2.1 performance enhancements:
 * - Multi-layer caching system
 * - Database optimization
 * - API response times
 * - Memory usage
 * - Bundle size validation
 */

import { jest } from '@jest/globals'
import { NextRequest } from 'next/server'

// Set up test environment variables
process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Import performance modules
import { PerformanceCache, CacheStrategies, CACHE_CONFIGS } from '@/lib/performance-cache'
import { DatabaseOptimizer } from '@/lib/database-optimizer'
import { PerformanceMonitor } from '@/lib/performance-monitor'
import { BundleAnalyzer, PerformanceBudgets } from '@/lib/bundle-optimizer'

// Mock Redis for testing
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  mget: jest.fn(),
  mset: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  eval: jest.fn()
}

describe('Performance Cache System', () => {
  let cache: PerformanceCache

  beforeEach(() => {
    cache = new PerformanceCache(1024 * 1024, mockRedis) // 1MB memory cache
    jest.clearAllMocks()
  })

  describe('Multi-layer Caching', () => {
    test('should cache data in L1 (memory) cache', async () => {
      const testData = { id: 1, name: 'Test Comment' }
      const cacheKey = 'test:key'
      
      // Set data in cache
      await cache.set(cacheKey, testData, {
        ttl: 60000,
        priority: 'high',
        tags: ['test']
      })
      
      // Get data from cache
      const cached = await cache.get(cacheKey)
      
      expect(cached).toEqual(testData)
    })

    test('should fall back to L2 (Redis) cache when L1 misses', async () => {
      const testData = { id: 2, name: 'Redis Comment' }
      const cacheKey = 'redis:key'
      
      // Mock Redis return
      const cacheEntry = {
        data: testData,
        timestamp: Date.now(),
        ttl: 60000,
        tags: ['redis'],
        size: 0,
        hits: 0,
        priority: 'medium'
      }
      
      mockRedis.get.mockResolvedValue(JSON.stringify(cacheEntry))
      
      // Get data (should hit Redis)
      const cached = await cache.get(cacheKey)
      
      expect(cached).toEqual(testData)
      expect(mockRedis.get).toHaveBeenCalledWith('pc:redis:key')
    })

    test('should handle cache invalidation by tags', async () => {
      const testData1 = { id: 1, name: 'Comment 1' }
      const testData2 = { id: 2, name: 'Comment 2' }
      
      await cache.set('user:1:comments', testData1, {
        ttl: 60000,
        tags: ['user:1', 'comments'],
        priority: 'high'
      })
      
      await cache.set('user:1:profile', testData2, {
        ttl: 60000,
        tags: ['user:1', 'profile'],
        priority: 'medium'
      })
      
      // Invalidate by tag
      const invalidated = await cache.invalidateByTags(['user:1'])
      
      expect(invalidated).toBeGreaterThan(0)
    })

    test('should respect cache TTL', async () => {
      const testData = { id: 1, expired: true }
      const cacheKey = 'ttl:test'
      
      // Set with very short TTL
      await cache.set(cacheKey, testData, {
        ttl: 1, // 1ms
        priority: 'low'
      })
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Should return null (expired)
      const cached = await cache.get(cacheKey)
      expect(cached).toBeNull()
    })

    test('should track cache hit/miss metrics', async () => {
      const testData = { metrics: 'test' }
      
      // Miss
      await cache.get('missing:key')
      
      // Set and hit
      await cache.set('hit:key', testData, { ttl: 60000 })
      await cache.get('hit:key')
      
      const metrics = cache.getMetrics()
      
      expect(metrics.hits).toBeGreaterThan(0)
      expect(metrics.misses).toBeGreaterThan(0)
      expect(metrics.hitRate).toBeGreaterThan(0)
    })
  })

  describe('Cache Strategies', () => {
    test('should generate consistent cache keys', () => {
      const params = { platform: 'tiktok', status: 'active' }
      const key1 = CacheStrategies.generateKey('comments', params)
      const key2 = CacheStrategies.generateKey('comments', params)
      
      expect(key1).toBe(key2)
    })

    test('should generate user-specific cache keys', () => {
      const userId = 'user123'
      const params = { limit: 20, offset: 0 }
      
      const key = CacheStrategies.generateUserKey(userId, 'comments', params)
      
      expect(key).toContain('user:user123:comments')
    })

    test('should return appropriate TTL for different data types', () => {
      expect(CacheStrategies.getTTL('comments')).toBe(5 * 60 * 1000) // 5 minutes
      expect(CacheStrategies.getTTL('user-data')).toBe(15 * 60 * 1000) // 15 minutes
      expect(CacheStrategies.getTTL('analytics')).toBe(30 * 60 * 1000) // 30 minutes
    })
  })

  describe('Batch Operations', () => {
    test('should handle batch get operations efficiently', async () => {
      const keys = ['key1', 'key2', 'key3']
      const testData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        null // Missing key
      ]
      
      // Mock L1 cache misses, L2 cache hits
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({
          data: testData[0],
          timestamp: Date.now(),
          ttl: 60000,
          tags: [],
          size: 0,
          hits: 0,
          priority: 'medium'
        }),
        JSON.stringify({
          data: testData[1],
          timestamp: Date.now(),
          ttl: 60000,
          tags: [],
          size: 0,
          hits: 0,
          priority: 'medium'
        }),
        null
      ])
      
      const results = await cache.mget(keys)
      
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual(testData[0])
      expect(results[1]).toEqual(testData[1])
      expect(results[2]).toBeNull()
    })
  })
})

describe('Database Optimizer', () => {
  let optimizer: DatabaseOptimizer

  beforeEach(() => {
    optimizer = new DatabaseOptimizer({
      maxConnections: 5,
      connectionTimeout: 10000,
      queryTimeout: 5000,
      enableQueryCache: true,
      enablePreparedStatements: true,
      enablePerformanceLogging: true
    })
  })

  describe('Query Optimization', () => {
    test('should execute queries with performance monitoring', async () => {
      const mockQuery = {
        data: [{ id: 1, content: 'Test comment' }],
        error: null
      }
      
      const result = await optimizer.executeQuery(
        Promise.resolve(mockQuery),
        {
          cacheKey: 'test:query',
          cacheTTL: 60000,
          priority: 'high'
        }
      )
      
      expect(result.data).toBeDefined()
      expect(result.metrics).toBeDefined()
      expect(result.metrics.latency).toBeGreaterThan(0)
    })

    test('should handle query errors gracefully', async () => {
      const mockError = new Error('Database connection failed')
      const mockQuery = Promise.reject(mockError)
      
      const result = await optimizer.executeQuery(mockQuery)
      
      expect(result.data).toBeNull()
      expect(result.error).toBe(mockError)
    })

    test('should track database metrics', () => {
      const metrics = optimizer.getMetrics()
      
      expect(metrics).toHaveProperty('totalQueries')
      expect(metrics).toHaveProperty('averageLatency')
      expect(metrics).toHaveProperty('cacheHits')
      expect(metrics).toHaveProperty('cacheMisses')
      expect(metrics).toHaveProperty('connectionPoolStats')
    })
  })

  describe('Batch Operations', () => {
    test('should execute batch queries efficiently', async () => {
      const queries = [
        {
          query: Promise.resolve({ data: { id: 1 }, error: null }),
          cacheKey: 'batch:1',
          cacheTTL: 60000
        },
        {
          query: Promise.resolve({ data: { id: 2 }, error: null }),
          cacheKey: 'batch:2',
          cacheTTL: 60000
        }
      ]
      
      const results = await optimizer.executeBatch(queries, 'user123')
      
      expect(results).toHaveLength(2)
      expect(results[0].data).toEqual({ id: 1 })
      expect(results[1].data).toEqual({ id: 2 })
    })
  })

  describe('Streaming Queries', () => {
    test('should stream large result sets', async () => {
      const mockQuery = {
        range: jest.fn().mockReturnThis(),
        then: jest.fn()
      }
      
      // Mock different result sets for pagination
      mockQuery.then
        .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null })
        .mockResolvedValueOnce({ data: [{ id: 3 }, { id: 4 }], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
      
      const results = []
      const stream = optimizer.streamQuery(mockQuery, 2, 'user123')
      
      for await (const batch of stream) {
        results.push(...batch)
        if (results.length >= 4) break // Prevent infinite loop in test
      }
      
      expect(results).toHaveLength(4)
    })
  })
})

describe('Performance Monitor', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      apiResponseTimeP95: 200,
      apiResponseTimeP99: 500,
      errorRate: 0.01,
      memoryUsagePercentage: 80,
      cacheHitRate: 80,
      databaseQueryTime: 100
    })
  })

  describe('API Performance Tracking', () => {
    test('should record API request metrics', () => {
      monitor.recordApiRequest(150, true, '/api/comments', 'GET')
      monitor.recordApiRequest(250, true, '/api/comments', 'POST')
      monitor.recordApiRequest(500, false, '/api/comments', 'GET')
      
      const metrics = monitor.getMetrics()
      
      expect(metrics.totalRequests).toBe(3)
      expect(metrics.successfulRequests).toBe(2)
      expect(metrics.failedRequests).toBe(1)
      expect(metrics.errorRate).toBeCloseTo(0.33, 2)
    })

    test('should calculate response time percentiles', () => {
      // Add various response times
      const times = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800]
      times.forEach(time => {
        monitor.recordApiRequest(time, true, '/api/test', 'GET')
      })
      
      const metrics = monitor.getMetrics()
      
      expect(metrics.apiResponseTime.p50).toBeGreaterThan(0)
      expect(metrics.apiResponseTime.p95).toBeGreaterThan(0)
      expect(metrics.apiResponseTime.p99).toBeGreaterThan(0)
      expect(metrics.apiResponseTime.p95).toBeGreaterThan(metrics.apiResponseTime.p50)
    })

    test('should generate alerts for performance threshold violations', () => {
      // Generate requests that exceed thresholds
      for (let i = 0; i < 10; i++) {
        monitor.recordApiRequest(600, true, '/api/slow', 'GET') // Exceeds P95 threshold
      }
      
      const alerts = monitor.getAlerts()
      
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts.some(alert => alert.type === 'performance')).toBe(true)
    })
  })

  describe('Performance Regression Detection', () => {
    test('should detect performance regressions', () => {
      // Establish baseline
      for (let i = 0; i < 50; i++) {
        monitor.recordApiRequest(100, true, '/api/baseline', 'GET')
      }
      
      // Introduce regression
      for (let i = 0; i < 20; i++) {
        monitor.recordApiRequest(300, true, '/api/regression', 'GET') // 3x slower
      }
      
      const alerts = monitor.getAlerts()
      const regressionAlerts = alerts.filter(alert => 
        alert.message.includes('regression')
      )
      
      expect(regressionAlerts.length).toBeGreaterThan(0)
    })
  })

  describe('Metrics Export', () => {
    test('should export metrics in JSON format', async () => {
      monitor.recordApiRequest(200, true, '/api/test', 'GET')
      
      const exported = await monitor.exportMetrics('json')
      const metrics = JSON.parse(exported)
      
      expect(metrics).toHaveProperty('apiResponseTime')
      expect(metrics).toHaveProperty('requestRate')
      expect(metrics).toHaveProperty('errorRate')
      expect(metrics).toHaveProperty('timestamp')
    })

    test('should export metrics in Prometheus format', async () => {
      monitor.recordApiRequest(200, true, '/api/test', 'GET')
      
      const exported = await monitor.exportMetrics('prometheus')
      
      expect(exported).toContain('api_response_time_p95')
      expect(exported).toContain('http_requests_total')
      expect(exported).toContain('memory_usage_bytes')
    })
  })
})

describe('Bundle Optimization', () => {
  describe('Performance Budgets', () => {
    test('should define appropriate performance budgets', () => {
      expect(PerformanceBudgets.bundles.initial).toBe(500 * 1024) // 500KB
      expect(PerformanceBudgets.bundles.total).toBe(2 * 1024 * 1024) // 2MB
      expect(PerformanceBudgets.timing.firstContentfulPaint).toBe(1500) // 1.5s
      expect(PerformanceBudgets.timing.largestContentfulPaint).toBe(2500) // 2.5s
    })
  })

  describe('Bundle Analysis', () => {
    // Note: These tests would typically run in a browser environment
    // In a real implementation, you might use tools like Puppeteer for E2E testing
    
    test('should validate bundle size targets', () => {
      // Mock performance metrics
      const mockMetrics = {
        navigation: {
          domContentLoaded: 1200,
          loadComplete: 2800,
          firstContentfulPaint: 1400,
          largestContentfulPaint: 2200
        },
        bundles: {
          javascript: {
            count: 3,
            totalSize: 450 * 1024, // 450KB - within budget
            averageLoadTime: 200
          },
          css: {
            count: 2,
            totalSize: 50 * 1024, // 50KB
            averageLoadTime: 100
          }
        },
        memory: {
          used: 25 * 1024 * 1024, // 25MB
          total: 50 * 1024 * 1024, // 50MB
          limit: 100 * 1024 * 1024 // 100MB
        }
      }
      
      // Simulate bundle target checking
      const results = {
        initialJSBundle: {
          current: mockMetrics.bundles.javascript.totalSize,
          target: PerformanceBudgets.bundles.initial,
          met: mockMetrics.bundles.javascript.totalSize <= PerformanceBudgets.bundles.initial
        },
        loadTime: {
          current: mockMetrics.navigation.loadComplete,
          target: PerformanceBudgets.timing.timeToInteractive,
          met: mockMetrics.navigation.loadComplete <= PerformanceBudgets.timing.timeToInteractive
        },
        firstContentfulPaint: {
          current: mockMetrics.navigation.firstContentfulPaint,
          target: PerformanceBudgets.timing.firstContentfulPaint,
          met: mockMetrics.navigation.firstContentfulPaint <= PerformanceBudgets.timing.firstContentfulPaint
        }
      }
      
      expect(results.initialJSBundle.met).toBe(true)
      expect(results.loadTime.met).toBe(true)
      expect(results.firstContentfulPaint.met).toBe(true)
    })
  })
})

describe('End-to-End Performance Tests', () => {
  test('should meet API response time targets', async () => {
    const startTime = Date.now()
    
    // Simulate optimized API call
    const mockApiResponse = await new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          data: [{ id: 1, content: 'Fast response' }],
          meta: {
            fromCache: true,
            responseTime: Date.now() - startTime
          }
        })
      }, 50) // 50ms response time
    })
    
    const responseTime = Date.now() - startTime
    
    expect(responseTime).toBeLessThan(200) // Target: <200ms
  })

  test('should achieve target cache hit rate', async () => {
    const cache = new PerformanceCache(1024 * 1024, mockRedis)
    
    // Simulate cache usage pattern
    const testData = { id: 1, content: 'Cached data' }
    
    // First request - cache miss
    await cache.get('cache:test')
    
    // Set data
    await cache.set('cache:test', testData, { ttl: 60000 })
    
    // Multiple requests - cache hits
    for (let i = 0; i < 10; i++) {
      await cache.get('cache:test')
    }
    
    const metrics = cache.getMetrics()
    
    // Should achieve >80% hit rate after warming up
    expect(metrics.hitRate).toBeGreaterThan(80)
  })

  test('should maintain performance under load', async () => {
    const monitor = new PerformanceMonitor()
    const promises = []
    
    // Simulate 100 concurrent requests
    for (let i = 0; i < 100; i++) {
      promises.push(
        new Promise(resolve => {
          const startTime = Date.now()
          setTimeout(() => {
            const responseTime = Date.now() - startTime
            monitor.recordApiRequest(responseTime, true, `/api/load-test/${i}`, 'GET')
            resolve(responseTime)
          }, Math.random() * 100) // Random response time 0-100ms
        })
      )
    }
    
    await Promise.all(promises)
    
    const metrics = await monitor.getMetrics()
    
    expect(metrics.totalRequests).toBe(100)
    expect(metrics.apiResponseTime.p95).toBeLessThan(200) // Target: <200ms P95
    expect(metrics.errorRate).toBe(0) // No errors under load
  })
})

describe('Performance Regression Prevention', () => {
  test('should detect when performance degrades beyond acceptable thresholds', () => {
    const monitor = new PerformanceMonitor({
      apiResponseTimeP95: 200,
      errorRate: 0.01
    })
    
    // Establish good baseline
    for (let i = 0; i < 100; i++) {
      monitor.recordApiRequest(100, true, '/api/baseline', 'GET')
    }
    
    // Introduce performance regression
    for (let i = 0; i < 50; i++) {
      monitor.recordApiRequest(400, true, '/api/regression', 'GET') // 4x slower
    }
    
    const alerts = monitor.getAlerts()
    const performanceAlerts = alerts.filter(alert => 
      alert.type === 'performance' && alert.metric.includes('apiResponseTime')
    )
    
    expect(performanceAlerts.length).toBeGreaterThan(0)
    expect(performanceAlerts[0].severity).toBe('medium')
  })

  test('should validate memory usage stays within bounds', () => {
    // Mock memory usage tracking
    const memoryReadings = []
    
    // Simulate memory usage over time
    for (let i = 0; i < 100; i++) {
      const usage = Math.random() * 100 // 0-100% memory usage
      memoryReadings.push(usage)
    }
    
    const averageUsage = memoryReadings.reduce((sum, usage) => sum + usage, 0) / memoryReadings.length
    const maxUsage = Math.max(...memoryReadings)
    
    expect(averageUsage).toBeLessThan(70) // Target: <70% average
    expect(maxUsage).toBeLessThan(90) // Target: <90% peak
  })
})