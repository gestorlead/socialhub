import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
    error
  } = await supabase.auth.getSession()

  console.log('Middleware - Path:', req.nextUrl.pathname, 'Session:', !!session, 'Error:', error)

  // Define route permissions
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/unauthorized']
  const adminRoutes = ['/admin']
  const superAdminRoutes = ['/super-admin', '/users', '/roles']
  
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)
  const isAdminRoute = adminRoutes.some(route => req.nextUrl.pathname.startsWith(route))
  const isSuperAdminRoute = superAdminRoutes.some(route => req.nextUrl.pathname.startsWith(route))
  
  // Redirect unauthenticated users to login
  if (!session && !isPublicRoute) {
    console.log('Redirecting to login - no session')
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Handle authenticated users
  if (session) {
    // Get user role level
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
        .eq('id', session.user.id)
        .single()

      if (!profileError && profile?.roles) {
        userLevel = profile.roles.level
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }

    console.log('User level:', userLevel, 'Path:', req.nextUrl.pathname)

    // Check role-based access
    if (isSuperAdminRoute && userLevel < 3) {
      console.log('Redirecting to unauthorized - insufficient permissions for super admin route')
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    if (isAdminRoute && userLevel < 2) {
      console.log('Redirecting to unauthorized - insufficient permissions for admin route')
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    // Redirect authenticated users away from login/signup pages
    if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup') {
      console.log('Redirecting to home - user authenticated')
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return res
}

export const config = {
  // Temporarily disabled to test client-side auth
  matcher: [],
}