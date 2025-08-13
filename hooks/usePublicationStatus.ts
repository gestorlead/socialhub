'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/lib/supabase-auth-helpers'

export interface PublicationJob {
  id: string
  platform: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  started_at?: string
  completed_at?: string
  error_message?: string
  retry_count: number
  max_retries: number
  platform_response?: any
}

interface UsePublicationStatusOptions {
  /**
   * Array of job IDs to track
   * If not provided, will track all user's jobs
   */
  jobIds?: string[]
  
  /**
   * Whether to automatically fetch initial job statuses
   * @default true
   */
  autoFetch?: boolean
  
  /**
   * How long to keep tracking jobs after they complete (in minutes)
   * @default 10
   */
  trackingDurationMinutes?: number
}

interface PublicationStatusResult {
  jobs: Record<string, PublicationJob>
  isLoading: boolean
  error: string | null
  
  // Derived state helpers
  totalJobs: number
  pendingJobs: number
  processingJobs: number
  completedJobs: number
  failedJobs: number
  
  // Status by platform
  statusByPlatform: Record<string, 'pending' | 'processing' | 'completed' | 'failed'>
  
  // Actions
  refetch: () => Promise<void>
  clearCompleted: () => void
}

/**
 * Hook to track publication job statuses in real-time using Supabase Realtime
 * 
 * @example
 * ```tsx
 * // Track specific job IDs
 * const { jobs, statusByPlatform, totalJobs, completedJobs } = usePublicationStatus({
 *   jobIds: ['job1', 'job2', 'job3']
 * })
 * 
 * // Track all user jobs
 * const { jobs, isLoading, error } = usePublicationStatus()
 * ```
 */
export function usePublicationStatus(options: UsePublicationStatusOptions = {}): PublicationStatusResult {
  const { user } = useAuth()
  const supabase = createClient()
  
  const {
    jobIds,
    autoFetch = true,
    trackingDurationMinutes = 10
  } = options
  
  const [jobs, setJobs] = useState<Record<string, PublicationJob>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial job statuses
  const fetchJobs = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('publication_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Filter by job IDs if provided
      if (jobIds && jobIds.length > 0) {
        query = query.in('id', jobIds)
      } else {
        // Only fetch recent jobs if no specific IDs provided
        const cutoffTime = new Date()
        cutoffTime.setMinutes(cutoffTime.getMinutes() - trackingDurationMinutes)
        query = query.gte('created_at', cutoffTime.toISOString())
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      if (data) {
        const jobsMap = data.reduce((acc, job) => {
          acc[job.id] = job as PublicationJob
          return acc
        }, {} as Record<string, PublicationJob>)
        
        setJobs(jobsMap)
        console.log('[usePublicationStatus] Fetched jobs:', Object.keys(jobsMap).length)
      }

    } catch (err) {
      console.error('[usePublicationStatus] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
    } finally {
      setIsLoading(false)
    }
  }

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return

    console.log('[usePublicationStatus] Setting up Realtime subscription')

    // Set up Realtime subscription for publication_jobs table
    const channel = supabase
      .channel('publication_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'publication_jobs',
          filter: `user_id=eq.${user.id}` // Only listen to current user's jobs
        },
        (payload) => {
          console.log('[usePublicationStatus] Realtime update:', payload)
          
          const job = payload.new as PublicationJob
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // If we're tracking specific job IDs, only update if it's in our list
            if (jobIds && jobIds.length > 0 && !jobIds.includes(job.id)) {
              return
            }
            
            setJobs(prev => ({
              ...prev,
              [job.id]: job
            }))
            
            console.log(`[usePublicationStatus] Job ${job.id} updated:`, {
              platform: job.platform,
              status: job.status,
              error: job.error_message
            })
            
          } else if (payload.eventType === 'DELETE') {
            const deletedJobId = (payload.old as any)?.id
            if (deletedJobId) {
              setJobs(prev => {
                const newJobs = { ...prev }
                delete newJobs[deletedJobId]
                return newJobs
              })
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[usePublicationStatus] Subscription status:', status)
        
        if (status === 'SUBSCRIBED') {
          console.log('[usePublicationStatus] Successfully subscribed to publication_jobs changes')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[usePublicationStatus] Subscription error')
          setError('Real-time connection failed')
        }
      })

    // Cleanup subscription
    return () => {
      console.log('[usePublicationStatus] Cleaning up Realtime subscription')
      supabase.removeChannel(channel)
    }
  }, [user?.id, jobIds?.join(','), supabase])

  // Auto-fetch initial data
  useEffect(() => {
    if (autoFetch && user) {
      fetchJobs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, autoFetch, jobIds?.join(',')])

  // Clear completed jobs from local state
  const clearCompleted = () => {
    setJobs(prev => {
      const newJobs: Record<string, PublicationJob> = {}
      Object.entries(prev).forEach(([id, job]) => {
        if (job.status !== 'completed') {
          newJobs[id] = job
        }
      })
      return newJobs
    })
  }

  // Calculate derived state
  const jobList = Object.values(jobs)
  const totalJobs = jobList.length
  const pendingJobs = jobList.filter(job => job.status === 'pending').length
  const processingJobs = jobList.filter(job => job.status === 'processing').length
  const completedJobs = jobList.filter(job => job.status === 'completed').length
  const failedJobs = jobList.filter(job => job.status === 'failed').length

  // Group status by platform (for UI convenience)
  const statusByPlatform = jobList.reduce((acc, job) => {
    acc[job.platform] = job.status
    return acc
  }, {} as Record<string, 'pending' | 'processing' | 'completed' | 'failed'>)

  return {
    jobs,
    isLoading,
    error,
    totalJobs,
    pendingJobs,
    processingJobs,
    completedJobs,
    failedJobs,
    statusByPlatform,
    refetch: fetchJobs,
    clearCompleted
  }
}