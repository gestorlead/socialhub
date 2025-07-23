-- Create social_connections table
CREATE TABLE IF NOT EXISTS public.social_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  platform_user_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  scope text,
  profile_data jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Create oauth_states table for CSRF protection
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  state text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON public.social_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON public.social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_user_platform ON public.social_connections(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON public.oauth_states(expires_at);

-- Enable RLS
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_connections
CREATE POLICY "Users can view their own social connections" ON public.social_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social connections" ON public.social_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social connections" ON public.social_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social connections" ON public.social_connections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for oauth_states (more permissive for server-side operations)
CREATE POLICY "Service role can manage oauth states" ON public.oauth_states
  FOR ALL USING (true);

-- Clean up expired oauth states (function)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.oauth_states 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired states (if pg_cron is available)
-- This is optional and depends on your Supabase plan
-- SELECT cron.schedule('cleanup-oauth-states', '*/10 * * * *', 'SELECT cleanup_expired_oauth_states();');