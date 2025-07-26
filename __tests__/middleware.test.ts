/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '../middleware'

// Mock Supabase middleware client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createMiddlewareClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }))
}))

// Mock NextResponse
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    next: jest.fn(() => ({
      headers: new Map()
    })),
    redirect: jest.fn()
  }
}))

describe('Authentication Middleware', () => {
  let mockSupabase: any
  let mockRequest: any
  let mockResponse: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock response with headers
    mockResponse = {
      headers: new Map(),
      set: jest.fn()
    }
    mockResponse.headers.set = jest.fn()
    
    // Setup mock request
    mockRequest = {
      nextUrl: {
        pathname: '/',
        searchParams: new URLSearchParams()
      },
      url: 'http://localhost:3000/'
    }

    // Setup mock Supabase client
    const { createMiddlewareClient } = require('@supabase/auth-helpers-nextjs')
    mockSupabase = {
      auth: {
        getSession: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }
    createMiddlewareClient.mockReturnValue(mockSupabase)
    
    // Mock NextResponse.next to return our mock response
    NextResponse.next = jest.fn(() => mockResponse)
  })

  describe('Security Headers', () => {
    it('should add security headers to all responses', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      mockRequest.nextUrl.pathname = '/login'
      
      await middleware(mockRequest as NextRequest)

      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin')
      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
    })

    it('should add CSP header in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      mockRequest.nextUrl.pathname = '/login'
      
      await middleware(mockRequest as NextRequest)

      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      )

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Public Routes', () => {
    const publicRoutes = ['/login', '/signup', '/auth/callback', '/unauthorized']

    publicRoutes.forEach(route => {
      it(`should allow access to ${route} without authentication`, async () => {
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: null },
          error: null
        })

        mockRequest.nextUrl.pathname = route
        
        const result = await middleware(mockRequest as NextRequest)
        
        expect(NextResponse.redirect).not.toHaveBeenCalled()
        expect(result).toBe(mockResponse)
      })
    })

    it('should allow access to API auth routes without authentication', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      mockRequest.nextUrl.pathname = '/api/auth/tiktok/callback'
      
      const result = await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockResponse)
    })
  })

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users to login', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      mockRequest.nextUrl.pathname = '/dashboard'
      
      await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/login?redirectTo=%2Fdashboard', 'http://localhost:3000/')
      )
    })

    it('should allow authenticated users to access protected routes', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token'
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', roles: { level: 1 } },
              error: null
            })
          })
        })
      })

      mockRequest.nextUrl.pathname = '/dashboard'
      
      const result = await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockResponse)
    })
  })

  describe('Role-Based Access Control', () => {
    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token'
    }

    it('should allow admin users to access admin routes', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', roles: { level: 2 } }, // Admin level
              error: null
            })
          })
        })
      })

      mockRequest.nextUrl.pathname = '/admin/settings'
      
      const result = await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockResponse)
    })

    it('should redirect regular users from admin routes', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', roles: { level: 1 } }, // Regular user
              error: null
            })
          })
        })
      })

      mockRequest.nextUrl.pathname = '/admin/settings'
      
      await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/unauthorized', 'http://localhost:3000/')
      )
    })

    it('should allow super admin users to access super admin routes', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', roles: { level: 3 } }, // Super admin level
              error: null
            })
          })
        })
      })

      mockRequest.nextUrl.pathname = '/super-admin/users'
      
      const result = await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockResponse)
    })

    it('should redirect admin users from super admin routes', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', roles: { level: 2 } }, // Admin level
              error: null
            })
          })
        })
      })

      mockRequest.nextUrl.pathname = '/super-admin/users'
      
      await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/unauthorized', 'http://localhost:3000/')
      )
    })
  })

  describe('Authenticated User Redirects', () => {
    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token'
    }

    it('should redirect authenticated users from login page to home', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', roles: { level: 1 } },
              error: null
            })
          })
        })
      })

      mockRequest.nextUrl.pathname = '/login'
      
      await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/', 'http://localhost:3000/')
      )
    })

    it('should redirect authenticated users to redirectTo URL if provided', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', roles: { level: 1 } },
              error: null
            })
          })
        })
      })

      mockRequest.nextUrl.pathname = '/login'
      mockRequest.nextUrl.searchParams.set('redirectTo', '/dashboard')
      
      await middleware(mockRequest as NextRequest)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', 'http://localhost:3000/')
      )
    })
  })

  describe('Static Files', () => {
    const staticPaths = [
      '/_next/static/chunk.js',
      '/_next/image/image.jpg',
      '/favicon.ico',
      '/images/logo.png',
      '/uploads/file.pdf'
    ]

    staticPaths.forEach(path => {
      it(`should skip authentication for static file: ${path}`, async () => {
        mockRequest.nextUrl.pathname = path
        
        const result = await middleware(mockRequest as NextRequest)
        
        expect(mockSupabase.auth.getSession).not.toHaveBeenCalled()
        expect(result).toBe(mockResponse)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully and use default role', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token'
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      })

      mockRequest.nextUrl.pathname = '/dashboard'
      
      const result = await middleware(mockRequest as NextRequest)
      
      // Should continue with default role (level 1) instead of failing
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockResponse)
    })

    it('should handle middleware errors gracefully', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Auth error'))

      mockRequest.nextUrl.pathname = '/dashboard'
      
      const result = await middleware(mockRequest as NextRequest)
      
      // Should allow request to continue despite error
      expect(result).toBe(mockResponse)
    })
  })

  describe('Configuration', () => {
    it('should have correct matcher configuration', () => {
      const { config } = require('../middleware')
      
      expect(config.matcher).toEqual([
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
      ])
    })
  })
})