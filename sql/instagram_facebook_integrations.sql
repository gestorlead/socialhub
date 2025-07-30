-- Create Instagram settings table
CREATE TABLE IF NOT EXISTS instagram_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- App credentials
  app_id TEXT,
  app_secret TEXT,
  access_token TEXT,
  instagram_business_account_id TEXT,
  
  -- API configuration
  api_version VARCHAR(10) DEFAULT 'v18.0',
  environment VARCHAR(20) DEFAULT 'development' CHECK (environment IN ('development', 'production')),
  
  -- OAuth settings
  oauth_redirect_uri TEXT,
  
  -- Webhook settings
  webhook_url TEXT,
  webhook_verify_token TEXT,
  
  -- Permissions
  permissions JSONB DEFAULT '["instagram_basic", "instagram_content_publish", "instagram_manage_insights"]',
  
  -- Content types configuration
  content_types JSONB DEFAULT '{
    "posts": true,
    "stories": true,
    "reels": true,
    "igtv": false
  }',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps and audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create Facebook settings table
CREATE TABLE IF NOT EXISTS facebook_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- App credentials
  app_id TEXT,
  app_secret TEXT,
  access_token TEXT,
  
  -- API configuration
  api_version VARCHAR(10) DEFAULT 'v18.0',
  environment VARCHAR(20) DEFAULT 'development' CHECK (environment IN ('development', 'production')),
  
  -- OAuth settings
  oauth_redirect_uri TEXT,
  
  -- Webhook settings
  webhook_url TEXT,
  webhook_verify_token TEXT,
  
  -- Permissions
  permissions JSONB DEFAULT '["pages_show_list", "pages_read_engagement", "pages_manage_posts"]',
  
  -- Facebook Pages
  pages JSONB DEFAULT '[]',
  
  -- Privacy settings
  privacy_settings JSONB DEFAULT '{
    "default_privacy": "PUBLIC",
    "allow_message_replies": true,
    "restrict_location": false
  }',
  
  -- Scheduling settings
  scheduling JSONB DEFAULT '{
    "enabled": true,
    "max_scheduled_posts": 50,
    "min_schedule_minutes": 10
  }',
  
  -- Audience targeting
  audience_targeting JSONB DEFAULT '{
    "enabled": false,
    "default_age_min": 18,
    "default_age_max": 65,
    "default_countries": []
  }',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps and audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_instagram_settings_active ON instagram_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_instagram_settings_environment ON instagram_settings(environment);

CREATE INDEX IF NOT EXISTS idx_facebook_settings_active ON facebook_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_facebook_settings_environment ON facebook_settings(environment);

-- Enable RLS (Row Level Security)
ALTER TABLE instagram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only Super Admins can access these settings
CREATE POLICY "Super admins can manage instagram settings" ON instagram_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

CREATE POLICY "Super admins can manage facebook settings" ON facebook_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_instagram_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_facebook_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update timestamps
CREATE TRIGGER trigger_update_instagram_settings_updated_at
  BEFORE UPDATE ON instagram_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_instagram_settings_updated_at();

CREATE TRIGGER trigger_update_facebook_settings_updated_at
  BEFORE UPDATE ON facebook_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_facebook_settings_updated_at();

