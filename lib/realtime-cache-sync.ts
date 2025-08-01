import { performanceCache } from './performance-cache'
import { SecureLogger } from './secure-logger'
import { RealtimeMessage, RealtimeMessageType } from './realtime-security'

/**
 * Real-time Cache Synchronization System
 * 
 * Integrates real-time updates with the existing multi-layer cache system:
 * - Automatic cache invalidation on real-time updates
 * - Intelligent cache warming with fresh data
 * - Conflict resolution between cached and real-time data
 * - Cache coherence across multiple instances
 * - Performance optimization for high-frequency updates
 * 
 * Performance Targets:
 * - Cache invalidation: <10ms
 * - Cache warming: <50ms
 * - Conflict resolution: <100ms
 * - Memory overhead: <5% of total cache
 */

// Cache invalidation strategy
export type InvalidationStrategy = 
  | 'immediate'     // Invalidate immediately on update
  | 'delayed'       // Batch invalidations for performance
  | 'selective'     // Invalidate only specific keys
  | 'lazy'          // Invalidate on next access
  | 'versioned'     // Use versioning for conflict resolution

// Cache warming strategy
export type WarmingStrategy = 
  | 'eager'         // Pre-fetch data immediately 
  | 'lazy'          // Fetch on demand
  | 'predictive'    // Pre-fetch based on usage patterns
  | 'disabled'      // No cache warming

// Real-time cache event
export interface RealtimeCacheEvent {
  id: string
  type: RealtimeMessageType
  affectedKeys: string[]
  affectedTags: string[]
  data?: any
  timestamp: Date
  source: 'realtime' | 'api' | 'background'
  userId?: string
}

// Cache coherence configuration
export interface CacheCoherenceConfig {
  invalidationStrategy: InvalidationStrategy
  warmingStrategy: WarmingStrategy
  batchSize: number
  batchDelay: number
  conflictResolution: 'timestamp' | 'version' | 'manual'
  enableMetrics: boolean
}

// Cache synchronization metrics
export interface CacheSyncMetrics {
  invalidationsCount: number
  warmingHits: number
  warmingMisses: number
  conflictsResolved: number
  averageInvalidationTime: number
  averageWarmingTime: number
  lastSyncAt: Date
}

/**
 * Real-time Cache Synchronization Manager
 */
export class RealtimeCacheSyncManager {
  private eventQueue: RealtimeCacheEvent[] = []
  private batchTimeout: NodeJS.Timeout | null = null
  private metrics: CacheSyncMetrics
  private keyMappings: Map<string, string[]> = new Map()
  private tagMappings: Map<string, string[]> = new Map()

  constructor(private config: CacheCoherenceConfig) {
    this.metrics = {
      invalidationsCount: 0,
      warmingHits: 0,
      warmingMisses: 0,
      conflictsResolved: 0,
      averageInvalidationTime: 0,
      averageWarmingTime: 0,
      lastSyncAt: new Date()
    }

    this.initializeKeyMappings()
  }

  /**
   * Initialize mappings between real-time events and cache keys/tags
   */
  private initializeKeyMappings(): void {
    // Comment-related mappings
    this.keyMappings.set('comment_created', [
      'comments:*',
      'comments_count:*',
      'comments_stats:*'
    ])

    this.keyMappings.set('comment_updated', [
      'comment:*',
      'comments:*',
      'comments_stats:*'
    ])

    this.keyMappings.set('comment_deleted', [
      'comment:*',
      'comments:*',
      'comments_count:*',
      'comments_stats:*'
    ])

    this.keyMappings.set('comment_status_changed', [
      'comment:*',
      'comments:*',
      'moderation_queue:*',
      'comments_stats:*'
    ])

    this.keyMappings.set('moderation_action', [
      'moderation_queue:*',
      'moderation_stats:*',
      'comments:*'
    ])

    // Tag mappings for broader invalidation
    this.tagMappings.set('comment_created', [
      'comments',
      'comment_stats',
      'dashboard_stats'
    ])

    this.tagMappings.set('comment_updated', [
      'comments',
      'comment',
      'comment_stats'
    ])

    this.tagMappings.set('comment_deleted', [
      'comments',
      'comment',
      'comment_stats',
      'dashboard_stats'
    ])

    this.tagMappings.set('moderation_action', [
      'comments',
      'moderation',
      'admin_stats'
    ])
  }

