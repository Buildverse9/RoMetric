-- ============================================================================
-- RoMetric — Portable Supabase PostgreSQL Schema & Free-Tier Retention Policy
-- All timestamps are stored strictly in UTC (TIMESTAMPTZ).
-- Raw snapshots are kept separate from aggregated hourly/daily tables and
-- never overwritten.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  batch_limit INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'disabled')),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.games (
  universe_id BIGINT PRIMARY KEY,
  root_place_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  creator_id BIGINT NOT NULL,
  creator_name TEXT NOT NULL,
  creator_type TEXT NOT NULL CHECK (creator_type IN ('User', 'Group')),
  creator_verified BOOLEAN NOT NULL DEFAULT FALSE,
  genre TEXT NOT NULL DEFAULT 'All Genres',
  icon_url TEXT,
  thumbnail_url TEXT,
  current_ccu INTEGER NOT NULL DEFAULT 0 CHECK (current_ccu >= 0),
  total_visits BIGINT NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  favorites BIGINT NOT NULL DEFAULT 0 CHECK (favorites >= 0),
  up_votes BIGINT,
  down_votes BIGINT,
  like_ratio NUMERIC(5, 2),
  growth_1h NUMERIC(8, 2),
  growth_24h NUMERIC(8, 2),
  growth_7d NUMERIC(8, 2),
  growth_30d NUMERIC(8, 2),
  peak_ccu_observed INTEGER NOT NULL DEFAULT 0,
  peak_ccu_at TIMESTAMPTZ,
  tracking_tier TEXT NOT NULL DEFAULT 'tier_2' CHECK (tracking_tier IN ('tier_1', 'tier_2', 'tier_3')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data_source_id TEXT REFERENCES public.data_sources(id),
  collection_status TEXT NOT NULL DEFAULT 'observed' CHECK (collection_status IN ('observed', 'partial', 'error', 'pending')),
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  roblox_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_live_ccu ON public.games (active, current_ccu DESC);
CREATE INDEX IF NOT EXISTS idx_games_genre_ccu ON public.games (genre, current_ccu DESC);
CREATE INDEX IF NOT EXISTS idx_games_creator ON public.games (creator_id, current_ccu DESC);
CREATE INDEX IF NOT EXISTS idx_games_tier_collected ON public.games (tracking_tier, active, last_collected_at ASC);

-- Immutable raw snapshots (never updated)
CREATE TABLE IF NOT EXISTS public.game_snapshots (
  id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT NOT NULL REFERENCES public.games(universe_id) ON DELETE CASCADE,
  ccu INTEGER NOT NULL CHECK (ccu >= 0),
  visits BIGINT NOT NULL CHECK (visits >= 0),
  favorites BIGINT NOT NULL CHECK (favorites >= 0),
  up_votes BIGINT,
  down_votes BIGINT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_minute BIGINT NOT NULL,
  data_source_id TEXT NOT NULL REFERENCES public.data_sources(id),
  collection_status TEXT NOT NULL DEFAULT 'observed' CHECK (collection_status IN ('observed', 'partial')),
  CONSTRAINT uq_snapshot_universe_minute UNIQUE (universe_id, captured_minute)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_universe_time ON public.game_snapshots (universe_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON public.game_snapshots (captured_at ASC);

-- Aggregated hourly statistics (retained 7-14 days on Free tier)
CREATE TABLE IF NOT EXISTS public.game_hourly_stats (
  universe_id BIGINT NOT NULL REFERENCES public.games(universe_id) ON DELETE CASCADE,
  hour_bucket TIMESTAMPTZ NOT NULL,
  avg_ccu NUMERIC(12, 2) NOT NULL,
  min_ccu INTEGER NOT NULL,
  max_ccu INTEGER NOT NULL,
  latest_visits BIGINT NOT NULL,
  latest_favorites BIGINT NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (universe_id, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_hourly_bucket ON public.game_hourly_stats (hour_bucket DESC);

-- Permanent daily statistics (retained indefinitely for 30d/90d/All-Time charts)
CREATE TABLE IF NOT EXISTS public.game_daily_stats (
  universe_id BIGINT NOT NULL REFERENCES public.games(universe_id) ON DELETE CASCADE,
  day_bucket DATE NOT NULL,
  avg_ccu NUMERIC(12, 2) NOT NULL,
  min_ccu INTEGER NOT NULL,
  max_ccu INTEGER NOT NULL,
  visits_end BIGINT NOT NULL,
  favorites_end BIGINT NOT NULL,
  like_ratio NUMERIC(5, 2),
  sample_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (universe_id, day_bucket)
);

-- Observed peak records & provenance
CREATE TABLE IF NOT EXISTS public.game_records (
  universe_id BIGINT PRIMARY KEY REFERENCES public.games(universe_id) ON DELETE CASCADE,
  highest_observed_ccu INTEGER NOT NULL,
  highest_observed_at TIMESTAMPTZ NOT NULL,
  official_record_ccu INTEGER,
  official_record_source TEXT,
  provenance TEXT NOT NULL DEFAULT 'observed_peak' CHECK (provenance IN ('observed_peak', 'verified_external')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Private collector audit logs
CREATE TABLE IF NOT EXISTS public.collection_jobs (
  id BIGSERIAL PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('all', 'tier_1', 'tier_2', 'tier_3', 'manual')),
  triggered_by TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL,
  games_attempted INTEGER NOT NULL,
  games_succeeded INTEGER NOT NULL,
  games_failed INTEGER NOT NULL,
  api_requests INTEGER NOT NULL,
  http_429_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_summary TEXT
);

-- ============================================================================
-- Row Level Security (RLS)
-- Public visitors get read-only access to public analytics tables.
-- Writes and operational logs require the server-side service_role key only.
-- ============================================================================

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_hourly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Public read snapshots" ON public.game_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read hourly stats" ON public.game_hourly_stats FOR SELECT USING (true);
CREATE POLICY "Public read daily stats" ON public.game_daily_stats FOR SELECT USING (true);
CREATE POLICY "Public read game records" ON public.game_records FOR SELECT USING (true);
CREATE POLICY "Public read data sources" ON public.data_sources FOR SELECT USING (true);
-- Note: collection_jobs intentionally has NO public SELECT policy (service_role only).

-- ============================================================================
-- Seed Official Data Sources
-- ============================================================================
INSERT INTO public.data_sources (id, name, endpoint, batch_limit, status, notes)
VALUES
  ('roblox_games_v1', 'Roblox Public Games API v1', 'https://games.roblox.com/v1/games', 50, 'active', 'Live CCU, visits, favorites, creator, genre'),
  ('roblox_votes_v1', 'Roblox Public Votes API v1', 'https://games.roblox.com/v1/games/votes', 50, 'active', 'Verified upvotes and downvotes'),
  ('roblox_thumbnails_v1', 'Roblox Thumbnails API v1', 'https://thumbnails.roblox.com/v1/games/icons', 50, 'active', 'Official game icons and thumbnails')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Automated Free-Tier Rollup & Pruning Function (Fits inside 500 MB Supabase Free)
-- Call once daily via Cloudflare Cron Worker or pg_cron.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.run_rometric_retention_rollup()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Roll up recent raw snapshots into hourly stats (36h overlap guarantees zero gaps)
  INSERT INTO public.game_hourly_stats (
    universe_id, hour_bucket, avg_ccu, min_ccu, max_ccu, latest_visits, latest_favorites, sample_count, updated_at
  )
  SELECT
    universe_id,
    date_trunc('hour', captured_at) AS hour_bucket,
    ROUND(AVG(ccu)::numeric, 2),
    MIN(ccu),
    MAX(ccu),
    MAX(visits),
    MAX(favorites),
    COUNT(*),
    NOW()
  FROM public.game_snapshots
  WHERE captured_at >= NOW() - INTERVAL '36 hours'
  GROUP BY universe_id, date_trunc('hour', captured_at)
  ON CONFLICT (universe_id, hour_bucket) DO UPDATE SET
    avg_ccu = EXCLUDED.avg_ccu,
    min_ccu = EXCLUDED.min_ccu,
    max_ccu = EXCLUDED.max_ccu,
    latest_visits = EXCLUDED.latest_visits,
    latest_favorites = EXCLUDED.latest_favorites,
    sample_count = EXCLUDED.sample_count,
    updated_at = NOW();

  -- 2. Roll up hourly stats into permanent daily stats
  INSERT INTO public.game_daily_stats (
    universe_id, day_bucket, avg_ccu, min_ccu, max_ccu, visits_end, favorites_end, sample_count, updated_at
  )
  SELECT
    universe_id,
    (hour_bucket AT TIME ZONE 'UTC')::date AS day_bucket,
    ROUND(AVG(avg_ccu)::numeric, 2),
    MIN(min_ccu),
    MAX(max_ccu),
    MAX(latest_visits),
    MAX(latest_favorites),
    SUM(sample_count),
    NOW()
  FROM public.game_hourly_stats
  GROUP BY universe_id, (hour_bucket AT TIME ZONE 'UTC')::date
  ON CONFLICT (universe_id, day_bucket) DO UPDATE SET
    avg_ccu = EXCLUDED.avg_ccu,
    min_ccu = EXCLUDED.min_ccu,
    max_ccu = EXCLUDED.max_ccu,
    visits_end = EXCLUDED.visits_end,
    favorites_end = EXCLUDED.favorites_end,
    sample_count = EXCLUDED.sample_count,
    updated_at = NOW();

  -- 3. Prune expired windows to fit 3,000 games @ 30-min cadence inside 500 MB Free Tier
  --    (Full lossless history is archived nightly to Google Drive via Apps Script at 02:30 UTC)
  DELETE FROM public.game_snapshots WHERE captured_at < NOW() - INTERVAL '30 hours';
  DELETE FROM public.game_hourly_stats WHERE hour_bucket < NOW() - INTERVAL '7 days';
  DELETE FROM public.collection_jobs WHERE started_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.game_daily_stats WHERE day_bucket < (CURRENT_DATE - INTERVAL '365 days');
  IF to_regclass('public.code_collection_logs') IS NOT NULL THEN
    DELETE FROM public.code_collection_logs WHERE started_at < NOW() - INTERVAL '90 days';
  END IF;
END;
$$;

-- ============================================================================
-- Automated Roblox Game Codes System Schema (UTC Timestamps, Idempotent)
-- ============================================================================

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS code_coverage_status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (code_coverage_status IN ('covered', 'no_provider_data', 'unchecked')),
  ADD COLUMN IF NOT EXISTS active_code_count INTEGER NOT NULL DEFAULT 0 CHECK (active_code_count >= 0),
  ADD COLUMN IF NOT EXISTS total_code_count INTEGER NOT NULL DEFAULT 0 CHECK (total_code_count >= 0),
  ADD COLUMN IF NOT EXISTS wiki_subdomain TEXT,
  ADD COLUMN IF NOT EXISTS codes_last_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_games_slug ON public.games (slug);
CREATE INDEX IF NOT EXISTS idx_games_code_coverage ON public.games (code_coverage_status, active_code_count DESC, current_ccu DESC);

CREATE TABLE IF NOT EXISTS public.code_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('roblox_official', 'mediawiki', 'bloxarchive', 'community')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  requires_api_key BOOLEAN NOT NULL DEFAULT FALSE,
  attribution_label TEXT NOT NULL,
  attribution_url TEXT,
  license_notice TEXT,
  rate_limit_rpm INTEGER NOT NULL DEFAULT 30,
  last_run_at TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('healthy', 'degraded', 'error', 'disabled', 'idle')),
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  requests_today INTEGER NOT NULL DEFAULT 0,
  requests_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_codes (
  id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT NOT NULL REFERENCES public.games(universe_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  normalized_code TEXT NOT NULL,
  reward_description TEXT,
  status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (status IN ('active', 'pending_verification', 'expired', 'unverified')),
  source_id TEXT NOT NULL REFERENCES public.code_sources(id),
  source_url TEXT,
  source_reported_status TEXT,
  admin_locked BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_by_note TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_game_codes_universe_norm UNIQUE (universe_id, normalized_code)
);

CREATE INDEX IF NOT EXISTS idx_game_codes_universe_status ON public.game_codes (universe_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_codes_status_updated ON public.game_codes (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_codes_norm_code ON public.game_codes (normalized_code);

CREATE TABLE IF NOT EXISTS public.code_collection_logs (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES public.code_sources(id),
  triggered_by TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  games_checked INTEGER NOT NULL DEFAULT 0,
  games_with_provider_data INTEGER NOT NULL DEFAULT 0,
  codes_discovered INTEGER NOT NULL DEFAULT 0,
  codes_updated INTEGER NOT NULL DEFAULT 0,
  codes_expired INTEGER NOT NULL DEFAULT 0,
  api_requests INTEGER NOT NULL DEFAULT 0,
  http_429_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
  error_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_code_collection_logs_started ON public.code_collection_logs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.code_verification_logs (
  id BIGSERIAL PRIMARY KEY,
  code_id BIGINT REFERENCES public.game_codes(id) ON DELETE SET NULL,
  universe_id BIGINT NOT NULL,
  code_text TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_verification_logs_time ON public.code_verification_logs (verified_at DESC);

-- RLS Policies for Game Codes tables
ALTER TABLE public.code_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_collection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_verification_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'code_sources' AND policyname = 'Public read code sources'
  ) THEN
    CREATE POLICY "Public read code sources" ON public.code_sources FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_codes' AND policyname = 'Public read game codes'
  ) THEN
    CREATE POLICY "Public read game codes" ON public.game_codes FOR SELECT USING (true);
  END IF;
END $$;
-- Note: code_collection_logs and code_verification_logs have NO public SELECT policy (service_role only).

-- Helper to keep denormalized game code counts synchronized
CREATE OR REPLACE FUNCTION public.recompute_game_code_counts(p_universe_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active INTEGER;
  v_total INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*)
  INTO v_active, v_total
  FROM public.game_codes
  WHERE universe_id = p_universe_id;

  UPDATE public.games
  SET
    active_code_count = COALESCE(v_active, 0),
    total_code_count = COALESCE(v_total, 0),
    code_coverage_status = CASE
      WHEN COALESCE(v_total, 0) > 0 THEN 'covered'
      ELSE code_coverage_status
    END,
    codes_last_checked_at = COALESCE(codes_last_checked_at, NOW()),
    updated_at = NOW()
  WHERE universe_id = p_universe_id;
END;
$$;

-- Seed Modular Code Providers
INSERT INTO public.code_sources (
  id, name, provider_type, enabled, requires_api_key,
  attribution_label, attribution_url, license_notice, rate_limit_rpm, last_status
)
VALUES
  (
    'roblox_official_signals',
    'Roblox Official Game Descriptions & Group Shouts',
    'roblox_official',
    TRUE,
    FALSE,
    'Official Roblox Experience & Group',
    'https://www.roblox.com',
    'Publicly published developer announcements via official Roblox APIs',
    45,
    'idle'
  ),
  (
    'fandom_mediawiki_api',
    'Community Wiki MediaWiki Action API',
    'mediawiki',
    TRUE,
    FALSE,
    'Fandom Community Wiki',
    'https://www.fandom.com',
    'Community wiki text licensed under CC BY-SA (attribution & source link required)',
    25,
    'idle'
  ),
  (
    'bloxarchive_api',
    'BloxArchive JSON API',
    'bloxarchive',
    FALSE,
    TRUE,
    'BloxArchive',
    'https://bloxarchive.com',
    'Requires authorized BloxArchive API key and mandatory visible backlink attribution',
    20,
    'disabled'
  ),
  (
    'community_submissions',
    'Developer & Community Submissions',
    'community',
    TRUE,
    FALSE,
    'Community / Developer Submission',
    NULL,
    'User-submitted codes strictly enter Pending Verification until Admin review',
    10,
    'healthy'
  )
ON CONFLICT (id) DO NOTHING;

