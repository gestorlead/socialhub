/**
 * Bundle Optimization Configuration
 * 
 * Features:
 * - Code splitting and lazy loading
 * - Asset optimization and compression
 * - Tree shaking and dead code elimination
 * - Dynamic imports for heavy components
 * - Bundle analysis and monitoring
 * 
 * Performance Targets:
 * - Initial bundle: <500KB
 * - Total bundle: <2MB
 * - Load time: <3s on 3G
 */

import dynamic from 'next/dynamic'

// Dynamic imports for heavy components
export const LazyComponents = {
  // Analytics components
  AnalyticsDashboard: dynamic(() => import('@/components/analytics/dashboard'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />,
    ssr: false
  }),

  CommentsAnalytics: dynamic(() => import('@/components/analytics/comments-analytics'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
    ssr: false
  }),

  // Chart components (heavy recharts imports)
  LineChart: dynamic(() => import('@/components/charts/line-chart'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-48 rounded-md" />,
    ssr: false
  }),

  BarChart: dynamic(() => import('@/components/charts/bar-chart'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-48 rounded-md" />,
    ssr: false
  }),

  PieChart: dynamic(() => import('@/components/charts/pie-chart'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-48 rounded-md" />,
    ssr: false
  }),

  // Admin components
  AdminPanel: dynamic(() => import('@/components/admin/admin-panel'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-screen" />,
    ssr: false
  }),

  UserManagement: dynamic(() => import('@/components/admin/user-management'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />,
    ssr: false
  }),

  // Social platform components
  TikTokIntegration: dynamic(() => import('@/components/integrations/tiktok'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
    ssr: false
  }),

  InstagramIntegration: dynamic(() => import('@/components/integrations/instagram'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
    ssr: false
  }),

  FacebookIntegration: dynamic(() => import('@/components/integrations/facebook'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
    ssr: false
  }),

  // Comments components
  CommentsTable: dynamic(() => import('@/components/comments/comments-table'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />,
    ssr: false
  }),

  CommentsBulkActions: dynamic(() => import('@/components/comments/bulk-actions'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-24 rounded-md" />,
    ssr: false
  }),

  CommentsModeration: dynamic(() => import('@/components/comments/moderation'), {
    loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
    ssr: false
  })
}

// Route-based code splitting configuration
export const RouteChunks = {
  // Analytics routes
  analytics: () => import('@/app/analytics/page'),
  'analytics-comments': () => import('@/app/analytics/comments/page'),
  'analytics-platforms': () => import('@/app/analytics/platforms/page'),

  // Admin routes
  admin: () => import('@/app/admin/page'),
  'admin-users': () => import('@/app/admin/users/page'),
  'admin-settings': () => import('@/app/admin/settings/page'),

  // Integration routes
  integrations: () => import('@/app/integrations/page'),
  'integrations-tiktok': () => import('@/app/integrations/tiktok/page'),
  'integrations-instagram': () => import('@/app/integrations/instagram/page'),

  // Comments routes
  comments: () => import('@/app/comments/page'),
  'comments-moderate': () => import('@/app/comments/moderate/page'),
  'comments-analytics': () => import('@/app/comments/analytics/page')
}

// Library-specific lazy loading
export const LazyLibraries = {
  // Heavy libraries that should be loaded on demand
  recharts: () => import('recharts'),
  'react-hook-form': () => import('react-hook-form'),
  zod: () => import('zod'),
  'date-fns': () => import('date-fns'),
  validator: () => import('validator')
}

// Asset optimization utilities
export class AssetOptimizer {
  /**
   * Preload critical resources
   */
  static preloadCriticalAssets() {
    if (typeof window !== 'undefined') {
      // Preload critical fonts
      const fontLink = document.createElement('link')
      fontLink.rel = 'preload'
      fontLink.as = 'font'
      fontLink.type = 'font/woff2'
      fontLink.crossOrigin = 'anonymous'
      fontLink.href = '/fonts/inter-var.woff2'
      document.head.appendChild(fontLink)

      // Preload critical images
      const logoImg = new Image()
      logoImg.src = '/images/logo.svg'
    }
  }

  /**
   * Lazy load non-critical images
   */
  static setupLazyImages() {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            img.src = img.dataset.src!
            img.classList.remove('lazy')
            imageObserver.unobserve(img)
          }
        })
      })

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img)
      })
    }
  }

  /**
   * Optimize images for different screen sizes
   */
  static getOptimizedImageUrl(
    src: string,
    width: number,
    quality: number = 80
  ): string {
    // In a real implementation, you might use a service like Cloudinary or Next.js Image optimization
    return `${src}?w=${width}&q=${quality}`
  }
}

// Bundle analyzer utilities
export class BundleAnalyzer {
  private static performanceObserver: PerformanceObserver | null = null

