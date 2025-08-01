-- Create table for storing social posts (if not exists)
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and platform info
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  platform_post_id TEXT,
  page_id TEXT, -- For Facebook pages, Instagram Business accounts, etc.
  
  -- Content
  content TEXT,
  media_urls JSONB,
  media_type VARCHAR(20), -- 'photo', 'video', 'carousel', 'text'
  
  -- Publishing info
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  
  -- Metadata
  metadata JSONB, -- Platform-specific metadata
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);  
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_at ON social_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_published_at ON social_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_page_id ON social_posts(page_id);

-- Enable RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Users can only access their own posts
CREATE POLICY "Users can manage their own posts" ON social_posts
  FOR ALL USING (auth.uid() = user_id);

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_social_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamps
CREATE TRIGGER trigger_update_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_posts_updated_at();

-- Comments for documentation
COMMENT ON TABLE social_posts IS 'Stores posts published to social media platforms';
COMMENT ON COLUMN social_posts.platform IS 'Social media platform (facebook, instagram, tiktok, etc.)';
COMMENT ON COLUMN social_posts.platform_post_id IS 'Platform-specific post ID returned after publishing';
COMMENT ON COLUMN social_posts.page_id IS 'Platform-specific page/account ID where the post was published';
COMMENT ON COLUMN social_posts.content IS 'Post text content/caption';
COMMENT ON COLUMN social_posts.media_urls IS 'Array of media URLs attached to the post';
COMMENT ON COLUMN social_posts.media_type IS 'Type of media: photo, video, carousel, or text';
COMMENT ON COLUMN social_posts.scheduled_at IS 'When the post is scheduled to be published';
COMMENT ON COLUMN social_posts.published_at IS 'When the post was actually published';
COMMENT ON COLUMN social_posts.status IS 'Current status: draft, scheduled, published, or failed';
COMMENT ON COLUMN social_posts.metadata IS 'Platform-specific metadata and settings';