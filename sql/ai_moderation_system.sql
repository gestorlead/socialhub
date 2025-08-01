-- AI-Powered Content Moderation System - Database Schema
-- Phase 2.3 - Complete moderation infrastructure
-- 
-- Tables:
-- - moderation_policies: Configurable moderation policies
-- - moderation_results: AI moderation analysis results
-- - moderation_audit_log: Comprehensive audit trail
-- - user_reputation_scores: User trustworthiness tracking
-- - content_similarity_cache: Duplicate content detection

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Moderation Policies Table
CREATE TABLE IF NOT EXISTS moderation_policies (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    platform VARCHAR(50), -- NULL means applies to all platforms
    rules JSONB NOT NULL, -- Policy rules configuration
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation Results Table
CREATE TABLE IF NOT EXISTS moderation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    
    -- OpenAI Moderation Results
    openai_flagged BOOLEAN,
    openai_categories JSONB, -- Category flags
    openai_category_scores JSONB, -- Category scores
    openai_response_time INTEGER, -- Response time in milliseconds
    
    -- Sentiment Analysis Results
    sentiment_score DECIMAL(4,3), -- -1.0 to 1.0
    sentiment_magnitude DECIMAL(4,3), -- 0.0 to 1.0  
    sentiment_confidence DECIMAL(4,3), -- 0.0 to 1.0
    sentiment_classification VARCHAR(20), -- very_negative, negative, neutral, positive, very_positive
    sentiment_emotions JSONB, -- Emotion breakdown
    sentiment_keywords JSONB, -- Extracted keywords
    
    -- Spam Detection Results
    spam_probability DECIMAL(4,3), -- 0.0 to 1.0
    spam_confidence DECIMAL(4,3), -- 0.0 to 1.0
    spam_signals JSONB, -- Detailed spam signals
    spam_reasons TEXT[], -- Human-readable reasons
    
    -- Final Decision
    final_action VARCHAR(20) NOT NULL, -- approve, flag, reject, escalate
    final_confidence DECIMAL(4,3) NOT NULL,
    automated_decision BOOLEAN DEFAULT true,
    requires_human_review BOOLEAN DEFAULT false,
    policy_id TEXT REFERENCES moderation_policies(id),
    
    -- Metadata
    processing_time INTEGER, -- Total processing time in milliseconds
    api_costs DECIMAL(10,6), -- API costs in USD
    cached_result BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_moderation_results_comment_id ON moderation_results(comment_id),
    INDEX idx_moderation_results_action ON moderation_results(final_action),
    INDEX idx_moderation_results_automated ON moderation_results(automated_decision),
    INDEX idx_moderation_results_created_at ON moderation_results(created_at)
);

-- Moderation Audit Log Table
CREATE TABLE IF NOT EXISTS moderation_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    moderation_result_id UUID REFERENCES moderation_results(id) ON DELETE CASCADE,
    
    -- Action Details
    action_type VARCHAR(50) NOT NULL, -- ai_analysis, human_review, policy_change, appeal
    action_by UUID REFERENCES profiles(id),
    action_reason TEXT,
    
    -- Before/After State
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    previous_data JSONB,
    new_data JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    platform VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_audit_log_comment_id ON moderation_audit_log(comment_id),
    INDEX idx_audit_log_action_type ON moderation_audit_log(action_type),
    INDEX idx_audit_log_action_by ON moderation_audit_log(action_by),
    INDEX idx_audit_log_created_at ON moderation_audit_log(created_at)
);

-- User Reputation Scores Table
CREATE TABLE IF NOT EXISTS user_reputation_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    
    -- Reputation Metrics
    trust_score DECIMAL(4,3) DEFAULT 0.5, -- 0.0 to 1.0
    spam_score DECIMAL(4,3) DEFAULT 0.0, -- 0.0 to 1.0 (higher = more likely spam)
    
    -- Activity Metrics
    total_comments INTEGER DEFAULT 0,
    approved_comments INTEGER DEFAULT 0,
    flagged_comments INTEGER DEFAULT 0,
    rejected_comments INTEGER DEFAULT 0,
    
    -- Behavior Metrics
    average_sentiment DECIMAL(4,3) DEFAULT 0.0,
    posting_velocity DECIMAL(8,3) DEFAULT 0.0, -- comments per hour
    content_diversity DECIMAL(4,3) DEFAULT 0.5, -- 0.0 to 1.0
    
    -- Time-based Metrics
    account_age_days INTEGER DEFAULT 0,
    last_violation_at TIMESTAMP WITH TIME ZONE,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(user_id, platform),
    
    -- Indexes
    INDEX idx_reputation_user_id ON user_reputation_scores(user_id),
    INDEX idx_reputation_platform ON user_reputation_scores(platform),
    INDEX idx_reputation_trust_score ON user_reputation_scores(trust_score),
    INDEX idx_reputation_spam_score ON user_reputation_scores(spam_score)
);

