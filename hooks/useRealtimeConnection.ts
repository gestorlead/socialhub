import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { SecureRealtimeClient, ConnectionStatus, createSecureRealtimeClient } from '@/lib/realtime-security'
import { SecureLogger } from '@/lib/secure-logger'

/**
 * Real-time Connection Management Hook
 * 
 * Provides low-level connection management for real-time features:
 * - Connection status monitoring
 * - Automatic reconnection with exponential backoff
 * - Connection health checks
 * - Rate limiting status
 * - Network quality monitoring
 */

export interface ConnectionOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  heartbeatInterval?: number
  connectionTimeout?: number
  enableHealthChecks?: boolean
}

export interface NetworkQuality {
  latency: number
  jitter: number
  packetLoss: number
  bandwidth: number
  quality: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface UseRealtimeConnectionReturn {
  // Connection state
  isConnected: boolean
  status: ConnectionStatus | null
  error: Error | null
  
  // Network monitoring
  networkQuality: NetworkQuality | null
  latency: number
  
  // Controls
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  reconnect: () => Promise<void>
  
  // Status
  reconnectAttempts: number
  lastConnected: Date | null
  rateLimitStatus: {
    remaining: number
    resetAt: Date | null
  }
}

export function useRealtimeConnection(
  options: ConnectionOptions = {}
): UseRealtimeConnectionReturn {
  
  const { user, token } = useAuth()
  const clientRef = useRef<SecureRealtimeClient | null>(null)
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latencyTestRef = useRef<{ start: number, samples: number[] }>({ start: 0, samples: [] })

  // Configuration with defaults
  const config = {
    autoConnect: options.autoConnect ?? true,
    reconnectAttempts: options.reconnectAttempts ?? 5,
    heartbeatInterval: options.heartbeatInterval ?? 30000,
    connectionTimeout: options.connectionTimeout ?? 10000,
    enableHealthChecks: options.enableHealthChecks ?? true
  }

  // State
  const [isConnected, setIsConnected] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null)
  const [latency, setLatency] = useState(0)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [lastConnected, setLastConnected] = useState<Date | null>(null)
  const [rateLimitStatus, setRateLimitStatus] = useState({
    remaining: 100,
    resetAt: null as Date | null
  })

