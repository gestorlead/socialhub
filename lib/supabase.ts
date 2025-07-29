import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',  // Melhora segurança do OAuth
    debug: process.env.NODE_ENV === 'development',
    storageKey: 'supabase-auth-token'
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
})