-- Content Similarity Cache Table (for duplicate detection)
CREATE TABLE IF NOT EXISTS content_similarity_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of content
    normalized_content TEXT NOT NULL, -- Cleaned/normalized content for similarity
    platform VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Similarity Detection
    word_count INTEGER,
    character_count INTEGER,
    language VARCHAR(10),
    
    -- First occurrence tracking
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    occurrence_count INTEGER DEFAULT 1,
    
    -- Moderation status of original
    original_status VARCHAR(20),
    is_spam BOOLEAN DEFAULT false,
    
    -- Indexes for similarity matching
    INDEX idx_similarity_content_hash ON content_similarity_cache(content_hash),
    INDEX idx_similarity_normalized USING gin(to_tsvector('english', normalized_content)),
    INDEX idx_similarity_platform_user ON content_similarity_cache(platform, user_id),
    INDEX idx_similarity_first_seen ON content_similarity_cache(first_seen_at)
);

-- Add moderation-related columns to existing comments table
DO $$
BEGIN
    -- Add sentiment score if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comments' AND column_name = 'sentiment_score') THEN
        ALTER TABLE comments ADD COLUMN sentiment_score DECIMAL(4,3);
        CREATE INDEX idx_comments_sentiment_score ON comments(sentiment_score);
    END IF;
    
    -- Add sentiment magnitude if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comments' AND column_name = 'sentiment_magnitude') THEN
        ALTER TABLE comments ADD COLUMN sentiment_magnitude DECIMAL(4,3);
    END IF;
    
    -- Add spam probability if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comments' AND column_name = 'spam_probability') THEN
        ALTER TABLE comments ADD COLUMN spam_probability DECIMAL(4,3);
        CREATE INDEX idx_comments_spam_probability ON comments(spam_probability);
    END IF;
    
    -- Add moderation confidence if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comments' AND column_name = 'moderation_confidence') THEN
        ALTER TABLE comments ADD COLUMN moderation_confidence DECIMAL(4,3);
    END IF;
    
    -- Add automated moderation flag if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comments' AND column_name = 'moderation_automated') THEN
        ALTER TABLE comments ADD COLUMN moderation_automated BOOLEAN DEFAULT false;
        CREATE INDEX idx_comments_moderation_automated ON comments(moderation_automated);  
    END IF;
    
    -- Add content hash for duplicate detection if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comments' AND column_name = 'content_hash') THEN  
        ALTER TABLE comments ADD COLUMN content_hash VARCHAR(64);
        CREATE INDEX idx_comments_content_hash ON comments(content_hash);
    END IF;
    
    -- Add AI analysis timestamp if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comments' AND column_name = 'ai_analyzed_at') THEN
        ALTER TABLE comments ADD COLUMN ai_analyzed_at TIMESTAMP WITH TIME ZONE;
        CREATE INDEX idx_comments_ai_analyzed_at ON comments(ai_analyzed_at);
    END IF;
END $$;

-- Row Level Security (RLS) Policies

-- Enable RLS on new tables
ALTER TABLE moderation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_similarity_cache ENABLE ROW LEVEL SECURITY;

-- Moderation Policies RLS (Super Admin only)
CREATE POLICY "Super admins can manage policies" ON moderation_policies
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id = 3
        )
    );

-- Moderation Results RLS (Admins can read, system can write)
CREATE POLICY "Admins can read moderation results" ON moderation_results
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id >= 2
        )
    );

CREATE POLICY "System can write moderation results" ON moderation_results
    FOR INSERT
    TO authenticated
    USING (true); -- Will be restricted by application logic

-- Audit Log RLS (Admins can read, system can write)
CREATE POLICY "Admins can read audit log" ON moderation_audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id >= 2
        )
    );

CREATE POLICY "System can write audit log" ON moderation_audit_log
    FOR INSERT
    TO authenticated
    USING (true);

