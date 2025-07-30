-- OAuth Security Tables
-- Creates tables for secure OAuth state management and security logging

-- OAuth States table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state VARCHAR(512) NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('instagram', 'facebook', 'twitter', 'linkedin')),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Indexes for performance
  INDEX idx_oauth_states_state ON oauth_states(state),
  INDEX idx_oauth_states_provider_expires ON oauth_states(provider, expires_at),
  INDEX idx_oauth_states_expires ON oauth_states(expires_at)
);

-- Security audit log for OAuth events
CREATE TABLE IF NOT EXISTS oauth_security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  provider VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for security analysis
  INDEX idx_oauth_security_logs_event_type ON oauth_security_logs(event_type),
  INDEX idx_oauth_security_logs_created_at ON oauth_security_logs(created_at),
  INDEX idx_oauth_security_logs_severity ON oauth_security_logs(severity),
  INDEX idx_oauth_security_logs_ip ON oauth_security_logs(ip_address),
  INDEX idx_oauth_security_logs_user_id ON oauth_security_logs(user_id)
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id VARCHAR(255) PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index for cleanup
  INDEX idx_rate_limits_reset_time ON rate_limits(reset_time)
);

-- Webhook security logs
CREATE TABLE IF NOT EXISTS webhook_security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  signature_valid BOOLEAN,
  ip_address INET,
  payload_hash VARCHAR(64), -- SHA-256 hash of payload
  user_agent TEXT,
  headers JSONB,
  details JSONB,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for security analysis
  INDEX idx_webhook_security_logs_provider ON webhook_security_logs(provider),
  INDEX idx_webhook_security_logs_event_type ON webhook_security_logs(event_type),
  INDEX idx_webhook_security_logs_created_at ON webhook_security_logs(created_at),
  INDEX idx_webhook_security_logs_severity ON webhook_security_logs(severity),
  INDEX idx_webhook_security_logs_signature_valid ON webhook_security_logs(signature_valid)
);

-- Enable RLS on all security tables
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_security_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for OAuth states (system access only)
CREATE POLICY "System can manage oauth states" ON oauth_states
  FOR ALL USING (true);

-- RLS Policies for security logs (Super Admins only)
CREATE POLICY "Super admins can view oauth security logs" ON oauth_security_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

CREATE POLICY "System can insert oauth security logs" ON oauth_security_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for rate limits (system access only)
CREATE POLICY "System can manage rate limits" ON rate_limits
  FOR ALL USING (true);

-- RLS Policies for webhook logs (Super Admins only)
CREATE POLICY "Super admins can view webhook security logs" ON webhook_security_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

CREATE POLICY "System can insert webhook security logs" ON webhook_security_logs
  FOR INSERT WITH CHECK (true);

-- Function to cleanup expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE reset_time < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old security logs (keep for 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_security_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM webhook_security_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to log OAuth security events
CREATE OR REPLACE FUNCTION log_oauth_security_event(
  p_event_type VARCHAR(100),
  p_provider VARCHAR(50) DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_severity VARCHAR(20) DEFAULT 'info'
)
RETURNS void AS $$
BEGIN
  INSERT INTO oauth_security_logs (
    event_type, provider, ip_address, user_agent, user_id, details, severity
  ) VALUES (
    p_event_type, p_provider, p_ip_address, p_user_agent, p_user_id, p_details, p_severity
  );
END;
$$ LANGUAGE plpgsql;

-- Function to log webhook security events
CREATE OR REPLACE FUNCTION log_webhook_security_event(
  p_provider VARCHAR(50),
  p_event_type VARCHAR(100),
  p_signature_valid BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_payload_hash VARCHAR(64) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_headers JSONB DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_severity VARCHAR(20) DEFAULT 'info'
)
RETURNS void AS $$
BEGIN
  INSERT INTO webhook_security_logs (
    provider, event_type, signature_valid, ip_address, payload_hash, 
    user_agent, headers, details, severity
  ) VALUES (
    p_provider, p_event_type, p_signature_valid, p_ip_address, 
    p_payload_hash, p_user_agent, p_headers, p_details, p_severity
  );
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE oauth_states IS 'Stores OAuth state parameters for CSRF protection';
COMMENT ON TABLE oauth_security_logs IS 'Logs OAuth security events for monitoring and analysis';
COMMENT ON TABLE rate_limits IS 'Stores rate limiting data for OAuth endpoints';
COMMENT ON TABLE webhook_security_logs IS 'Logs webhook security events for monitoring';

COMMENT ON COLUMN oauth_states.state IS 'Cryptographically secure random state parameter';
COMMENT ON COLUMN oauth_states.data IS 'Encrypted OAuth session data including PKCE parameters';
COMMENT ON COLUMN oauth_security_logs.event_type IS 'Type of security event (e.g., invalid_state, rate_limit_exceeded)';
COMMENT ON COLUMN webhook_security_logs.signature_valid IS 'Whether HMAC signature validation passed';
COMMENT ON COLUMN webhook_security_logs.payload_hash IS 'SHA-256 hash of webhook payload for deduplication';