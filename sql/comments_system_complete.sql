-- ============================================================================
-- COMMENTS SYSTEM - DATABASE SCHEMA & SECURITY IMPLEMENTATION
-- Phase 1, Step 1.1: Database Schema & Security
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- ============================================================================
-- MAIN TABLES
-- ============================================================================

-- Tabela principal de comentários com particionamento
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
  platform_comment_id text NOT NULL,
  platform_post_id text NOT NULL,
  platform_user_id text NOT NULL,
  author_username text CHECK (char_length(author_username) <= 100),
  author_profile_picture text,
  content text NOT NULL CHECK (char_length(content) <= 10000),
  content_hash text NOT NULL,
  thread_path ltree,
  reply_to_comment_id uuid REFERENCES public.comments(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  sentiment_score decimal(3,2) CHECK (sentiment_score >= -1.00 AND sentiment_score <= 1.00),
  engagement_metrics jsonb DEFAULT '{}',
  moderation_flags text[] DEFAULT '{}',
  created_at_platform timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  UNIQUE(platform, platform_comment_id),
  CONSTRAINT valid_url CHECK (
    author_profile_picture IS NULL OR 
    author_profile_picture ~* '^https?://[^\s/$.?#].[^\s]*$'
  )
) PARTITION BY RANGE (created_at);

-- Tabela de respostas automáticas
CREATE TABLE IF NOT EXISTS public.comment_replies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  platform_reply_id text,
  content text NOT NULL CHECK (char_length(content) <= 2000),
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'pending', 'failed')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de posts/conteúdo para referência
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  platform_post_id text NOT NULL,
  platform_user_id text NOT NULL,
  title text,
  description text,
  url text,
  thumbnail_url text,
  post_type text CHECK (post_type IN ('image', 'video', 'carousel', 'reel', 'story')),
  metrics jsonb DEFAULT '{}',
  created_at_platform timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(platform, platform_post_id)
);

-- Tabela de configurações de moderação
CREATE TABLE IF NOT EXISTS public.comment_moderation_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  auto_approve boolean DEFAULT false,
  keywords_block text[] DEFAULT '{}',
  keywords_flag text[] DEFAULT '{}',
  sentiment_threshold decimal(3,2) DEFAULT -0.5,
  spam_detection_enabled boolean DEFAULT true,
  auto_reply_enabled boolean DEFAULT false,
  auto_reply_templates jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, platform)
);

-- ============================================================================
-- AUDIT TRAIL SYSTEM
-- ============================================================================

-- Tabela de audit trail
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  retention_date timestamptz DEFAULT (now() + interval '7 years')
);

-- ============================================================================
-- PARTITIONING SETUP
-- ============================================================================

-- Criar partições mensais para comments (últimos 12 meses + próximos 3 meses)
DO $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
    i integer;
