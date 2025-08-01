-- ============================================================================
-- COMMENTS SYSTEM - REAL-TIME CONFIGURATION
-- Phase 2, Step 2.2: Real-time Subscriptions & WebSocket Integration
-- ============================================================================

-- This script configures Supabase Real-time for the comments system
-- with secure subscriptions, RLS policies, and performance optimization

-- ============================================================================
-- ENABLE REAL-TIME FOR TABLES
-- ============================================================================

-- Enable real-time for comments table (main table)
ALTER TABLE public.comments REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- Enable real-time for comment replies
ALTER TABLE public.comment_replies REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_replies;

-- Enable real-time for social posts (for notifications)
ALTER TABLE public.social_posts REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;

-- Enable real-time for moderation settings (for admin notifications)
ALTER TABLE public.comment_moderation_settings REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_moderation_settings;

-- Enable real-time for audit log (for security monitoring)
ALTER TABLE public.audit_log REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;

-- ============================================================================
-- REAL-TIME RLS POLICIES
-- ============================================================================

-- Real-time policies for comments (must match existing RLS policies)
-- These policies ensure users only receive real-time updates for their own data

-- Comments real-time policies
DROP POLICY IF EXISTS "Realtime: Users can subscribe to their own comments" ON public.comments;
CREATE POLICY "Realtime: Users can subscribe to their own comments" ON public.comments
  FOR SELECT USING (auth.uid() = user_id);

-- Admin real-time policy for moderation
DROP POLICY IF EXISTS "Realtime: Admins can subscribe to all comments" ON public.comments;
CREATE POLICY "Realtime: Admins can subscribe to all comments" ON public.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 2
    )
  );

-- Comment replies real-time policies
DROP POLICY IF EXISTS "Realtime: Users can subscribe to their own replies" ON public.comment_replies;
CREATE POLICY "Realtime: Users can subscribe to their own replies" ON public.comment_replies
  FOR SELECT USING (auth.uid() = user_id);

-- Social posts real-time policies
DROP POLICY IF EXISTS "Realtime: Users can subscribe to their own posts" ON public.social_posts;
CREATE POLICY "Realtime: Users can subscribe to their own posts" ON public.social_posts
  FOR SELECT USING (auth.uid() = user_id);

-- Moderation settings real-time policies
DROP POLICY IF EXISTS "Realtime: Users can subscribe to their own moderation settings" ON public.comment_moderation_settings;
CREATE POLICY "Realtime: Users can subscribe to their own moderation settings" ON public.comment_moderation_settings
  FOR SELECT USING (auth.uid() = user_id);

-- Audit log real-time policies (restricted)
DROP POLICY IF EXISTS "Realtime: Users can subscribe to their own audit logs" ON public.audit_log;
CREATE POLICY "Realtime: Users can subscribe to their own audit logs" ON public.audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can subscribe to all audit logs for monitoring
DROP POLICY IF EXISTS "Realtime: Service role can subscribe to all audit logs" ON public.audit_log;
CREATE POLICY "Realtime: Service role can subscribe to all audit logs" ON public.audit_log
  FOR SELECT USING (auth.role() = 'service_role');

-- ============================================================================
-- REAL-TIME OPTIMIZATION VIEWS
-- ============================================================================

-- Optimized view for comment subscriptions with minimal data
CREATE OR REPLACE VIEW public.comments_realtime AS
SELECT 
  id,
  user_id,
  platform,
  platform_post_id,
  author_username,
  content,
  status,
  sentiment_score,
  reply_to_comment_id,
  created_at,
  updated_at
FROM public.comments
WHERE deleted_at IS NULL;

-- Enable RLS on the view
ALTER VIEW public.comments_realtime ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for the view
CREATE POLICY "Realtime View: Users can subscribe to their own comments" ON public.comments_realtime
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Realtime View: Admins can subscribe to all comments" ON public.comments_realtime
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 2
    )
  );

-- Enable real-time for the view
ALTER VIEW public.comments_realtime REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments_realtime;

-- Optimized view for comment replies subscriptions
CREATE OR REPLACE VIEW public.comment_replies_realtime AS
SELECT 
  id,
  comment_id,
  user_id,
  platform,
  content,
  status,
  created_at,
  updated_at
FROM public.comment_replies;

