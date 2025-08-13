// API Route configuration for large file uploads
export const config = {
  api: {
    bodyParser: false, // Disable default body parser
    responseLimit: false, // Disable response size limit
  },
  // Configure for large uploads (Vercel specific)
  maxDuration: 300, // 5 minutes timeout for large files
}

// Export for Next.js API route configuration
export const runtime = 'nodejs'