BEGIN
    -- Criar partições para os últimos 12 meses
    FOR i IN 0..14 LOOP
        start_date := date_trunc('month', CURRENT_DATE - interval '12 months' + interval '1 month' * i);
        end_date := start_date + interval '1 month';
        partition_name := 'comments_' || to_char(start_date, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.comments
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
    END LOOP;
END $$;

-- ============================================================================
-- INDEXES OPTIMIZATION
-- ============================================================================

-- Índices principais para performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_user_platform_date 
ON public.comments (user_id, platform, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_platform_post 
ON public.comments (platform, platform_post_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_thread_path 
ON public.comments USING GIST (thread_path);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_search 
ON public.comments USING GIN (to_tsvector('english', content));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_status_platform 
ON public.comments (status, platform, created_at DESC) 
WHERE status IN ('pending', 'approved');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_sentiment 
ON public.comments (sentiment_score, platform, created_at DESC) 
WHERE sentiment_score IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_moderation_flags 
ON public.comments USING GIN (moderation_flags) 
WHERE array_length(moderation_flags, 1) > 0;

-- Índices para comment_replies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_replies_comment_id 
ON public.comment_replies (comment_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_replies_user_platform 
ON public.comment_replies (user_id, platform, created_at DESC);

-- Índices para social_posts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_user_platform 
ON public.social_posts (user_id, platform, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_platform_user 
ON public.social_posts (platform, platform_user_id, created_at DESC);

-- Índices para audit_log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_action 
ON public.audit_log (user_id, action, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_resource 
ON public.audit_log (resource_type, resource_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_retention 
ON public.audit_log (retention_date) 
WHERE retention_date < now();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_moderation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;

-- Comments RLS Policies
CREATE POLICY "Users can view their own comments" ON public.comments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- Comment Replies RLS Policies
CREATE POLICY "Users can view their own comment replies" ON public.comment_replies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own comment replies" ON public.comment_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment replies" ON public.comment_replies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comment replies" ON public.comment_replies
  FOR DELETE USING (auth.uid() = user_id);

-- Social Posts RLS Policies
CREATE POLICY "Users can view their own social posts" ON public.social_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social posts" ON public.social_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social posts" ON public.social_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social posts" ON public.social_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Moderation Settings RLS Policies
CREATE POLICY "Users can view their own moderation settings" ON public.comment_moderation_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own moderation settings" ON public.comment_moderation_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own moderation settings" ON public.comment_moderation_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own moderation settings" ON public.comment_moderation_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Audit Log RLS Policies (more restrictive)
CREATE POLICY "Users can view their own audit logs" ON public.audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage audit logs" ON public.audit_log
  FOR ALL USING (auth.role() = 'service_role');

-- Admin policies for moderation
CREATE POLICY "Admins can view all comments for moderation" ON public.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 2
    )
  );

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to calculate content hash
CREATE OR REPLACE FUNCTION public.calculate_content_hash(content text)
RETURNS text AS $$
BEGIN
  RETURN encode(digest(content, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update thread path for nested comments
CREATE OR REPLACE FUNCTION public.update_comment_thread_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reply_to_comment_id IS NOT NULL THEN
    -- Get parent thread path and append current comment ID
    SELECT COALESCE(thread_path, ''::ltree) || NEW.id::text::ltree
    INTO NEW.thread_path
    FROM public.comments
    WHERE id = NEW.reply_to_comment_id;
  ELSE
    -- Root comment, create new path
    NEW.thread_path = NEW.id::text::ltree;
  END IF;
  
  -- Calculate content hash
  NEW.content_hash = public.calculate_content_hash(NEW.content);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log audit trail
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (
      user_id, action, resource_type, resource_id, old_values, ip_address, user_agent
    ) VALUES (
      OLD.user_id, TG_OP, TG_TABLE_NAME, OLD.id::text, 
      row_to_json(OLD), inet_client_addr(), current_setting('request.headers', true)::json->>'user-agent'
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (
      user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent
    ) VALUES (
      NEW.user_id, TG_OP, TG_TABLE_NAME, NEW.id::text, 
      row_to_json(OLD), row_to_json(NEW), inet_client_addr(), current_setting('request.headers', true)::json->>'user-agent'
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      user_id, action, resource_type, resource_id, new_values, ip_address, user_agent
    ) VALUES (
      NEW.user_id, TG_OP, TG_TABLE_NAME, NEW.id::text, 
      row_to_json(NEW), inet_client_addr(), current_setting('request.headers', true)::json->>'user-agent'
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_log 
  WHERE retention_date < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create monthly partitions automatically
CREATE OR REPLACE FUNCTION public.create_monthly_partition(target_date date DEFAULT CURRENT_DATE)
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', target_date);
    end_date := start_date + interval '1 month';
    partition_name := 'comments_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.comments
                   FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for thread path and content hash
DROP TRIGGER IF EXISTS trg_comments_thread_path ON public.comments;
CREATE TRIGGER trg_comments_thread_path
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_thread_path();

-- Audit trail triggers
DROP TRIGGER IF EXISTS trg_comments_audit ON public.comments;
CREATE TRIGGER trg_comments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS trg_comment_replies_audit ON public.comment_replies;
CREATE TRIGGER trg_comment_replies_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.comment_replies
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.comments;
CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_comment_replies_updated_at ON public.comment_replies;
CREATE TRIGGER trg_comment_replies_updated_at
  BEFORE UPDATE ON public.comment_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_social_posts_updated_at ON public.social_posts;
CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_comment_moderation_settings_updated_at ON public.comment_moderation_settings;
CREATE TRIGGER trg_comment_moderation_settings_updated_at
  BEFORE UPDATE ON public.comment_moderation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default moderation settings for existing users
INSERT INTO public.comment_moderation_settings (user_id, platform, auto_approve, sentiment_threshold)
SELECT DISTINCT 
  sc.user_id, 
  sc.platform,
  false,
  -0.5
FROM public.social_connections sc
LEFT JOIN public.comment_moderation_settings cms ON (cms.user_id = sc.user_id AND cms.platform = sc.platform)
WHERE cms.id IS NULL
ON CONFLICT (user_id, platform) DO NOTHING;

-- ============================================================================
-- PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Set table storage parameters for better performance
ALTER TABLE public.comments SET (
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE public.comment_replies SET (
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.2
);

ALTER TABLE public.audit_log SET (
  fillfactor = 100,
  autovacuum_vacuum_scale_factor = 0.05
);

-- ============================================================================
-- SCHEDULED MAINTENANCE (if pg_cron is available)
-- ============================================================================

-- Clean up old audit logs daily at 2 AM
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT public.cleanup_old_audit_logs();');

-- Create next month's partition on the 25th of each month
-- SELECT cron.schedule('create-next-partition', '0 0 25 * *', 'SELECT public.create_monthly_partition(CURRENT_DATE + interval ''1 month'');');

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_moderation_settings TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION public.calculate_content_hash(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_monthly_partition(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs() TO service_role;

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- These queries can be used to validate the implementation

-- Test 1: RLS functional (should return 0 for non-owners)
-- SELECT COUNT(*) FROM public.comments WHERE user_id != auth.uid();

-- Test 2: Indexes created
-- SELECT indexname FROM pg_indexes WHERE tablename = 'comments' AND schemaname = 'public';

-- Test 3: Partitioning active
-- SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE 'comments_%' AND schemaname = 'public';

-- Test 4: Triggers functional
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE event_object_schema = 'public' AND event_object_table LIKE '%comment%';

-- Test 5: RLS policies active
-- SELECT tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename LIKE '%comment%';

COMMENT ON TABLE public.comments IS 'Main comments table with partitioning and full audit trail';
COMMENT ON TABLE public.comment_replies IS 'User replies to comments with status tracking';
COMMENT ON TABLE public.social_posts IS 'Social media posts reference table';
COMMENT ON TABLE public.comment_moderation_settings IS 'Per-user moderation configuration';
COMMENT ON TABLE public.audit_log IS 'Complete audit trail for all operations';