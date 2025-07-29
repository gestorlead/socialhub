import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side logout endpoint
 * Ensures complete session invalidation on both client and server
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🔴 Server-side logout initiated')
    
    const supabase = createClient()
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Error getting session for logout:', sessionError)
    }
    
    if (session) {
      console.log(`Logging out user: ${session.user.email}`)
      
      // Sign out from Supabase
      const { error: signOutError } = await supabase.auth.signOut()
      
      if (signOutError) {
        console.error('Supabase signOut error:', signOutError)
      } else {
        console.log('✅ Supabase session invalidated')
      }
    }
    
    // Create response
    const response = NextResponse.json(
      { 
        success: true, 
        message: 'Logout successful',
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )
    
    // Clear all possible authentication cookies server-side
    const cookiesToClear = [
      'sb-localhost-auth-token',
      'sb-127.0.0.1-auth-token', 
      'supabase-auth-token',
      'sh-login-success',
      'sh-login-timestamp'
    ]
    
    // Get hostname from request
    const hostname = req.headers.get('host') || 'localhost'
    cookiesToClear.push(`sb-${hostname}-auth-token`)
    
    // Clear each cookie with proper attributes
    cookiesToClear.forEach(cookieName => {
      // Clear for root path
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
      
      // Clear for specific hostname if not localhost
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        response.cookies.set(cookieName, '', {
          expires: new Date(0),
          path: '/',
          domain: hostname,
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        })
      }
    })
    
    // Also clear any Supabase-related cookies found in the request
    const cookieHeader = req.headers.get('cookie')
    if (cookieHeader) {
      const requestCookies = cookieHeader.split(';')
      requestCookies.forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim()
        if (cookieName.includes('supabase') || cookieName.includes('sb-') || cookieName.includes('auth')) {
          response.cookies.set(cookieName, '', {
            expires: new Date(0),
            path: '/',
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
          })
        }
      })
    }
    
    console.log('✅ Server-side logout completed - all cookies cleared')
    
    return response
    
  } catch (error) {
    console.error('Server logout error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Logout failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}