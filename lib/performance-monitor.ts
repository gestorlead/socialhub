import { NextRequest } from 'next/server'
import { performanceCache } from './performance-cache'

/**
 * Performance Monitoring System
 * 
 * Features:
 * - Real-time performance metrics collection
 * - Bottleneck detection and alerting
 * - Resource usage monitoring
 * - Performance regression detection
 * - API response time tracking
 * - Memory and CPU usage monitoring
 * 
 * Performance Targets:
 * - API Response Time: 95% < 200ms
 * - Memory Usage: <100MB for 1K concurrent users
 * - CPU Usage: <70% average
 * - Error Rate: <0.1%
 */

export interface PerformanceMetrics {
  // API Metrics
  apiResponseTime: {
    p50: number
    p95: number
    p99: number
    average: number
    min: number
    max: number
  }
  
  // Request Metrics
  requestRate: number
  errorRate: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  
  // Resource Metrics
  memoryUsage: {
    used: number
    free: number
    total: number
    percentage: number
  }
  
  // Cache Metrics
  cacheMetrics: {
    hitRate: number
    missRate: number
    size: number
    memoryUsage: number
  }
  
  // Database Metrics
  databaseMetrics: {
    averageQueryTime: number
    slowQueries: number
    connectionPoolUtilization: number
    cacheHitRate: number
  }
  
  // System Health
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical'
    uptime: number
    lastHealthCheck: number
  }
  
  timestamp: number
}

export interface PerformanceAlert {
  id: string
  type: 'performance' | 'error' | 'resource' | 'system'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  metric: string
  threshold: number
  currentValue: number
  timestamp: number
  resolved: boolean
}

export interface PerformanceThresholds {
  apiResponseTimeP95: number
  apiResponseTimeP99: number
  errorRate: number
  memoryUsagePercentage: number
  cacheHitRate: number
  databaseQueryTime: number
}

/**
 * Response Time Tracker
 */
class ResponseTimeTracker {
  private measurements: number[] = []
  private readonly maxMeasurements = 1000
  
  addMeasurement(responseTime: number): void {
    this.measurements.push(responseTime)
    
    // Keep only recent measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift()
    }
  }
  
  getPercentile(percentile: number): number {
    if (this.measurements.length === 0) return 0
    
    const sorted = [...this.measurements].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }
  
  getAverage(): number {
    if (this.measurements.length === 0) return 0
    return this.measurements.reduce((sum, time) => sum + time, 0) / this.measurements.length
  }
  
  getMin(): number {
    return this.measurements.length > 0 ? Math.min(...this.measurements) : 0
  }
  
  getMax(): number {
    return this.measurements.length > 0 ? Math.max(...this.measurements) : 0
  }
  
  getStats() {
    return {
      p50: this.getPercentile(50),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
      average: this.getAverage(),
      min: this.getMin(),
      max: this.getMax()
    }
  }
  
  clear(): void {
    this.measurements = []
  }
}

/**
 * Resource Monitor
 */
class ResourceMonitor {
  private memoryReadings: number[] = []
  private readonly maxReadings = 100
  
  getCurrentMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        free: usage.heapTotal - usage.heapUsed,
        percentage: (usage.heapUsed / usage.heapTotal) * 100
      }
    }
    
    // Fallback for browser environment
    return {
      used: 0,
      total: 0,
      free: 0,
      percentage: 0
    }
  }
  
  recordMemoryUsage(): void {
    const usage = this.getCurrentMemoryUsage()
    this.memoryReadings.push(usage.percentage)
    
    if (this.memoryReadings.length > this.maxReadings) {
      this.memoryReadings.shift()
    }
  }
  
  getAverageMemoryUsage(): number {
    if (this.memoryReadings.length === 0) return 0
    return this.memoryReadings.reduce((sum, usage) => sum + usage, 0) / this.memoryReadings.length
  }
}

/**
 * Performance Alert Manager
 */
class AlertManager {
  private alerts: Map<string, PerformanceAlert> = new Map()
  private alertHistory: PerformanceAlert[] = []
  private readonly maxHistorySize = 100
  
  createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    metric: string,
    threshold: number,
    currentValue: number
  ): PerformanceAlert {
    const alert: PerformanceAlert = {
      id: `${type}-${metric}-${Date.now()}`,
      type,
      severity,
      message,
      metric,
      threshold,
      currentValue,
      timestamp: Date.now(),
      resolved: false
    }
    
    this.alerts.set(alert.id, alert)
    this.alertHistory.push(alert)
    
    // Keep history size manageable
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift()
    }
    
    // Log alert based on severity
    const logLevel = severity === 'critical' ? 'error' : 
                    severity === 'high' ? 'warn' : 'info'
    console[logLevel](`Performance Alert [${severity.toUpperCase()}]: ${message}`, {
      metric,
      threshold,
      currentValue,
      timestamp: new Date(alert.timestamp).toISOString()
    })
    
    return alert
  }
  
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.resolved = true
      console.info(`Performance Alert Resolved: ${alert.message}`)
      return true
    }
    return false
  }
  
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }
  
  getAllAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values())
  }
  
  getAlertHistory(): PerformanceAlert[] {
    return [...this.alertHistory]
  }
  
  clearResolvedAlerts(): void {
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved) {
        this.alerts.delete(id)
      }
    }
  }
}

/**
 * Performance Regression Detector
 */
class RegressionDetector {
  private baselineMetrics: Map<string, number> = new Map()
  private readonly regressionThreshold = 0.2 // 20% degradation threshold
  
  setBaseline(metric: string, value: number): void {
    this.baselineMetrics.set(metric, value)
  }
  
  checkRegression(metric: string, currentValue: number): {
    isRegression: boolean
    percentageChange: number
    baseline: number
  } {
    const baseline = this.baselineMetrics.get(metric)
    if (!baseline) {
      // No baseline set, establish current value as baseline
      this.setBaseline(metric, currentValue)
      return { isRegression: false, percentageChange: 0, baseline: currentValue }
    }
    
    const percentageChange = (currentValue - baseline) / baseline
    const isRegression = percentageChange > this.regressionThreshold
    
    return { isRegression, percentageChange, baseline }
  }
  
  updateBaseline(metric: string, value: number): void {
    // Update baseline with exponential moving average
    const current = this.baselineMetrics.get(metric) || value
    const alpha = 0.1 // Smoothing factor
    const newBaseline = (alpha * value) + ((1 - alpha) * current)
    this.baselineMetrics.set(metric, newBaseline)
  }
}

/**
 * Main Performance Monitor
 */
export class PerformanceMonitor {
  private responseTimeTracker = new ResponseTimeTracker()
  private resourceMonitor = new ResourceMonitor()
  private alertManager = new AlertManager()
  private regressionDetector = new RegressionDetector()
  