  /**
   * Initialize connection
   */
  const connect = useCallback(async (): Promise<void> => {
    if (!user || !token) {
      throw new Error('Authentication required for connection')
    }

    if (clientRef.current) {
      await disconnect()
    }

    try {
      setError(null)

      // Create client with connection timeout
      const client = createSecureRealtimeClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        token,
        user.id
      )

      clientRef.current = client

      // Set up connection monitoring
      const statusCallback = {
        onMessage: () => {
          // Update activity on any message
          updateActivity()
        },
        onError: (err: Error) => {
          setError(err)
          handleConnectionError(err)
        },
        onStatusChange: (newStatus: ConnectionStatus) => {
          setStatus(newStatus)
          setIsConnected(newStatus.connected)
          setRateLimitStatus({
            remaining: newStatus.rateLimitRemaining,
            resetAt: null // Would be calculated based on rate limit window
          })

          if (newStatus.connected) {
            setLastConnected(new Date())
            setReconnectAttempts(0)
            startHealthChecks()
          } else {
            stopHealthChecks()
          }
        }
      }

      // Subscribe to a system channel for monitoring
      await client.subscribeToChannel('system:connection', statusCallback)

      await SecureLogger.log({
        level: 'INFO',
        category: 'REALTIME',
        message: 'Connection established',
        details: {
          userId: user.id,
          config
        },
        userId: user.id
      })

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Connection failed')
      setError(error)
      
      await SecureLogger.logSecurityEvent({
        type: 'REALTIME_CONNECTION_FAILED',
        severity: 'MEDIUM',
        details: {
          userId: user.id,
          error: error.message,
          attempt: reconnectAttempts + 1
        }
      })

      throw error
    }
  }, [user, token, config, reconnectAttempts])

  /**
   * Disconnect from real-time
   */
  const disconnect = useCallback(async (): Promise<void> => {
    stopHealthChecks()
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (clientRef.current) {
      await clientRef.current.disconnect()
      clientRef.current = null
    }

    setIsConnected(false)
    setStatus(null)
    setNetworkQuality(null)
    
    await SecureLogger.log({
      level: 'INFO',
      category: 'REALTIME',
      message: 'Connection closed',
      details: {
        userId: user?.id,
        lastConnected,
        totalUptime: lastConnected ? Date.now() - lastConnected.getTime() : 0
      },
      userId: user?.id
    })
  }, [user?.id, lastConnected])

  /**
   * Reconnect with exponential backoff
   */
  const reconnect = useCallback(async (): Promise<void> => {
    if (reconnectAttempts >= config.reconnectAttempts) {
      setError(new Error('Maximum reconnection attempts reached'))
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
    setReconnectAttempts(prev => prev + 1)

    await SecureLogger.log({
      level: 'INFO',
      category: 'REALTIME',
      message: 'Attempting reconnection',
      details: {
        attempt: reconnectAttempts + 1,
        maxAttempts: config.reconnectAttempts,
        delay,
        userId: user?.id
      },
      userId: user?.id
    })

    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        await connect()
      } catch (error) {
        // Will trigger another reconnect attempt
        console.error('Reconnection failed:', error)
      }
    }, delay)
  }, [reconnectAttempts, config.reconnectAttempts, connect, user?.id])

  /**
   * Handle connection errors
   */
  const handleConnectionError = useCallback((error: Error) => {
    console.error('Connection error:', error)
    
    // Trigger reconnection if auto-reconnect is enabled
    if (config.autoConnect && reconnectAttempts < config.reconnectAttempts) {
      reconnect()
    }
  }, [config.autoConnect, config.reconnectAttempts, reconnectAttempts, reconnect])

  /**
   * Update activity timestamp
   */
  const updateActivity = useCallback(() => {
    if (status) {
      setStatus(prev => prev ? {
        ...prev,
        lastActivity: new Date()
      } : null)
    }
  }, [status])

  /**
   * Start health checks
   */
  const startHealthChecks = useCallback(() => {
    if (!config.enableHealthChecks) return

    stopHealthChecks() // Clear any existing interval

    healthCheckIntervalRef.current = setInterval(async () => {
      await performHealthCheck()
    }, config.heartbeatInterval)
  }, [config.enableHealthChecks, config.heartbeatInterval])

  /**
   * Stop health checks
   */
  const stopHealthChecks = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current)
      healthCheckIntervalRef.current = null
    }
  }, [])

  /**
   * Perform connection health check
   */
  const performHealthCheck = useCallback(async () => {
    if (!clientRef.current) return

    try {
      const startTime = performance.now()
      
      // Send ping message
      await clientRef.current.sendMessage(
        'system:connection',
        'connection_status',
        { ping: true, timestamp: startTime }
      )

      // Measure latency (simplified - in real implementation would wait for pong)
      const endTime = performance.now()
      const currentLatency = endTime - startTime

      // Update latency samples
      latencyTestRef.current.samples.push(currentLatency)
      if (latencyTestRef.current.samples.length > 10) {
        latencyTestRef.current.samples.shift()
      }

      const avgLatency = latencyTestRef.current.samples.reduce((a, b) => a + b, 0) / 
                        latencyTestRef.current.samples.length

      setLatency(avgLatency)

      // Calculate network quality metrics
      calculateNetworkQuality(latencyTestRef.current.samples)

    } catch (err) {
      console.error('Health check failed:', err)
      setError(err instanceof Error ? err : new Error('Health check failed'))
    }
  }, [])

  /**
   * Calculate network quality based on performance metrics
   */
  const calculateNetworkQuality = useCallback((samples: number[]) => {
    if (samples.length < 3) return

    const avgLatency = samples.reduce((a, b) => a + b, 0) / samples.length
    const jitter = Math.sqrt(
      samples.reduce((sum, sample) => sum + Math.pow(sample - avgLatency, 2), 0) / samples.length
    )

    // Simple quality assessment
    let quality: NetworkQuality['quality'] = 'excellent'
    if (avgLatency > 100 || jitter > 20) quality = 'good'
    if (avgLatency > 200 || jitter > 50) quality = 'fair'
    if (avgLatency > 500 || jitter > 100) quality = 'poor'

    const networkQuality: NetworkQuality = {
      latency: avgLatency,
      jitter,
      packetLoss: 0, // Would need to track missed messages
      bandwidth: 0, // Would need to measure throughput
      quality
    }

    setNetworkQuality(networkQuality)

    // Log quality changes
    if (quality === 'poor') {
      SecureLogger.log({
        level: 'WARNING',
        category: 'REALTIME',
        message: 'Poor network quality detected',
        details: {
          networkQuality,
          userId: user?.id
        },
        userId: user?.id
      })
    }
  }, [user?.id])

  // Auto-connect on mount
  useEffect(() => {
    if (config.autoConnect && user && token) {
      connect().catch(console.error)
    }

    return () => {
      disconnect()
    }
  }, [config.autoConnect, user, token, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHealthChecks()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [stopHealthChecks])

  return {
    // Connection state
    isConnected,
    status,
    error,
    
    // Network monitoring
    networkQuality,
    latency,
    
    // Controls
    connect,
    disconnect,
    reconnect,
    
    // Status
    reconnectAttempts,
    lastConnected,
    rateLimitStatus
  }
}