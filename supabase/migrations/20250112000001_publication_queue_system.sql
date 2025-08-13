-- Migration: Publication Queue System with pgmq and Realtime
-- Implements a background job processing system for social media publications

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create publication_jobs table
CREATE TABLE IF NOT EXISTS publication_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'facebook', 'instagram', 'youtube', 'threads', 'x', 'linkedin')),
  content jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  platform_response jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Ensure jobs don't stay processing forever
  CONSTRAINT processing_timeout CHECK (
    status != 'processing' OR 
    started_at > now() - interval '30 minutes'
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS publication_jobs_user_id_idx ON publication_jobs(user_id);
CREATE INDEX IF NOT EXISTS publication_jobs_status_idx ON publication_jobs(status);
CREATE INDEX IF NOT EXISTS publication_jobs_platform_idx ON publication_jobs(platform);
CREATE INDEX IF NOT EXISTS publication_jobs_created_at_idx ON publication_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS publication_jobs_retry_idx ON publication_jobs(status, retry_count) WHERE status = 'failed';

-- Enable Row Level Security
ALTER TABLE publication_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own publication jobs" 
  ON publication_jobs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own publication jobs" 
  ON publication_jobs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update publication jobs" 
  ON publication_jobs FOR UPDATE 
  USING (true);

-- Enable Realtime for publication_jobs table
ALTER PUBLICATION supabase_realtime ADD TABLE publication_jobs;

-- Create pgmq queue for publication jobs
SELECT pgmq.create('publication_queue');

-- Function to safely get app setting with fallback
CREATE OR REPLACE FUNCTION get_app_setting(setting_name text, fallback_value text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  setting_value text;
BEGIN
  BEGIN
    SELECT current_setting('app.settings.' || setting_name, true) INTO setting_value;
    IF setting_value IS NULL OR setting_value = '' THEN
      setting_value := fallback_value;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    setting_value := fallback_value;
  END;
  
  RETURN setting_value;
END;
$$;

-- Function to process publication jobs from the queue
CREATE OR REPLACE FUNCTION process_publication_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record record;
  queue_message record;
  base_url text;
  processing_count integer;
  max_concurrent integer := 5; -- Maximum concurrent jobs
BEGIN
  -- Check how many jobs are currently processing
  SELECT COUNT(*) INTO processing_count 
  FROM publication_jobs 
  WHERE status = 'processing' 
    AND started_at > now() - interval '30 minutes';
  
  -- Don't process more if we're at capacity
  IF processing_count >= max_concurrent THEN
    RETURN;
  END IF;
  
  -- Get base URL for API calls
  base_url := get_app_setting('base_url', 'http://localhost:3000');
  
  -- Read messages from the queue (max 5 per run to prevent overload)
  FOR queue_message IN 
    SELECT msg_id, message 
    FROM pgmq.read('publication_queue', 300, least(5, max_concurrent - processing_count))
  LOOP
    -- Get the job record
    SELECT * INTO job_record 
    FROM publication_jobs 
    WHERE id = (queue_message.message->>'job_id')::uuid;
    
    IF FOUND AND job_record.status = 'pending' THEN
      -- Update status to processing
      UPDATE publication_jobs 
      SET status = 'processing', 
          started_at = now(),
          retry_count = retry_count + 1
      WHERE id = job_record.id;
      
      -- Make async HTTP request to process the job
      PERFORM net.http_post(
        url := base_url || '/api/internal/process-publication',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || get_app_setting('service_role_key', '')
        ),
        body := jsonb_build_object(
          'job_id', job_record.id,
          'user_id', job_record.user_id,
          'platform', job_record.platform,
          'content', job_record.content,
          'metadata', job_record.metadata
        ),
        timeout_milliseconds := 300000 -- 5 minutes timeout
      );
      
      -- Remove message from queue (will be re-queued if processing fails)
      PERFORM pgmq.delete('publication_queue', queue_message.msg_id);
    ELSE
      -- Job not found or not in pending status, remove from queue
      PERFORM pgmq.delete('publication_queue', queue_message.msg_id);
    END IF;
  END LOOP;
  
  -- Clean up stale processing jobs (older than 30 minutes)
  UPDATE publication_jobs 
  SET status = 'failed',
      completed_at = now(),
      error_message = 'Job timed out during processing'
  WHERE status = 'processing' 
    AND started_at < now() - interval '30 minutes';
    
END;
$$;

-- Function to retry failed jobs that haven't exceeded max retries
CREATE OR REPLACE FUNCTION retry_failed_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Re-queue failed jobs that haven't exceeded max retries
  INSERT INTO pgmq.publication_queue (message)
  SELECT jsonb_build_object('job_id', id)
  FROM publication_jobs 
  WHERE status = 'failed' 
    AND retry_count < max_retries
    AND completed_at < now() - interval '5 minutes'; -- Wait 5 minutes before retry
    
  -- Update status back to pending for retry
  UPDATE publication_jobs 
  SET status = 'pending',
      started_at = NULL,
      error_message = NULL
  WHERE status = 'failed' 
    AND retry_count < max_retries
    AND completed_at < now() - interval '5 minutes';
END;
$$;

-- Schedule the job processor to run every 10 seconds
SELECT cron.schedule(
  'process-publication-jobs',
  '*/10 * * * * *', -- Every 10 seconds
  'SELECT process_publication_jobs();'
);

-- Schedule retry of failed jobs every 5 minutes
SELECT cron.schedule(
  'retry-failed-publication-jobs',
  '*/5 * * * *', -- Every 5 minutes
  'SELECT retry_failed_jobs();'
);

-- Schedule cleanup of old completed jobs (keep for 7 days)
SELECT cron.schedule(
  'cleanup-old-publication-jobs',
  '0 2 * * *', -- Daily at 2 AM
  'DELETE FROM publication_jobs WHERE completed_at < now() - interval ''7 days'' AND status IN (''completed'', ''failed'');'
);

-- Function to enqueue a publication job
CREATE OR REPLACE FUNCTION enqueue_publication_job(
  p_user_id uuid,
  p_platform text,
  p_content jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_id uuid;
BEGIN
  -- Insert the job
  INSERT INTO publication_jobs (user_id, platform, content, metadata)
  VALUES (p_user_id, p_platform, p_content, p_metadata)
  RETURNING id INTO job_id;
  
  -- Add to queue
  PERFORM pgmq.send('publication_queue', jsonb_build_object('job_id', job_id));
  
  RETURN job_id;
END;
$$;

-- Function to get job status with details
CREATE OR REPLACE FUNCTION get_job_status(p_job_id uuid)
RETURNS TABLE (
  id uuid,
  platform text,
  status text,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer,
  max_retries integer,
  platform_response jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pj.id,
    pj.platform,
    pj.status,
    pj.created_at,
    pj.started_at,
    pj.completed_at,
    pj.error_message,
    pj.retry_count,
    pj.max_retries,
    pj.platform_response
  FROM publication_jobs pj
  WHERE pj.id = p_job_id
    AND pj.user_id = auth.uid();
END;
$$;

-- Function to get queue metrics
CREATE OR REPLACE FUNCTION get_queue_metrics()
RETURNS TABLE (
  queue_length bigint,
  pending_jobs bigint,
  processing_jobs bigint,
  completed_jobs_last_hour bigint,
  failed_jobs_last_hour bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT queue_length FROM pgmq.metrics('publication_queue')),
    (SELECT COUNT(*) FROM publication_jobs WHERE status = 'pending'),
    (SELECT COUNT(*) FROM publication_jobs WHERE status = 'processing'),
    (SELECT COUNT(*) FROM publication_jobs 
     WHERE status = 'completed' AND completed_at > now() - interval '1 hour'),
    (SELECT COUNT(*) FROM publication_jobs 
     WHERE status = 'failed' AND completed_at > now() - interval '1 hour');
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA pgmq TO authenticated;
GRANT EXECUTE ON FUNCTION enqueue_publication_job TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_queue_metrics TO authenticated;

-- Create app settings if they don't exist
DO $$
BEGIN
  -- Set default base URL for local development
  -- This should be updated in production
  PERFORM set_config('app.settings.base_url', 'http://localhost:3000', false);
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors if setting already exists
END;
$$;

-- Add helpful comments
COMMENT ON TABLE publication_jobs IS 'Jobs for publishing content to social media platforms';
COMMENT ON FUNCTION process_publication_jobs() IS 'Processes pending publication jobs from the queue';
COMMENT ON FUNCTION enqueue_publication_job(uuid, text, jsonb, jsonb) IS 'Enqueues a new publication job';
COMMENT ON FUNCTION get_job_status(uuid) IS 'Gets the status and details of a publication job';
COMMENT ON FUNCTION get_queue_metrics() IS 'Gets metrics about the publication queue';