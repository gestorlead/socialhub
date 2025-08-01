import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { 
  SecureRealtimeClient, 
  RealtimeMessage, 
  ConnectionStatus, 
  createSecureRealtimeClient,
  RealtimeMessageType
} from '@/lib/realtime-security'
import { performanceCache } from '@/lib/performance-cache'
import { SecureLogger } from '@/lib/secure-logger'

/**
 * Enterprise Real-time Comments Hook
 * 
 * Features:
 * - Secure WebSocket connections with JWT validation
 * - Optimistic updates with conflict resolution
 * - Cache integration with automatic invalidation
 * - Connection management with auto-reconnect
 * - Rate limiting and error handling
 * - Real-time presence and typing indicators
 * 
 * Performance Targets:
 * - Message delivery: <100ms
 * - Connection reliability: 99.9%
 * - Memory usage: <50MB for 1000 messages
 * - CPU impact: <5% during high activity
 */

// Comment data interface
export interface Comment {
  id: string
  user_id: string
  platform: string
  platform_post_id: string
  platform_comment_id: string
  author_username?: string
  content: string
  status: 'pending' | 'approved' | 'rejected' | 'spam'
  sentiment_score?: number
  reply_to_comment_id?: string
  created_at: string
  updated_at: string
  replies?: Comment[]
  _optimistic?: boolean
  _error?: string
}

// Real-time events interface
export interface RealtimeEvents {
  onCommentCreated?: (comment: Comment) => void
  onCommentUpdated?: (comment: Comment) => void
  onCommentDeleted?: (commentId: string) => void
  onStatusChanged?: (commentId: string, status: string) => void
  onModerationAction?: (action: any) => void
  onConnectionChange?: (status: ConnectionStatus) => void
  onError?: (error: Error) => void
}

// Hook options interface
export interface UseRealtimeCommentsOptions {
  platform?: 'instagram' | 'tiktok' | 'facebook'
  postId?: string
  autoConnect?: boolean
  enableOptimisticUpdates?: boolean
  enablePresence?: boolean
  enableTypingIndicators?: boolean
  cacheUpdates?: boolean
  rateLimits?: {
    messagesPerMinute?: number
    connectionsPerUser?: number
  }
}

// Hook return interface
export interface UseRealtimeCommentsReturn {
  // Data
  comments: Comment[]
  isConnected: boolean
  connectionStatus: ConnectionStatus | null
  presenceUsers: any[]
  typingUsers: string[]
  
  // Actions
  createComment: (comment: Omit<Comment, 'id' | 'created_at' | 'updated_at'>) => Promise<Comment | null>
  updateComment: (id: string, updates: Partial<Comment>) => Promise<Comment | null>
  deleteComment: (id: string) => Promise<boolean>
  moderateComment: (id: string, action: 'approve' | 'reject' | 'spam') => Promise<boolean>
  
  // Presence & Typing
  updatePresence: (status: 'viewing' | 'typing' | 'idle' | 'away') => Promise<void>
  startTyping: () => void
  stopTyping: () => void
  
  // Connection Management
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  reconnect: () => Promise<void>
  
  // State
  loading: boolean
  error: Error | null
  retryCount: number
}

/**
 * Main real-time comments hook
 */
