import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClientForMiddleware } from '@/utils/supabase/server'
import { isProtectedPath } from '@/lib/middleware-auth'

/**
 * Secure authentication middleware for Social Hub
 * Handles authentication, authorization, and security headers
 */
export async function middleware(req: NextRequest) {
  // Handle route redirections from Portuguese to English URLs
  const { pathname } = req.nextUrl
  
  // Route redirections mapping
  const routeRedirects: Record<string, string> = {
    '/configuracoes': '/settings',
    '/configuracoes/perfil': '/settings/profile',
    '/analise': '/analytics',
    '/analise/tiktok': '/analytics/tiktok',
    '/publicar': '/publish',
    '/redes': '/networks',
    '/redes/tiktok': '/networks/tiktok',
    '/integracoes': '/integrations',
    '/integracoes/tiktok': '/integrations/tiktok',
    '/admin/integracoes': '/admin/integrations'
  }
  
  // Check if current path matches any old route
  const redirectPath = routeRedirects[pathname]
  if (redirectPath) {
    const redirectUrl = new URL(redirectPath, req.url)
    // Preserve query parameters
    redirectUrl.search = req.nextUrl.search
    return NextResponse.redirect(redirectUrl, 301) // Permanent redirect
  }

  // Create Supabase client for middleware
  const { supabase, supabaseResponse } = createClientForMiddleware(req)

  // Add security headers
  supabaseResponse.headers.set('X-Frame-Options', 'SAMEORIGIN')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Add CSP header for enhanced security
  if (false && process.env.NODE_ENV === 'production') {
    supabaseResponse.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://*.tiktok.com https://*.tiktokcdn.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://vercel.live wss://vercel.live; " +
      "frame-src 'self' https://*.tiktok.com https://*.tiktokcdn.com https://www.tiktok.com; " +
      "frame-ancestors 'none';"
    )
  }

  try {
    // Define route permissions
    const adminRoutes = ['/admin', '/integracoes']
    const superAdminRoutes = ['/super-admin', '/users', '/roles', '/api/admin/']
    
    const isAdminRoute = adminRoutes.some(route => req.nextUrl.pathname.startsWith(route))
    const isSuperAdminRoute = superAdminRoutes.some(route => req.nextUrl.pathname.startsWith(route))
    
    // Check if this path needs authentication
    if (!isProtectedPath(req.nextUrl.pathname)) {
      return supabaseResponse
    }

    // Get the user using Supabase SSR (more secure than getSession)
    const { data: { user }, error } = await supabase.auth.getUser()
    const session = user ? { user } : null

    // Redirect unauthenticated users to login
    if (!session || !user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🚫 Redirecting to login - no session found', {
          hasSession: !!session,
          hasUser: !!user,
          pathname: req.nextUrl.pathname
        })
      }
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Handle authenticated users with valid session
    if (session && user) {
      // Get user role level with error handling
      let userLevel = 1 // default User role
      
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            roles!inner (
              level
            )
          `)
          .eq('id', user.id)
          .single()

        if (!profileError && profile?.roles) {
          userLevel = (profile.roles as any).level
        } else if (profileError && process.env.NODE_ENV === 'development') {
          console.warn('Profile fetch error (using default role):', profileError.message)
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching user role:', error)
        }
        // Continue with default role instead of blocking
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('User level:', userLevel, 'Path:', req.nextUrl.pathname)
      }

      // Check role-based access with proper error handling
      if (isSuperAdminRoute && userLevel < 3) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Redirecting to unauthorized - insufficient permissions for super admin route')
        }
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }

      if (isAdminRoute && userLevel < 2) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Redirecting to unauthorized - insufficient permissions for admin route')
        }
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }

      // Redirect authenticated users away from login/signup pages
      if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup') {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Redirecting authenticated user away from login')
        }
        const redirectTo = req.nextUrl.searchParams.get('redirectTo')
        const targetUrl = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/'
        return NextResponse.redirect(new URL(targetUrl, req.url))
      }
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware error:', error)
    // In case of middleware errors, allow the request to continue
    // but log the error for monitoring
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}