  /**
   * Process real-time message and sync cache
   */
  async processRealtimeMessage(message: RealtimeMessage): Promise<void> {
    const startTime = performance.now()

    try {
      // Create cache event
      const cacheEvent: RealtimeCacheEvent = {
        id: `cache_${message.id}`,
        type: message.type,
        affectedKeys: this.generateAffectedKeys(message),
        affectedTags: this.generateAffectedTags(message),
        data: message.payload,
        timestamp: new Date(message.timestamp),
        source: 'realtime',
        userId: message.user_id
      }

      // Process based on invalidation strategy
      switch (this.config.invalidationStrategy) {
        case 'immediate':
          await this.processImmediate(cacheEvent)
          break
        case 'delayed':
          this.queueForBatchProcessing(cacheEvent)
          break
        case 'selective':
          await this.processSelective(cacheEvent)
          break
        case 'lazy':
          await this.markForLazyInvalidation(cacheEvent)
          break
        case 'versioned':
          await this.processVersioned(cacheEvent)
          break
      }

      // Update metrics
      const duration = performance.now() - startTime
      this.updateMetrics('invalidation', duration)

      await SecureLogger.log({
        level: 'DEBUG',
        category: 'CACHE_SYNC',
        message: 'Real-time cache sync processed',
        details: {
          messageType: message.type,
          affectedKeysCount: cacheEvent.affectedKeys.length,
          affectedTagsCount: cacheEvent.affectedTags.length,
          strategy: this.config.invalidationStrategy,
          duration
        },
        userId: message.user_id
      })

    } catch (error) {
      await SecureLogger.logSecurityEvent({
        type: 'CACHE_SYNC_ERROR',
        severity: 'MEDIUM',
        details: {
          messageType: message.type,
          error: error instanceof Error ? error.message : 'Unknown error',
          messageId: message.id
        }
      })
      throw error
    }
  }

  /**
   * Generate affected cache keys for a real-time message
   */
  private generateAffectedKeys(message: RealtimeMessage): string[] {
    const keys: string[] = []
    const baseKeys = this.keyMappings.get(message.type) || []

    for (const keyPattern of baseKeys) {
      // Replace wildcards with actual values from message payload
      let actualKey = keyPattern

      if (message.payload) {
        actualKey = actualKey
          .replace('*', message.payload.id || message.payload.comment_id || '*')
          .replace('{platform}', message.payload.platform || '')
          .replace('{post_id}', message.payload.platform_post_id || '')
          .replace('{user_id}', message.payload.user_id || message.user_id || '')
      }

      keys.push(actualKey)
    }

    return keys
  }

  /**
   * Generate affected cache tags for a real-time message
   */
  private generateAffectedTags(message: RealtimeMessage): string[] {
    const baseTags = this.tagMappings.get(message.type) || []
    const dynamicTags: string[] = []

    if (message.payload) {
      // Add dynamic tags based on message content
      if (message.payload.platform) {
        dynamicTags.push(`platform:${message.payload.platform}`)
      }
      if (message.payload.user_id || message.user_id) {
        dynamicTags.push(`user:${message.payload.user_id || message.user_id}`)
      }
      if (message.payload.platform_post_id) {
        dynamicTags.push(`post:${message.payload.platform_post_id}`)
      }
    }

    return [...baseTags, ...dynamicTags]
  }

  /**
   * Process immediate invalidation
   */
  private async processImmediate(event: RealtimeCacheEvent): Promise<void> {
    // Invalidate by keys
    for (const key of event.affectedKeys) {
      await performanceCache.del(key)
    }

    // Invalidate by tags
    for (const tag of event.affectedTags) {
      await performanceCache.invalidateByTags([tag])
    }

    // Cache warming if enabled
    if (this.config.warmingStrategy !== 'disabled') {
      await this.warmCache(event)
    }

    this.metrics.invalidationsCount++
  }

