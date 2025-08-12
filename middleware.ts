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

  // Create response with security headers
  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  try {
    // Define route permissions
    const adminRoutes = ['/admin', '/integracoes']
    const superAdminRoutes = ['/super-admin', '/users', '/roles', '/api/admin/']
    
    const isAdminRoute = adminRoutes.some(route => req.nextUrl.pathname.startsWith(route))
    const isSuperAdminRoute = superAdminRoutes.some(route => req.nextUrl.pathname.startsWith(route))
    
    // Check if this path needs authentication
    if (!isProtectedPath(req.nextUrl.pathname)) {
      return response
    }

    // Create Supabase client for middleware
    const { supabase } = createClientForMiddleware(req)
    
    // Check authentication
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session?.user) {
      // Redirect to login page for protected routes
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }

    // User is authenticated, continue to the protected route
    return response
  } catch (error) {
    console.error('Middleware error:', error)
    // In case of middleware errors, allow the request to continue
    // but log the error for monitoring
    return response
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
    '/((?!_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|mov|avi)$).*)',
  ],
}