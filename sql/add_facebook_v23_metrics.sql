-- Add new Facebook API v23.0 metrics to facebook_daily_stats table
-- These are the only supported metrics after November 1, 2025 deprecations

-- Add video ad break metrics columns
ALTER TABLE facebook_daily_stats 
ADD COLUMN IF NOT EXISTS page_daily_video_ad_break_ad_impressions_by_crosspost_status INTEGER DEFAULT 0;

ALTER TABLE facebook_daily_stats 
ADD COLUMN IF NOT EXISTS total_video_ad_break_ad_impressions INTEGER DEFAULT 0;

-- Add comments for the new columns
COMMENT ON COLUMN facebook_daily_stats.page_daily_video_ad_break_ad_impressions_by_crosspost_status IS 'Ad impressions during video ad breaks, separated by owned vs crossposted content';
COMMENT ON COLUMN facebook_daily_stats.total_video_ad_break_ad_impressions IS 'Total number of ads shown during video breaks';

-- Update any existing NULL values to 0 for consistency
UPDATE facebook_daily_stats 
SET page_daily_video_ad_break_ad_impressions_by_crosspost_status = 0 
WHERE page_daily_video_ad_break_ad_impressions_by_crosspost_status IS NULL;

UPDATE facebook_daily_stats 
SET total_video_ad_break_ad_impressions = 0 
WHERE total_video_ad_break_ad_impressions IS NULL;