-- Enable RLS on the view
ALTER VIEW public.comment_replies_realtime ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for the view
CREATE POLICY "Realtime View: Users can subscribe to their own replies" ON public.comment_replies_realtime
  FOR SELECT USING (auth.uid() = user_id);

-- Enable real-time for the view
ALTER VIEW public.comment_replies_realtime REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_replies_realtime;

-- ============================================================================
-- REAL-TIME EVENT FUNCTIONS
-- ============================================================================

-- Function to notify about comment status changes
CREATE OR REPLACE FUNCTION public.notify_comment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Send notification through pg_notify for WebSocket handling
    PERFORM pg_notify(
      'comment_status_change',
      json_build_object(
        'comment_id', NEW.id,
        'user_id', NEW.user_id,
        'platform', NEW.platform,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', NOW()
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify about new comments
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER AS $$
BEGIN
  -- Send notification for new comments
  PERFORM pg_notify(
    'new_comment',
    json_build_object(
      'comment_id', NEW.id,
      'user_id', NEW.user_id,
      'platform', NEW.platform,
      'platform_post_id', NEW.platform_post_id,
      'content_preview', LEFT(NEW.content, 100),
      'timestamp', NEW.created_at
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify about moderation actions
CREATE OR REPLACE FUNCTION public.notify_moderation_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a moderation-related change
  IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected', 'spam')) THEN
    PERFORM pg_notify(
      'moderation_action',
      json_build_object(
        'comment_id', NEW.id,
        'user_id', NEW.user_id,
        'platform', NEW.platform,
        'action', NEW.status,
        'moderator_id', auth.uid(),
        'timestamp', NOW()
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle real-time connection management
CREATE OR REPLACE FUNCTION public.handle_realtime_connection()
RETURNS TRIGGER AS $$
BEGIN
  -- Log real-time connection for audit purposes
  INSERT INTO public.audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    new_values,
    ip_address
  ) VALUES (
    auth.uid(),
    'REALTIME_CONNECT',
    'realtime_connection',
    COALESCE(auth.uid()::text, 'anonymous'),
    json_build_object(
      'timestamp', NOW(),
      'connection_type', TG_TABLE_NAME
    ),
    inet_client_addr()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REAL-TIME TRIGGERS
-- ============================================================================

-- Trigger for comment status changes
DROP TRIGGER IF EXISTS trg_comment_status_change ON public.comments;
CREATE TRIGGER trg_comment_status_change
  AFTER UPDATE OF status ON public.comments
  FOR EACH ROW 
  EXECUTE FUNCTION public.notify_comment_status_change();

-- Trigger for new comments
DROP TRIGGER IF EXISTS trg_new_comment ON public.comments;
CREATE TRIGGER trg_new_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW 
  EXECUTE FUNCTION public.notify_new_comment();

-- Trigger for moderation actions
DROP TRIGGER IF EXISTS trg_moderation_action ON public.comments;
CREATE TRIGGER trg_moderation_action
  AFTER UPDATE OF status ON public.comments
  FOR EACH ROW 
  EXECUTE FUNCTION public.notify_moderation_action();

-- ============================================================================
-- REAL-TIME SECURITY CONFIGURATIONS
-- ============================================================================

-- Create table for real-time connection tracking
CREATE TABLE IF NOT EXISTS public.realtime_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id text NOT NULL,
  channel_name text NOT NULL,
  connected_at timestamptz DEFAULT NOW(),
  last_activity timestamptz DEFAULT NOW(),
  ip_address inet,
  user_agent text,
  is_active boolean DEFAULT true,
  disconnected_at timestamptz,
  
  UNIQUE(connection_id, channel_name)
);

-- Enable RLS on realtime connections
ALTER TABLE public.realtime_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for realtime connections
CREATE POLICY "Users can view their own connections" ON public.realtime_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all connections" ON public.realtime_connections
  FOR ALL USING (auth.role() = 'service_role');

-- Index for performance
CREATE INDEX idx_realtime_connections_user_active 
ON public.realtime_connections (user_id, is_active, last_activity);

CREATE INDEX idx_realtime_connections_channel_active 
ON public.realtime_connections (channel_name, is_active, last_activity);

-- ============================================================================
-- REAL-TIME RATE LIMITING
-- ============================================================================

-- Create table for real-time rate limiting
CREATE TABLE IF NOT EXISTS public.realtime_rate_limits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  event_type text NOT NULL,
  event_count integer DEFAULT 1,
  window_start timestamptz DEFAULT NOW(),
  last_event timestamptz DEFAULT NOW(),
  
  UNIQUE(user_id, channel_name, event_type, window_start)
);

-- Enable RLS on rate limits
ALTER TABLE public.realtime_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for rate limits
CREATE POLICY "Users can view their own rate limits" ON public.realtime_rate_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all rate limits" ON public.realtime_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- Index for performance
CREATE INDEX idx_realtime_rate_limits_user_window 
ON public.realtime_rate_limits (user_id, window_start, last_event);

-- Function to check real-time rate limits
CREATE OR REPLACE FUNCTION public.check_realtime_rate_limit(
  p_user_id uuid,
  p_channel_name text,
  p_event_type text,
  p_max_events integer DEFAULT 100,
  p_window_minutes integer DEFAULT 60
) RETURNS boolean AS $$
DECLARE
  current_window timestamptz;
  event_count integer;
BEGIN
  -- Calculate current window start
  current_window := date_trunc('hour', NOW()) + 
    (EXTRACT(minute FROM NOW())::integer / p_window_minutes) * (p_window_minutes || ' minutes')::interval;
  
  -- Get current count for this window
  SELECT COALESCE(SUM(event_count), 0) INTO event_count
  FROM public.realtime_rate_limits
  WHERE user_id = p_user_id
    AND channel_name = p_channel_name
    AND event_type = p_event_type
    AND window_start = current_window;
  
  -- Return false if limit exceeded
  IF event_count >= p_max_events THEN
    RETURN false;
  END IF;
  
  -- Update or insert rate limit record
  INSERT INTO public.realtime_rate_limits (
    user_id, channel_name, event_type, window_start, last_event
  ) VALUES (
    p_user_id, p_channel_name, p_event_type, current_window, NOW()
  )
  ON CONFLICT (user_id, channel_name, event_type, window_start)
  DO UPDATE SET
    event_count = realtime_rate_limits.event_count + 1,
    last_event = NOW();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REAL-TIME PRESENCE SYSTEM
-- ============================================================================

-- Create table for user presence in comment threads
CREATE TABLE IF NOT EXISTS public.comment_thread_presence (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  platform_post_id text NOT NULL,
  platform text NOT NULL,
  status text DEFAULT 'viewing' CHECK (status IN ('viewing', 'typing', 'idle', 'away')),
  last_activity timestamptz DEFAULT NOW(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  
  UNIQUE(user_id, comment_id),
  UNIQUE(user_id, platform_post_id, platform)
);

-- Enable RLS on presence
ALTER TABLE public.comment_thread_presence ENABLE ROW LEVEL SECURITY;

-- RLS policies for presence (users can see presence in threads they have access to)
CREATE POLICY "Users can view presence in accessible threads" ON public.comment_thread_presence
  FOR SELECT USING (
    -- User can see presence in threads where they have comments
    EXISTS (
      SELECT 1 FROM public.comments c
      WHERE c.user_id = auth.uid()
        AND c.platform_post_id = comment_thread_presence.platform_post_id
        AND c.platform = comment_thread_presence.platform
    )
    OR
    -- User can see their own presence
    auth.uid() = user_id
  );

CREATE POLICY "Users can manage their own presence" ON public.comment_thread_presence
  FOR ALL USING (auth.uid() = user_id);

-- Enable real-time for presence
ALTER TABLE public.comment_thread_presence REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_thread_presence;

-- Index for performance
CREATE INDEX idx_comment_thread_presence_post_platform 
ON public.comment_thread_presence (platform_post_id, platform, last_activity);

CREATE INDEX idx_comment_thread_presence_user_activity 
ON public.comment_thread_presence (user_id, last_activity);

-- Function to update user presence
CREATE OR REPLACE FUNCTION public.update_user_presence(
  p_comment_id uuid DEFAULT NULL,
  p_platform_post_id text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_status text DEFAULT 'viewing',
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid AS $$
DECLARE
  presence_id uuid;
BEGIN
  -- Validate inputs
  IF p_platform_post_id IS NULL OR p_platform IS NULL THEN
    RAISE EXCEPTION 'platform_post_id and platform are required';
  END IF;
  
  -- Insert or update presence
  INSERT INTO public.comment_thread_presence (
    user_id, comment_id, platform_post_id, platform, status, metadata, updated_at
  ) VALUES (
    auth.uid(), p_comment_id, p_platform_post_id, p_platform, p_status, p_metadata, NOW()
  )
  ON CONFLICT (user_id, platform_post_id, platform)
  DO UPDATE SET
    comment_id = COALESCE(EXCLUDED.comment_id, comment_thread_presence.comment_id),
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    last_activity = NOW(),
    updated_at = NOW()
  RETURNING id INTO presence_id;
  
  RETURN presence_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old presence records
CREATE OR REPLACE FUNCTION public.cleanup_old_presence()
RETURNS void AS $$
BEGIN
  -- Remove presence records older than 1 hour
  DELETE FROM public.comment_thread_presence
  WHERE last_activity < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REAL-TIME PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Create materialized view for real-time dashboard
CREATE MATERIALIZED VIEW public.realtime_stats AS
SELECT 
  platform,
  COUNT(*) as total_comments,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_comments,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_comments,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_comments,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_comments,
  AVG(sentiment_score) as avg_sentiment,
  MAX(created_at) as last_comment_at
FROM public.comments
WHERE deleted_at IS NULL
GROUP BY platform;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_realtime_stats_platform ON public.realtime_stats (platform);

-- Function to refresh real-time stats
CREATE OR REPLACE FUNCTION public.refresh_realtime_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.realtime_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant permissions for real-time functions
GRANT EXECUTE ON FUNCTION public.check_realtime_rate_limit(uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_presence(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_realtime_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_presence() TO service_role;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.realtime_connections TO authenticated;
GRANT SELECT ON public.realtime_rate_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_thread_presence TO authenticated;
GRANT SELECT ON public.realtime_stats TO authenticated;

-- Grant view permissions
GRANT SELECT ON public.comments_realtime TO authenticated;
GRANT SELECT ON public.comment_replies_realtime TO authenticated;

-- ============================================================================
-- SCHEDULED CLEANUP (if pg_cron is available)
-- ============================================================================

-- Clean up old presence records every 30 minutes
-- SELECT cron.schedule('cleanup-presence', '*/30 * * * *', 'SELECT public.cleanup_old_presence();');

-- Refresh real-time stats every 5 minutes
-- SELECT cron.schedule('refresh-realtime-stats', '*/5 * * * *', 'SELECT public.refresh_realtime_stats();');

-- Clean up old rate limit records daily
-- SELECT cron.schedule('cleanup-rate-limits', '0 2 * * *', 'DELETE FROM public.realtime_rate_limits WHERE window_start < NOW() - INTERVAL ''24 hours'';');

-- Clean up old connection records daily
-- SELECT cron.schedule('cleanup-connections', '0 3 * * *', 'DELETE FROM public.realtime_connections WHERE disconnected_at IS NOT NULL AND disconnected_at < NOW() - INTERVAL ''7 days'';');

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Test 1: Verify real-time is enabled
-- SELECT schemaname, tablename 
-- FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime' AND schemaname = 'public';

-- Test 2: Check RLS policies for real-time
-- SELECT tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename LIKE '%comment%' AND policyname LIKE '%Realtime%';

-- Test 3: Verify triggers are active
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE event_object_schema = 'public' AND trigger_name LIKE '%realtime%' OR trigger_name LIKE '%notify%';

-- Test 4: Check materialized view
-- SELECT * FROM public.realtime_stats;

-- Test 5: Test rate limiting function
-- SELECT public.check_realtime_rate_limit(auth.uid(), 'comments:test', 'message', 10, 60);

COMMENT ON TABLE public.realtime_connections IS 'Tracks active real-time WebSocket connections';
COMMENT ON TABLE public.realtime_rate_limits IS 'Manages rate limiting for real-time events';
COMMENT ON TABLE public.comment_thread_presence IS 'Tracks user presence in comment threads';
COMMENT ON VIEW public.comments_realtime IS 'Optimized view for real-time comment subscriptions';
COMMENT ON VIEW public.comment_replies_realtime IS 'Optimized view for real-time reply subscriptions';
COMMENT ON MATERIALIZED VIEW public.realtime_stats IS 'Real-time dashboard statistics';