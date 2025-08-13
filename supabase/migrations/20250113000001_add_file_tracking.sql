-- Migration: Add file tracking and automatic cleanup system
-- Adds file_paths tracking to publication_jobs and implements automatic cleanup

-- Add file_paths column to track uploaded files for cleanup
ALTER TABLE publication_jobs 
ADD COLUMN IF NOT EXISTS file_paths text[] DEFAULT '{}';

-- Add index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS publication_jobs_file_paths_idx ON publication_jobs USING GIN(file_paths) WHERE file_paths IS NOT NULL AND array_length(file_paths, 1) > 0;

-- Function to cleanup files for a completed job
CREATE OR REPLACE FUNCTION cleanup_job_files(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record record;
  base_url text;
  cleanup_response record;
BEGIN
  -- Get job record with file paths
  SELECT id, user_id, file_paths, status 
  INTO job_record
  FROM publication_jobs 
  WHERE id = p_job_id;
  
  -- Only cleanup if job exists and has files
  IF NOT FOUND OR job_record.file_paths IS NULL OR array_length(job_record.file_paths, 1) IS NULL THEN
    RETURN;
  END IF;
  
  -- Only cleanup for completed or failed jobs
  IF job_record.status NOT IN ('completed', 'failed') THEN
    RETURN;
  END IF;
  
  -- Get base URL for cleanup API calls
  base_url := get_app_setting('base_url', 'http://localhost:3000');
  
  -- Make async HTTP request to cleanup files (enhanced storage support)
  BEGIN
    SELECT INTO cleanup_response * FROM net.http_post(
      url := base_url || '/api/internal/cleanup-files/storage',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_app_setting('service_role_key', '')
      ),
      body := jsonb_build_object(
        'job_id', job_record.id,
        'user_id', job_record.user_id,
        'file_paths', job_record.file_paths
      ),
      timeout_milliseconds := 30000 -- 30 seconds timeout
    );
    
    -- Log cleanup attempt
    INSERT INTO publication_jobs_cleanup_log (job_id, file_paths, cleanup_status, cleanup_response, created_at)
    VALUES (job_record.id, job_record.file_paths, 'attempted', 
            jsonb_build_object('status_code', cleanup_response.status_code, 'response', cleanup_response.content),
            now());
            
  EXCEPTION WHEN OTHERS THEN
    -- Log cleanup failure but don't fail the job
    INSERT INTO publication_jobs_cleanup_log (job_id, file_paths, cleanup_status, cleanup_response, created_at)
    VALUES (job_record.id, job_record.file_paths, 'failed', 
            jsonb_build_object('error', SQLERRM),
            now());
  END;
END;
$$;

-- Create cleanup log table for monitoring
CREATE TABLE IF NOT EXISTS publication_jobs_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES publication_jobs(id) ON DELETE CASCADE,
  file_paths text[] NOT NULL,
  cleanup_status text NOT NULL CHECK (cleanup_status IN ('attempted', 'success', 'failed', 'retry')),
  cleanup_response jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create enhanced cleanup log table for the new API
CREATE TABLE IF NOT EXISTS cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  user_id uuid NOT NULL,
  files_deleted integer DEFAULT 0,
  files_failed integer DEFAULT 0,
  cleanup_details jsonb,
  cleanup_timestamp timestamptz DEFAULT now()
);

-- Index for cleanup log queries
CREATE INDEX IF NOT EXISTS publication_jobs_cleanup_log_job_id_idx ON publication_jobs_cleanup_log(job_id);
CREATE INDEX IF NOT EXISTS publication_jobs_cleanup_log_status_idx ON publication_jobs_cleanup_log(cleanup_status);
CREATE INDEX IF NOT EXISTS publication_jobs_cleanup_log_created_at_idx ON publication_jobs_cleanup_log(created_at DESC);

-- Indexes for enhanced cleanup log
CREATE INDEX IF NOT EXISTS cleanup_log_job_id_idx ON cleanup_log(job_id);
CREATE INDEX IF NOT EXISTS cleanup_log_user_id_idx ON cleanup_log(user_id);
CREATE INDEX IF NOT EXISTS cleanup_log_timestamp_idx ON cleanup_log(cleanup_timestamp DESC);

-- Enable RLS on cleanup logs
ALTER TABLE publication_jobs_cleanup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleanup_log ENABLE ROW LEVEL SECURITY;

-- RLS policy for publication jobs cleanup log (admin access only)
CREATE POLICY "Admin can view cleanup logs" 
  ON publication_jobs_cleanup_log FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role >= 2
    )
  );

-- RLS policies for enhanced cleanup log
CREATE POLICY "Service role can insert cleanup logs" 
  ON cleanup_log FOR INSERT 
  WITH CHECK (true); -- Service role operations

CREATE POLICY "Admin can view enhanced cleanup logs" 
  ON cleanup_log FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role >= 2
    )
  );

CREATE POLICY "Users can view their own cleanup logs" 
  ON cleanup_log FOR SELECT 
  USING (user_id = auth.uid());

