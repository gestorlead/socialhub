import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Optimized Supabase client for browser usage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',  // Improved OAuth security
    debug: process.env.NODE_ENV === 'development',
    storageKey: 'supabase-auth-token'
  },
  global: {
    headers: {
      'X-Client-Info': 'socialhub-web-optimized'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// High-performance server-side client factory
export function createOptimizedClient(context: 'read' | 'write' | 'admin', authToken?: string) {
  const isAdmin = context === 'admin'
  const key = isAdmin ? process.env.SUPABASE_SERVICE_ROLE_KEY! : supabaseAnonKey
  
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false, // Disable for server performance
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': `socialhub-server-${context}`,
        'X-Connection-Pool': 'true',
        ...(authToken && !isAdmin && { Authorization: `Bearer ${authToken}` })
      }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      disabled: true // Disable realtime for server clients
    }
  })
}

// Connection pool-aware client for API routes
export function createPooledClient(authToken?: string) {
  return createOptimizedClient(authToken ? 'read' : 'admin', authToken)
}

// Batch operation client
export function createBatchClient() {
  return createOptimizedClient('admin')
}