-- Create threads_posts table for storing published posts
CREATE TABLE IF NOT EXISTS threads_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  thread_id VARCHAR(255) NOT NULL,
  
  -- Post content
  content TEXT,
  media_type VARCHAR(50) CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL')),
  media_urls TEXT[], -- Array of media URLs for carousel posts
  
  -- Metadata
  permalink TEXT,
  shortcode VARCHAR(100),
  is_quote_post BOOLEAN DEFAULT false,
  quoted_post_id VARCHAR(255),
  reply_to_id VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'published',
  
  -- Timestamps
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create threads_daily_stats table for analytics
CREATE TABLE IF NOT EXISTS threads_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Date
  stat_date DATE NOT NULL,
  
  -- Profile metrics
  followers_count INTEGER DEFAULT 0,
  
  -- Post metrics (aggregated)
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_reposts INTEGER DEFAULT 0,
  total_quotes INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  
  -- User metrics
  profile_views INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per day
  UNIQUE(user_id, stat_date)
);

-- Create threads_post_insights table for individual post metrics
CREATE TABLE IF NOT EXISTS threads_post_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  thread_id VARCHAR(255) NOT NULL,
  
  -- Metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Timestamps
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per post per collection
  UNIQUE(thread_id, collected_at)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threads_posts_user_id ON threads_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_posts_published_at ON threads_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_threads_posts_thread_id ON threads_posts(thread_id);

CREATE INDEX IF NOT EXISTS idx_threads_daily_stats_user_id ON threads_daily_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_daily_stats_stat_date ON threads_daily_stats(stat_date);

CREATE INDEX IF NOT EXISTS idx_threads_post_insights_user_id ON threads_post_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_post_insights_thread_id ON threads_post_insights(thread_id);

-- Enable RLS
ALTER TABLE threads_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads_post_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for threads_posts
CREATE POLICY "Users can view their own Threads posts" ON threads_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Threads posts" ON threads_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Threads posts" ON threads_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Threads posts" ON threads_posts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for threads_daily_stats
CREATE POLICY "Users can view their own Threads stats" ON threads_daily_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert Threads stats" ON threads_daily_stats
  FOR INSERT WITH CHECK (true);

-- RLS Policies for threads_post_insights
CREATE POLICY "Users can view their own Threads post insights" ON threads_post_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert Threads post insights" ON threads_post_insights
  FOR INSERT WITH CHECK (true);

-- Add Threads to integration_settings if not exists
INSERT INTO integration_settings (platform, environment, is_active)
VALUES ('threads', 'production', true)
ON CONFLICT (platform) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE threads_posts IS 'Stores published Threads posts';
COMMENT ON TABLE threads_daily_stats IS 'Daily aggregated statistics for Threads accounts';
COMMENT ON TABLE threads_post_insights IS 'Individual post metrics for Threads';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_threads_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamp
CREATE TRIGGER trigger_update_threads_posts_updated_at
  BEFORE UPDATE ON threads_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_threads_posts_updated_at();