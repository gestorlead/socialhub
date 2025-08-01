import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimeConnection } from './useRealtimeConnection'
import { SecureLogger } from '@/lib/secure-logger'

/**
 * Real-time Presence Hook
 * 
 * Manages user presence in comment threads and collaborative features:
 * - Track active users in comment threads
 * - Real-time typing indicators
 * - User activity status (viewing, typing, idle, away)
 * - Presence-based collaborative features
 * - Automatic cleanup of stale presence
 */

export interface PresenceUser {
  userId: string
  username?: string
  avatar?: string
  status: 'viewing' | 'typing' | 'idle' | 'away'
  lastActivity: Date
  metadata?: Record<string, any>
}

export interface TypingUser {
  userId: string
  username?: string
  startedAt: Date
  lastActivity: Date
}

export interface UsePresenceOptions {
  platform?: 'instagram' | 'tiktok' | 'facebook'
  postId?: string
  commentId?: string
  autoTrack?: boolean
  idleTimeout?: number // milliseconds before marking as idle
  awayTimeout?: number // milliseconds before marking as away
  typingTimeout?: number // milliseconds to auto-stop typing
  enableTypingIndicators?: boolean
}

export interface UsePresenceReturn {
  // Presence data
  presenceUsers: PresenceUser[]
  typingUsers: TypingUser[]
  isUserTyping: (userId: string) => boolean
  getUserPresence: (userId: string) => PresenceUser | null
  
  // Actions
  updateStatus: (status: PresenceUser['status'], metadata?: Record<string, any>) => Promise<void>
  startTyping: () => void
  stopTyping: () => void
  
  // Status
  currentStatus: PresenceUser['status']
  isTracking: boolean
  error: Error | null
}

