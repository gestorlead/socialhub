-- Create integration_settings table for managing external platform configurations
CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  
  -- App credentials (encrypted)
  app_id TEXT,
  client_key TEXT,
  client_secret TEXT,
  
  -- Environment settings
  environment VARCHAR(20) DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  is_audited BOOLEAN DEFAULT false,
  
  -- URLs
  webhook_url TEXT,
  callback_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  config_data JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(platform)
);

-- Create index for platform lookups
CREATE INDEX IF NOT EXISTS idx_integration_settings_platform ON integration_settings(platform);
CREATE INDEX IF NOT EXISTS idx_integration_settings_active ON integration_settings(is_active);

-- Create audit log table for configuration changes
CREATE TABLE IF NOT EXISTS integration_settings_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES integration_settings(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete', 'test'
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Create index for audit logs
CREATE INDEX IF NOT EXISTS idx_integration_audit_platform ON integration_settings_audit(platform);
CREATE INDEX IF NOT EXISTS idx_integration_audit_changed_at ON integration_settings_audit(changed_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_settings_audit ENABLE ROW LEVEL SECURITY;

-- Only Super Admins can access integration settings
CREATE POLICY "Super admins can manage integration settings" ON integration_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

-- Only Super Admins can view audit logs
CREATE POLICY "Super admins can view integration audit logs" ON integration_settings_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamp
CREATE TRIGGER trigger_update_integration_settings_updated_at
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_settings_updated_at();

-- Function to log configuration changes
CREATE OR REPLACE FUNCTION log_integration_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO integration_settings_audit (
      integration_id, platform, action, new_values, changed_by
    ) VALUES (
      NEW.id, NEW.platform, 'create', 
      jsonb_build_object(
        'environment', NEW.environment,
        'is_audited', NEW.is_audited,
        'is_active', NEW.is_active
      ),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO integration_settings_audit (
      integration_id, platform, action, old_values, new_values, changed_by
    ) VALUES (
      NEW.id, NEW.platform, 'update',
      jsonb_build_object(
        'environment', OLD.environment,
        'is_audited', OLD.is_audited,
        'is_active', OLD.is_active
      ),
      jsonb_build_object(
        'environment', NEW.environment,
        'is_audited', NEW.is_audited,
        'is_active', NEW.is_active
      ),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO integration_settings_audit (
      integration_id, platform, action, old_values, changed_by
    ) VALUES (
      OLD.id, OLD.platform, 'delete',
      jsonb_build_object(
        'environment', OLD.environment,
        'is_audited', OLD.is_audited,
        'is_active', OLD.is_active
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log changes
CREATE TRIGGER trigger_log_integration_settings_changes
  AFTER INSERT OR UPDATE OR DELETE ON integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION log_integration_settings_changes();

-- Insert default TikTok configuration (will be populated from current .env values)
INSERT INTO integration_settings (platform, environment, is_audited, is_active)
VALUES ('tiktok', 'sandbox', false, true)
ON CONFLICT (platform) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE integration_settings IS 'Stores configuration for external platform integrations (TikTok, Meta, Google, etc.)';
COMMENT ON COLUMN integration_settings.app_id IS 'Platform-specific app identifier (encrypted)';
COMMENT ON COLUMN integration_settings.client_key IS 'OAuth client key/ID (encrypted)';
COMMENT ON COLUMN integration_settings.client_secret IS 'OAuth client secret (encrypted)';
COMMENT ON COLUMN integration_settings.environment IS 'sandbox or production environment';
COMMENT ON COLUMN integration_settings.is_audited IS 'Whether the app has been audited by the platform';
COMMENT ON COLUMN integration_settings.config_data IS 'Additional platform-specific configuration in JSON format';