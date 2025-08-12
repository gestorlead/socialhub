-- Tabela para configurações de integração do X
CREATE TABLE IF NOT EXISTS x_integration_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key TEXT,
    api_secret TEXT,
    client_id TEXT,
    client_secret TEXT,
    bearer_token TEXT,
    environment TEXT DEFAULT 'development' CHECK (environment IN ('development', 'production')),
    callback_url TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para dados temporários OAuth (para PKCE)
CREATE TABLE IF NOT EXISTS oauth_temp_data (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para posts publicados
CREATE TABLE IF NOT EXISTS published_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_post_id TEXT NOT NULL,
    content JSONB NOT NULL,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
    published_at TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para logs de auditoria admin
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_oauth_temp_data_expires_at ON oauth_temp_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_temp_data_platform ON oauth_temp_data(platform);
CREATE INDEX IF NOT EXISTS idx_published_posts_user_platform ON published_posts(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_published_posts_created_at ON published_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_published_posts_status ON published_posts(status);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_user_action ON admin_audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

-- RLS Policies
ALTER TABLE x_integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_temp_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para x_integration_settings (apenas admins)
CREATE POLICY "Admin access only" ON x_integration_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role >= 2
        )
    );

-- Política para oauth_temp_data (acesso temporário durante OAuth)
CREATE POLICY "Temporary OAuth access" ON oauth_temp_data
    FOR ALL USING (true); -- Dados temporários, expiram automaticamente

-- Política para published_posts (usuários podem ver apenas seus próprios posts)
CREATE POLICY "Users can manage their own posts" ON published_posts
    FOR ALL USING (user_id = auth.uid());

-- Política para admin_audit_logs (apenas admins podem ver)
CREATE POLICY "Admin audit access" ON admin_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role >= 2
        )
    );

-- Função para limpar dados OAuth expirados
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_data()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_temp_data WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE x_integration_settings IS 'Configurações de integração com X (Twitter) API';
COMMENT ON TABLE oauth_temp_data IS 'Dados temporários para fluxo OAuth com PKCE';
COMMENT ON TABLE published_posts IS 'Histórico de posts publicados em redes sociais';
COMMENT ON TABLE admin_audit_logs IS 'Logs de auditoria para ações administrativas';