export function usePresence(
  options: UsePresenceOptions = {}
): UsePresenceReturn {
  
  const { user } = useAuth()
  const { isConnected, status: connectionStatus } = useRealtimeConnection()
  
  // Configuration with defaults
  const config = {
    platform: options.platform,
    postId: options.postId,
    commentId: options.commentId,
    autoTrack: options.autoTrack ?? true,
    idleTimeout: options.idleTimeout ?? 5 * 60 * 1000, // 5 minutes
    awayTimeout: options.awayTimeout ?? 15 * 60 * 1000, // 15 minutes
    typingTimeout: options.typingTimeout ?? 3000, // 3 seconds
    enableTypingIndicators: options.enableTypingIndicators ?? true
  }

  // Refs for timers
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const awayTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<Date>(new Date())
  const presenceUpdateRef = useRef<NodeJS.Timeout | null>(null)

  // State
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [currentStatus, setCurrentStatus] = useState<PresenceUser['status']>('viewing')
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Generate presence channel name
  const presenceChannel = config.postId 
    ? `presence:${config.platform}:${config.postId}`
    : config.commentId
    ? `presence:comment:${config.commentId}`
    : null

  /**
   * Update user presence status
   */
  const updateStatus = useCallback(async (
    status: PresenceUser['status'],
    metadata: Record<string, any> = {}
  ): Promise<void> => {
    if (!user || !isConnected || !presenceChannel) return

    try {
      setCurrentStatus(status)
      lastActivityRef.current = new Date()

      // Update via Supabase function
      const response = await fetch('/api/presence/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${connectionStatus?.connected ? 'valid_token' : 'invalid'}`
        },
        body: JSON.stringify({
          channel: presenceChannel,
          status,
          metadata: {
            ...metadata,
            username: user.user_metadata?.username || user.email?.split('@')[0],
            avatar: user.user_metadata?.avatar_url
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update presence: ${response.statusText}`)
      }

      // Reset activity timers
      resetActivityTimers()

      await SecureLogger.log({
        level: 'DEBUG',
        category: 'PRESENCE',
        message: 'Presence status updated',
        details: {
          userId: user.id,
          status,
          channel: presenceChannel,
          metadata
        },
        userId: user.id
      })

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update presence')
      setError(error)
      console.error('Presence update failed:', error)
    }
  }, [user, isConnected, presenceChannel, connectionStatus])

  /**
   * Start typing indicator
   */
  const startTyping = useCallback(() => {
    if (!config.enableTypingIndicators) return

    // Update status to typing
    updateStatus('typing')

    // Clear existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Auto-stop typing after timeout
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping()
    }, config.typingTimeout)
  }, [config.enableTypingIndicators, config.typingTimeout, updateStatus])

  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(() => {
    if (!config.enableTypingIndicators) return

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    // Update status to viewing
    updateStatus('viewing')
  }, [config.enableTypingIndicators, updateStatus])

  /**
   * Check if a user is typing
   */
  const isUserTyping = useCallback((userId: string): boolean => {
    return typingUsers.some(user => user.userId === userId)
  }, [typingUsers])

  /**
   * Get presence information for a specific user
   */
  const getUserPresence = useCallback((userId: string): PresenceUser | null => {
    return presenceUsers.find(user => user.userId === userId) || null
  }, [presenceUsers])

  /**
   * Reset activity timers
   */
  const resetActivityTimers = useCallback(() => {
    // Clear existing timers
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }
    if (awayTimeoutRef.current) {
      clearTimeout(awayTimeoutRef.current)
    }

    // Set idle timer
    idleTimeoutRef.current = setTimeout(() => {
      if (currentStatus !== 'typing') {
        updateStatus('idle')
      }
    }, config.idleTimeout)

    // Set away timer
    awayTimeoutRef.current = setTimeout(() => {
      updateStatus('away')
    }, config.awayTimeout)
  }, [currentStatus, config.idleTimeout, config.awayTimeout, updateStatus])

  /**
   * Handle activity detection
   */
  const handleActivity = useCallback(() => {
    lastActivityRef.current = new Date()
    
    // Only update if not already viewing and not typing
    if (currentStatus === 'idle' || currentStatus === 'away') {
      updateStatus('viewing')
    } else {
      // Just reset timers without updating status
      resetActivityTimers()
    }
  }, [currentStatus, updateStatus, resetActivityTimers])

  /**
   * Process presence updates from real-time
   */
  const processPresenceUpdate = useCallback((update: any) => {
    try {
      if (update.eventType === 'presence_sync') {
        // Full presence state sync
        const users: PresenceUser[] = Object.values(update.payload || {})
          .flat()
          .filter((p: any) => p.userId !== user?.id)
          .map((p: any) => ({
            userId: p.userId,
            username: p.metadata?.username,
            avatar: p.metadata?.avatar,
            status: p.status || 'viewing',
            lastActivity: new Date(p.timestamp || Date.now()),
            metadata: p.metadata || {}
          }))

        setPresenceUsers(users)

        // Update typing users
        const typing = users
          .filter(u => u.status === 'typing')
          .map(u => ({
            userId: u.userId,
            username: u.username,
            startedAt: u.lastActivity,
            lastActivity: u.lastActivity
          }))

        setTypingUsers(typing)

      } else if (update.eventType === 'presence_diff') {
        // Incremental presence updates
        const { joins = {}, leaves = {} } = update.payload || {}

        setPresenceUsers(prev => {
          let updated = [...prev]

          // Process joins/updates
          Object.entries(joins).forEach(([userId, data]: [string, any]) => {
            if (userId === user?.id) return

            const presence: PresenceUser = {
              userId,
              username: data.metadata?.username,
              avatar: data.metadata?.avatar,
              status: data.status || 'viewing',
              lastActivity: new Date(data.timestamp || Date.now()),
              metadata: data.metadata || {}
            }

            const existingIndex = updated.findIndex(u => u.userId === userId)
            if (existingIndex >= 0) {
              updated[existingIndex] = presence
            } else {
              updated.push(presence)
            }
          })

          // Process leaves
          Object.keys(leaves).forEach(userId => {
            updated = updated.filter(u => u.userId !== userId)
          })

          return updated
        })

        // Update typing users
        setTypingUsers(prev => {
          let updated = [...prev]

          Object.entries(joins).forEach(([userId, data]: [string, any]) => {
            if (userId === user?.id) return

            if (data.status === 'typing') {
              const typing: TypingUser = {
                userId,
                username: data.metadata?.username,
                startedAt: new Date(data.timestamp || Date.now()),
                lastActivity: new Date(data.timestamp || Date.now())
              }

              const existingIndex = updated.findIndex(u => u.userId === userId)
              if (existingIndex >= 0) {
                updated[existingIndex] = typing
              } else {
                updated.push(typing)
              }
            } else {
              updated = updated.filter(u => u.userId !== userId)
            }
          })

          Object.keys(leaves).forEach(userId => {
            updated = updated.filter(u => u.userId !== userId)
          })

          return updated
        })
      }

    } catch (err) {
      console.error('Failed to process presence update:', err)
      setError(err instanceof Error ? err : new Error('Presence processing failed'))
    }
  }, [user?.id])

  /**
   * Start presence tracking
   */
  const startTracking = useCallback(async () => {
    if (!user || !isConnected || !presenceChannel || isTracking) return

    try {
      setIsTracking(true)
      setError(null)

      // Initialize presence
      await updateStatus('viewing')

      // Set up periodic presence updates (heartbeat)
      presenceUpdateRef.current = setInterval(() => {
        if (currentStatus !== 'away') {
          updateStatus(currentStatus)
        }
      }, 30000) // Every 30 seconds

      // Set up activity listeners
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
      events.forEach(event => {
        document.addEventListener(event, handleActivity, { passive: true })
      })

      // Start activity timers
      resetActivityTimers()

      await SecureLogger.log({
        level: 'INFO',
        category: 'PRESENCE',
        message: 'Presence tracking started',
        details: {
          userId: user.id,
          channel: presenceChannel,
          config
        },
        userId: user.id
      })

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start presence tracking')
      setError(error)
      setIsTracking(false)
    }
  }, [user, isConnected, presenceChannel, isTracking, currentStatus, updateStatus, handleActivity, resetActivityTimers, config])

  /**
   * Stop presence tracking
   */
  const stopTracking = useCallback(async () => {
    if (!isTracking) return

    try {
      setIsTracking(false)

      // Clear all timers
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
      if (awayTimeoutRef.current) clearTimeout(awayTimeoutRef.current)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (presenceUpdateRef.current) clearInterval(presenceUpdateRef.current)

      // Remove activity listeners
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })

      // Update status to away before leaving
      if (user && isConnected) {
        await updateStatus('away')
      }

      // Clear presence data
      setPresenceUsers([])
      setTypingUsers([])

      await SecureLogger.log({
        level: 'INFO',
        category: 'PRESENCE',
        message: 'Presence tracking stopped',
        details: {
          userId: user?.id,
          channel: presenceChannel
        },
        userId: user?.id
      })

    } catch (err) {
      console.error('Failed to stop presence tracking:', err)
    }
  }, [isTracking, user, isConnected, presenceChannel, updateStatus, handleActivity])

  // Auto-start tracking when connected
  useEffect(() => {
    if (config.autoTrack && isConnected && user && presenceChannel) {
      startTracking()
    } else if (!isConnected || !user) {
      stopTracking()
    }

    return () => {
      stopTracking()
    }
  }, [config.autoTrack, isConnected, user, presenceChannel, startTracking, stopTracking])

  // Clean up stale typing indicators
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = new Date()
      setTypingUsers(prev => prev.filter(user => 
        now.getTime() - user.lastActivity.getTime() < config.typingTimeout * 2
      ))
    }, config.typingTimeout)

    return () => clearInterval(cleanup)
  }, [config.typingTimeout])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
      if (awayTimeoutRef.current) clearTimeout(awayTimeoutRef.current)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (presenceUpdateRef.current) clearInterval(presenceUpdateRef.current)
    }
  }, [])

  return {
    // Presence data
    presenceUsers,
    typingUsers,
    isUserTyping,
    getUserPresence,
    
    // Actions
    updateStatus,
    startTyping,
    stopTyping,
    
    // Status
    currentStatus,
    isTracking,
    error
  }
}