-- Create audit tables for both platforms
CREATE TABLE IF NOT EXISTS instagram_settings_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_settings_id UUID REFERENCES instagram_settings(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete', 'test'
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS facebook_settings_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facebook_settings_id UUID REFERENCES facebook_settings(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete', 'test'
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on audit tables
ALTER TABLE instagram_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_settings_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit tables
CREATE POLICY "Super admins can view instagram audit logs" ON instagram_settings_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

CREATE POLICY "Super admins can view facebook audit logs" ON facebook_settings_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

-- Create indexes for audit tables
CREATE INDEX IF NOT EXISTS idx_instagram_audit_changed_at ON instagram_settings_audit(changed_at);
CREATE INDEX IF NOT EXISTS idx_facebook_audit_changed_at ON facebook_settings_audit(changed_at);

-- Functions to log configuration changes
CREATE OR REPLACE FUNCTION log_instagram_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO instagram_settings_audit (
      instagram_settings_id, action, new_values, changed_by
    ) VALUES (
      NEW.id, 'create', 
      jsonb_build_object(
        'environment', NEW.environment,
        'is_active', NEW.is_active,
        'api_version', NEW.api_version
      ),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO instagram_settings_audit (
      instagram_settings_id, action, old_values, new_values, changed_by
    ) VALUES (
      NEW.id, 'update',
      jsonb_build_object(
        'environment', OLD.environment,
        'is_active', OLD.is_active,
        'api_version', OLD.api_version
      ),
      jsonb_build_object(
        'environment', NEW.environment,
        'is_active', NEW.is_active,
        'api_version', NEW.api_version
      ),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO instagram_settings_audit (
      instagram_settings_id, action, old_values, changed_by
    ) VALUES (
      OLD.id, 'delete',
      jsonb_build_object(
        'environment', OLD.environment,
        'is_active', OLD.is_active,
        'api_version', OLD.api_version
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_facebook_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO facebook_settings_audit (
      facebook_settings_id, action, new_values, changed_by
    ) VALUES (
      NEW.id, 'create', 
      jsonb_build_object(
        'environment', NEW.environment,
        'is_active', NEW.is_active,
        'api_version', NEW.api_version
      ),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO facebook_settings_audit (
      facebook_settings_id, action, old_values, new_values, changed_by
    ) VALUES (
      NEW.id, 'update',
      jsonb_build_object(
        'environment', OLD.environment,
        'is_active', OLD.is_active,
        'api_version', OLD.api_version
      ),
      jsonb_build_object(
        'environment', NEW.environment,
        'is_active', NEW.is_active,
        'api_version', NEW.api_version
      ),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO facebook_settings_audit (
      facebook_settings_id, action, old_values, changed_by
    ) VALUES (
      OLD.id, 'delete',
      jsonb_build_object(
        'environment', OLD.environment,
        'is_active', OLD.is_active,
        'api_version', OLD.api_version
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to log changes
CREATE TRIGGER trigger_log_instagram_settings_changes
  AFTER INSERT OR UPDATE OR DELETE ON instagram_settings
  FOR EACH ROW
  EXECUTE FUNCTION log_instagram_settings_changes();

CREATE TRIGGER trigger_log_facebook_settings_changes
  AFTER INSERT OR UPDATE OR DELETE ON facebook_settings
  FOR EACH ROW
  EXECUTE FUNCTION log_facebook_settings_changes();

-- Comments for documentation
COMMENT ON TABLE instagram_settings IS 'Instagram Business API integration settings';
COMMENT ON TABLE facebook_settings IS 'Facebook Pages API integration settings';
COMMENT ON COLUMN instagram_settings.app_id IS 'Instagram App ID from Facebook Developer Console';
COMMENT ON COLUMN instagram_settings.app_secret IS 'Instagram App Secret (encrypted)';
COMMENT ON COLUMN instagram_settings.access_token IS 'Long-lived Instagram access token (encrypted)';
COMMENT ON COLUMN instagram_settings.instagram_business_account_id IS 'Instagram Business Account ID';
COMMENT ON COLUMN instagram_settings.permissions IS 'Required Instagram API permissions as JSON array';
COMMENT ON COLUMN instagram_settings.content_types IS 'Enabled content types (posts, stories, reels, igtv) as JSON object';

COMMENT ON COLUMN facebook_settings.app_id IS 'Facebook App ID from Facebook Developer Console';
COMMENT ON COLUMN facebook_settings.app_secret IS 'Facebook App Secret (encrypted)';
COMMENT ON COLUMN facebook_settings.access_token IS 'Facebook User access token (encrypted)';
COMMENT ON COLUMN facebook_settings.pages IS 'Facebook Pages configuration as JSON array';
COMMENT ON COLUMN facebook_settings.privacy_settings IS 'Default privacy and messaging settings as JSON object';
COMMENT ON COLUMN facebook_settings.scheduling IS 'Post scheduling configuration as JSON object';
COMMENT ON COLUMN facebook_settings.audience_targeting IS 'Audience targeting settings as JSON object';