-- User Reputation Scores RLS (Users can read own, admins can read all)
CREATE POLICY "Users can read own reputation" ON user_reputation_scores
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can read all reputations" ON user_reputation_scores
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id >= 2
        )
    );

CREATE POLICY "System can manage reputation scores" ON user_reputation_scores
    FOR ALL
    TO authenticated
    USING (true); -- Will be restricted by application logic

-- Content Similarity Cache RLS (System access only)
CREATE POLICY "System can manage similarity cache" ON content_similarity_cache
    FOR ALL
    TO authenticated
    USING (true); -- Will be restricted by application logic

-- Insert default moderation policies
INSERT INTO moderation_policies (id, name, description, rules, enabled, priority) VALUES
('standard', 'Standard Content Policy', 'Default moderation policy with balanced thresholds', '{
    "categories": {
        "hate": {"threshold": 0.7, "action": "reject"},
        "hate/threatening": {"threshold": 0.5, "action": "reject"},
        "harassment": {"threshold": 0.8, "action": "flag"},
        "harassment/threatening": {"threshold": 0.6, "action": "reject"},
        "sexual": {"threshold": 0.8, "action": "flag"},
        "sexual/minors": {"threshold": 0.1, "action": "reject"},
        "violence": {"threshold": 0.8, "action": "flag"},
        "violence/graphic": {"threshold": 0.6, "action": "reject"},
        "self-harm": {"threshold": 0.7, "action": "escalate"},
        "self-harm/intent": {"threshold": 0.5, "action": "escalate"},
        "self-harm/instructions": {"threshold": 0.3, "action": "reject"}
    },
    "sentiment": {"threshold": -0.8, "action": "flag"},
    "spam": {"threshold": 0.7, "action": "flag"}
}', true, 1),
('strict', 'Strict Content Policy', 'Restrictive policy for sensitive communities', '{
    "categories": {
        "hate": {"threshold": 0.5, "action": "reject"},
        "hate/threatening": {"threshold": 0.3, "action": "reject"},
        "harassment": {"threshold": 0.6, "action": "reject"},
        "harassment/threatening": {"threshold": 0.4, "action": "reject"},
        "sexual": {"threshold": 0.6, "action": "reject"},
        "sexual/minors": {"threshold": 0.05, "action": "reject"},
        "violence": {"threshold": 0.6, "action": "reject"},
        "violence/graphic": {"threshold": 0.4, "action": "reject"},
        "self-harm": {"threshold": 0.5, "action": "escalate"},
        "self-harm/intent": {"threshold": 0.3, "action": "escalate"},
        "self-harm/instructions": {"threshold": 0.2, "action": "reject"}
    },
    "sentiment": {"threshold": -0.6, "action": "flag"},
    "spam": {"threshold": 0.5, "action": "flag"}
}', false, 2),
('permissive', 'Permissive Content Policy', 'Lenient policy for open discussion platforms', '{
    "categories": {
        "hate": {"threshold": 0.9, "action": "flag"},
        "hate/threatening": {"threshold": 0.7, "action": "reject"},
        "harassment": {"threshold": 0.9, "action": "flag"},
        "harassment/threatening": {"threshold": 0.8, "action": "flag"},
        "sexual": {"threshold": 0.9, "action": "flag"},
        "sexual/minors": {"threshold": 0.2, "action": "reject"},
        "violence": {"threshold": 0.9, "action": "flag"},
        "violence/graphic": {"threshold": 0.8, "action": "flag"},
        "self-harm": {"threshold": 0.8, "action": "escalate"},
        "self-harm/intent": {"threshold": 0.6, "action": "escalate"},
        "self-harm/instructions": {"threshold": 0.4, "action": "reject"}
    },
    "sentiment": {"threshold": -0.9, "action": "flag"},
    "spam": {"threshold": 0.8, "action": "flag"}
}', false, 0)
ON CONFLICT (id) DO UPDATE SET
    rules = EXCLUDED.rules,
    updated_at = NOW();

