import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to determine maximum upload size supported
 * This helps diagnose 413 errors by testing different payload sizes
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Upload Limit Test] Starting upload size test')
    console.log('[Upload Limit Test] Headers:', Object.fromEntries(request.headers.entries()))
    
    const contentLength = request.headers.get('content-length')
    console.log('[Upload Limit Test] Content-Length:', contentLength)
    
    // Try to read the body
    const formData = await request.formData()
    console.log('[Upload Limit Test] Successfully read FormData')
    
    const testFile = formData.get('testFile') as File
    const testSize = formData.get('testSize') as string
    
    if (testFile) {
      console.log('[Upload Limit Test] Test file details:')
      console.log(`  - Name: ${testFile.name}`)
      console.log(`  - Size: ${testFile.size} bytes (${(testFile.size / 1024 / 1024).toFixed(2)}MB)`)
      console.log(`  - Type: ${testFile.type}`)
    }
    
    const response = {
      success: true,
      receivedContentLength: contentLength,
      receivedFileSize: testFile?.size,
      receivedTestSize: testSize,
      timestamp: new Date().toISOString(),
      message: 'Upload test successful'
    }
    
    console.log('[Upload Limit Test] Test completed successfully:', response)
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('[Upload Limit Test] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Allow large uploads for testing
export const runtime = 'nodejs'
export const maxDuration = 60