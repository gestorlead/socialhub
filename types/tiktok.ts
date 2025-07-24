export interface TikTokVideo {
  id: string
  user_id: string
  platform_user_id: string
  video_id: string
  title?: string
  description?: string
  share_url?: string
  embed_link?: string
  view_count: number
  like_count: number
  comment_count: number
  share_count: number
  favorite_count: number
  play_count: number
  duration?: number
  height?: number
  width?: number
  cover_image_url?: string
  video_url?: string
  is_top_video: boolean
  privacy_type?: string
  create_time?: string
  created_at: string
  updated_at: string
}

export interface TikTokVideoApiResponse {
  id: string
  title?: string
  share_url?: string
  embed_html?: string
  embed_link?: string
  create_time: number
  cover_image_url?: string
  video_description?: string
  duration?: number
  height?: number
  width?: number
  like_count?: number
  comment_count?: number
  share_count?: number
  view_count?: number
}

export interface TikTokVideoListResponse {
  data: {
    videos: TikTokVideoApiResponse[]
  }
  error?: {
    code: string
    message: string
    log_id: string
  }
  has_more?: boolean
  cursor?: number
  max_count?: number
}