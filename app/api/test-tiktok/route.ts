import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('[TEST] TikTok test endpoint called')
  
  const fields = [
    'id',
    'title',
    'share_url',
    'embed_html',
    'embed_link',
    'create_time',
    'cover_image_url',
    'video_description',
    'duration',
    'height',
    'width',
    'like_count',
    'comment_count',
    'share_count',
    'view_count'
  ].join(',')
  
  console.log('[TEST] Fields to request:', fields)
  
  return NextResponse.json({
    message: 'Test endpoint working',
    fields: fields
  })
}