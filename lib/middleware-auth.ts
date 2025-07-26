import { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

/**
 * Comprehensive authentication validation for middleware
 * Handles multiple session detection methods and fallbacks
 */
export async function validateAuthentication(req: NextRequest) {
  const supabase = createMiddlewareClient({ req, res: {} as any })
  
  // Method 1: Standard Supabase session
  let session = null
  let sessionError = null
  
  try {
    const { data, error } = await supabase.auth.getSession()
    session = data.session
    sessionError = error
  } catch (e) {
    sessionError = e
    console.error('Session fetch error:', e)
  }

  // Method 2: Check for login success indicators
  const loginSuccess = req.cookies.get('sh-login-success')?.value
  const loginTimestamp = req.cookies.get('sh-login-timestamp')?.value
  const isRecentLogin = loginTimestamp && (Date.now() - parseInt(loginTimestamp)) < 60000 // 1 minute

  // Method 3: Direct cookie inspection
  const hostname = req.headers.get('host') || 'localhost'
  const authCookiePatterns = [
    `sb-${hostname}-auth-token`,
    'sb-127.0.0.1-auth-token', 
    'sb-localhost-auth-token',
    'supabase-auth-token'
  ]
  
  const hasAuthCookies = authCookiePatterns.some(pattern => {
    const cookie = req.cookies.get(pattern)
    return cookie?.value && cookie.value.length > 10 // Basic validity check
  })

  // Method 4: Check for Supabase access token in various formats
  const allCookieNames = Array.from(req.cookies.keys())
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

  // Conservative authentication check - require session OR multiple indicators
  const isAuthenticated = indicators.hasValidSession || 
    (indicators.hasLoginSuccess && indicators.isRecentLogin) ||
    (indicators.hasAuthCookies && !indicators.sessionError)

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
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/unauthorized']
  const publicPatterns = ['/api/auth/', '/api/cron/']
  
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
  
  return true
}