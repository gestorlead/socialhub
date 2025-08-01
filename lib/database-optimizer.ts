import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { performanceCache, CACHE_CONFIGS, CacheStrategies } from './performance-cache'

/**
 * Database Optimization Layer
 * 
 * Features:
 * - Connection pooling and reuse
 * - Query optimization and batching
 * - Prepared statement caching
 * - Query result streaming
 * - Performance monitoring
 * - Cursor-based pagination
 * 
 * Performance Targets:
 * - Query response time: <100ms simple, <200ms complex
 * - Connection reuse: >90%
 * - Query caching: >80% hit rate
 */

export interface DatabaseConfig {
  maxConnections: number
  connectionTimeout: number
  queryTimeout: number
  enableQueryCache: boolean
  enablePreparedStatements: boolean
  enablePerformanceLogging: boolean
}

export interface QueryMetrics {
  totalQueries: number
  averageLatency: number
  cacheHits: number
  cacheMisses: number
  slowQueries: number
  connectionPoolStats: {
    active: number
    idle: number
    total: number
    maxConnections: number
  }
}

export interface PaginationCursor {
  column: string
  value: any
  direction: 'asc' | 'desc'
}

export interface OptimizedQuery {
  sql?: string
  cacheKey?: string
  cacheTTL?: number
  metrics?: boolean
  timeout?: number
  priority?: 'low' | 'medium' | 'high'
}

/**
 * Connection Pool Manager
 */
class ConnectionPool {
  private connections: Map<string, SupabaseClient> = new Map()
  private activeConnections: Set<string> = new Set()
  private connectionStats = {
    created: 0,
    reused: 0,
    destroyed: 0,
    errors: 0
  }
  private maxConnections: number
  private connectionTimeout: number

  constructor(maxConnections: number = 10, connectionTimeout: number = 30000) {
    this.maxConnections = maxConnections
    this.connectionTimeout = connectionTimeout
  }

  /**
   * Get optimized connection based on context
   */
  getConnection(context: 'read' | 'write' | 'admin', userId?: string): SupabaseClient {
    const connectionKey = this.generateConnectionKey(context, userId)
    
    // Try to reuse existing connection
    if (this.connections.has(connectionKey) && !this.activeConnections.has(connectionKey)) {
      this.activeConnections.add(connectionKey)
      this.connectionStats.reused++
      return this.connections.get(connectionKey)!
    }

    // Create new connection if under limit
    if (this.connections.size < this.maxConnections) {
      const client = this.createOptimizedClient(context, userId)
      this.connections.set(connectionKey, client)
      this.activeConnections.add(connectionKey)
      this.connectionStats.created++
      return client
    }

    // If at limit, find least recently used connection
    const availableKey = this.findAvailableConnection()
    if (availableKey) {
      this.activeConnections.add(availableKey)
      this.connectionStats.reused++
      return this.connections.get(availableKey)!
    }

    // Fallback: create temporary connection
    console.warn('Connection pool exhausted, creating temporary connection')
    return this.createOptimizedClient(context, userId)
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(context: 'read' | 'write' | 'admin', userId?: string): void {
    const connectionKey = this.generateConnectionKey(context, userId)
    this.activeConnections.delete(connectionKey)
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      active: this.activeConnections.size,
      idle: this.connections.size - this.activeConnections.size,
      total: this.connections.size,
      maxConnections: this.maxConnections,
      ...this.connectionStats
    }
  }

  private createOptimizedClient(context: 'read' | 'write' | 'admin', userId?: string): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    
    if (context === 'admin') {
      return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
        global: {
          headers: {
            'X-Client-Info': 'socialhub-admin',
            'X-Connection-Pool': 'true'
          }
        },
        db: {
          schema: 'public'
        }
      })
    }

    return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { 
        persistSession: false,
        autoRefreshToken: false // Disable for performance
      },
      global: {
        headers: {
          'X-Client-Info': `socialhub-${context}`,
          'X-Connection-Pool': 'true',
          ...(userId && { 'X-User-ID': userId })
        }
      },
      db: {
        schema: 'public'
      }
    })
  }

  private generateConnectionKey(context: string, userId?: string): string {
    return `${context}:${userId || 'anonymous'}`
  }

  private findAvailableConnection(): string | null {
    for (const key of this.connections.keys()) {
      if (!this.activeConnections.has(key)) {
        return key
      }
    }
    return null
  }
}