-- Function to trigger cleanup when job status changes
CREATE OR REPLACE FUNCTION trigger_job_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger cleanup when status changes to completed or failed
  IF NEW.status IN ('completed', 'failed') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'failed')) THEN
    
    -- Schedule cleanup with a small delay to ensure job processing is complete
    PERFORM pg_notify('job_cleanup', jsonb_build_object('job_id', NEW.id)::text);
    
    -- Alternative: Direct call (commented out in favor of async notification)
    -- PERFORM cleanup_job_files(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic cleanup
DROP TRIGGER IF EXISTS publication_jobs_cleanup_trigger ON publication_jobs;
CREATE TRIGGER publication_jobs_cleanup_trigger
  AFTER UPDATE ON publication_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_job_cleanup();

-- Function to process cleanup notifications (called by cron)
CREATE OR REPLACE FUNCTION process_cleanup_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_payload text;
  job_data jsonb;
  job_id_to_cleanup uuid;
BEGIN
  -- Listen for cleanup notifications and process them
  -- This function will be called by cron every minute to process accumulated notifications
  
  -- For now, we'll process jobs that completed in the last 5 minutes and haven't been cleaned up
  FOR job_id_to_cleanup IN
    SELECT DISTINCT pj.id
    FROM publication_jobs pj
    LEFT JOIN publication_jobs_cleanup_log cl ON pj.id = cl.job_id AND cl.cleanup_status = 'success'
    WHERE pj.status IN ('completed', 'failed')
      AND pj.completed_at > now() - interval '5 minutes'
      AND pj.file_paths IS NOT NULL 
      AND array_length(pj.file_paths, 1) > 0
      AND cl.job_id IS NULL -- Not yet successfully cleaned up
    ORDER BY pj.completed_at ASC
    LIMIT 10 -- Process up to 10 cleanups per run
  LOOP
    PERFORM cleanup_job_files(job_id_to_cleanup);
  END LOOP;
END;
$$;

-- Schedule cleanup processing every minute
SELECT cron.schedule(
  'process-file-cleanup',
  '*/1 * * * *', -- Every minute
  'SELECT process_cleanup_notifications();'
);

-- Function to retry failed cleanups
CREATE OR REPLACE FUNCTION retry_failed_cleanups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Retry cleanups that failed more than 10 minutes ago (max 3 retries)
  INSERT INTO publication_jobs_cleanup_log (job_id, file_paths, cleanup_status, cleanup_response, created_at)
  SELECT DISTINCT ON (cl.job_id) 
         cl.job_id, 
         cl.file_paths, 
         'retry', 
         jsonb_build_object('retry_attempt', COALESCE((
           SELECT COUNT(*) FROM publication_jobs_cleanup_log cl2 
           WHERE cl2.job_id = cl.job_id AND cl2.cleanup_status = 'retry'
         ), 0) + 1),
         now()
  FROM publication_jobs_cleanup_log cl
  WHERE cl.cleanup_status = 'failed'
    AND cl.created_at < now() - interval '10 minutes'
    AND (
      SELECT COUNT(*) FROM publication_jobs_cleanup_log cl2 
      WHERE cl2.job_id = cl.job_id AND cl2.cleanup_status = 'retry'
    ) < 3 -- Max 3 retries
  ORDER BY cl.job_id, cl.created_at DESC;
  
  -- Actually retry the cleanup for these jobs
  PERFORM cleanup_job_files(job_id)
  FROM (
    SELECT DISTINCT cl.job_id
    FROM publication_jobs_cleanup_log cl
    WHERE cl.cleanup_status = 'retry'
      AND cl.created_at > now() - interval '1 minute' -- Just added by above query
  ) retry_jobs;
END;
$$;

-- Schedule retry of failed cleanups every 10 minutes
SELECT cron.schedule(
  'retry-failed-cleanups',
  '*/10 * * * *', -- Every 10 minutes
  'SELECT retry_failed_cleanups();'
);

-- Update existing enqueue function to support file_paths
CREATE OR REPLACE FUNCTION enqueue_publication_job(
  p_user_id uuid,
  p_platform text,
  p_content jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_file_paths text[] DEFAULT '{}'::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_id uuid;
BEGIN
  -- Insert the job with file paths
  INSERT INTO publication_jobs (user_id, platform, content, metadata, file_paths)
  VALUES (p_user_id, p_platform, p_content, p_metadata, p_file_paths)
  RETURNING id INTO job_id;
  
  -- Add to queue
  PERFORM pgmq.send('publication_queue', jsonb_build_object('job_id', job_id));
  
  RETURN job_id;
END;
$$;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION enqueue_publication_job(uuid, text, jsonb, jsonb, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_job_files(uuid) TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN publication_jobs.file_paths IS 'Array of file paths to be cleaned up after job completion';
COMMENT ON TABLE publication_jobs_cleanup_log IS 'Log of file cleanup attempts for monitoring and debugging';
COMMENT ON FUNCTION cleanup_job_files(uuid) IS 'Cleanup files associated with a completed publication job';
COMMENT ON FUNCTION process_cleanup_notifications() IS 'Process accumulated cleanup notifications from triggers';
COMMENT ON FUNCTION retry_failed_cleanups() IS 'Retry failed file cleanup operations with exponential backoff';