// TikTok API V2 Video Object - Official Structure
export interface TikTokVideo {
  id: string                    // Unique video identifier (item_id)
  create_time: number          // UTC Unix epoch timestamp in seconds
  cover_image_url?: string     // CDN link for cover image (6-hour TTL)
  share_url?: string           // Shareable link for the video
  video_description?: string   // Creator's description (max 150 chars)
  duration?: number            // Video duration in seconds
  height?: number              // Video height in pixels
  width?: number               // Video width in pixels
  title?: string               // Video title (max 150 chars)
  embed_html?: string          // HTML code for embedded video
  embed_link?: string          // Video embed link
  like_count?: number          // Number of likes
  comment_count?: number       // Number of comments
  share_count?: number         // Number of shares
  view_count?: number          // Number of views (int64)
  
  // Local database fields (not from API)
  user_id?: string             // Internal user ID
  platform_user_id?: string    // TikTok user ID
  created_at?: string          // Local timestamp
  updated_at?: string          // Local timestamp
}

// TikTok API V2 Video List Response Structure
export interface TikTokVideoApiResponse {
  data: {
    videos: TikTokVideo[]       // Array of video objects
    cursor?: number             // Pagination cursor (Unix timestamp)
    has_more: boolean           // Whether more videos are available
  }
  error?: {
    code: string               // Error code
    message: string            // Error message
    log_id: string             // Log identifier for debugging
  }
}

// TikTok API V2 Video Query Request Body
export interface TikTokVideoQueryRequest {
  filters?: {
    video_ids: string[]         // Array of video IDs (max 20)
  }
}

// TikTok API V2 Video List Request Body
export interface TikTokVideoListRequest {
  cursor?: number              // UTC Unix timestamp for pagination
  max_count?: number           // Number of videos to return (default 10, max 20)
}

// Available fields for TikTok API requests
export const TIKTOK_VIDEO_FIELDS = [
  'id',
  'create_time',
  'cover_image_url',
  'share_url',
  'video_description',
  'duration',
  'height',
  'width',
  'title',
  'embed_html',
  'embed_link',
  'like_count',
  'comment_count',
  'share_count',
  'view_count'
] as const

export type TikTokVideoField = typeof TIKTOK_VIDEO_FIELDS[number]