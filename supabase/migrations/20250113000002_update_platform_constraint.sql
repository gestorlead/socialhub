-- Update platform constraint to support composite platform names
-- This allows platform values like 'instagram_story', 'tiktok_video', etc.

-- Drop the existing platform constraint
ALTER TABLE publication_jobs DROP CONSTRAINT IF EXISTS publication_jobs_platform_check;

-- Add new constraint that supports both base and composite platform names
ALTER TABLE publication_jobs 
ADD CONSTRAINT publication_jobs_platform_check 
CHECK (platform IN (
  -- Base platforms (for backward compatibility)
  'tiktok', 'facebook', 'instagram', 'youtube', 'threads', 'x', 'linkedin',
  
  -- TikTok variants
  'tiktok_video',
  
  -- Instagram variants
  'instagram_feed', 'instagram_story', 'instagram_reels',
  
  -- YouTube variants
  'youtube_video', 'youtube_shorts',
  
  -- Facebook variants
  'facebook_feed', 'facebook_story', 'facebook_reels',
  
  -- X (Twitter) variants
  'x_post',
  
  -- LinkedIn variants
  'linkedin_post',
  
  -- Threads variants
  'threads_post'
));

-- Add comment to document the constraint
COMMENT ON CONSTRAINT publication_jobs_platform_check ON publication_jobs IS 
'Allows both base platform names (tiktok, instagram, etc.) and composite platform names (instagram_story, tiktok_video, etc.)';