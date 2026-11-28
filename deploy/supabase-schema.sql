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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'games' AND policyname = 'Public read games'
  ) THEN
    CREATE POLICY "Public read games" ON public.games FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_snapshots' AND policyname = 'Public read snapshots'
  ) THEN
    CREATE POLICY "Public read snapshots" ON public.game_snapshots FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_hourly_stats' AND policyname = 'Public read hourly stats'
  ) THEN
    CREATE POLICY "Public read hourly stats" ON public.game_hourly_stats FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_daily_stats' AND policyname = 'Public read daily stats'
  ) THEN
    CREATE POLICY "Public read daily stats" ON public.game_daily_stats FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_records' AND policyname = 'Public read game records'
  ) THEN
    CREATE POLICY "Public read game records" ON public.game_records FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'data_sources' AND policyname = 'Public read data sources'
  ) THEN
    CREATE POLICY "Public read data sources" ON public.data_sources FOR SELECT USING (true);
  END IF;
END $$;
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

  -- 3. Tier 1 (Hot) retention windows — keeps 10,000-15,000+ games well under 500 MB Free Tier
  --    Tier 2 (Warm): Cloudflare D1 (5 GB, No Card) holds 14d hourly + multi-year daily charts at $0 egress
  --    Tier 3 (Cold): Google Drive 5 TB archives full lossless daily snapshots at 02:30 UTC
  DELETE FROM public.game_snapshots WHERE captured_at < NOW() - INTERVAL '12 hours';
  DELETE FROM public.game_hourly_stats WHERE hour_bucket < NOW() - INTERVAL '3 days';
  DELETE FROM public.collection_jobs WHERE started_at < NOW() - INTERVAL '7 days';
  DELETE FROM public.game_daily_stats WHERE day_bucket < (CURRENT_DATE - INTERVAL '90 days');
  IF to_regclass('public.code_collection_logs') IS NOT NULL THEN
    DELETE FROM public.code_collection_logs WHERE started_at < NOW() - INTERVAL '30 days';
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
  ),
  (
    'rometric_verified_catalog',
    'RoMetric Verified Catalog',
    'roblox_official',
    TRUE,
    FALSE,
    'RoMetric Automated Codes Index',
    NULL,
    'Bulk-verified Roblox game codes catalog continuously refreshed by automated providers',
    60,
    'healthy'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- EGRESS OPTIMIZATION: In-Database Platform CCU Aggregation RPC (~2 KB payload)
-- Replaces downloading 25,000+ raw rows into Node.js for the homepage chart.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_platform_ccu_history(p_range TEXT DEFAULT '24h')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_range TEXT;
  v_tracked_games INTEGER := 0;
  v_live_total_ccu BIGINT := 0;
  v_source_table TEXT := 'game_snapshots';
  v_points JSONB := '[]'::JSONB;
  v_days INTEGER;
  v_hours INTEGER;
BEGIN
  -- Strict allowlist validation on p_range
  v_range := CASE
    WHEN p_range IN ('1h', '24h', '7d', '30d', '90d', 'all') THEN p_range
    ELSE '24h'
  END;

  -- 1) Live totals computed inside Postgres (0 rows transferred)
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(GREATEST(current_ccu, 0)), 0)::BIGINT
  INTO v_tracked_games, v_live_total_ccu
  FROM public.games
  WHERE active = TRUE;

  -- 2) Daily rollup for 30d / 90d / all
  IF v_range IN ('30d', '90d', 'all') THEN
    v_days := CASE v_range WHEN '30d' THEN 30 WHEN '90d' THEN 90 ELSE 365 END;

    WITH raw_buckets AS (
      SELECT
        (EXTRACT(EPOCH FROM (day_bucket::TIMESTAMP AT TIME ZONE 'UTC' + INTERVAL '12 hours')) * 1000)::BIGINT AS ts,
        COALESCE(SUM(GREATEST(ROUND(avg_ccu), 0)), 0)::BIGINT AS ccu,
        COUNT(*)::INTEGER AS games_count
      FROM public.game_daily_stats
      WHERE day_bucket >= (CURRENT_DATE - v_days)
      GROUP BY day_bucket
    ),
    stats AS (
      SELECT
        COALESCE(PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY games_count), 1) AS med,
        COUNT(*) AS total_buckets
      FROM raw_buckets
    ),
    filtered AS (
      SELECT rb.ts, rb.ccu, rb.games_count
      FROM raw_buckets rb
      CROSS JOIN stats s
      WHERE s.total_buckets <= 2 OR rb.games_count >= GREATEST(1, FLOOR(s.med * 0.45))
      ORDER BY rb.ts ASC
    )
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('ts', ts, 'ccu', ccu, 'gamesCount', games_count)
        ORDER BY ts ASC
      ),
      '[]'::JSONB
    )
    INTO v_points
    FROM filtered;

    IF jsonb_array_length(v_points) >= 2 THEN
      v_source_table := 'game_daily_stats';
      RETURN jsonb_build_object(
        'tracked_games', v_tracked_games,
        'live_total_ccu', v_live_total_ccu,
        'source_table', v_source_table,
        'points', v_points
      );
    END IF;
  END IF;

  -- 3) Hourly rollup for 24h / 7d (or fallback when daily history is still young)
  v_hours := CASE v_range WHEN '1h' THEN 2 WHEN '24h' THEN 26 ELSE 168 END;

  WITH raw_buckets AS (
    SELECT
      (EXTRACT(EPOCH FROM hour_bucket) * 1000)::BIGINT AS ts,
      COALESCE(SUM(GREATEST(ROUND(avg_ccu), 0)), 0)::BIGINT AS ccu,
      COUNT(*)::INTEGER AS games_count
    FROM public.game_hourly_stats
    WHERE hour_bucket >= (NOW() - make_interval(hours => v_hours))
    GROUP BY hour_bucket
  ),
  stats AS (
    SELECT
      COALESCE(PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY games_count), 1) AS med,
      COUNT(*) AS total_buckets
    FROM raw_buckets
  ),
  filtered AS (
    SELECT rb.ts, rb.ccu, rb.games_count
    FROM raw_buckets rb
    CROSS JOIN stats s
    WHERE s.total_buckets <= 2 OR rb.games_count >= GREATEST(1, FLOOR(s.med * 0.45))
    ORDER BY rb.ts ASC
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('ts', ts, 'ccu', ccu, 'gamesCount', games_count)
      ORDER BY ts ASC
    ),
    '[]'::JSONB
  )
  INTO v_points
  FROM filtered;

  IF jsonb_array_length(v_points) >= 2 THEN
    v_source_table := 'game_hourly_stats';
    RETURN jsonb_build_object(
      'tracked_games', v_tracked_games,
      'live_total_ccu', v_live_total_ccu,
      'source_table', v_source_table,
      'points', v_points
    );
  END IF;

  -- 4) Snapshot 30-min bucket fallback (only last 24h, deduplicated per game per bucket)
  WITH per_game_bucket AS (
    SELECT DISTINCT ON (bucket_ts, universe_id)
      (FLOOR(EXTRACT(EPOCH FROM captured_at) / 1800) * 1800000)::BIGINT AS bucket_ts,
      universe_id,
      GREATEST(ccu, 0)::BIGINT AS ccu
    FROM public.game_snapshots
    WHERE captured_at >= (NOW() - INTERVAL '24 hours')
    ORDER BY bucket_ts, universe_id, captured_at DESC
  ),
  raw_buckets AS (
    SELECT
      bucket_ts AS ts,
      SUM(ccu)::BIGINT AS ccu,
      COUNT(*)::INTEGER AS games_count
    FROM per_game_bucket
    GROUP BY bucket_ts
  ),
  stats AS (
    SELECT
      COALESCE(PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY games_count), 1) AS med,
      COUNT(*) AS total_buckets
    FROM raw_buckets
  ),
  filtered AS (
    SELECT rb.ts, rb.ccu, rb.games_count
    FROM raw_buckets rb
    CROSS JOIN stats s
    WHERE s.total_buckets <= 2 OR rb.games_count >= GREATEST(1, FLOOR(s.med * 0.45))
    ORDER BY rb.ts ASC
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('ts', ts, 'ccu', ccu, 'gamesCount', games_count)
      ORDER BY ts ASC
    ),
    '[]'::JSONB
  )
  INTO v_points
  FROM filtered;

  v_source_table := 'game_snapshots';
  RETURN jsonb_build_object(
    'tracked_games', v_tracked_games,
    'live_total_ccu', v_live_total_ccu,
    'source_table', v_source_table,
    'points', v_points
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_ccu_history(TEXT) TO anon, authenticated, service_role;