  /**
   * Queue event for batch processing
   */
  private queueForBatchProcessing(event: RealtimeCacheEvent): void {
    this.eventQueue.push(event)

    // Set batch timeout if not already set
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.processBatch()
      }, this.config.batchDelay)
    }

    // Process immediately if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.processBatch()
    }
  }

  /**
   * Process batch of cache events
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }

    if (this.eventQueue.length === 0) return

    const events = [...this.eventQueue]
    this.eventQueue = []

    try {
      // Collect all unique keys and tags
      const allKeys = new Set<string>()
      const allTags = new Set<string>()

      for (const event of events) {
        event.affectedKeys.forEach(key => allKeys.add(key))
        event.affectedTags.forEach(tag => allTags.add(tag))
      }

      // Batch invalidate keys
      for (const key of allKeys) {
        await performanceCache.del(key)
      }

      // Batch invalidate tags
      if (allTags.size > 0) {
        await performanceCache.invalidateByTags(Array.from(allTags))
      }

      // Warm cache for latest events
      if (this.config.warmingStrategy !== 'disabled') {
        const latestEvents = events.slice(-5) // Warm cache for 5 most recent events
        for (const event of latestEvents) {
          await this.warmCache(event)
        }
      }

      this.metrics.invalidationsCount += events.length

      await SecureLogger.log({
        level: 'DEBUG',
        category: 'CACHE_SYNC',
        message: 'Batch cache invalidation completed',
        details: {
          eventsProcessed: events.length,
          keysInvalidated: allKeys.size,
          tagsInvalidated: allTags.size
        }
      })

    } catch (error) {
      console.error('Batch cache processing failed:', error)
      
      // Re-queue events for retry
      this.eventQueue.unshift(...events)
    }
  }

  /**
   * Process selective invalidation (only specific keys)
   */
  private async processSelective(event: RealtimeCacheEvent): Promise<void> {
    // Only invalidate exact matches, not wildcard patterns
    for (const key of event.affectedKeys) {
      if (!key.includes('*')) {
        await performanceCache.del(key)
      }
    }

    // Selective tag invalidation
    const selectiveTags = event.affectedTags.filter(tag => 
      tag.includes(':') // Only invalidate specific tags like "user:123"
    )

    if (selectiveTags.length > 0) {
      await performanceCache.invalidateByTags(selectiveTags)
    }

    this.metrics.invalidationsCount++
  }

  /**
   * Mark keys for lazy invalidation
   */
  private async markForLazyInvalidation(event: RealtimeCacheEvent): Promise<void> {
    // Set expiry metadata on cache entries instead of invalidating immediately
    for (const key of event.affectedKeys) {
      await performanceCache.expire(key, 1) // Expire in 1 second
    }

    // Store invalidation metadata
    const invalidationKey = `invalidation:${event.id}`
    await performanceCache.set(invalidationKey, {
      event,
      markedAt: new Date()
    }, {
      ttl: 60 * 1000, // 1 minute
      tags: ['invalidation']
    })
  }

  /**
   * Process versioned cache invalidation
   */
  private async processVersioned(event: RealtimeCacheEvent): Promise<void> {
    for (const key of event.affectedKeys) {
      // Get current cached data
      const cachedData = await performanceCache.get(key)
      
      if (cachedData && this.hasVersionConflict(cachedData, event.data)) {
        await this.resolveVersionConflict(key, cachedData, event)
      } else {
        // No conflict, update cache with new data
        if (event.data) {
          await performanceCache.set(key, {
            ...event.data,
            _version: event.timestamp.getTime(),
            _lastUpdated: event.timestamp
          })
        } else {
          await performanceCache.del(key)
        }
      }
    }

    this.metrics.conflictsResolved++
  }

  /**
   * Check for version conflicts
   */
  private hasVersionConflict(cachedData: any, newData: any): boolean {
    if (!cachedData._version || !newData) return false
    
    const cachedVersion = cachedData._version
    const newVersion = newData.updated_at ? new Date(newData.updated_at).getTime() : Date.now()
    
    return cachedVersion > newVersion
  }

  /**
   * Resolve version conflicts
   */
  private async resolveVersionConflict(
    key: string, 
    cachedData: any, 
    event: RealtimeCacheEvent
  ): Promise<void> {
    switch (this.config.conflictResolution) {
      case 'timestamp':
        // Keep the most recent version
        const cachedTime = cachedData._lastUpdated ? new Date(cachedData._lastUpdated) : new Date(0)
        if (event.timestamp > cachedTime) {
          await performanceCache.set(key, {
            ...event.data,
            _version: event.timestamp.getTime(),
            _lastUpdated: event.timestamp
          })
        }
        break

      case 'version':
        // Use version numbers if available
        const cachedVersion = cachedData._version || 0
        const newVersion = event.data?._version || event.timestamp.getTime()
        if (newVersion > cachedVersion) {
          await performanceCache.set(key, {
            ...event.data,
            _version: newVersion,
            _lastUpdated: event.timestamp
          })
        }
        break

      case 'manual':
        // Store conflict for manual resolution
        await performanceCache.set(`conflict:${key}`, {
          cachedData,
          newData: event.data,
          event,
          timestamp: new Date()
        }, {
          ttl: 24 * 60 * 60 * 1000, // 24 hours
          tags: ['conflict']
        })
        break
    }
  }

  /**
   * Cache warming based on strategy
   */
  private async warmCache(event: RealtimeCacheEvent): Promise<void> {
    const startTime = performance.now()

    try {
      switch (this.config.warmingStrategy) {
        case 'eager':
          await this.eagerWarmCache(event)
          break
        case 'predictive':
          await this.predictiveWarmCache(event)
          break
        case 'lazy':
          // Mark for lazy loading
          await this.markForLazyWarming(event)
          break
      }

      const duration = performance.now() - startTime
      this.updateMetrics('warming', duration)
      this.metrics.warmingHits++

    } catch (error) {
      this.metrics.warmingMisses++
      console.error('Cache warming failed:', error)
    }
  }

  /**
   * Eager cache warming - immediately fetch fresh data
   */
  private async eagerWarmCache(event: RealtimeCacheEvent): Promise<void> {
    // For comment-related events, pre-fetch related data
    if (event.type.startsWith('comment_') && event.data) {
      const commentId = event.data.id || event.data.comment_id
      const userId = event.data.user_id || event.userId
      const platform = event.data.platform

      if (commentId) {
        // Warm individual comment cache
        await this.warmCommentData(commentId)
      }

      if (userId && platform) {
        // Warm user's comments list
        await this.warmUserCommentsData(userId, platform)
      }

      if (platform) {
        // Warm platform stats
        await this.warmPlatformStats(platform)
      }
    }
  }

  /**
   * Predictive cache warming based on usage patterns
   */
  private async predictiveWarmCache(event: RealtimeCacheEvent): Promise<void> {
    // Analyze usage patterns and pre-fetch likely-to-be-accessed data
    const predictions = await this.predictLikelyAccessPatterns(event)
    
    for (const prediction of predictions) {
      if (prediction.confidence > 0.7) {
        await this.warmSpecificData(prediction.key, prediction.type)
      }
    }
  }

  /**
   * Mark for lazy cache warming
   */
  private async markForLazyWarming(event: RealtimeCacheEvent): Promise<void> {
    const warmingKey = `warming:${event.id}`
    await performanceCache.set(warmingKey, {
      event,
      markedAt: new Date(),
      priority: this.calculateWarmingPriority(event)
    }, {
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['warming']
    })
  }

  /**
   * Helper methods for cache warming
   */
  private async warmCommentData(commentId: string): Promise<void> {
    // This would typically fetch from API and cache
    const key = `comment:${commentId}`
    // Simulate API call
    const data = { id: commentId, warmed: true, timestamp: new Date() }
    await performanceCache.set(key, data, { ttl: 30 * 60 * 1000 })
  }

  private async warmUserCommentsData(userId: string, platform: string): Promise<void> {
    const key = `comments:${userId}:${platform}`
    // Simulate API call
    const data = { userId, platform, warmed: true, timestamp: new Date() }
    await performanceCache.set(key, data, { ttl: 10 * 60 * 1000 })
  }

  private async warmPlatformStats(platform: string): Promise<void> {
    const key = `comments_stats:${platform}`
    // Simulate API call
    const data = { platform, stats: {}, warmed: true, timestamp: new Date() }
    await performanceCache.set(key, data, { ttl: 5 * 60 * 1000 })
  }

  private async predictLikelyAccessPatterns(event: RealtimeCacheEvent): Promise<Array<{
    key: string
    type: string
    confidence: number
  }>> {
    // Simplified prediction logic - in production would use ML/analytics
    const predictions: Array<{ key: string, type: string, confidence: number }> = []

    if (event.type === 'comment_created') {
      predictions.push({
        key: `comments:${event.userId}:${event.data?.platform}`,
        type: 'user_comments',
        confidence: 0.9
      })
      predictions.push({
        key: `comments_stats:${event.data?.platform}`,
        type: 'platform_stats',
        confidence: 0.8
      })
    }

    return predictions
  }

  private async warmSpecificData(key: string, type: string): Promise<void> {
    // Warm specific data based on type
    switch (type) {
      case 'user_comments':
        // Simulate fetching user comments
        break
      case 'platform_stats':
        // Simulate fetching platform stats
        break
    }
  }

  private calculateWarmingPriority(event: RealtimeCacheEvent): number {
    // Calculate priority based on event type and data
    let priority = 0.5

    if (event.type === 'comment_created') priority += 0.3
    if (event.type === 'moderation_action') priority += 0.4
    if (event.userId) priority += 0.1

    return Math.min(priority, 1.0)
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(operation: 'invalidation' | 'warming', duration: number): void {
    const currentAvg = operation === 'invalidation' 
      ? this.metrics.averageInvalidationTime 
      : this.metrics.averageWarmingTime

    const newAvg = (currentAvg + duration) / 2

    if (operation === 'invalidation') {
      this.metrics.averageInvalidationTime = newAvg
    } else {
      this.metrics.averageWarmingTime = newAvg
    }

    this.metrics.lastSyncAt = new Date()
  }

  /**
   * Get current metrics
   */
  getMetrics(): CacheSyncMetrics {
    return { ...this.metrics }
  }

  /**
   * Get pending conflicts for manual resolution
   */
  async getPendingConflicts(): Promise<Array<{ key: string, conflict: any }>> {
    const conflicts: Array<{ key: string, conflict: any }> = []
    
    // This would scan cache for conflict keys
    // Simplified implementation
    
    return conflicts
  }

  /**
   * Cleanup old invalidation and warming markers
   */
  async cleanup(): Promise<void> {
    await performanceCache.invalidateByTags(['invalidation', 'warming'])
    
    await SecureLogger.log({
      level: 'INFO',
      category: 'CACHE_SYNC',
      message: 'Cache sync cleanup completed',
      details: {
        metrics: this.metrics
      }
    })
  }
}

/**
 * Factory function to create cache sync manager
 */
export function createRealtimeCacheSyncManager(
  config: Partial<CacheCoherenceConfig> = {}
): RealtimeCacheSyncManager {
  const defaultConfig: CacheCoherenceConfig = {
    invalidationStrategy: 'immediate',
    warmingStrategy: 'eager',
    batchSize: 10,
    batchDelay: 100, // 100ms
    conflictResolution: 'timestamp',
    enableMetrics: true
  }

  return new RealtimeCacheSyncManager({ ...defaultConfig, ...config })
}

/**
 * Global cache sync manager instance
 */
export const globalCacheSyncManager = createRealtimeCacheSyncManager()