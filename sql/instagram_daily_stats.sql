-- Create instagram_daily_stats table for historical statistics tracking
CREATE TABLE IF NOT EXISTS public.instagram_daily_stats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform_user_id text NOT NULL,
  date date NOT NULL,
  follower_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  media_count integer DEFAULT 0,
  -- Instagram Graph API insights (available for business accounts with 100+ followers)
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  profile_views integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, platform_user_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_instagram_daily_stats_user_id ON public.instagram_daily_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_daily_stats_platform_user_id ON public.instagram_daily_stats(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_daily_stats_date ON public.instagram_daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_instagram_daily_stats_user_date ON public.instagram_daily_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_instagram_daily_stats_platform_date ON public.instagram_daily_stats(platform_user_id, date);

-- Enable RLS (Row Level Security)
ALTER TABLE public.instagram_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for instagram_daily_stats
CREATE POLICY "Users can view their own daily stats" ON public.instagram_daily_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily stats" ON public.instagram_daily_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily stats" ON public.instagram_daily_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily stats" ON public.instagram_daily_stats
  FOR DELETE USING (auth.uid() = user_id);

-- Service role policies for cron jobs
CREATE POLICY "Service role can manage all daily stats" ON public.instagram_daily_stats
  FOR ALL USING (true);

-- Function to get Instagram stats growth between dates
CREATE OR REPLACE FUNCTION get_instagram_stats_growth(
  p_user_id uuid,
  p_platform_user_id text,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  metric text,
  start_value integer,
  end_value integer,
  growth integer,
  growth_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unnest(ARRAY['followers', 'following', 'media', 'impressions', 'reach', 'profile_views']) as metric,
    unnest(ARRAY[
      COALESCE((SELECT follower_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT following_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT media_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT impressions FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT reach FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT profile_views FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0)
    ]) as start_value,
    unnest(ARRAY[
      COALESCE((SELECT follower_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0),
      COALESCE((SELECT following_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0),
      COALESCE((SELECT media_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0),
      COALESCE((SELECT impressions FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0),
      COALESCE((SELECT reach FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0),
      COALESCE((SELECT profile_views FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0)
    ]) as end_value,
    unnest(ARRAY[
      COALESCE((SELECT follower_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) -
      COALESCE((SELECT follower_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT following_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) -
      COALESCE((SELECT following_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT media_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) -
      COALESCE((SELECT media_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT impressions FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) -
      COALESCE((SELECT impressions FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT reach FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) -
      COALESCE((SELECT reach FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0),
      COALESCE((SELECT profile_views FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) -
      COALESCE((SELECT profile_views FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0)
    ]) as growth,
    unnest(ARRAY[
      CASE WHEN COALESCE((SELECT follower_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0) = 0 THEN 0
           ELSE ROUND((COALESCE((SELECT follower_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) - 
                      COALESCE((SELECT follower_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0))::numeric / 
                      COALESCE((SELECT follower_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 1)::numeric * 100, 2) END,
      CASE WHEN COALESCE((SELECT following_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0) = 0 THEN 0
           ELSE ROUND((COALESCE((SELECT following_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) - 
                      COALESCE((SELECT following_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0))::numeric / 
                      COALESCE((SELECT following_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 1)::numeric * 100, 2) END,
      CASE WHEN COALESCE((SELECT media_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0) = 0 THEN 0
           ELSE ROUND((COALESCE((SELECT media_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) - 
                      COALESCE((SELECT media_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0))::numeric / 
                      COALESCE((SELECT media_count FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 1)::numeric * 100, 2) END,
      CASE WHEN COALESCE((SELECT impressions FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0) = 0 THEN 0
           ELSE ROUND((COALESCE((SELECT impressions FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) - 
                      COALESCE((SELECT impressions FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0))::numeric / 
                      COALESCE((SELECT impressions FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 1)::numeric * 100, 2) END,
      CASE WHEN COALESCE((SELECT reach FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0) = 0 THEN 0
           ELSE ROUND((COALESCE((SELECT reach FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) - 
                      COALESCE((SELECT reach FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0))::numeric / 
                      COALESCE((SELECT reach FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 1)::numeric * 100, 2) END,
      CASE WHEN COALESCE((SELECT profile_views FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0) = 0 THEN 0
           ELSE ROUND((COALESCE((SELECT profile_views FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_end_date), 0) - 
                      COALESCE((SELECT profile_views FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 0))::numeric / 
                      COALESCE((SELECT profile_views FROM public.instagram_daily_stats WHERE user_id = p_user_id AND platform_user_id = p_platform_user_id AND date = p_start_date), 1)::numeric * 100, 2) END
    ]) as growth_percentage;
END;
$$ LANGUAGE plpgsql;