  private requestCount = 0
  private errorCount = 0
  private startTime = Date.now()
  private thresholds: PerformanceThresholds
  
  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      apiResponseTimeP95: 200, // 200ms
      apiResponseTimeP99: 500, // 500ms
      errorRate: 0.01, // 1%
      memoryUsagePercentage: 80, // 80%
      cacheHitRate: 80, // 80%
      databaseQueryTime: 100, // 100ms
      ...thresholds
    }
    
    // Set initial baselines
    this.initializeBaselines()
    
    // Start periodic monitoring
    this.startPeriodicMonitoring()
  }
  
  /**
   * Record API request performance
   */
  recordApiRequest(
    responseTime: number,
    success: boolean,
    endpoint: string,
    method: string
  ): void {
    this.requestCount++
    this.responseTimeTracker.addMeasurement(responseTime)
    
    if (!success) {
      this.errorCount++
    }
    
    // Check for performance issues
    this.checkPerformanceThresholds()
    
    // Check for regressions
    this.checkRegressions()
  }
  
  /**
   * Get current performance metrics
   */
  async getMetrics(): Promise<PerformanceMetrics> {
    const cacheMetrics = performanceCache.getMetrics()
    const memoryUsage = this.resourceMonitor.getCurrentMemoryUsage()
    
    return {
      apiResponseTime: this.responseTimeTracker.getStats(),
      requestRate: this.calculateRequestRate(),
      errorRate: this.calculateErrorRate(),
      totalRequests: this.requestCount,
      successfulRequests: this.requestCount - this.errorCount,
      failedRequests: this.errorCount,
      memoryUsage,
      cacheMetrics: {
        hitRate: cacheMetrics.hitRate,
        missRate: 100 - cacheMetrics.hitRate,
        size: 0, // Would be implemented based on cache implementation
        memoryUsage: cacheMetrics.memoryUsage
      },
      databaseMetrics: {
        averageQueryTime: 0, // Would be integrated with DatabaseOptimizer
        slowQueries: 0,
        connectionPoolUtilization: 0,
        cacheHitRate: cacheMetrics.hitRate
      },
      systemHealth: {
        status: this.getSystemHealthStatus(),
        uptime: Date.now() - this.startTime,
        lastHealthCheck: Date.now()
      },
      timestamp: Date.now()
    }
  }
  
  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return this.alertManager.getActiveAlerts()
  }
  
  /**
   * Get performance alert history
   */
  getAlertHistory(): PerformanceAlert[] {
    return this.alertManager.getAlertHistory()
  }
  
  /**
   * Create custom performance middleware
   */
  createMiddleware() {
    return async (request: NextRequest, next: () => Promise<Response>) => {
      const startTime = Date.now()
      const endpoint = new URL(request.url).pathname
      const method = request.method
      
      try {
        const response = await next()
        const responseTime = Date.now() - startTime
        const success = response.status < 400
        
        this.recordApiRequest(responseTime, success, endpoint, method)
        
        // Add performance headers
        response.headers.set('X-Response-Time', `${responseTime}ms`)
        response.headers.set('X-Request-ID', `${Date.now()}-${Math.random().toString(36).slice(2)}`)
        
        return response
        
      } catch (error) {
        const responseTime = Date.now() - startTime
        this.recordApiRequest(responseTime, false, endpoint, method)
        throw error
      }
    }
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.responseTimeTracker.clear()
    this.requestCount = 0
    this.errorCount = 0
    this.startTime = Date.now()
    this.alertManager.clearResolvedAlerts()
  }
  
  /**
   * Export metrics for external monitoring systems
   */
  async exportMetrics(format: 'json' | 'prometheus' = 'json'): Promise<string> {
    const metrics = await this.getMetrics()
    
    if (format === 'prometheus') {
      return this.formatPrometheusMetrics(metrics)
    }
    
    return JSON.stringify(metrics, null, 2)
  }
  
  private initializeBaselines(): void {
    // Set reasonable baseline values
    this.regressionDetector.setBaseline('apiResponseTimeP95', 150)
    this.regressionDetector.setBaseline('apiResponseTimeP99', 300)
    this.regressionDetector.setBaseline('errorRate', 0.005)
    this.regressionDetector.setBaseline('memoryUsage', 50)
  }
  
  private startPeriodicMonitoring(): void {
    // Monitor every 30 seconds
    setInterval(() => {
      this.resourceMonitor.recordMemoryUsage()
      this.checkPerformanceThresholds()
    }, 30000)
    
    // Clean up old alerts every 5 minutes
    setInterval(() => {
      this.alertManager.clearResolvedAlerts()
    }, 5 * 60 * 1000)
  }
  
  private checkPerformanceThresholds(): void {
    const stats = this.responseTimeTracker.getStats()
    const memoryUsage = this.resourceMonitor.getCurrentMemoryUsage()
    const errorRate = this.calculateErrorRate()
    
    // Check API response time
    if (stats.p95 > this.thresholds.apiResponseTimeP95) {
      this.alertManager.createAlert(
        'performance',
        stats.p95 > this.thresholds.apiResponseTimeP99 ? 'high' : 'medium',
        `API response time P95 (${stats.p95.toFixed(2)}ms) exceeds threshold (${this.thresholds.apiResponseTimeP95}ms)`,
        'apiResponseTimeP95',
        this.thresholds.apiResponseTimeP95,
        stats.p95
      )
    }
    
    // Check error rate
    if (errorRate > this.thresholds.errorRate) {
      this.alertManager.createAlert(
        'error',
        errorRate > this.thresholds.errorRate * 2 ? 'high' : 'medium',
        `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.thresholds.errorRate * 100).toFixed(2)}%)`,
        'errorRate',
        this.thresholds.errorRate,
        errorRate
      )
    }
    
    // Check memory usage
    if (memoryUsage.percentage > this.thresholds.memoryUsagePercentage) {
      this.alertManager.createAlert(
        'resource',
        memoryUsage.percentage > 90 ? 'critical' : 'high',
        `Memory usage (${memoryUsage.percentage.toFixed(1)}%) exceeds threshold (${this.thresholds.memoryUsagePercentage}%)`,
        'memoryUsage',
        this.thresholds.memoryUsagePercentage,
        memoryUsage.percentage
      )
    }
  }
  
  private checkRegressions(): void {
    const stats = this.responseTimeTracker.getStats()
    const errorRate = this.calculateErrorRate()
    const memoryUsage = this.resourceMonitor.getCurrentMemoryUsage()
    
    // Check for regressions
    const regressions = [
      { metric: 'apiResponseTimeP95', value: stats.p95 },
      { metric: 'errorRate', value: errorRate },
      { metric: 'memoryUsage', value: memoryUsage.percentage }
    ]
    
    regressions.forEach(({ metric, value }) => {
      const result = this.regressionDetector.checkRegression(metric, value)
      
      if (result.isRegression) {
        this.alertManager.createAlert(
          'performance',
          'medium',
          `Performance regression detected in ${metric}: ${(result.percentageChange * 100).toFixed(1)}% increase from baseline`,
          metric,
          result.baseline,
          value
        )
      } else {
        // Update baseline for good performance
        this.regressionDetector.updateBaseline(metric, value)
      }
    })
  }
  
  private calculateRequestRate(): number {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000
    return uptimeSeconds > 0 ? this.requestCount / uptimeSeconds : 0
  }
  
  private calculateErrorRate(): number {
    return this.requestCount > 0 ? this.errorCount / this.requestCount : 0
  }
  
  private getSystemHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const activeAlerts = this.alertManager.getActiveAlerts()
    
    if (activeAlerts.some(alert => alert.severity === 'critical')) {
      return 'critical'
    }
    
    if (activeAlerts.some(alert => alert.severity === 'high')) {
      return 'warning'
    }
    
    return 'healthy'
  }
  
  private formatPrometheusMetrics(metrics: PerformanceMetrics): string {
    return `
# HELP api_response_time_seconds API response time in seconds
# TYPE api_response_time_seconds histogram
api_response_time_p50 ${metrics.apiResponseTime.p50 / 1000}
api_response_time_p95 ${metrics.apiResponseTime.p95 / 1000}
api_response_time_p99 ${metrics.apiResponseTime.p99 / 1000}

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.totalRequests}

# HELP http_request_errors_total Total HTTP request errors
# TYPE http_request_errors_total counter
http_request_errors_total ${metrics.failedRequests}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes ${metrics.memoryUsage.used}

# HELP cache_hit_rate Cache hit rate percentage
# TYPE cache_hit_rate gauge
cache_hit_rate ${metrics.cacheMetrics.hitRate}
    `.trim()
  }
}

// Utility functions
export const createPerformanceMonitor = (thresholds?: Partial<PerformanceThresholds>) =>
  new PerformanceMonitor(thresholds)

// Default performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Middleware helper
export const withPerformanceMonitoring = (handler: any) => {
  return async (request: NextRequest) => {
    const startTime = Date.now()
    const endpoint = new URL(request.url).pathname
    const method = request.method
    
    try {
      const response = await handler(request)
      const responseTime = Date.now() - startTime
      const success = response.status < 400
      
      performanceMonitor.recordApiRequest(responseTime, success, endpoint, method)
      
      // Add performance headers
      const headers = new Headers(response.headers)
      headers.set('X-Response-Time', `${responseTime}ms`)
      headers.set('X-Request-ID', `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
      
    } catch (error) {
      const responseTime = Date.now() - startTime
      performanceMonitor.recordApiRequest(responseTime, false, endpoint, method)
      throw error
    }
  }
}