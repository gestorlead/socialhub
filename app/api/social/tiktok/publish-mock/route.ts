import { NextRequest, NextResponse } from 'next/server'

// Mock TikTok publish endpoint for testing without actual API calls
export async function POST(request: NextRequest) {
  try {
    console.log('[TikTok Publish Mock] Starting mock publish request')
    
    const body = await request.json()
    const { userId, mediaFile, caption, settings } = body
    
    console.log('[TikTok Publish Mock] Request received:', {
      userId,
      fileName: mediaFile?.name,
      fileSize: mediaFile?.size,
      captionLength: caption?.length,
      settings
    })
    
    // Validate required fields
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    if (!mediaFile || !mediaFile.data) {
      return NextResponse.json({ error: 'Media file required' }, { status: 400 })
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Simulate success response
    return NextResponse.json({
      success: true,
      message: 'Mock upload successful - This is a test response',
      data: {
        publish_id: `mock_${Date.now()}`,
        status: 'PROCESSING_UPLOAD',
        upload_completed: true,
        file_name: mediaFile.name,
        file_size: mediaFile.size,
        caption: caption,
        settings: settings,
        mock: true,
        note: 'This is a mock response for testing. In production, this would upload to TikTok.'
      }
    })
    
  } catch (error) {
    console.error('[TikTok Publish Mock] Error:', error)
    
    return NextResponse.json({ 
      error: 'Mock server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}