-- Create table for storing Facebook daily statistics
CREATE TABLE IF NOT EXISTS facebook_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and page info
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_user_id TEXT NOT NULL, -- Facebook Page ID
  date DATE NOT NULL,
  
  -- Basic fan metrics
  page_fans INTEGER DEFAULT 0,
  page_fan_adds INTEGER DEFAULT 0,
  page_fan_removes INTEGER DEFAULT 0,
  
  -- Impressions and reach metrics
  page_impressions INTEGER DEFAULT 0,
  page_impressions_unique INTEGER DEFAULT 0,
  page_impressions_paid INTEGER DEFAULT 0,
  page_impressions_organic INTEGER DEFAULT 0,
  page_reach INTEGER DEFAULT 0,
  
  -- Engagement metrics
  page_engaged_users INTEGER DEFAULT 0,
  page_post_engagements INTEGER DEFAULT 0,
  page_consumptions INTEGER DEFAULT 0,
  page_consumptions_unique INTEGER DEFAULT 0,
  page_negative_feedback INTEGER DEFAULT 0,
  page_places_checkin_total INTEGER DEFAULT 0,
  
  -- Video metrics
  page_video_views INTEGER DEFAULT 0,
  page_video_views_paid INTEGER DEFAULT 0,
  page_video_views_organic INTEGER DEFAULT 0,
  page_video_complete_views_30s INTEGER DEFAULT 0,
  
  -- Post-level metrics
  page_posts_impressions INTEGER DEFAULT 0,
  page_posts_impressions_unique INTEGER DEFAULT 0,
  page_posts_impressions_paid INTEGER DEFAULT 0,
  page_posts_impressions_organic INTEGER DEFAULT 0,
  
  -- Demographic data (stored as JSON)
  page_fans_country JSONB,
  page_fans_city JSONB,
  page_fans_locale JSONB,
  page_fans_gender_age JSONB,
  
  -- Online fans metrics
  page_fans_online INTEGER DEFAULT 0,
  page_fans_online_per_day JSONB, -- Daily breakdown
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(user_id, platform_user_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_facebook_daily_stats_user_id ON facebook_daily_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_daily_stats_platform_user_id ON facebook_daily_stats(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_daily_stats_date ON facebook_daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_facebook_daily_stats_user_date ON facebook_daily_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_facebook_daily_stats_platform_date ON facebook_daily_stats(platform_user_id, date);

-- Enable RLS
ALTER TABLE facebook_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Users can only access their own stats
CREATE POLICY "Users can view their own Facebook stats" ON facebook_daily_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Facebook stats" ON facebook_daily_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Facebook stats" ON facebook_daily_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_facebook_daily_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamps
CREATE TRIGGER trigger_update_facebook_daily_stats_updated_at
  BEFORE UPDATE ON facebook_daily_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_facebook_daily_stats_updated_at();

-- Comments for documentation
COMMENT ON TABLE facebook_daily_stats IS 'Stores daily statistics for Facebook pages';
COMMENT ON COLUMN facebook_daily_stats.user_id IS 'Reference to the user who owns this Facebook page';
COMMENT ON COLUMN facebook_daily_stats.platform_user_id IS 'Facebook Page ID';
COMMENT ON COLUMN facebook_daily_stats.date IS 'Date for which these statistics were collected (YYYY-MM-DD)';
COMMENT ON COLUMN facebook_daily_stats.page_fans IS 'Total number of page likes/fans';
COMMENT ON COLUMN facebook_daily_stats.page_fan_adds IS 'Number of new likes/fans gained on this date';
COMMENT ON COLUMN facebook_daily_stats.page_fan_removes IS 'Number of likes/fans lost on this date';
COMMENT ON COLUMN facebook_daily_stats.page_impressions IS 'Total impressions for page content';
COMMENT ON COLUMN facebook_daily_stats.page_impressions_unique IS 'Unique impressions (number of people who saw content)';
COMMENT ON COLUMN facebook_daily_stats.page_reach IS 'Total reach of page content';
COMMENT ON COLUMN facebook_daily_stats.page_engaged_users IS 'Number of people who engaged with page content';
COMMENT ON COLUMN facebook_daily_stats.page_post_engagements IS 'Total engagements on page posts';
COMMENT ON COLUMN facebook_daily_stats.page_video_views IS 'Total video views on page';
COMMENT ON COLUMN facebook_daily_stats.page_fans_country IS 'Distribution of fans by country (JSON)';
COMMENT ON COLUMN facebook_daily_stats.page_fans_city IS 'Distribution of fans by city (JSON)';
COMMENT ON COLUMN facebook_daily_stats.page_fans_locale IS 'Distribution of fans by locale/language (JSON)';
COMMENT ON COLUMN facebook_daily_stats.page_fans_gender_age IS 'Distribution of fans by gender and age (JSON)';