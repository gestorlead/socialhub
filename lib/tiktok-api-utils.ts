/**
 * TikTok API V2 Utilities
 * Utility functions for handling TikTok API data according to official documentation
 */

import { TikTokVideo, TIKTOK_VIDEO_FIELDS } from '@/types/tiktok'

/**
 * Build query parameters for TikTok API requests
 */
export function buildTikTokVideoQuery(options: {
  fields?: string[]
  maxCount?: number
  cursor?: number
}) {
  const { fields = TIKTOK_VIDEO_FIELDS, maxCount = 20, cursor } = options
  
  const params = new URLSearchParams()
  params.set('fields', fields.join(','))
  
  return { params, body: { max_count: maxCount, ...(cursor && { cursor }) } }
}

/**
 * Validate TikTok video data from API response
 */
export function validateTikTokVideo(data: any): TikTokVideo | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  // Validate required fields
  if (!data.id || typeof data.id !== 'string') {
    console.warn('TikTok video missing required id field')
    return null
  }

  // Transform and validate data according to API spec
  const video: TikTokVideo = {
    id: data.id,
    create_time: typeof data.create_time === 'number' ? data.create_time : 0,
    cover_image_url: typeof data.cover_image_url === 'string' ? data.cover_image_url : undefined,
    share_url: typeof data.share_url === 'string' ? data.share_url : undefined,
    video_description: typeof data.video_description === 'string' ? data.video_description : undefined,
    duration: typeof data.duration === 'number' ? data.duration : undefined,
    height: typeof data.height === 'number' ? data.height : undefined,
    width: typeof data.width === 'number' ? data.width : undefined,
    title: typeof data.title === 'string' ? data.title : undefined,
    embed_html: typeof data.embed_html === 'string' ? data.embed_html : undefined,
    embed_link: typeof data.embed_link === 'string' ? data.embed_link : undefined,
    like_count: typeof data.like_count === 'number' ? data.like_count : 
                typeof data.like_count === 'string' ? parseInt(data.like_count) || 0 : 
                data.like_count ? Number(data.like_count) || 0 : 0,
    comment_count: typeof data.comment_count === 'number' ? data.comment_count : 
                   typeof data.comment_count === 'string' ? parseInt(data.comment_count) || 0 : 
                   data.comment_count ? Number(data.comment_count) || 0 : 0,
    share_count: typeof data.share_count === 'number' ? data.share_count : 
                 typeof data.share_count === 'string' ? parseInt(data.share_count) || 0 : 
                 data.share_count ? Number(data.share_count) || 0 : 0,
    view_count: typeof data.view_count === 'number' ? data.view_count : 
                typeof data.view_count === 'string' ? parseInt(data.view_count) || 0 : 
                data.view_count ? Number(data.view_count) || 0 : 0,
  }

  return video
}

/**
 * Transform database video record to TikTok API format
 */
export function transformDatabaseVideoToTikTokFormat(dbVideo: any): any {
  return {
    id: dbVideo.video_id,
    title: dbVideo.title,
    video_description: dbVideo.description,
    share_url: dbVideo.share_url,
    embed_link: dbVideo.embed_link,
    embed_html: dbVideo.embed_link, // Use embed_link as fallback
    cover_image_url: dbVideo.cover_image_url,
    create_time: dbVideo.create_time ? Math.floor(new Date(dbVideo.create_time).getTime() / 1000) : undefined,
    duration: dbVideo.duration,
    height: dbVideo.height,
    width: dbVideo.width,
    view_count: dbVideo.view_count,
    like_count: dbVideo.like_count,
    comment_count: dbVideo.comment_count,
    share_count: dbVideo.share_count
  }
}

/**
 * Transform TikTok API response to validated video list
 */
export function transformTikTokApiResponse(apiResponse: any): {
  videos: TikTokVideo[]
  cursor?: number
  hasMore: boolean
  error?: string
} {
  try {
    // Handle null or undefined response
    if (!apiResponse) {
      return {
        videos: [],
        hasMore: false,
        error: 'Empty API response'
      }
    }

    // Handle API error response
    if (apiResponse.error) {
      return {
        videos: [],
        hasMore: false,
        error: apiResponse.error.message || 'TikTok API error'
      }
    }

    // Validate response structure
    if (!apiResponse.data) {
      return {
        videos: [],
        hasMore: false,
        error: 'Missing data in API response'
      }
    }

    if (!Array.isArray(apiResponse.data.videos)) {
      return {
        videos: [],
        hasMore: false,
        error: 'Invalid videos array in API response'
      }
    }

    // Transform and validate each video
    const videos: TikTokVideo[] = []
    for (const videoData of apiResponse.data.videos) {
      const validatedVideo = validateTikTokVideo(videoData)
      if (validatedVideo) {
        videos.push(validatedVideo)
      }
    }

    return {
      videos,
      cursor: apiResponse.data.cursor,
      hasMore: apiResponse.data.has_more || false
    }
  } catch (error) {
    console.error('Error transforming TikTok API response:', error)
    return {
      videos: [],
      hasMore: false,
      error: 'Failed to process API response'
    }
  }
}

/**
 * Format TikTok timestamp to readable date
 */
export function formatTikTokTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp * 1000).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

/**
 * Calculate engagement rate for TikTok video
 */
export function calculateEngagementRate(video: TikTokVideo): number {
  const views = video.view_count || 0
  const likes = video.like_count || 0
  const comments = video.comment_count || 0
  const shares = video.share_count || 0
  
  if (views === 0) return 0
  
  return ((likes + comments + shares) / views) * 100
}

/**
 * Sort videos by engagement or date
 */
export function sortTikTokVideos(
  videos: TikTokVideo[], 
  sortBy: 'engagement' | 'date' | 'views' = 'date'
): TikTokVideo[] {
  return [...videos].sort((a, b) => {
    switch (sortBy) {
      case 'engagement':
        return calculateEngagementRate(b) - calculateEngagementRate(a)
      case 'views':
        return (b.view_count || 0) - (a.view_count || 0)
      case 'date':
      default:
        return (b.create_time || 0) - (a.create_time || 0)
    }
  })
}

/**
 * Filter videos by minimum engagement or views
 */
export function filterTikTokVideos(
  videos: TikTokVideo[], 
  filters: {
    minViews?: number
    minEngagement?: number
    hasTitle?: boolean
  }
): TikTokVideo[] {
  return videos.filter(video => {
    if (filters.minViews && (video.view_count || 0) < filters.minViews) {
      return false
    }
    
    if (filters.minEngagement && calculateEngagementRate(video) < filters.minEngagement) {
      return false
    }
    
    if (filters.hasTitle && !video.title && !video.video_description) {
      return false
    }
    
    return true
  })
}