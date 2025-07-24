-- Create table for TikTok videos
CREATE TABLE IF NOT EXISTS tiktok_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform_user_id VARCHAR(255) NOT NULL,
  video_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Basic info
  title TEXT,
  description TEXT,
  share_url TEXT,
  embed_link TEXT,
  
  -- Statistics
  view_count BIGINT DEFAULT 0,
  like_count BIGINT DEFAULT 0,
  comment_count BIGINT DEFAULT 0,
  share_count BIGINT DEFAULT 0,
  favorite_count BIGINT DEFAULT 0,
  play_count BIGINT DEFAULT 0,
  
  -- Video metadata
  duration INTEGER, -- in seconds
  height INTEGER,
  width INTEGER,
  cover_image_url TEXT,
  video_url TEXT,
  
  -- Status
  is_top_video BOOLEAN DEFAULT FALSE,
  privacy_type VARCHAR(50),
  
  -- Timestamps
  create_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tiktok_videos_user_id ON tiktok_videos(user_id);
CREATE INDEX idx_tiktok_videos_platform_user_id ON tiktok_videos(platform_user_id);
CREATE INDEX idx_tiktok_videos_create_time ON tiktok_videos(create_time DESC);
CREATE INDEX idx_tiktok_videos_view_count ON tiktok_videos(view_count DESC);

-- Enable RLS
ALTER TABLE tiktok_videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own tiktok videos" ON tiktok_videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tiktok videos" ON tiktok_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tiktok videos" ON tiktok_videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tiktok videos" ON tiktok_videos
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tiktok_videos_updated_at
  BEFORE UPDATE ON tiktok_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();