export function useRealtimeComments(
  options: UseRealtimeCommentsOptions = {},
  events: RealtimeEvents = {}
): UseRealtimeCommentsReturn {
  
  // Auth and configuration
  const { user, token } = useAuth()
  const realtimeClientRef = useRef<SecureRealtimeClient | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // State management
  const [comments, setComments] = useState<Comment[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [presenceUsers, setPresenceUsers] = useState<any[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Configuration with defaults
  const config = useMemo(() => ({
    platform: options.platform,
    postId: options.postId,
    autoConnect: options.autoConnect ?? true,
    enableOptimisticUpdates: options.enableOptimisticUpdates ?? true,
    enablePresence: options.enablePresence ?? true,
    enableTypingIndicators: options.enableTypingIndicators ?? true,
    cacheUpdates: options.cacheUpdates ?? true,
    rateLimits: {
      messagesPerMinute: options.rateLimits?.messagesPerMinute ?? 100,
      connectionsPerUser: options.rateLimits?.connectionsPerUser ?? 10
    }
  }), [options])

  // Channel names based on configuration
  const channelNames = useMemo(() => {
    const channels: string[] = []
    
    if (config.platform && config.postId) {
      channels.push(`comments:${config.platform}:${config.postId}`)
      
      if (config.enablePresence) {
        channels.push(`presence:${config.platform}:${config.postId}`)
      }
    } else if (config.platform) {
      channels.push(`comments:${config.platform}:all`)
    } else {
      channels.push('comments:all')
    }
    
    return channels
  }, [config.platform, config.postId, config.enablePresence])

  /**
   * Initialize real-time client
   */
  const initializeClient = useCallback(async () => {
    if (!user || !token) {
      throw new Error('Authentication required for real-time connection')
    }

    try {
      setLoading(true)
      setError(null)

      // Create secure real-time client
      const client = createSecureRealtimeClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        token,
        user.id
      )

      realtimeClientRef.current = client

      // Set up connection status monitoring
      const statusHandler = {
        onMessage: handleRealtimeMessage,
        onError: handleRealtimeError,
        onStatusChange: (status: ConnectionStatus) => {
          setConnectionStatus(status)
          setIsConnected(status.connected)
          events.onConnectionChange?.(status)
        }
      }

      // Subscribe to channels
      for (const channelName of channelNames) {
        await client.subscribeToChannel(channelName, statusHandler, {
          encrypt: channelName.includes('moderation'),
          rateLimitPerMinute: config.rateLimits.messagesPerMinute
        })
      }

      setRetryCount(0)
      
      await SecureLogger.log({
        level: 'INFO',
        category: 'REALTIME',
        message: 'Real-time comments client initialized',
        details: {
          userId: user.id,
          channels: channelNames,
          config
        },
        userId: user.id
      })

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize real-time client')
      setError(error)
      events.onError?.(error)
      
      await SecureLogger.logSecurityEvent({
        type: 'REALTIME_INITIALIZATION_FAILED',
        severity: 'HIGH',
        details: {
          userId: user?.id,
          error: error.message,
          retryCount
        }
      })
      
      throw error
    } finally {
      setLoading(false)
    }
  }, [user, token, channelNames, config, events, retryCount])

  /**
   * Handle real-time messages
   */
  const handleRealtimeMessage = useCallback(async (message: RealtimeMessage) => {
    try {
      switch (message.type) {
        case 'comment_created':
          await handleCommentCreated(message.payload)
          break
        case 'comment_updated':
          await handleCommentUpdated(message.payload)
          break
        case 'comment_deleted':
          await handleCommentDeleted(message.payload)
          break
        case 'comment_status_changed':
          await handleStatusChanged(message.payload)
          break
        case 'moderation_action':
          events.onModerationAction?.(message.payload)
          break
        case 'user_presence':
          handlePresenceUpdate(message.payload)
          break
        case 'typing_indicator':
          handleTypingIndicator(message.payload)
          break
        default:
          console.warn('Unknown real-time message type:', message.type)
      }

      // Update cache if enabled
      if (config.cacheUpdates) {
        await updateCache(message)
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to handle real-time message')
      setError(error)
      events.onError?.(error)
    }
  }, [config.cacheUpdates, events])

  /**
   * Handle real-time errors
   */
  const handleRealtimeError = useCallback((error: Error) => {
    setError(error)
    events.onError?.(error)

    // Attempt reconnection after delay
    if (retryCount < 5) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
      reconnectTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1)
        reconnect()
      }, delay)
    }
  }, [events, retryCount])

  /**
   * Handle comment created event
   */
  const handleCommentCreated = useCallback(async (commentData: any) => {
    const newComment: Comment = {
      ...commentData,
      replies: []
    }

    setComments(prev => {
      // Remove optimistic version if exists
      const withoutOptimistic = prev.filter(c => 
        !(c._optimistic && c.platform_comment_id === newComment.platform_comment_id)
      )
      
      // Add new comment (avoid duplicates)
      if (!withoutOptimistic.find(c => c.id === newComment.id)) {
        return [newComment, ...withoutOptimistic]
      }
      
      return withoutOptimistic
    })

    events.onCommentCreated?.(newComment)
  }, [events])

  /**
   * Handle comment updated event
   */
  const handleCommentUpdated = useCallback(async (commentData: any) => {
    const updatedComment: Comment = {
      ...commentData,
      replies: commentData.replies || []
    }

    setComments(prev => prev.map(comment => 
      comment.id === updatedComment.id ? updatedComment : comment
    ))

    events.onCommentUpdated?.(updatedComment)
  }, [events])

  /**
   * Handle comment deleted event
   */
  const handleCommentDeleted = useCallback(async (payload: { id: string }) => {
    setComments(prev => prev.filter(comment => comment.id !== payload.id))
    events.onCommentDeleted?.(payload.id)
  }, [events])

  /**
   * Handle status changed event
   */
  const handleStatusChanged = useCallback(async (payload: { comment_id: string, status: string }) => {
    setComments(prev => prev.map(comment => 
      comment.id === payload.comment_id 
        ? { ...comment, status: payload.status as any }
        : comment
    ))

    events.onStatusChanged?.(payload.comment_id, payload.status)
  }, [events])

  /**
   * Handle presence updates
   */
  const handlePresenceUpdate = useCallback((payload: { users: any[] }) => {
    if (config.enablePresence) {
      setPresenceUsers(payload.users.filter(u => u.userId !== user?.id))
    }
  }, [config.enablePresence, user?.id])

  /**
   * Handle typing indicators
   */
  const handleTypingIndicator = useCallback((payload: { user_id: string, typing: boolean }) => {
    if (config.enableTypingIndicators && payload.user_id !== user?.id) {
      setTypingUsers(prev => {
        if (payload.typing) {
          return prev.includes(payload.user_id) ? prev : [...prev, payload.user_id]
        } else {
          return prev.filter(id => id !== payload.user_id)
        }
      })
    }
  }, [config.enableTypingIndicators, user?.id])

  /**
   * Update cache with real-time data
   */
  const updateCache = useCallback(async (message: RealtimeMessage) => {
    try {
      // Invalidate related cache entries
      const tags = [
        'comments',
        `comments:${user?.id}`,
        `comments:${message.payload?.platform}`,
        `comments:${message.payload?.platform_post_id}`
      ].filter(Boolean)

      await performanceCache.invalidateByTags(tags)

      // Update specific cache entries if needed
      if (message.type === 'comment_created' || message.type === 'comment_updated') {
        const cacheKey = `comment:${message.payload?.id}`
        await performanceCache.set(cacheKey, message.payload, {
          ttl: 30 * 60 * 1000, // 30 minutes
          tags: ['comment', `comment:${message.payload?.id}`]
        })
      }

    } catch (error) {
      console.error('Failed to update cache:', error)
    }
  }, [user?.id])

  /**
   * Create comment with optimistic updates
   */
  const createComment = useCallback(async (
    commentData: Omit<Comment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Comment | null> => {
    try {
      const optimisticId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Create optimistic comment
      const optimisticComment: Comment = {
        ...commentData,
        id: optimisticId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _optimistic: true
      }

      // Add optimistic comment to state
      if (config.enableOptimisticUpdates) {
        setComments(prev => [optimisticComment, ...prev])
      }

      // Send to server via API
      const response = await fetch('/api/comments/optimized', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(commentData)
      })

      if (!response.ok) {
        throw new Error(`Failed to create comment: ${response.statusText}`)
      }

      const result = await response.json()
      const createdComment: Comment = result.data

      // Remove optimistic comment and add real one
      if (config.enableOptimisticUpdates) {
        setComments(prev => {
          const withoutOptimistic = prev.filter(c => c.id !== optimisticId)
          return [createdComment, ...withoutOptimistic]
        })
      }

      return createdComment

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create comment')
      
      // Mark optimistic comment as error
      if (config.enableOptimisticUpdates) {
        setComments(prev => prev.map(c => 
          c._optimistic && c.id.startsWith('temp_') 
            ? { ...c, _error: error.message }
            : c
        ))
      }

      setError(error)
      return null
    }
  }, [config.enableOptimisticUpdates, token])

  /**
   * Update comment
   */
  const updateComment = useCallback(async (
    id: string,
    updates: Partial<Comment>
  ): Promise<Comment | null> => {
    try {
      // Optimistic update
      if (config.enableOptimisticUpdates) {
        setComments(prev => prev.map(comment => 
          comment.id === id 
            ? { ...comment, ...updates, updated_at: new Date().toISOString() }
            : comment
        ))
      }

      // Send to server
      const response = await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error(`Failed to update comment: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update comment')
      setError(error)
      
      // Revert optimistic update
      if (config.enableOptimisticUpdates) {
        // This would typically refresh from server or revert changes
        await refreshComments()
      }
      
      return null
    }
  }, [config.enableOptimisticUpdates, token])

  /**
   * Delete comment
   */
  const deleteComment = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Optimistic update
      if (config.enableOptimisticUpdates) {
        setComments(prev => prev.filter(comment => comment.id !== id))
      }

      // Send to server
      const response = await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to delete comment: ${response.statusText}`)
      }

      return true

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete comment')
      setError(error)
      
      // Revert optimistic update
      if (config.enableOptimisticUpdates) {
        await refreshComments()
      }
      
      return false
    }
  }, [config.enableOptimisticUpdates, token])

  /**
   * Moderate comment
   */
  const moderateComment = useCallback(async (
    id: string,
    action: 'approve' | 'reject' | 'spam'
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/comments/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comment_ids: [id], action })
      })

      if (!response.ok) {
        throw new Error(`Failed to moderate comment: ${response.statusText}`)
      }

      return true

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to moderate comment')
      setError(error)
      return false
    }
  }, [token])

  /**
   * Update user presence
   */
  const updatePresence = useCallback(async (
    status: 'viewing' | 'typing' | 'idle' | 'away'
  ): Promise<void> => {
    if (!config.enablePresence || !realtimeClientRef.current) return

    try {
      for (const channelName of channelNames) {
        if (channelName.startsWith('presence:')) {
          await realtimeClientRef.current.updatePresence(channelName, status)
        }
      }
    } catch (error) {
      console.error('Failed to update presence:', error)
    }
  }, [config.enablePresence, channelNames])

  /**
   * Start typing indicator
   */
  const startTyping = useCallback(() => {
    if (!config.enableTypingIndicators || !realtimeClientRef.current) return

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Send typing indicator
    updatePresence('typing')

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping()
    }, 3000)
  }, [config.enableTypingIndicators, updatePresence])

  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(() => {
    if (!config.enableTypingIndicators) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    updatePresence('viewing')
  }, [config.enableTypingIndicators, updatePresence])

  /**
   * Connect to real-time
   */
  const connect = useCallback(async (): Promise<void> => {
    if (!user || !token) {
      throw new Error('Authentication required')
    }

    await initializeClient()
  }, [user, token, initializeClient])

  /**
   * Disconnect from real-time
   */
  const disconnect = useCallback(async (): Promise<void> => {
    if (realtimeClientRef.current) {
      await realtimeClientRef.current.disconnect()
      realtimeClientRef.current = null
    }

    setIsConnected(false)
    setConnectionStatus(null)
    setPresenceUsers([])
    setTypingUsers([])

    // Clear timeouts
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  /**
   * Reconnect to real-time
   */
  const reconnect = useCallback(async (): Promise<void> => {
    await disconnect()
    await connect()
  }, [disconnect, connect])

  /**
   * Refresh comments from server
   */
  const refreshComments = useCallback(async (): Promise<void> => {
    if (!token) return

    try {
      const params = new URLSearchParams()
      if (config.platform) params.set('platform', config.platform)
      if (config.postId) params.set('platform_post_id', config.postId)

      const response = await fetch(`/api/comments/optimized?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setComments(result.data || [])
      }
    } catch (error) {
      console.error('Failed to refresh comments:', error)
    }
  }, [token, config.platform, config.postId])

  // Auto-connect on mount
  useEffect(() => {
    if (config.autoConnect && user && token) {
      connect().catch(console.error)
    }

    return () => {
      disconnect()
    }
  }, [config.autoConnect, user, token, connect, disconnect])

  // Load initial comments
  useEffect(() => {
    if (user && token) {
      refreshComments()
    }
  }, [user, token, refreshComments])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return {
    // Data
    comments,
    isConnected,
    connectionStatus,
    presenceUsers,
    typingUsers,
    
    // Actions
    createComment,
    updateComment,
    deleteComment,
    moderateComment,
    
    // Presence & Typing
    updatePresence,
    startTyping,
    stopTyping,
    
    // Connection Management
    connect,
    disconnect,
    reconnect,
    
    // State
    loading,
    error,
    retryCount
  }
}