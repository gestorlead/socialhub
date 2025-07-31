-- Create table for API test logs
CREATE TABLE IF NOT EXISTS api_test_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  test_type TEXT NOT NULL,
  results JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_api_test_logs_user_id ON api_test_logs(user_id);
CREATE INDEX idx_api_test_logs_platform ON api_test_logs(platform);
CREATE INDEX idx_api_test_logs_timestamp ON api_test_logs(timestamp);

-- Add RLS policies
ALTER TABLE api_test_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own test logs
CREATE POLICY "Users can view own api test logs" ON api_test_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own test logs
CREATE POLICY "Users can insert own api test logs" ON api_test_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);