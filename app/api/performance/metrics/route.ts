import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/lib/performance-monitor'
import { performanceCache } from '@/lib/performance-cache'
// import { databaseOptimizer } from '@/lib/database-optimizer' // TODO: Fix this import
import { SecurityMiddleware } from '@/lib/security-middleware'
import { withPerformanceMonitoring } from '@/lib/performance-monitor'

/**
 * Performance Metrics API
 * 
 * Provides real-time performance metrics for monitoring dashboard
 * - API response times and throughput
 * - Cache hit rates and memory usage
 * - Database performance metrics
 * - System health indicators
 * - Performance alerts and regressions
 */

const GET_Handler = async function(request: NextRequest) {
  try {
    // Apply security middleware
    const securityResult = await SecurityMiddleware.handle(request, {
      enableRateLimit: true,
      enableRequestSanitization: true,
      enableAuditLogging: false // Reduce overhead for metrics endpoint
    })
    
    if (securityResult) {
      return securityResult
    }

    // Get query parameters
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'
    const includeHistory = url.searchParams.get('history') === 'true'

    // Collect all performance metrics
    const performanceMetrics = await performanceMonitor.getMetrics()
    const cacheMetrics = performanceCache.getMetrics()
    const databaseMetrics = {} // databaseOptimizer.getMetrics() // TODO: Fix this

    // Get alerts if requested
    const alerts = includeHistory ? 
      performanceMonitor.getAlertHistory() : 
      performanceMonitor.getAlerts()

    // Combine all metrics
    const combinedMetrics = {
      timestamp: Date.now(),
      performance: performanceMetrics,
      cache: cacheMetrics,
      database: databaseMetrics,
      alerts: alerts,
      system: {
        environment: process.env.NODE_ENV,
        uptime: process.uptime?.() || 0,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage?.() || {}
      },
      thresholds: {
        apiResponseTimeP95: 200,
        apiResponseTimeP99: 500,
        errorRate: 0.01,
        cacheHitRate: 80,
        memoryUsagePercentage: 80,
        databaseQueryTime: 100
      }
    }

    // Return metrics in requested format
    if (format === 'prometheus') {
      const prometheusMetrics = await performanceMonitor.exportMetrics('prometheus')
      return new Response(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    return NextResponse.json(combinedMetrics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Performance-Score': calculatePerformanceScore(combinedMetrics).toString()
      }
    })

  } catch (error) {
    console.error('Performance metrics API error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve performance metrics',
        timestamp: Date.now()
      },
      { status: 500 }
    )
  }
}

/**
 * Performance Status API
 * Lightweight endpoint for health checks
 */
const HEAD_Handler = async function(request: NextRequest) {
  try {
    const performanceMetrics = await performanceMonitor.getMetrics()
    const score = calculatePerformanceScore({ performance: performanceMetrics })
    
    return new Response(null, {
      status: score >= 80 ? 200 : score >= 60 ? 206 : 503,
      headers: {
        'X-Performance-Score': score.toString(),
        'X-System-Status': score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    return new Response(null, { status: 503 })
  }
}

/**
 * Calculate overall performance score (0-100)
 */
function calculatePerformanceScore(metrics: any): number {
  const performance = metrics.performance || {}
  const cache = metrics.cache || {}
  const database = metrics.database || {}
  
  let score = 100
  
  // API Response Time Score (30 points)
  const p95ResponseTime = performance.apiResponseTime?.p95 || 0
  if (p95ResponseTime > 500) {
    score -= 30
  } else if (p95ResponseTime > 200) {
    score -= Math.round((p95ResponseTime - 200) / 300 * 30)
  }
  
  // Error Rate Score (25 points)
  const errorRate = performance.errorRate || 0
  if (errorRate > 0.05) { // >5%
    score -= 25
  } else if (errorRate > 0.01) { // >1%
    score -= Math.round((errorRate - 0.01) / 0.04 * 25)
  }
  
  // Cache Hit Rate Score (20 points)
  const cacheHitRate = cache.hitRate || 0
  if (cacheHitRate < 50) {
    score -= 20
  } else if (cacheHitRate < 80) {
    score -= Math.round((80 - cacheHitRate) / 30 * 20)
  }
  
  // Memory Usage Score (15 points)
  const memoryPercentage = performance.memoryUsage?.percentage || 0
  if (memoryPercentage > 90) {
    score -= 15
  } else if (memoryPercentage > 70) {
    score -= Math.round((memoryPercentage - 70) / 20 * 15)
  }
  
  // Database Performance Score (10 points)
  const avgQueryTime = database.averageLatency || 0
  if (avgQueryTime > 200) {
    score -= 10
  } else if (avgQueryTime > 100) {
    score -= Math.round((avgQueryTime - 100) / 100 * 10)
  }
  
  return Math.max(0, Math.min(100, score))
}

// Export handlers with performance monitoring
export const GET = withPerformanceMonitoring(GET_Handler)
export const HEAD = withPerformanceMonitoring(HEAD_Handler)