-- Create functions for automated reputation updates
CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user reputation when comment status changes
    IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) OR TG_OP = 'INSERT' THEN
        INSERT INTO user_reputation_scores (user_id, platform, total_comments, approved_comments, flagged_comments, rejected_comments)
        VALUES (
            COALESCE(NEW.user_id, OLD.user_id),
            COALESCE(NEW.platform, OLD.platform),
            1,
            CASE WHEN COALESCE(NEW.status, OLD.status) = 'approved' THEN 1 ELSE 0 END,
            CASE WHEN COALESCE(NEW.status, OLD.status) IN ('flagged', 'pending') THEN 1 ELSE 0 END,
            CASE WHEN COALESCE(NEW.status, OLD.status) = 'rejected' THEN 1 ELSE 0 END
        )
        ON CONFLICT (user_id, platform) DO UPDATE SET
            total_comments = user_reputation_scores.total_comments + 1,
            approved_comments = user_reputation_scores.approved_comments + 
                CASE WHEN COALESCE(NEW.status, OLD.status) = 'approved' THEN 1 ELSE 0 END,
            flagged_comments = user_reputation_scores.flagged_comments + 
                CASE WHEN COALESCE(NEW.status, OLD.status) IN ('flagged', 'pending') THEN 1 ELSE 0 END,
            rejected_comments = user_reputation_scores.rejected_comments + 
                CASE WHEN COALESCE(NEW.status, OLD.status) = 'rejected' THEN 1 ELSE 0 END,
            trust_score = LEAST(1.0, GREATEST(0.0, 
                (user_reputation_scores.approved_comments + 
                 CASE WHEN COALESCE(NEW.status, OLD.status) = 'approved' THEN 1 ELSE 0 END) * 1.0 / 
                GREATEST(1, user_reputation_scores.total_comments + 1)
            )),
            last_updated_at = NOW();
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reputation updates
DROP TRIGGER IF EXISTS trigger_update_user_reputation ON comments;
CREATE TRIGGER trigger_update_user_reputation
    AFTER INSERT OR UPDATE OF status ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_user_reputation();

-- Create function for content similarity checking
CREATE OR REPLACE FUNCTION check_content_similarity(
    input_content TEXT,
    input_platform VARCHAR(50),
    input_user_id UUID
) RETURNS TABLE (
    similarity_score DECIMAL,
    is_duplicate BOOLEAN,
    original_hash VARCHAR(64),
    first_seen TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    content_hash VARCHAR(64);
    normalized_content TEXT;
BEGIN
    -- Generate content hash
    content_hash := encode(digest(input_content, 'sha256'), 'hex');
    
    -- Normalize content (remove extra spaces, lowercase, etc.)
    normalized_content := lower(regexp_replace(trim(input_content), '\s+', ' ', 'g'));
    
    -- Check for exact duplicates first
    RETURN QUERY
    SELECT 
        1.0::DECIMAL as similarity_score,
        true as is_duplicate,
        css.content_hash as original_hash,
        css.first_seen_at as first_seen
    FROM content_similarity_cache css
    WHERE css.content_hash = check_content_similarity.content_hash
    AND css.platform = input_platform
    AND css.user_id = input_user_id
    LIMIT 1;
    
    -- If no exact duplicate found, check for similar content using trigrams
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            similarity(css.normalized_content, normalized_content)::DECIMAL as similarity_score,
            false as is_duplicate,
            css.content_hash as original_hash,  
            css.first_seen_at as first_seen
        FROM content_similarity_cache css
        WHERE css.platform = input_platform
        AND css.user_id = input_user_id
        AND similarity(css.normalized_content, normalized_content) > 0.8
        ORDER BY similarity(css.normalized_content, normalized_content) DESC
        LIMIT 1;
    END IF;
    
    -- If no similar content found, insert new entry
    IF NOT FOUND THEN
        INSERT INTO content_similarity_cache 
        (content_hash, normalized_content, platform, user_id, word_count, character_count)
        VALUES (
            check_content_similarity.content_hash,
            normalized_content,
            input_platform,
            input_user_id,
            array_length(string_to_array(normalized_content, ' '), 1),
            length(input_content)
        )
        ON CONFLICT (content_hash) DO UPDATE SET
            last_seen_at = NOW(),
            occurrence_count = content_similarity_cache.occurrence_count + 1;
            
        RETURN QUERY SELECT 0.0::DECIMAL, false, ''::VARCHAR(64), NOW()::TIMESTAMP WITH TIME ZONE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_status_platform 
    ON comments(status, platform) WHERE status IN ('pending', 'flagged');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_ai_moderation 
    ON comments(ai_analyzed_at, moderation_automated) WHERE ai_analyzed_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_results_composite
    ON moderation_results(final_action, automated_decision, created_at);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON moderation_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON moderation_results TO authenticated;
GRANT SELECT, INSERT ON moderation_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_reputation_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON content_similarity_cache TO authenticated;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;