/**
 * Query Cache Manager
 */
class QueryCache {
  private preparedStatements = new Map<string, string>()
  private queryPlans = new Map<string, any>()

  /**
   * Get cached query plan
   */
  getQueryPlan(sql: string): any | null {
    const hash = this.hashQuery(sql)
    return this.queryPlans.get(hash) || null
  }

  /**
   * Cache query plan
   */
  setQueryPlan(sql: string, plan: any): void {
    const hash = this.hashQuery(sql)
    this.queryPlans.set(hash, plan)
  }

  /**
   * Get prepared statement
   */
  getPreparedStatement(sql: string): string | null {
    const hash = this.hashQuery(sql)
    return this.preparedStatements.get(hash) || null
  }

  /**
   * Cache prepared statement
   */
  setPreparedStatement(sql: string, prepared: string): void {
    const hash = this.hashQuery(sql)
    this.preparedStatements.set(hash, prepared)
  }

  private hashQuery(sql: string): string {
    // Simple hash function for SQL queries
    let hash = 0
    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
}

/**
 * Database Optimizer - Main Class
 */
export class DatabaseOptimizer {
  private connectionPool: ConnectionPool
  private queryCache: QueryCache
  private metrics: QueryMetrics
  private config: DatabaseConfig

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      maxConnections: 10,
      connectionTimeout: 30000,
      queryTimeout: 10000,
      enableQueryCache: true,
      enablePreparedStatements: true,
      enablePerformanceLogging: true,
      ...config
    }

    this.connectionPool = new ConnectionPool(
      this.config.maxConnections,
      this.config.connectionTimeout
    )
    
    this.queryCache = new QueryCache()
    
