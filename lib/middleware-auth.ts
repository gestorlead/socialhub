import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

/**
 * Comprehensive authentication validation for middleware
 * Handles multiple session detection methods and fallbacks
 */
export async function validateAuthentication(req: NextRequest, res?: NextResponse) {
  // Method 1: Standard Supabase session with error handling
  let session = null
  let sessionError = null
  
  try {
    // Use provided response or create new one
    const response = res || NextResponse.next()
    const supabase = createMiddlewareClient({ req, res: response })
    
    const { data, error } = await supabase.auth.getSession()
    session = data.session
    sessionError = error
  } catch (e) {
    sessionError = e
    // Log error in development only to avoid spam
    if (process.env.NODE_ENV === 'development') {
      console.error('Session fetch error:', e)
    }
  }

  // Method 2: Check for login success indicators
  const loginSuccess = req.cookies.get('sh-login-success')?.value
  const loginTimestamp = req.cookies.get('sh-login-timestamp')?.value
  const isRecentLogin = loginTimestamp && (Date.now() - parseInt(loginTimestamp)) < 60000 // 1 minute

  // Method 3: Direct cookie inspection
  const hostname = req.headers.get('host') || 'localhost'
  
  // Extract the Supabase project ref from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ''
  
  const authCookiePatterns = [
    `sb-${hostname}-auth-token`,
    `sb-${projectRef}-auth-token`,
    'sb-127.0.0.1-auth-token', 
    'sb-localhost-auth-token',
    'supabase-auth-token'
  ]
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🍪 Cookie patterns checked:', authCookiePatterns)
    console.log('🍪 Available cookies:', req.cookies.getAll().map(c => c.name))
  }
  
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
  const supabaseTokenCookie = allCookieNames.find(name => 
    name.includes('supabase') && name.includes('auth') && req.cookies.get(name)?.value
  )

  // Authentication decision matrix
  const indicators = {
    hasValidSession: !!session && !sessionError,
    hasLoginSuccess: !!loginSuccess,
    isRecentLogin: isRecentLogin,
    hasAuthCookies: hasAuthCookies,
    hasTokenCookie: !!supabaseTokenCookie,
    sessionError: sessionError
  }

  // Strict authentication check - prioritize valid session
  const isAuthenticated = indicators.hasValidSession || 
    (indicators.hasLoginSuccess && indicators.isRecentLogin)

  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Auth Validation Results:', {
      path: req.nextUrl.pathname,
      isAuthenticated,
      indicators,
      user: session?.user?.email || 'none'
    })
  }

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
    '/api/admin/auth/force-logout'
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