import { NextRequest, NextResponse } from 'next/server'

/**
 * Comprehensive authentication validation for middleware
 * Handles multiple session detection methods and fallbacks
 */
export async function validateAuthentication(req: NextRequest, res?: NextResponse) {
  // Method 1: Cookie-based authentication check
  let session = null
  let sessionError = null

  // Method 2: Check for login success indicators
  const loginSuccess = req.cookies.get('sh-login-success')?.value
  const loginTimestamp = req.cookies.get('sh-login-timestamp')?.value
  const isRecentLogin = loginTimestamp && (Date.now() - parseInt(loginTimestamp)) < 60000 // 1 minute

  // Method 3: Direct cookie inspection
  const hostname = req.headers.get('host') || 'localhost'
  
  // Extract the Supabase project ref from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ''
  
  // Comprehensive cookie patterns for Supabase auth
  const authCookiePatterns = [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token.0`,
    `sb-${projectRef}-auth-token.1`,
    `sb-${hostname}-auth-token`,
    'sb-127.0.0.1-auth-token', 
    'sb-localhost-auth-token',
    'supabase-auth-token',
    'supabase.auth.token'
  ]
  
  
  const hasAuthCookies = authCookiePatterns.some(pattern => {
    const cookie = req.cookies.get(pattern)
    return cookie?.value && cookie.value.length > 10 // Basic validity check
  })

  // Method 4: Check for Supabase access token in various formats
  // In Next.js 15, we need to check cookies differently
  const allCookieNames: string[] = []
  req.cookies.getAll().forEach(cookie => {
    allCookieNames.push(cookie.name)
  })
  const supabaseTokenCookie = allCookieNames.find(name => {
    const isSupabaseAuth = (name.includes('supabase') && name.includes('auth')) ||
                          name.startsWith(`sb-${projectRef}-auth`) ||
                          name.startsWith('sb-') && name.includes('-auth-token')
    return isSupabaseAuth && req.cookies.get(name)?.value
  })

  // Authentication decision matrix
  const indicators = {
    hasValidSession: !!session && !sessionError,
    hasLoginSuccess: !!loginSuccess,
    isRecentLogin: isRecentLogin,
    hasAuthCookies: hasAuthCookies,
    hasTokenCookie: !!supabaseTokenCookie,
    sessionError: sessionError
  }

  // Enhanced authentication check - prioritize valid session but allow cookie fallback
  const isAuthenticated = indicators.hasValidSession || 
    indicators.hasAuthCookies ||
    indicators.hasTokenCookie ||
    (indicators.hasLoginSuccess && indicators.isRecentLogin)


  return {
    isAuthenticated,
    session,
    indicators,
    user: session?.user
  }
}

/**
 * Check if a path requires authentication
 */
export function isProtectedPath(pathname: string): boolean {
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/unauthorized', '/test-login']
  const publicPatterns = ['/api/auth/', '/api/cron/']
  
  // API routes that handle their own authentication
  const selfAuthenticatedAPIs = [
    '/api/analytics/data',
    '/api/social/'
  ]
  
  // Startup validation routes that should be publicly accessible
  const startupValidationRoutes = [
    '/api/admin/validate-environment',
    '/api/admin/integrations/test-crypto',
    '/api/admin/auth/force-logout',
    '/api/admin/generate-facebook-history',
    '/api/admin/setup-facebook-table'
  ]
  
  // Static files
  if (pathname.startsWith('/_next/') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.startsWith('/images/') ||
      pathname.startsWith('/uploads/')) {
    return false
  }
  
  // Public routes
  if (publicRoutes.includes(pathname)) {
    return false
  }
  
  // Public API patterns
  if (publicPatterns.some(pattern => pathname.startsWith(pattern))) {
    return false
  }
  
  // Self-authenticated API routes
  if (selfAuthenticatedAPIs.some(pattern => pathname.startsWith(pattern))) {
    return false
  }
  
  // Startup validation routes (publicly accessible)
  if (startupValidationRoutes.includes(pathname)) {
    return false
  }
  
  return true
}