-- TravelTalk Database Schema
-- Phase 1: Basic tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- phrases: User custom phrases
-- =============================================
CREATE TABLE phrases (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    text VARCHAR(500) NOT NULL,
    translation VARCHAR(500),
    source_lang VARCHAR(10) DEFAULT 'zh',
    target_lang VARCHAR(10) DEFAULT 'en',
    audio_url TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own phrases"
    ON phrases FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_phrases_user_id ON phrases(user_id);
CREATE INDEX idx_phrases_target_lang ON phrases(target_lang);

-- =============================================
-- translations_cache: Translation result cache
-- =============================================
CREATE TABLE translations_cache (
    id BIGSERIAL PRIMARY KEY,
    source_lang VARCHAR(10) NOT NULL,
    target_lang VARCHAR(10) NOT NULL,
    source_text VARCHAR(1000) NOT NULL,
    translated_text VARCHAR(1000) NOT NULL,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_translations_cache_key ON translations_cache(cache_key);
CREATE INDEX idx_translations_cache_expires ON translations_cache(expires_at);

-- Function to auto-cleanup expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM translations_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- user_quotas: User quota management
-- =============================================
CREATE TABLE user_quotas (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
    plan VARCHAR(20) DEFAULT 'free',
    daily_limit INTEGER DEFAULT 50,
    daily_used INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quota"
    ON user_quotas FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================
-- translation_logs: API usage logs
-- =============================================
CREATE TABLE translation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('voice', 'image', 'phrase')),
    source_lang VARCHAR(10),
    target_lang VARCHAR(10),
    api_calls INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_translation_logs_user_id ON translation_logs(user_id);
CREATE INDEX idx_translation_logs_created_at ON translation_logs(created_at);

-- =============================================
-- api_keys: Client API keys for B2B2C
-- =============================================
CREATE TABLE api_keys (
    id BIGSERIAL PRIMARY KEY,
    client_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100),
    quota_daily INTEGER DEFAULT 1000,
    quota_used INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own api keys"
    ON api_keys FOR ALL
    USING (auth.uid() = client_id)
    WITH CHECK (auth.uid() = client_id);

CREATE INDEX idx_api_keys_hash ON api_keys(api_key_hash);
CREATE INDEX idx_api_keys_client_id ON api_keys(client_id);

-- =============================================
-- Function to check and reset daily quota
-- =============================================
CREATE OR REPLACE FUNCTION check_daily_quota(p_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_needed BOOLEAN) AS $$
DECLARE
    v_quota RECORD;
    v_today DATE := CURRENT_DATE;
BEGIN
    SELECT INTO v_quota daily_limit, daily_used, last_reset_date
    FROM user_quotas
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        -- No quota record, create one
        INSERT INTO user_quotas (user_id, daily_limit, daily_used, last_reset_date)
        VALUES (p_user_id, 50, 0, v_today)
        RETURNING daily_limit, daily_used, last_reset_date INTO v_quota;
        RETURN QUERY SELECT true, v_quota.daily_limit, false;
        RETURN;
    END IF;

    -- Check if reset is needed
    IF v_quota.last_reset_date < v_today THEN
        UPDATE user_quotas
        SET daily_used = 0, last_reset_date = v_today
        WHERE user_id = p_user_id;
        RETURN QUERY SELECT true, v_quota.daily_limit, true;
        RETURN;
    END IF;

    -- Check quota
    IF v_quota.daily_used >= v_quota.daily_limit THEN
        RETURN QUERY SELECT false, 0, false;
    ELSE
        RETURN QUERY SELECT true, v_quota.daily_limit - v_quota.daily_used, false;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Trigger to update updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER phrases_updated_at
    BEFORE UPDATE ON phrases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_quotas_updated_at
    BEFORE UPDATE ON user_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
