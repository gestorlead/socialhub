-- Add language preference column to profiles table
-- This migration adds support for user language preferences

-- Add the preferred_language column to the profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'pt';

-- Add a check constraint to ensure only supported locales are used
ALTER TABLE profiles 
ADD CONSTRAINT check_supported_language 
CHECK (preferred_language IN ('pt', 'en', 'es', 'ja', 'zh-CN', 'zh-TW', 'ko'));

-- Create an index for better query performance on language preferences
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language 
ON profiles(preferred_language);

-- Add a comment to document the column
COMMENT ON COLUMN profiles.preferred_language IS 'User preferred language code (ISO 639-1 with country codes for Chinese variants)';

-- Update existing profiles to have the default language preference
-- This ensures all existing users have a language preference set
UPDATE profiles 
SET preferred_language = 'pt' 
WHERE preferred_language IS NULL;