    this.metrics = {
      totalQueries: 0,
      averageLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
      slowQueries: 0,
      connectionPoolStats: {
        active: 0,
        idle: 0,
        total: 0,
        maxConnections: this.config.maxConnections
      }
    }
  }

  /**
   * Execute optimized query with caching and performance monitoring
   */
  async executeQuery<T = any>(
    query: any,
    options: OptimizedQuery = {}
  ): Promise<{ data: T | null, error: any, metrics?: any }> {
    const startTime = Date.now()
    const cacheKey = options.cacheKey
    
    try {
      // Try cache first if enabled
      if (cacheKey && this.config.enableQueryCache) {
        const cached = await performanceCache.get<T>(cacheKey)
        if (cached !== null) {
          this.metrics.cacheHits++
          return { 
            data: cached, 
            error: null,
            metrics: { fromCache: true, latency: Date.now() - startTime }
          }
        }
        this.metrics.cacheMisses++
      }

      // Execute query
      const result = await query

      // Cache successful results
      if (!result.error && cacheKey && options.cacheTTL) {
        await performanceCache.set(cacheKey, result.data, {
          ttl: options.cacheTTL,
          tags: ['query-cache'],
          priority: options.priority || 'medium'
        })
      }

      // Update metrics
      const latency = Date.now() - startTime
      this.updateMetrics(latency)

      if (this.config.enablePerformanceLogging && latency > 1000) {
        console.warn(`Slow query detected: ${latency}ms`)
        this.metrics.slowQueries++
      }

      return {
        data: result.data,
        error: result.error,
        metrics: { latency, fromCache: false }
      }

    } catch (error) {
      const latency = Date.now() - startTime
      this.updateMetrics(latency)
      
      if (this.config.enablePerformanceLogging) {
        console.error('Query execution error:', error, { latency })
      }

      return { data: null, error }
    }
  }

  /**
   * Optimized comments query with cursor pagination
   */
  async getComments(
    userId: string,
    filters: Record<string, any> = {},
    cursor?: PaginationCursor,
    limit: number = 20
  ) {
    const client = this.connectionPool.getConnection('read', userId)
    
    try {
      // Generate cache key
      const cacheKey = CacheStrategies.generateCommentsKey(userId, {
        ...filters,
        cursor: cursor ? `${cursor.column}:${cursor.value}:${cursor.direction}` : null,
        limit
      })

      // Build optimized query
      let query = client
        .from('comments')
        .select(`
          *,
          social_posts!inner (
            platform,
            platform_post_id,
            title,
            url
          ),
          comment_replies (
            id,
            content,
            status,
            created_at
          )
        `)

      // Apply filters
      if (filters.platform) {
        query = query.eq('platform', filters.platform)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.search) {
        query = query.textSearch('content', filters.search)
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from)
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      // Apply cursor-based pagination
      if (cursor) {
        const operator = cursor.direction === 'asc' ? 'gt' : 'lt'
        query = query[operator](cursor.column, cursor.value)
      }

      // Apply sorting and limit
      query = query
        .order(filters.sort || 'created_at', { 
          ascending: filters.order === 'asc' 
        })
        .limit(limit)

      return await this.executeQuery(query, {
        cacheKey,
        cacheTTL: CACHE_CONFIGS.COMMENTS_LIST.ttl,
        priority: 'high'
      })

    } finally {
      this.connectionPool.releaseConnection('read', userId)
    }
  }

  /**
   * Batch query execution for improved performance
   */
  async executeBatch<T = any>(
    queries: Array<{ query: any, cacheKey?: string, cacheTTL?: number }>,
    userId?: string
  ): Promise<Array<{ data: T | null, error: any }>> {
    const client = this.connectionPool.getConnection('read', userId)
    
    try {
      // Check cache for all queries first
      const cacheResults = await this.checkBatchCache<T>(queries)
      const uncachedQueries: typeof queries = []
      const results: Array<{ data: T | null, error: any }> = new Array(queries.length)

      // Identify queries that need execution
      cacheResults.forEach((cached, index) => {
        if (cached !== null) {
          results[index] = { data: cached, error: null }
          this.metrics.cacheHits++
        } else {
          uncachedQueries.push({ ...queries[index], index })
          this.metrics.cacheMisses++
        }
      })

      // Execute uncached queries in parallel
      if (uncachedQueries.length > 0) {
        const promises = uncachedQueries.map(async ({ query, cacheKey, cacheTTL, index }) => {
          const result = await query
          
          // Cache successful results
          if (!result.error && cacheKey && cacheTTL) {
            await performanceCache.set(cacheKey, result.data, {
              ttl: cacheTTL,
              tags: ['batch-query'],
              priority: 'medium'
            })
          }

          return { result, index }
        })

        const batchResults = await Promise.allSettled(promises)
        
        batchResults.forEach((settled, i) => {
          const queryIndex = uncachedQueries[i].index
          if (settled.status === 'fulfilled') {
            const { result } = settled.value
            results[queryIndex] = { data: result.data, error: result.error }
          } else {
            results[queryIndex] = { data: null, error: settled.reason }
          }
        })
      }

      return results

    } finally {
      this.connectionPool.releaseConnection('read', userId)
    }
  }

  /**
   * Optimized aggregation queries
   */
  async getAggregatedData(
    userId: string,
    aggregations: Array<{
      table: string
      column: string
      function: 'count' | 'sum' | 'avg' | 'min' | 'max'
      filters?: Record<string, any>
    }>
  ) {
    const client = this.connectionPool.getConnection('read', userId)
    
    try {
      const cacheKey = CacheStrategies.generateUserKey(userId, 'aggregations', {
        queries: aggregations
      })

      // Build aggregation query
      const aggregationPromises = aggregations.map(async ({ table, column, function: func, filters }) => {
        let query = client.from(table)

        // Apply filters
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value)
          })
        }

        // Apply aggregation function
        switch (func) {
          case 'count':
            return query.select('*', { count: 'exact', head: true })
          case 'sum':
            return query.select(`${column}.sum()`)
          case 'avg':
            return query.select(`${column}.avg()`)
          case 'min':
            return query.select(`${column}.min()`)
          case 'max':
            return query.select(`${column}.max()`)
          default:
            throw new Error(`Unsupported aggregation function: ${func}`)
        }
      })

      return await this.executeQuery(
        Promise.all(aggregationPromises),
        {
          cacheKey,
          cacheTTL: CACHE_CONFIGS.ANALYTICS_DATA.ttl,
          priority: 'medium'
        }
      )

    } finally {
      this.connectionPool.releaseConnection('read', userId)
    }
  }

  /**
   * Stream large query results
   */
  async *streamQuery<T>(
    baseQuery: any,
    pageSize: number = 100,
    userId?: string
  ): AsyncGenerator<T[], void, unknown> {
    const client = this.connectionPool.getConnection('read', userId)
    let offset = 0
    
    try {
      while (true) {
        const query = baseQuery.range(offset, offset + pageSize - 1)
        const result = await query
        
        if (result.error) {
          throw new Error(result.error.message)
        }

        if (!result.data || result.data.length === 0) {
          break
        }

        yield result.data
        
        if (result.data.length < pageSize) {
          break
        }

        offset += pageSize
      }
    } finally {
      this.connectionPool.releaseConnection('read', userId)
    }
  }

  /**
   * Get database performance metrics
   */
  getMetrics(): QueryMetrics {
    return {
      ...this.metrics,
      connectionPoolStats: this.connectionPool.getStats()
    }
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      averageLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
      slowQueries: 0,
      connectionPoolStats: this.connectionPool.getStats()
    }
  }

  /**
   * Invalidate query cache by patterns
   */
  async invalidateCache(patterns: string[]): Promise<void> {
    await performanceCache.invalidateByTags(patterns)
  }

  private async checkBatchCache<T>(
    queries: Array<{ cacheKey?: string }>
  ): Promise<Array<T | null>> {
    const cacheKeys = queries.map(q => q.cacheKey).filter(Boolean) as string[]
    
    if (cacheKeys.length === 0) {
      return new Array(queries.length).fill(null)
    }

    const cached = await performanceCache.mget<T>(cacheKeys)
    const results: Array<T | null> = new Array(queries.length).fill(null)
    
    let cacheIndex = 0
    queries.forEach((query, index) => {
      if (query.cacheKey) {
        results[index] = cached[cacheIndex]
        cacheIndex++
      }
    })

    return results
  }

  private updateMetrics(latency: number): void {
    this.metrics.totalQueries++
    
    // Update average latency using exponential moving average
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageLatency = this.metrics.averageLatency === 0 
      ? latency
      : (alpha * latency) + ((1 - alpha) * this.metrics.averageLatency)
  }
}