  /**
   * Initialize bundle performance monitoring
   */
  static initialize() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            this.logNavigationMetrics(navEntry)
          } else if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming
            this.logResourceMetrics(resourceEntry)
          }
        })
      })

      this.performanceObserver.observe({ entryTypes: ['navigation', 'resource'] })
    }
  }

  /**
   * Get current bundle metrics
   */
  static getBundleMetrics() {
    if (typeof window === 'undefined') return null

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

    const jsResources = resources.filter(r => r.name.includes('.js'))
    const cssResources = resources.filter(r => r.name.includes('.css'))

    return {
      navigation: {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        firstContentfulPaint: this.getFirstContentfulPaint(),
        largestContentfulPaint: this.getLargestContentfulPaint()
      },
      bundles: {
        javascript: {
          count: jsResources.length,
          totalSize: jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
          averageLoadTime: jsResources.reduce((sum, r) => sum + r.duration, 0) / jsResources.length
        },
        css: {
          count: cssResources.length,
          totalSize: cssResources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
          averageLoadTime: cssResources.reduce((sum, r) => sum + r.duration, 0) / cssResources.length
        }
      },
      memory: (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : null
    }
  }

  /**
   * Check if bundle size targets are met
   */
  static checkBundleTargets() {
    const metrics = this.getBundleMetrics()
    if (!metrics) return null

    const targets = {
      initialJSBundle: 500 * 1024, // 500KB
      totalBundle: 2 * 1024 * 1024, // 2MB
      loadTime: 3000, // 3 seconds
      firstContentfulPaint: 1500 // 1.5 seconds
    }

    const results = {
      initialJSBundle: {
        current: metrics.bundles.javascript.totalSize,
        target: targets.initialJSBundle,
        met: metrics.bundles.javascript.totalSize <= targets.initialJSBundle
      },
      loadTime: {
        current: metrics.navigation.loadComplete,
        target: targets.loadTime,
        met: metrics.navigation.loadComplete <= targets.loadTime
      },
      firstContentfulPaint: {
        current: metrics.navigation.firstContentfulPaint,
        target: targets.firstContentfulPaint,
        met: metrics.navigation.firstContentfulPaint <= targets.firstContentfulPaint
      }
    }

    return results
  }

  private static logNavigationMetrics(entry: PerformanceNavigationTiming) {
    console.log('Navigation Metrics:', {
      domContentLoaded: entry.domContentLoadedEventEnd - entry.navigationStart,
      loadComplete: entry.loadEventEnd - entry.navigationStart,
      firstContentfulPaint: this.getFirstContentfulPaint()
    })
  }

  private static logResourceMetrics(entry: PerformanceResourceTiming) {
    if (entry.name.includes('.js') || entry.name.includes('.css')) {
      console.log('Resource Metrics:', {
        name: entry.name.split('/').pop(),
        size: entry.transferSize,
        loadTime: entry.duration,
        type: entry.name.includes('.js') ? 'javascript' : 'css'
      })
    }
  }

  private static getFirstContentfulPaint(): number {
    const entries = performance.getEntriesByType('paint')
    const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
    return fcpEntry?.startTime || 0
  }

  private static getLargestContentfulPaint(): number {
    if ('PerformanceObserver' in window) {
      let lcp = 0
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          lcp = entry.startTime
        })
      })
      observer.observe({ entryTypes: ['largest-contentful-paint'] })
      return lcp
    }
    return 0
  }
}

// Performance budget configuration
export const PerformanceBudgets = {
  // Bundle size budgets (in bytes)
  bundles: {
    initial: 500 * 1024, // 500KB
    total: 2 * 1024 * 1024, // 2MB
    perRoute: 200 * 1024, // 200KB per route
    perComponent: 50 * 1024 // 50KB per component
  },

  // Performance timing budgets (in milliseconds)
  timing: {
    firstContentfulPaint: 1500,
    largestContentfulPaint: 2500,
    firstInputDelay: 100,
    cumulativeLayoutShift: 0.1,
    timeToInteractive: 3000
  },

  // Network budgets
  network: {
    maxRequests: 50, // Maximum number of requests on initial load
    maxImageSize: 200 * 1024, // 200KB per image
    maxFontSize: 100 * 1024 // 100KB per font file
  }
}

// Utility functions
export const preloadRoute = (route: keyof typeof RouteChunks) => {
  RouteChunks[route]()
}

export const preloadComponent = (component: keyof typeof LazyComponents) => {
  const Component = LazyComponents[component]
  // Trigger the dynamic import
  Component.render = Component.render || (() => null)
}

export const initializeBundleOptimization = () => {
  if (typeof window !== 'undefined') {
    // Initialize asset optimization
    AssetOptimizer.preloadCriticalAssets()
    AssetOptimizer.setupLazyImages()
    
    // Initialize bundle monitoring
    BundleAnalyzer.initialize()
    
    // Log initial bundle metrics after load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const metrics = BundleAnalyzer.getBundleMetrics()
        const budgetCheck = BundleAnalyzer.checkBundleTargets()
        
        console.log('Bundle Optimization Metrics:', { metrics, budgetCheck })
        
        // Warn about budget violations
        if (budgetCheck && !budgetCheck.initialJSBundle.met) {
          console.warn('JS Bundle size exceeds target:', budgetCheck.initialJSBundle)
        }
        if (budgetCheck && !budgetCheck.loadTime.met) {
          console.warn('Load time exceeds target:', budgetCheck.loadTime)
        }
      }, 1000)
    })
  }
}