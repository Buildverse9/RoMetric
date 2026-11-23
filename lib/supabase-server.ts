import firebaseConfig from '../firebase-applet-config.json';
import { DEFAULT_ADMIN_EMAIL, SEED_UNIVERSES } from './seed-universes';
import { slugify } from './format';
import {
  discoverLiveRobloxCharts,
  fetchLiveRobloxGames,
} from './roblox-api';
import type {
  CollectionJob,
  GamePeakRecord,
  GameRecordData,
  LiveRobloxGamePayload,
  TimeRange,
  TrackingTier,
} from './types';

export interface SupabaseGameRow {
  universe_id: number;
  root_place_id: number;
  name: string;
  slug: string;
  description: string | null;
  creator_id: number;
  creator_name: string;
  creator_type: 'User' | 'Group';
  creator_verified: boolean;
  genre: string;
  icon_url: string | null;
  thumbnail_url: string | null;
  current_ccu: number;
  total_visits: number;
  favorites: number;
  up_votes: number | null;
  down_votes: number | null;
  like_ratio: number | null;
  growth_1h: number | null;
  growth_24h: number | null;
  growth_7d: number | null;
  growth_30d: number | null;
  peak_ccu_observed: number;
  peak_ccu_at: string | null;
  tracking_tier: TrackingTier;
  active: boolean;
  data_source_id: string | null;
  collection_status: 'observed' | 'partial' | 'error' | 'pending';
  first_observed_at: string;
  last_collected_at: string;
  roblox_updated_at: string | null;
  updated_at: string;
}

export interface SupabaseSnapshotRow {
  id: number;
  universe_id: number;
  ccu: number;
  visits: number;
  favorites: number;
  up_votes: number | null;
  down_votes: number | null;
  captured_at: string;
  captured_minute: number;
  data_source_id: string;
  collection_status: 'observed' | 'partial';
}

export interface SupabaseHourlyRow {
  universe_id: number;
  hour_bucket: string;
  avg_ccu: number;
  min_ccu: number;
  max_ccu: number;
  latest_visits: number;
  latest_favorites: number;
  sample_count: number;
  updated_at: string;
}

export interface SupabaseDailyRow {
  universe_id: number;
  day_bucket: string;
  avg_ccu: number;
  min_ccu: number;
  max_ccu: number;
  visits_end: number;
  favorites_end: number;
  like_ratio: number | null;
  sample_count: number;
  updated_at: string;
}

export interface SupabasePeakRow {
  universe_id: number;
  highest_observed_ccu: number;
  highest_observed_at: string;
  provenance: 'observed_peak' | 'verified_external';
  updated_at: string;
}

export interface SupabaseJobRow {
  id: number;
  tier: 'all' | 'tier_1' | 'tier_2' | 'tier_3' | 'manual';
  triggered_by: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  games_attempted: number;
  games_succeeded: number;
  games_failed: number;
  api_requests: number;
  http_429_count: number;
  status: 'success' | 'partial' | 'failed';
  error_summary: string | null;
}

function getValidatedSupabaseBaseUrl(): string | null {
  const raw = process.env.SUPABASE_URL?.trim();
  if (!raw || raw.includes('YOUR_PROJECT_REF')) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host === '169.254.169.254'
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function getSupabaseReadKey(): string | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceKey && !serviceKey.includes('YOUR_SUPABASE_')) return serviceKey;
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (anonKey && !anonKey.includes('YOUR_SUPABASE_')) return anonKey;
  return null;
}

function getSupabaseAdminKey(): string | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceKey && !serviceKey.includes('YOUR_SUPABASE_')) return serviceKey;
  return null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getValidatedSupabaseBaseUrl() && getSupabaseReadKey());
}

export function isSupabaseWriteConfigured(): boolean {
  return Boolean(getValidatedSupabaseBaseUrl() && getSupabaseAdminKey());
}