// Utility functions for cursor pagination
export class PaginationUtils {
  /**
   * Create cursor from row data
   */
  static createCursor(
    row: Record<string, any>,
    column: string,
    direction: 'asc' | 'desc' = 'desc'
  ): PaginationCursor {
    return {
      column,
      value: row[column],
      direction
    }
  }

  /**
   * Parse cursor from string
   */
  static parseCursor(cursorString: string): PaginationCursor | null {
    try {
      const [column, value, direction] = cursorString.split(':')
      return {
        column,
        value: this.parseValue(value),
        direction: direction as 'asc' | 'desc'
      }
    } catch {
      return null
    }
  }

  /**
   * Encode cursor to string
   */
  static encodeCursor(cursor: PaginationCursor): string {
    return `${cursor.column}:${cursor.value}:${cursor.direction}`
  }

  private static parseValue(value: string): any {
    // Try to parse as number
    if (!isNaN(Number(value))) {
      return Number(value)
    }
    
    // Try to parse as date
    if (value.includes('T') && value.includes('Z')) {
      return value // Keep as ISO string
    }
    
    return value
  }
}

// Export default instance
export const databaseOptimizer = new DatabaseOptimizer()

// Export utility functions
export const createDatabaseOptimizer = (config?: Partial<DatabaseConfig>) =>
  new DatabaseOptimizer(config)