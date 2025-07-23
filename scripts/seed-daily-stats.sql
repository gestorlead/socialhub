-- Script to generate mock daily statistics data for development
-- This creates 60 days of realistic TikTok growth data

-- First, let's create a function to generate realistic daily stats
CREATE OR REPLACE FUNCTION generate_mock_daily_stats(
  p_user_id uuid,
  p_platform_user_id text,
  p_days_back integer DEFAULT 60
) RETURNS void AS $$
DECLARE
  base_date date := CURRENT_DATE - p_days_back;
  current_date date;
  day_counter integer := 0;
  
  -- Starting values (realistic for a growing TikTok account)
  followers integer := 100;
  following integer := 250;
  likes integer := 750;
  videos integer := 45;
  
  -- Growth parameters
  follower_growth integer;
  following_growth integer;
  likes_growth integer;
  video_growth integer;
  
  -- Random factors
  growth_factor numeric;
  is_weekend boolean;
  is_viral_day boolean;
BEGIN
  -- Generate data for each day
  FOR day_counter IN 0..p_days_back LOOP
    current_date := base_date + day_counter;
    
    -- Determine if it's weekend (typically lower engagement)
    is_weekend := EXTRACT(DOW FROM current_date) IN (0, 6);
    
    -- Random chance for viral content (5% chance)
    is_viral_day := random() < 0.05;
    
    -- Calculate growth factor based on various conditions
    growth_factor := CASE
      WHEN is_viral_day THEN 2.5 + random() * 2  -- Viral days: 2.5x to 4.5x growth
      WHEN is_weekend THEN 0.3 + random() * 0.4  -- Weekends: 0.3x to 0.7x growth
      ELSE 0.8 + random() * 0.4                  -- Normal days: 0.8x to 1.2x growth
    END;
    
    -- Calculate daily growth with some randomness
    follower_growth := CASE
      WHEN is_viral_day THEN FLOOR(5 + random() * 25) * growth_factor  -- 5-30 on viral days
      ELSE FLOOR(-2 + random() * 8) * growth_factor                     -- -2 to 6 normally
    END;
    
    following_growth := CASE
      WHEN day_counter % 7 = 0 THEN FLOOR(-3 + random() * 8)  -- Weekly following sprees
      ELSE FLOOR(-1 + random() * 3)                           -- Mostly stable
    END;
    
    likes_growth := CASE
      WHEN videos > (45 + day_counter * 0.3) THEN  -- New video posted
        FLOOR(follower_growth * 3 + random() * 50)
      ELSE
        FLOOR(follower_growth * 1.2 + random() * 10)
    END;
    
    video_growth := CASE
      WHEN day_counter % 3 = 0 AND random() < 0.6 THEN 1  -- Post ~2 videos per week
      WHEN day_counter % 2 = 0 AND random() < 0.3 THEN 1  -- Occasional extra posts
      ELSE 0
    END;
    
    -- Apply growth with minimum constraints
    followers := GREATEST(followers + follower_growth, 50);  -- Never go below 50
    following := GREATEST(following + following_growth, 200); -- Never go below 200
    likes := GREATEST(likes + likes_growth, followers * 2);   -- Likes should be at least 2x followers
    videos := videos + video_growth;
    
    -- Add some realistic caps and adjustments
    IF followers > 10000 THEN
      -- Slower growth for larger accounts
      follower_growth := FLOOR(follower_growth * 0.7);
    END IF;
    
    -- Insert the daily stat
    INSERT INTO public.tiktok_daily_stats (
      user_id,
      platform_user_id,
      date,
      follower_count,
      following_count,
      likes_count,
      video_count,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_platform_user_id,
      current_date,
      followers,
      following,
      likes,
      videos,
      (current_date + interval '23 hours')::timestamp with time zone,  -- Simulate daily collection at 11 PM
      (current_date + interval '23 hours')::timestamp with time zone
    )
    ON CONFLICT (user_id, platform_user_id, date) 
    DO UPDATE SET
      follower_count = EXCLUDED.follower_count,
      following_count = EXCLUDED.following_count,
      likes_count = EXCLUDED.likes_count,
      video_count = EXCLUDED.video_count,
      updated_at = EXCLUDED.updated_at;
      
  END LOOP;
  
  RAISE NOTICE 'Generated % days of mock data for user % (platform_user_id: %)', 
    p_days_back + 1, p_user_id, p_platform_user_id;
END;
$$ LANGUAGE plpgsql;

-- Now let's generate data for existing TikTok connections
DO $$
DECLARE
  connection_record RECORD;
BEGIN
  -- Loop through all existing TikTok connections
  FOR connection_record IN 
    SELECT user_id, platform_user_id 
    FROM public.social_connections 
    WHERE platform = 'tiktok'
  LOOP
    -- Generate 60 days of mock data for each connection
    PERFORM generate_mock_daily_stats(
      connection_record.user_id,
      connection_record.platform_user_id,
      60
    );
  END LOOP;
  
  -- If no connections exist, create sample data for testing
  IF NOT FOUND THEN
    RAISE NOTICE 'No TikTok connections found. Creating sample data for testing...';
    
    -- Create sample data with a test user ID (you can replace this with a real user ID)
    PERFORM generate_mock_daily_stats(
      '00000000-0000-0000-0000-000000000001'::uuid,  -- Sample user ID
      'sample_tiktok_user_123',                       -- Sample platform user ID
      60
    );
  END IF;
END;
$$;

-- Create additional sample accounts with different growth patterns
DO $$
BEGIN
  -- Fast growing account
  PERFORM generate_mock_daily_stats(
    '00000000-0000-0000-0000-000000000002'::uuid,
    'fast_growing_tiktoker',
    60
  );
  
  -- Stable/mature account
  PERFORM generate_mock_daily_stats(
    '00000000-0000-0000-0000-000000000003'::uuid,
    'stable_content_creator',
    60
  );
  
  -- Declining account
  INSERT INTO public.tiktok_daily_stats (
    user_id, platform_user_id, date, follower_count, following_count, likes_count, video_count
  )
  SELECT 
    '00000000-0000-0000-0000-000000000004'::uuid,
    'declining_account',
    generate_series(CURRENT_DATE - 60, CURRENT_DATE, '1 day'::interval)::date,
    GREATEST(5000 - (EXTRACT(epoch FROM (CURRENT_DATE - generate_series(CURRENT_DATE - 60, CURRENT_DATE, '1 day'::interval)::date)) / 86400)::integer * 2, 1000),
    300 + (random() * 10)::integer,
    GREATEST(15000 - (EXTRACT(epoch FROM (CURRENT_DATE - generate_series(CURRENT_DATE - 60, CURRENT_DATE, '1 day'::interval)::date)) / 86400)::integer * 8, 3000),
    120 + (EXTRACT(epoch FROM (CURRENT_DATE - generate_series(CURRENT_DATE - 60, CURRENT_DATE, '1 day'::interval)::date)) / 86400)::integer / 7
  ON CONFLICT (user_id, platform_user_id, date) DO NOTHING;
END;
$$;

-- Clean up the function (optional)
-- DROP FUNCTION IF EXISTS generate_mock_daily_stats(uuid, text, integer);

-- Display summary of generated data
SELECT 
  platform_user_id,
  COUNT(*) as days_of_data,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  MAX(follower_count) - MIN(follower_count) as follower_growth,
  MAX(likes_count) - MIN(likes_count) as likes_growth
FROM public.tiktok_daily_stats 
GROUP BY platform_user_id
ORDER BY platform_user_id;