export async function supabaseRest(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    requireAdminKey?: boolean;
  } = {}
): Promise<Response> {
  const baseUrl = getValidatedSupabaseBaseUrl();
  const key = options.requireAdminKey
    ? getSupabaseAdminKey()
    : getSupabaseReadKey();

  if (!baseUrl || !key) {
    throw new Error('Supabase server environment variables are not configured.');
  }

  const isJwt = key.startsWith('eyJ');
  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
    ...(isJwt ? { Authorization: `Bearer ${key}` } : {}),
    ...(options.headers || {}),
  };

  const normalizedPath = path.replace(/^\/+/, '');
  return fetch(`${baseUrl}/rest/v1/${normalizedPath}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
}

export function mapSupabaseRowToGame(row: SupabaseGameRow): GameRecordData {
  return {
    universeId: String(row.universe_id),
    rootPlaceId: String(row.root_place_id || row.universe_id),
    name: row.name || `Experience ${row.universe_id}`,
    slug: row.slug || slugify(row.name || `experience-${row.universe_id}`),
    description: row.description ?? '',
    creatorId: String(row.creator_id ?? 0),
    creatorName: row.creator_name || 'Unknown Creator',
    creatorType: row.creator_type === 'User' ? 'User' : 'Group',
    creatorVerified: Boolean(row.creator_verified),
    genre: row.genre || 'All Genres',
    iconUrl: row.icon_url ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    currentCcu: Number(row.current_ccu ?? 0),
    totalVisits: Number(row.total_visits ?? 0),
    favorites: Number(row.favorites ?? 0),
    upVotes: row.up_votes !== null && row.up_votes !== undefined ? Number(row.up_votes) : null,
    downVotes:
      row.down_votes !== null && row.down_votes !== undefined ? Number(row.down_votes) : null,
    likeRatio:
      row.like_ratio !== null && row.like_ratio !== undefined ? Number(row.like_ratio) : null,
    growth1h:
      row.growth_1h !== null && row.growth_1h !== undefined ? Number(row.growth_1h) : null,
    growth24h:
      row.growth_24h !== null && row.growth_24h !== undefined ? Number(row.growth_24h) : null,
    growth7d:
      row.growth_7d !== null && row.growth_7d !== undefined ? Number(row.growth_7d) : null,
    growth30d:
      row.growth_30d !== null && row.growth_30d !== undefined ? Number(row.growth_30d) : null,
    peakCcuObserved: Number(row.peak_ccu_observed ?? row.current_ccu ?? 0),
    peakCcuAt: row.peak_ccu_at ?? row.last_collected_at,
    snapshotCount: undefined,
    trackingTier: row.tracking_tier || 'tier_2',
    active: row.active !== false,
    dataSource: row.data_source_id || 'games.roblox.com/v1/games',
    collectionStatus: row.collection_status || 'observed',
    lastCollectedAt: row.last_collected_at || row.updated_at,
    firstObservedAt: row.first_observed_at || row.last_collected_at,
    robloxUpdatedAt: row.roblox_updated_at ?? null,
    updatedAt: row.updated_at || row.last_collected_at,
  };
}

export function mapSupabaseJobRow(row: SupabaseJobRow): CollectionJob {
  return {
    id: String(row.id),
    tier: row.tier,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: Number(row.duration_ms ?? 0),
    gamesAttempted: Number(row.games_attempted ?? 0),
    gamesSucceeded: Number(row.games_succeeded ?? 0),
    gamesFailed: Number(row.games_failed ?? 0),
    apiRequests: Number(row.api_requests ?? 0),
    http429Count: Number(row.http_429_count ?? 0),
    status: row.status,
    errorSummary: row.error_summary ?? null,
  };
}

/**
 * Verifies a Firebase ID token from the Authorization: Bearer header against
 * Google's Identity Toolkit and confirms the caller is the verified RoMetric owner admin.
 */
export async function verifyAdminBearerToken(
  authHeader: string | null
): Promise<{ email: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 4096) return null;

  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (
      !user?.email ||
      !user.emailVerified ||
      user.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()
    ) {
      return null;
    }

    return { email: user.email };
  } catch {
    return null;
  }
}

export function isValidNumericId(id: string): boolean {
  return /^[0-9]{1,20}$/.test(id);
}

export function isValidTimeRange(value: string): value is TimeRange {
  return ['1h', '24h', '7d', '30d', '90d', 'all'].includes(value);
}

export function isValidTrackingTier(value: unknown): value is TrackingTier {
  return value === 'tier_1' || value === 'tier_2' || value === 'tier_3';
}

function computeWindowGrowth(
  currentCcu: number,
  points: Array<{ ts: number; ccu: number }>,
  windowMs: number,
  toleranceMs: number
): number | null {
  if (points.length < 2) return null;
  const nowTs = points[points.length - 1].ts;
  const targetTs = nowTs - windowMs;
  let best: { ts: number; ccu: number } | null = null;
  let bestDiff = Number.MAX_SAFE_INTEGER;

  for (const pt of points) {
    if (pt.ts >= nowTs - 60_000) continue;
    const diff = Math.abs(pt.ts - targetTs);
    if (diff <= toleranceMs && diff < bestDiff) {
      best = pt;
      bestDiff = diff;
    }
  }

  if (!best || best.ccu <= 0) return null;
  return Number((((currentCcu - best.ccu) / best.ccu) * 100).toFixed(1));
}

function computeDerivedGrowth(
  currentCcu: number,
  points: Array<{ ts: number; ccu: number }>
): { growth1h: number | null; growth24h: number | null } {
  if (points.length < 2) {
    return { growth1h: null, growth24h: null };
  }
  const latestTs = points[points.length - 1].ts;
  const growth1h =
    computeWindowGrowth(currentCcu, points, 60 * 60 * 1000, 55 * 60 * 1000) ??
    (latestTs - points[0].ts >= 60_000 && points[0].ccu > 0
      ? Number((((currentCcu - points[0].ccu) / points[0].ccu) * 100).toFixed(1))
      : null);
  const growth24h = computeWindowGrowth(
    currentCcu,
    points,
    24 * 60 * 60 * 1000,
    4 * 60 * 60 * 1000
  );
  return { growth1h, growth24h };
}

async function fetchRecentSnapshotsByGame(
  universeId?: string
): Promise<Map<string, Array<{ ts: number; ccu: number }>>> {
  const cutoffIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const filter = universeId
    ? `universe_id=eq.${encodeURIComponent(universeId)}&`
    : '';
  const res = await supabaseRest(
    `game_snapshots?select=universe_id,ccu,captured_at&${filter}captured_at=gte.${encodeURIComponent(
      cutoffIso
    )}&order=captured_at.desc&limit=1000`
  );
  const byGame = new Map<string, Array<{ ts: number; ccu: number }>>();
  if (!res.ok) return byGame;

  const snapRows = (await res.json()) as Array<{
    universe_id: number;
    ccu: number;
    captured_at: string;
  }>;
  for (const s of snapRows) {
    const id = String(s.universe_id);
    const ts = new Date(s.captured_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const list = byGame.get(id) ?? [];
    list.push({ ts, ccu: Number(s.ccu ?? 0) });
    byGame.set(id, list);
  }
  for (const list of byGame.values()) {
    list.sort((a, b) => a.ts - b.ts);
  }
  return byGame;
}

export async function fetchSupabaseGamesList(): Promise<GameRecordData[]> {
  const [res, snapsByGame] = await Promise.all([
    supabaseRest('games?select=*&order=current_ccu.desc&limit=500'),
    fetchRecentSnapshotsByGame().catch(
      () => new Map<string, Array<{ ts: number; ccu: number }>>()
    ),
  ]);
  if (!res.ok) {
    throw new Error(`Supabase games query failed (HTTP ${res.status})`);
  }
  const rows = (await res.json()) as SupabaseGameRow[];
  return rows.map((row) => {
    const game = mapSupabaseRowToGame(row);
    const pts = snapsByGame.get(game.universeId) ?? [];
    game.snapshotCount = pts.length;
    if (pts.length >= 2) {
      const derived = computeDerivedGrowth(game.currentCcu, pts);
      if (game.growth1h === null || game.growth1h === undefined) {
        game.growth1h = derived.growth1h;
      }
      if (game.growth24h === null || game.growth24h === undefined) {
        game.growth24h = derived.growth24h;
      }
    }
    return game;
  });
}

export async function fetchSupabaseGameById(
  universeId: string
): Promise<GameRecordData | null> {
  if (!isValidNumericId(universeId)) return null;
  const [res, snapsByGame] = await Promise.all([
    supabaseRest(
      `games?select=*&universe_id=eq.${encodeURIComponent(universeId)}&limit=1`
    ),
    fetchRecentSnapshotsByGame(universeId).catch(
      () => new Map<string, Array<{ ts: number; ccu: number }>>()
    ),
  ]);
  if (!res.ok) {
    throw new Error(`Supabase game query failed (HTTP ${res.status})`);
  }
  const rows = (await res.json()) as SupabaseGameRow[];
  if (!rows[0]) return null;
  const game = mapSupabaseRowToGame(rows[0]);
  const pts = snapsByGame.get(game.universeId) ?? [];
  game.snapshotCount = pts.length;
  if (pts.length >= 2) {
    const derived = computeDerivedGrowth(game.currentCcu, pts);
    if (game.growth1h === null || game.growth1h === undefined) {
      game.growth1h = derived.growth1h;
    }
    if (game.growth24h === null || game.growth24h === undefined) {
      game.growth24h = derived.growth24h;
    }
  }
  return game;
}

export async function fetchSupabaseGameHistory(
  universeId: string,
  range: TimeRange
): Promise<{
  points: Array<{
    timestamp: string;
    timestampMs: number;
    ccu: number;
    minCcu?: number;
    maxCcu?: number;
    visits: number;
    favorites: number;
    sourceTable: 'game_snapshots' | 'game_hourly_stats' | 'game_daily_stats';
  }>;
  peakRecord: GamePeakRecord | null;
}> {
  const nowMs = Date.now();
  const rangeMsMap: Record<TimeRange, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    all: Number.MAX_SAFE_INTEGER,
  };
  const cutoffIso =
    range === 'all' ? null : new Date(nowMs - rangeMsMap[range]).toISOString();
  const idEnc = encodeURIComponent(universeId);

  const [peakRes, rawRes] = await Promise.all([
    supabaseRest(`game_records?select=*&universe_id=eq.${idEnc}&limit=1`),
    supabaseRest(
      `game_snapshots?select=*&universe_id=eq.${idEnc}${
        cutoffIso ? `&captured_at=gte.${encodeURIComponent(cutoffIso)}` : ''
      }&order=captured_at.asc&limit=500`
    ),
  ]);

  let peakRecord: GamePeakRecord | null = null;
  if (peakRes.ok) {
    const peakRows = (await peakRes.json()) as SupabasePeakRow[];
    if (peakRows[0]) {
      peakRecord = {
        universeId,
        gameName: '',
        highestObservedCcu: Number(peakRows[0].highest_observed_ccu),
        highestObservedAt: peakRows[0].highest_observed_at,
        provenance: peakRows[0].provenance,
        updatedAt: peakRows[0].updated_at,
      };
    }
  }

  const rawSnaps: SupabaseSnapshotRow[] = rawRes.ok
    ? ((await rawRes.json()) as SupabaseSnapshotRow[])
    : [];

  if (range === '1h' || range === '24h') {
    return {
      peakRecord,
      points: rawSnaps.map((s) => ({
        timestamp: s.captured_at,
        timestampMs: new Date(s.captured_at).getTime(),
        ccu: Number(s.ccu),
        visits: Number(s.visits),
        favorites: Number(s.favorites),
        sourceTable: 'game_snapshots',
      })),
    };
  }

  if (range === '7d') {
    const hourlyRes = await supabaseRest(
      `game_hourly_stats?select=*&universe_id=eq.${idEnc}${
        cutoffIso ? `&hour_bucket=gte.${encodeURIComponent(cutoffIso)}` : ''
      }&order=hour_bucket.asc&limit=250`
    );
    const hourlyRows: SupabaseHourlyRow[] = hourlyRes.ok
      ? ((await hourlyRes.json()) as SupabaseHourlyRow[])
      : [];

    if (hourlyRows.length >= 3) {
      return {
        peakRecord,
        points: hourlyRows.map((h) => ({
          timestamp: h.hour_bucket,
          timestampMs: new Date(h.hour_bucket).getTime(),
          ccu: Math.round(Number(h.avg_ccu)),
          minCcu: Number(h.min_ccu),
          maxCcu: Number(h.max_ccu),
          visits: Number(h.latest_visits),
          favorites: Number(h.latest_favorites),
          sourceTable: 'game_hourly_stats',
        })),
      };
    }

    return {
      peakRecord,
      points: rawSnaps.map((s) => ({
        timestamp: s.captured_at,
        timestampMs: new Date(s.captured_at).getTime(),
        ccu: Number(s.ccu),
        visits: Number(s.visits),
        favorites: Number(s.favorites),
        sourceTable: 'game_snapshots',
      })),
    };
  }

  const dailyRes = await supabaseRest(
    `game_daily_stats?select=*&universe_id=eq.${idEnc}${
      cutoffIso
        ? `&day_bucket=gte.${encodeURIComponent(cutoffIso.slice(0, 10))}`
        : ''
    }&order=day_bucket.asc&limit=365`
  );
  const dailyRows: SupabaseDailyRow[] = dailyRes.ok
    ? ((await dailyRes.json()) as SupabaseDailyRow[])
    : [];

  if (dailyRows.length >= 2) {
    return {
      peakRecord,
      points: dailyRows.map((d) => ({
        timestamp: `${d.day_bucket}T00:00:00Z`,
        timestampMs: new Date(`${d.day_bucket}T00:00:00Z`).getTime(),
        ccu: Math.round(Number(d.avg_ccu)),
        minCcu: Number(d.min_ccu),
        maxCcu: Number(d.max_ccu),
        visits: Number(d.visits_end),
        favorites: Number(d.favorites_end),
        sourceTable: 'game_daily_stats',
      })),
    };
  }

  return {
    peakRecord,
    points: rawSnaps.map((s) => ({
      timestamp: s.captured_at,
      timestampMs: new Date(s.captured_at).getTime(),
      ccu: Number(s.ccu),
      visits: Number(s.visits),
      favorites: Number(s.favorites),
      sourceTable: 'game_snapshots',
    })),
  };
}

export async function saveGameToSupabase(
  payload: LiveRobloxGamePayload,
  tier: TrackingTier,
  capturedAt: string
): Promise<GameRecordData> {
  const existing = await fetchSupabaseGameById(payload.universeId);
  const prevPeak = existing?.peakCcuObserved ?? 0;
  const isNewPeak = payload.currentCcu >= prevPeak;
  const capturedMs = new Date(capturedAt).getTime();
  const capturedMinute = Math.floor(capturedMs / 60_000);

  const gameRow = {
    universe_id: Number(payload.universeId),
    root_place_id: Number(payload.rootPlaceId || payload.universeId),
    name: payload.name.slice(0, 200),
    slug: slugify(payload.name).slice(0, 220),
    description: (payload.description || '').slice(0, 1900),
    creator_id: Number(payload.creatorId) || 0,
    creator_name: payload.creatorName.slice(0, 120),
    creator_type: payload.creatorType,
    creator_verified: Boolean(payload.creatorVerified),
    genre: payload.genre.slice(0, 80),
    icon_url: payload.iconUrl ?? existing?.iconUrl ?? null,
    thumbnail_url: payload.thumbnailUrl ?? existing?.thumbnailUrl ?? null,
    current_ccu: payload.currentCcu,
    total_visits: payload.totalVisits,
    favorites: payload.favorites,
    up_votes: payload.upVotes,
    down_votes: payload.downVotes,
    like_ratio: payload.likeRatio,
    peak_ccu_observed: isNewPeak ? payload.currentCcu : prevPeak,
    peak_ccu_at: isNewPeak ? capturedAt : existing?.peakCcuAt ?? capturedAt,
    tracking_tier: tier,
    active: true,
    data_source_id: 'roblox_games_v1',
    collection_status: payload.upVotes !== null ? 'observed' : 'partial',
    first_observed_at: existing?.firstObservedAt ?? capturedAt,
    last_collected_at: capturedAt,
    roblox_updated_at: payload.robloxUpdatedAt ?? existing?.robloxUpdatedAt ?? null,
    updated_at: capturedAt,
  };

  const upsertGameRes = await supabaseRest('games?on_conflict=universe_id', {
    method: 'POST',
    requireAdminKey: true,
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: [gameRow],
  });
  if (!upsertGameRes.ok) {
    const body = await upsertGameRes.text();
    throw new Error(`Supabase game upsert failed (HTTP ${upsertGameRes.status}): ${body.slice(0, 180)}`);
  }

  await supabaseRest('game_snapshots?on_conflict=universe_id,captured_minute', {
    method: 'POST',
    requireAdminKey: true,
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: [
      {
        universe_id: Number(payload.universeId),
        ccu: payload.currentCcu,
        visits: payload.totalVisits,
        favorites: payload.favorites,
        up_votes: payload.upVotes,
        down_votes: payload.downVotes,
        captured_at: capturedAt,
        captured_minute: capturedMinute,
        data_source_id: 'roblox_games_v1',
        collection_status: payload.upVotes !== null ? 'observed' : 'partial',
      },
    ],
  });

  if (isNewPeak || !existing) {
    await supabaseRest('game_records?on_conflict=universe_id', {
      method: 'POST',
      requireAdminKey: true,
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: [
        {
          universe_id: Number(payload.universeId),
          highest_observed_ccu: gameRow.peak_ccu_observed,
          highest_observed_at: gameRow.peak_ccu_at,
          provenance: 'observed_peak',
          updated_at: capturedAt,
        },
      ],
    });
  }

  return mapSupabaseRowToGame(gameRow as unknown as SupabaseGameRow);
}

export async function runSupabaseCollectionCycle(options: {
  tier: 'all' | 'tier_1' | 'tier_2' | 'tier_3' | 'manual';
  triggeredBy: string;
  includeLiveDiscovery?: boolean;
}): Promise<{ job: CollectionJob; updatedGames: GameRecordData[] }> {
  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();

  const existingGames = await fetchSupabaseGamesList();
  const existingMap = new Map(existingGames.map((g) => [g.universeId, g]));

  const shouldDiscover =
    Boolean(options.includeLiveDiscovery) ||
    (existingGames.length < 25 &&
      (options.tier === 'all' || options.tier === 'manual'));

  const targetMap = new Map<string, TrackingTier>();
  for (const g of existingGames) {
    if (!g.active) continue;
    if (
      options.tier === 'all' ||
      options.tier === 'manual' ||
      g.trackingTier === options.tier
    ) {
      targetMap.set(g.universeId, g.trackingTier);
    }
  }

  if (shouldDiscover) {
    try {
      const discovered = await discoverLiveRobloxCharts(80, true);
      for (const entry of discovered) {
        if (!targetMap.has(entry.universeId)) {
          targetMap.set(entry.universeId, entry.tier);
        }
      }
    } catch {
      // Fallback to verified seed catalog below
    }
    for (const seed of SEED_UNIVERSES) {
      if (!targetMap.has(seed.universeId)) {
        targetMap.set(seed.universeId, seed.tier);
      }
    }
  } else if (existingGames.length === 0) {
    for (const seed of SEED_UNIVERSES) {
      targetMap.set(seed.universeId, seed.tier);
    }
  }

  const targetIds = Array.from(targetMap.keys()).slice(0, 120);
  const [fetchRes, snapsByGame] = await Promise.all([
    fetchLiveRobloxGames(targetIds, true),
    fetchRecentSnapshotsByGame().catch(
      () => new Map<string, Array<{ ts: number; ccu: number }>>()
    ),
  ]);
  const capturedAt = fetchRes.capturedAt;
  const capturedMs = new Date(capturedAt).getTime();
  const capturedMinute = Math.floor(capturedMs / 60_000);
  const errors = [...fetchRes.telemetry.errors];

  const gameRows: Array<Record<string, unknown>> = [];
  const snapshotRows: Array<Record<string, unknown>> = [];
  const peakRows: Array<Record<string, unknown>> = [];

  for (const payload of fetchRes.games) {
    const prev = existingMap.get(payload.universeId) ?? null;
    const prevPeak = prev?.peakCcuObserved ?? 0;
    const isNewPeak = payload.currentCcu >= prevPeak;
    const historyPts = [
      ...(snapsByGame.get(payload.universeId) ?? []),
      { ts: capturedMs, ccu: payload.currentCcu },
    ].sort((a, b) => a.ts - b.ts);
    const derived = computeDerivedGrowth(payload.currentCcu, historyPts);

    gameRows.push({
      universe_id: Number(payload.universeId),
      root_place_id: Number(payload.rootPlaceId || payload.universeId),
      name: payload.name.slice(0, 200),
      slug: slugify(payload.name).slice(0, 220),
      description: (payload.description || '').slice(0, 1900),
      creator_id: Number(payload.creatorId) || 0,
      creator_name: payload.creatorName.slice(0, 120),
      creator_type: payload.creatorType,
      creator_verified: Boolean(payload.creatorVerified),
      genre: payload.genre.slice(0, 80),
      icon_url: payload.iconUrl ?? prev?.iconUrl ?? null,
      thumbnail_url: payload.thumbnailUrl ?? prev?.thumbnailUrl ?? null,
      current_ccu: payload.currentCcu,
      total_visits: payload.totalVisits,
      favorites: payload.favorites,
      up_votes: payload.upVotes,
      down_votes: payload.downVotes,
      like_ratio: payload.likeRatio,
      growth_1h: derived.growth1h,
      growth_24h: derived.growth24h,
      peak_ccu_observed: isNewPeak ? payload.currentCcu : prevPeak,
      peak_ccu_at: isNewPeak ? capturedAt : prev?.peakCcuAt ?? capturedAt,
      tracking_tier: targetMap.get(payload.universeId) ?? 'tier_2',
      active: prev?.active ?? true,
      data_source_id: 'roblox_games_v1',
      collection_status: payload.upVotes !== null ? 'observed' : 'partial',
      first_observed_at: prev?.firstObservedAt ?? capturedAt,
      last_collected_at: capturedAt,
      roblox_updated_at: payload.robloxUpdatedAt ?? prev?.robloxUpdatedAt ?? null,
      updated_at: capturedAt,
    });

    snapshotRows.push({
      universe_id: Number(payload.universeId),
      ccu: payload.currentCcu,
      visits: payload.totalVisits,
      favorites: payload.favorites,
      up_votes: payload.upVotes,
      down_votes: payload.downVotes,
      captured_at: capturedAt,
      captured_minute: capturedMinute,
      data_source_id: 'roblox_games_v1',
      collection_status: payload.upVotes !== null ? 'observed' : 'partial',
    });

    if (isNewPeak || !prev) {
      peakRows.push({
        universe_id: Number(payload.universeId),
        highest_observed_ccu: isNewPeak ? payload.currentCcu : prevPeak,
        highest_observed_at: isNewPeak ? capturedAt : prev?.peakCcuAt ?? capturedAt,
        provenance: 'observed_peak',
        updated_at: capturedAt,
      });
    }
  }

  if (gameRows.length > 0) {
    const gamesWrite = await supabaseRest('games?on_conflict=universe_id', {
      method: 'POST',
      requireAdminKey: true,
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: gameRows,
    });
    if (!gamesWrite.ok) {
      const text = await gamesWrite.text();
      errors.push(`games write HTTP ${gamesWrite.status}: ${text.slice(0, 180)}`);
    }

    const snapsWrite = await supabaseRest(
      'game_snapshots?on_conflict=universe_id,captured_minute',
      {
        method: 'POST',
        requireAdminKey: true,
        headers: { Prefer: 'resolution=ignore-duplicates' },
        body: snapshotRows,
      }
    );
    if (!snapsWrite.ok) {
      const text = await snapsWrite.text();
      errors.push(`snapshots write HTTP ${snapsWrite.status}: ${text.slice(0, 180)}`);
    }

    if (peakRows.length > 0) {
      await supabaseRest('game_records?on_conflict=universe_id', {
        method: 'POST',
        requireAdminKey: true,
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: peakRows,
      });
    }
  }

  const completedMs = Date.now();
  const completedAt = new Date(completedMs).toISOString();
  const succeeded = gameRows.length;
  const failed = Math.max(0, targetIds.length - succeeded);
  const status: CollectionJob['status'] =
    succeeded === 0 ? 'failed' : errors.length > 0 || failed > 0 ? 'partial' : 'success';

  const jobPayload = {
    tier: options.tier,
    triggered_by: options.triggeredBy.slice(0, 120),
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: completedMs - startedMs,
    games_attempted: targetIds.length,
    games_succeeded: succeeded,
    games_failed: failed,
    api_requests: fetchRes.telemetry.apiRequests,
    http_429_count: fetchRes.telemetry.http429Count,
    status,
    error_summary: errors.length > 0 ? errors.join(' | ').slice(0, 950) : null,
  };

  await supabaseRest('collection_jobs', {
    method: 'POST',
    requireAdminKey: true,
    body: jobPayload,
  });

  const updatedGames = await fetchSupabaseGamesList();
  return {
    job: {
      id: `job_${startedMs}`,
      tier: options.tier,
      triggeredBy: jobPayload.triggered_by,
      startedAt,
      completedAt,
      durationMs: jobPayload.duration_ms,
      gamesAttempted: jobPayload.games_attempted,
      gamesSucceeded: jobPayload.games_succeeded,
      gamesFailed: jobPayload.games_failed,
      apiRequests: jobPayload.api_requests,
      http429Count: jobPayload.http_429_count,
      status,
      errorSummary: jobPayload.error_summary,
    },
    updatedGames,
  };
}
