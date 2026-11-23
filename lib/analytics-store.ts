import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { SEED_UNIVERSES } from './seed-universes';
import {
  getDayBucket,
  getHourBucket,
  slugify,
} from './format';
import type {
  CollectionJob,
  DataSourceInfo,
  GameDailyStat,
  GameHourlyStat,
  GamePeakRecord,
  GameRecordData,
  GameSnapshot,
  LiveRobloxGamePayload,
  RobloxFetchResponse,
  SystemConfig,
  TimeRange,
  TrackingTier,
} from './types';

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  paused: false,
  retentionRawHours: 30,
  retentionHourlyDays: 7,
  tier1IntervalMin: 5,
  tier2IntervalMin: 30,
  tier3IntervalMin: 30,
};

export const OFFICIAL_DATA_SOURCES: DataSourceInfo[] = [
  {
    id: 'roblox_games_v1',
    name: 'Roblox Public Games API v1',
    endpoint: 'https://games.roblox.com/v1/games',
    batchLimit: 50,
    status: 'active',
    notes: 'Returns live concurrent players (CCU), total visits, favorites, creator, and genre metadata.',
  },
  {
    id: 'roblox_votes_v1',
    name: 'Roblox Public Votes API v1',
    endpoint: 'https://games.roblox.com/v1/games/votes',
    batchLimit: 50,
    status: 'active',
    notes: 'Returns verified upvote and downvote counts used to calculate like ratio.',
  },
  {
    id: 'roblox_thumbnails_v1',
    name: 'Roblox Thumbnails CDN API v1',
    endpoint: 'https://thumbnails.roblox.com/v1/games/icons',
    batchLimit: 50,
    status: 'active',
    notes: 'Returns official game icons and 16:9 cover thumbnails cached for 15+ minutes.',
  },
];

export function livePayloadToGameRecord(
  payload: LiveRobloxGamePayload,
  capturedAt: string,
  tier: TrackingTier = 'tier_1',
  existing?: GameRecordData | null
): GameRecordData {
  const prevPeak = existing?.peakCcuObserved ?? 0;
  const isNewPeak = payload.currentCcu >= prevPeak;

  return {
    universeId: payload.universeId,
    rootPlaceId: payload.rootPlaceId,
    name: payload.name.slice(0, 200),
    slug: slugify(payload.name).slice(0, 220),
    description: (payload.description || '').slice(0, 1900),
    creatorId: payload.creatorId.slice(0, 32),
    creatorName: payload.creatorName.slice(0, 120),
    creatorType: payload.creatorType,
    creatorVerified: Boolean(payload.creatorVerified),
    genre: payload.genre.slice(0, 80),
    iconUrl: payload.iconUrl ? payload.iconUrl.slice(0, 500) : existing?.iconUrl ?? null,
    thumbnailUrl: payload.thumbnailUrl
      ? payload.thumbnailUrl.slice(0, 500)
      : existing?.thumbnailUrl ?? null,
    currentCcu: payload.currentCcu,
    totalVisits: payload.totalVisits,
    favorites: payload.favorites,
    upVotes: payload.upVotes,
    downVotes: payload.downVotes,
    likeRatio: payload.likeRatio,
    growth1h: existing?.growth1h ?? null,
    growth24h: existing?.growth24h ?? null,
    growth7d: existing?.growth7d ?? null,
    growth30d: existing?.growth30d ?? null,
    peakCcuObserved: isNewPeak ? payload.currentCcu : prevPeak,
    peakCcuAt: isNewPeak ? capturedAt : existing?.peakCcuAt ?? capturedAt,
    snapshotCount: (existing?.snapshotCount ?? 0) + (existing ? 1 : 1),
    trackingTier: existing?.trackingTier ?? tier,
    active: existing?.active ?? true,
    dataSource: 'games.roblox.com/v1/games',
    collectionStatus: payload.upVotes !== null ? 'observed' : 'partial',
    lastCollectedAt: capturedAt,
    firstObservedAt: existing?.firstObservedAt ?? capturedAt,
    robloxUpdatedAt: payload.robloxUpdatedAt ?? existing?.robloxUpdatedAt ?? null,
    updatedAt: capturedAt,
  };
}

function computeWindowGrowth(
  currentCcu: number,
  points: Array<{ ts: number; ccu: number }>,
  targetAgoMs: number,
  toleranceMs: number
): number | null {
  if (points.length < 2) return null;
  const nowMs = points[points.length - 1].ts;
  const targetTs = nowMs - targetAgoMs;

  // Find closest observation within tolerance, or earliest if window is shorter than 1h for 1h growth
  let closest: { ts: number; ccu: number } | null = null;
  let bestDiff = Infinity;

  for (const pt of points) {
    if (pt.ts >= nowMs) continue;
    const diff = Math.abs(pt.ts - targetTs);
    if (diff < bestDiff && diff <= toleranceMs) {
      bestDiff = diff;
      closest = pt;
    }
  }

  if (!closest || closest.ccu <= 0) return null;
  return Number((((currentCcu - closest.ccu) / closest.ccu) * 100).toFixed(1));
}

export async function fetchAllStoredGames(): Promise<GameRecordData[]> {
  try {
    const res = await fetch('/api/supabase/games', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as {
        configured?: boolean;
        games?: GameRecordData[];
      };
      if (data.configured) {
        return (data.games ?? []).sort((a, b) => b.currentCcu - a.currentCcu);
      }
    }
  } catch {
    // Fall through to Firestore if Supabase proxy is unreachable
  }

  const path = 'games';
  try {
    const snap = await getDocs(collection(db, path));
    const list: GameRecordData[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as GameRecordData);
    });
    return list.sort((a, b) => b.currentCcu - a.currentCcu);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchStoredGameById(
  universeId: string
): Promise<GameRecordData | null> {
  try {
    const res = await fetch(
      `/api/supabase/games/${encodeURIComponent(universeId)}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        configured?: boolean;
        game?: GameRecordData | null;
      };
      if (data.configured) {
        return data.game ?? null;
      }
    }
  } catch {
    // Fall through to Firestore
  }

  const path = `games/${universeId}`;
  try {
    const snap = await getDoc(doc(db, 'games', universeId));
    if (!snap.exists()) return null;
    return snap.data() as GameRecordData;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchGameHistory(
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
  try {
    const res = await fetch(
      `/api/supabase/history?universeId=${encodeURIComponent(universeId)}&range=${encodeURIComponent(range)}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        configured?: boolean;
        points?: Array<{
          timestamp: string;
          timestampMs: number;
          ccu: number;
          minCcu?: number;
          maxCcu?: number;
          visits: number;
          favorites: number;
          sourceTable: 'game_snapshots' | 'game_hourly_stats' | 'game_daily_stats';
        }>;
        peakRecord?: GamePeakRecord | null;
      };
      if (data.configured) {
        return {
          points: data.points ?? [],
          peakRecord: data.peakRecord ?? null,
        };
      }
    }
  } catch {
    // Fall through to Firestore
  }

  const nowMs = Date.now();
  const rangeMsMap: Record<TimeRange, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    all: Number.MAX_SAFE_INTEGER,
  };
  const cutoffMs = range === 'all' ? 0 : nowMs - rangeMsMap[range];

  let peakRecord: GamePeakRecord | null = null;
  try {
    const peakSnap = await getDoc(doc(db, 'game_records', universeId));
    if (peakSnap.exists()) {
      peakRecord = peakSnap.data() as GamePeakRecord;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `game_records/${universeId}`);
  }

  // Raw snapshots for 1h & 24h; hourly for 7d; daily for 30d/90d/all (with raw fallback when young)
  const rawPath = 'game_snapshots';
  let rawSnaps: GameSnapshot[] = [];
  try {
    const q = query(
      collection(db, rawPath),
      where('universeId', '==', universeId),
      limit(400)
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      rawSnaps.push({ id: d.id, ...(d.data() as Omit<GameSnapshot, 'id'>) });
    });
    rawSnaps.sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, rawPath);
  }

  if (range === '1h' || range === '24h') {
    const filtered = rawSnaps.filter((s) => s.capturedAtMs >= cutoffMs);
    return {
      peakRecord,
      points: filtered.map((s) => ({
        timestamp: s.capturedAt,
        timestampMs: s.capturedAtMs,
        ccu: s.ccu,
        visits: s.visits,
        favorites: s.favorites,
        sourceTable: 'game_snapshots',
      })),
    };
  }

  if (range === '7d') {
    let hourly: GameHourlyStat[] = [];
    try {
      const q = query(
        collection(db, 'game_hourly_stats'),
        where('universeId', '==', universeId),
        limit(200)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        hourly.push({ id: d.id, ...(d.data() as Omit<GameHourlyStat, 'id'>) });
      });
      hourly = hourly
        .filter((h) => h.bucketMs >= cutoffMs)
        .sort((a, b) => a.bucketMs - b.bucketMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'game_hourly_stats');
    }

    // If fewer than 3 hourly buckets exist yet, fall back to raw snapshots so recent observations still plot accurately
    if (hourly.length >= 3) {
      return {
        peakRecord,
        points: hourly.map((h) => ({
          timestamp: h.hourBucket,
          timestampMs: h.bucketMs,
          ccu: Math.round(h.avgCcu),
          minCcu: h.minCcu,
          maxCcu: h.maxCcu,
          visits: h.latestVisits,
          favorites: h.latestFavorites,
          sourceTable: 'game_hourly_stats',
        })),
      };
    }

    return {
      peakRecord,
      points: rawSnaps
        .filter((s) => s.capturedAtMs >= cutoffMs)
        .map((s) => ({
          timestamp: s.capturedAt,
          timestampMs: s.capturedAtMs,
          ccu: s.ccu,
          visits: s.visits,
          favorites: s.favorites,
          sourceTable: 'game_snapshots',
        })),
    };
  }

  // 30d, 90d, all -> query game_daily_stats, fallback to raw if tracking just started
  let daily: GameDailyStat[] = [];
  try {
    const q = query(
      collection(db, 'game_daily_stats'),
      where('universeId', '==', universeId),
      limit(365)
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      daily.push({ id: d.id, ...(d.data() as Omit<GameDailyStat, 'id'>) });
    });
    daily = daily
      .filter((d) => d.bucketMs >= cutoffMs)
      .sort((a, b) => a.bucketMs - b.bucketMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'game_daily_stats');
  }

  if (daily.length >= 2) {
    return {
      peakRecord,
      points: daily.map((d) => ({
        timestamp: `${d.dayBucket}T00:00:00Z`,
        timestampMs: d.bucketMs,
        ccu: Math.round(d.avgCcu),
        minCcu: d.minCcu,
        maxCcu: d.maxCcu,
        visits: d.visitsEnd,
        favorites: d.favoritesEnd,
        sourceTable: 'game_daily_stats',
      })),
    };
  }

  return {
    peakRecord,
    points: rawSnaps.map((s) => ({
      timestamp: s.capturedAt,
      timestampMs: s.capturedAtMs,
      ccu: s.ccu,
      visits: s.visits,
      favorites: s.favorites,
      sourceTable: 'game_snapshots',
    })),
  };
}

export async function fetchLiveFallbackGames(): Promise<{
  games: GameRecordData[];
  capturedAt: string;
}> {
  const res = await fetch('/api/roblox/fetch', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch live Roblox catalog.');
  }
  const data = (await res.json()) as RobloxFetchResponse;
  const tierMap = new Map(SEED_UNIVERSES.map((s) => [s.universeId, s.tier]));
  const games = data.games
    .map((g) =>
      livePayloadToGameRecord(g, data.capturedAt, tierMap.get(g.universeId) ?? 'tier_2')
    )
    .map((g) => ({ ...g, snapshotCount: 1 }))
    .sort((a, b) => b.currentCcu - a.currentCcu);

  return { games, capturedAt: data.capturedAt };
}

// ============================================================================
// ADMIN-ONLY COLLECTOR & OPERATIONS
// ============================================================================

export async function fetchSystemConfig(): Promise<SystemConfig> {
  const path = 'system_config/collector';
  try {
    const snap = await getDoc(doc(db, 'system_config', 'collector'));
    if (!snap.exists()) return DEFAULT_SYSTEM_CONFIG;
    return snap.data() as SystemConfig;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveSystemConfig(
  config: SystemConfig,
  updatedBy: string
): Promise<void> {
  const path = 'system_config/collector';
  try {
    await setDoc(doc(db, 'system_config', 'collector'), {
      paused: Boolean(config.paused),
      retentionRawHours: Number(config.retentionRawHours),
      retentionHourlyDays: Number(config.retentionHourlyDays),
      tier1IntervalMin: Number(config.tier1IntervalMin),
      tier2IntervalMin: Number(config.tier2IntervalMin),
      tier3IntervalMin: Number(config.tier3IntervalMin),
      updatedBy: updatedBy.slice(0, 120),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCollectionJobs(maxCount = 25): Promise<CollectionJob[]> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch('/api/supabase/admin', {
      cache: 'no-store',
      headers,
    });
    if (res.ok) {
      const data = (await res.json()) as {
        configured?: boolean;
        jobs?: CollectionJob[];
      };
      if (data.configured) {
        return (data.jobs ?? []).slice(0, maxCount);
      }
    }
  } catch {
    // Fall through to Firestore
  }

  const path = 'collection_jobs';
  try {
    const q = query(
      collection(db, path),
      orderBy('startedAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    const jobs: CollectionJob[] = [];
    snap.forEach((d) => {
      jobs.push({ id: d.id, ...(d.data() as Omit<CollectionJob, 'id'>) });
    });
    return jobs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function countStoredSnapshotsSample(): Promise<number> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch('/api/supabase/admin', {
      cache: 'no-store',
      headers,
    });
    if (res.ok) {
      const data = (await res.json()) as {
        configured?: boolean;
        snapshotCount?: number;
      };
      if (data.configured) {
        return data.snapshotCount ?? 0;
      }
    }
  } catch {
    // Fall through to Firestore
  }

  const path = 'game_snapshots';
  try {
    const snap = await getDocs(query(collection(db, path), limit(2500)));
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function seedDataSourcesIfNeeded(): Promise<void> {
  const nowIso = new Date().toISOString();
  for (const ds of OFFICIAL_DATA_SOURCES) {
    const ref = doc(db, 'data_sources', ds.id);
    try {
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          name: ds.name,
          endpoint: ds.endpoint,
          batchLimit: ds.batchLimit,
          status: ds.status,
          notes: ds.notes ?? '',
          updatedAt: nowIso,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `data_sources/${ds.id}`);
    }
  }
}

export async function addGameToTracking(
  payload: LiveRobloxGamePayload,
  tier: TrackingTier,
  capturedAt: string
): Promise<GameRecordData> {
  const authHeaders = await getAdminAuthHeaders();
  const supaRes = await fetch('/api/supabase/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ action: 'add_game', payload, tier, capturedAt }),
  });
  if (supaRes.ok) {
    const data = (await supaRes.json()) as {
      configured?: boolean;
      game?: GameRecordData;
      error?: string;
    };
    if (data.configured) {
      if (!data.game) {
        throw new Error(data.error || 'Failed to save game to Supabase.');
      }
      return data.game;
    }
  } else if (supaRes.status === 401 || supaRes.status === 403 || supaRes.status >= 500) {
    const errBody = (await supaRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Supabase admin error (HTTP ${supaRes.status})`);
  }

  const existing = await fetchStoredGameById(payload.universeId);
  const record = livePayloadToGameRecord(payload, capturedAt, tier, existing);
  if (!existing) {
    record.snapshotCount = 1;
  }

  const gamePath = `games/${payload.universeId}`;
  try {
    await setDoc(doc(db, 'games', payload.universeId), record);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, gamePath);
  }

  // Write initial immutable snapshot
  const nowDate = new Date(capturedAt);
  const minuteBucket = Math.floor(nowDate.getTime() / 60_000);
  const snapId = `${payload.universeId}_${minuteBucket}`;
  try {
    await setDoc(doc(db, 'game_snapshots', snapId), {
      universeId: payload.universeId,
      ccu: payload.currentCcu,
      visits: payload.totalVisits,
      favorites: payload.favorites,
      upVotes: payload.upVotes,
      downVotes: payload.downVotes,
      capturedAt,
      capturedAtMs: nowDate.getTime(),
      dataSource: 'games.roblox.com/v1/games',
      collectionStatus: payload.upVotes !== null ? 'observed' : 'partial',
    });
  } catch (error) {
    // Ignore duplicate snapshot within the same minute
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('permission') && !msg.includes('PERMISSION_DENIED')) {
      handleFirestoreError(error, OperationType.CREATE, `game_snapshots/${snapId}`);
    }
  }

  // Write initial peak record
  try {
    await setDoc(doc(db, 'game_records', payload.universeId), {
      universeId: payload.universeId,
      gameName: record.name,
      highestObservedCcu: record.peakCcuObserved,
      highestObservedAt: record.peakCcuAt || capturedAt,
      provenance: 'observed_peak',
      updatedAt: capturedAt,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `game_records/${payload.universeId}`);
  }

  return record;
}

export async function updateGameTrackingSettings(
  game: GameRecordData,
  updates: { trackingTier?: TrackingTier; active?: boolean }
): Promise<GameRecordData> {
  const updated: GameRecordData = {
    ...game,
    trackingTier: updates.trackingTier ?? game.trackingTier,
    active: updates.active ?? game.active,
    updatedAt: new Date().toISOString(),
  };

  const authHeaders = await getAdminAuthHeaders();
  const supaRes = await fetch('/api/supabase/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      action: 'update_game',
      universeId: game.universeId,
      trackingTier: updated.trackingTier,
      active: updated.active,
    }),
  });
  if (supaRes.ok) {
    const data = (await supaRes.json()) as { configured?: boolean };
    if (data.configured) return updated;
  } else if (supaRes.status === 401 || supaRes.status === 403 || supaRes.status >= 500) {
    const errBody = (await supaRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Supabase update error (HTTP ${supaRes.status})`);
  }

  const path = `games/${game.universeId}`;
  try {
    await setDoc(doc(db, 'games', game.universeId), updated);
    return updated;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeGameFromTracking(universeId: string): Promise<void> {
  const authHeaders = await getAdminAuthHeaders();
  const supaRes = await fetch('/api/supabase/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ action: 'delete_game', universeId }),
  });
  if (supaRes.ok) {
    const data = (await supaRes.json()) as { configured?: boolean };
    if (data.configured) return;
  } else if (supaRes.status === 401 || supaRes.status === 403 || supaRes.status >= 500) {
    const errBody = (await supaRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Supabase delete error (HTTP ${supaRes.status})`);
  }

  const path = `games/${universeId}`;
  try {
    await deleteDoc(doc(db, 'games', universeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function runCollectionCycle(options: {
  tier: 'all' | 'tier_1' | 'tier_2' | 'tier_3' | 'manual';
  triggeredBy: string;
  includeLiveDiscovery?: boolean;
  onProgress?: (message: string) => void;
}): Promise<{
  job: CollectionJob;
  updatedGames: GameRecordData[];
}> {
  options.onProgress?.('Syncing live Roblox charts to database...');
  const authHeaders = await getAdminAuthHeaders();
  const supaRes = await fetch('/api/supabase/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      action: 'collect',
      tier: options.tier,
      includeLiveDiscovery: Boolean(options.includeLiveDiscovery),
    }),
  });
  if (supaRes.ok) {
    const data = (await supaRes.json()) as {
      configured?: boolean;
      job?: CollectionJob;
      updatedGames?: GameRecordData[];
      error?: string;
    };
    if (data.configured) {
      if (!data.job) {
        throw new Error(data.error || 'Supabase collection failed.');
      }
      return {
        job: data.job,
        updatedGames: data.updatedGames ?? [],
      };
    }
  } else if (supaRes.status === 401 || supaRes.status === 403 || supaRes.status >= 500) {
    const errBody = (await supaRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Supabase collection error (HTTP ${supaRes.status})`);
  }

  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();

  options.onProgress?.('Checking data sources & existing catalog...');
  await seedDataSourcesIfNeeded();

  const existingGames = await fetchAllStoredGames();
  const existingMap = new Map(existingGames.map((g) => [g.universeId, g]));

  // Automatically merge live Roblox top charts when requested OR when catalog is small (< 25 games)
  const shouldDiscover =
    Boolean(options.includeLiveDiscovery) ||
    (existingGames.length < 25 &&
      (options.tier === 'all' || options.tier === 'manual'));

  const targetMap = new Map<string, TrackingTier>();

  // Always preserve existing active games matching the requested tier
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
    options.onProgress?.(
      'Discovering live Roblox Explore charts (Top Playing, Trending, Up-and-Coming & more)...'
    );
    try {
      const discoverRes = await fetch('/api/roblox/discover?limit=500&fresh=1', {
        cache: 'no-store',
      });
      if (discoverRes.ok) {
        const discoverData = (await discoverRes.json()) as {
          entries?: Array<{ universeId: string; tier: TrackingTier }>;
        };
        for (const entry of discoverData.entries ?? []) {
          if (!targetMap.has(entry.universeId)) {
            targetMap.set(entry.universeId, entry.tier);
          }
        }
      }
    } catch {
      // Fallback to curated verified list below
    }

    // Ensure curated verified classics are included as fallback
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

  const targetIds = Array.from(targetMap.keys()).slice(0, 500);

  if (targetIds.length === 0) {
    const completedAt = new Date().toISOString();
    const emptyJob: CollectionJob = {
      id: `job_${startedMs}`,
      tier: options.tier,
      triggeredBy: options.triggeredBy.slice(0, 120),
      startedAt,
      completedAt,
      durationMs: Date.now() - startedMs,
      gamesAttempted: 0,
      gamesSucceeded: 0,
      gamesFailed: 0,
      apiRequests: 0,
      http429Count: 0,
      status: 'success',
      errorSummary: 'No active games matched this collection tier.',
    };
    return { job: emptyJob, updatedGames: existingGames };
  }

  options.onProgress?.(
    `Fetching live CCU, visits & votes for ${targetIds.length} Roblox experiences...`
  );

  const res = await fetch('/api/roblox/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ universeIds: targetIds, fresh: true }),
  });

  if (!res.ok) {
    const completedAt = new Date().toISOString();
    const failedJob: CollectionJob = {
      id: `job_${startedMs}`,
      tier: options.tier,
      triggeredBy: options.triggeredBy.slice(0, 120),
      startedAt,
      completedAt,
      durationMs: Date.now() - startedMs,
      gamesAttempted: targetIds.length,
      gamesSucceeded: 0,
      gamesFailed: targetIds.length,
      apiRequests: 0,
      http429Count: 0,
      status: 'failed',
      errorSummary: `Roblox proxy returned HTTP ${res.status}`,
    };
    try {
      await setDoc(doc(db, 'collection_jobs', failedJob.id), {
        tier: failedJob.tier,
        triggeredBy: failedJob.triggeredBy,
        startedAt: failedJob.startedAt,
        completedAt: failedJob.completedAt,
        durationMs: failedJob.durationMs,
        gamesAttempted: failedJob.gamesAttempted,
        gamesSucceeded: failedJob.gamesSucceeded,
        gamesFailed: failedJob.gamesFailed,
        apiRequests: failedJob.apiRequests,
        http429Count: failedJob.http429Count,
        status: failedJob.status,
        errorSummary: failedJob.errorSummary,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `collection_jobs/${failedJob.id}`);
    }
    throw new Error(failedJob.errorSummary || 'Collection failed');
  }

  const data = (await res.json()) as RobloxFetchResponse;
  const capturedDate = new Date(data.capturedAt);
  const capturedMs = capturedDate.getTime();
  const minuteBucket = Math.floor(capturedMs / 60_000);
  const { bucket: hourBucket, bucketMs: hourBucketMs } = getHourBucket(capturedDate);
  const { bucket: dayBucket, bucketMs: dayBucketMs } = getDayBucket(capturedDate);

  // Pre-fetch recent snapshots so we can compute real growth percentages accurately
  options.onProgress?.(
    `Computing measured growth windows for ${data.games.length} experiences...`
  );
  const recentSnapsByGame = new Map<string, Array<{ ts: number; ccu: number }>>();
  try {
    const snapsRes = await getDocs(query(collection(db, 'game_snapshots'), limit(1500)));
    snapsRes.forEach((docSnap) => {
      const s = docSnap.data() as GameSnapshot;
      const arr = recentSnapsByGame.get(s.universeId) ?? [];
      arr.push({ ts: s.capturedAtMs, ccu: s.ccu });
      recentSnapsByGame.set(s.universeId, arr);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'game_snapshots');
  }

  // Batch commits in chunks of 25 games (~125 ops per batch, well under Firestore's 500-op limit)
  const BATCH_GAMES = 25;
  const updatedGamesList: GameRecordData[] = [];
  const errors = [...data.telemetry.errors];
  const totalBatches = Math.ceil(data.games.length / BATCH_GAMES);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const chunk = data.games.slice(
      batchIdx * BATCH_GAMES,
      (batchIdx + 1) * BATCH_GAMES
    );

    options.onProgress?.(
      `Saving batch ${batchIdx + 1}/${totalBatches} (${chunk.length} experiences) to database...`
    );

    // Parallel pre-read of existing rollup & snapshot docs for this chunk
    const existingMeta = await Promise.all(
      chunk.map(async (payload) => {
        const snapId = `${payload.universeId}_${minuteBucket}`;
        const hourlyId = `${payload.universeId}_${hourBucketMs}`;
        const dailyId = `${payload.universeId}_${dayBucket}`;

        const [snapDoc, hourlyDoc, dailyDoc, recDoc] = await Promise.all([
          getDoc(doc(db, 'game_snapshots', snapId)),
          getDoc(doc(db, 'game_hourly_stats', hourlyId)),
          getDoc(doc(db, 'game_daily_stats', dailyId)),
          getDoc(doc(db, 'game_records', payload.universeId)),
        ]);

        return {
          snapId,
          hourlyId,
          dailyId,
          snapExists: snapDoc.exists(),
          existingHourly: hourlyDoc.exists()
            ? (hourlyDoc.data() as GameHourlyStat)
            : null,
          existingDaily: dailyDoc.exists()
            ? (dailyDoc.data() as GameDailyStat)
            : null,
          existingPeak: recDoc.exists()
            ? (recDoc.data() as GamePeakRecord)
            : null,
        };
      })
    );

    const preparedItems = chunk.map((payload, idx) => {
      const meta = existingMeta[idx];
      const prev = existingMap.get(payload.universeId) ?? null;
      const historyPts = [...(recentSnapsByGame.get(payload.universeId) ?? [])];
      historyPts.push({ ts: capturedMs, ccu: payload.currentCcu });
      historyPts.sort((a, b) => a.ts - b.ts);

      const growth1h =
        computeWindowGrowth(payload.currentCcu, historyPts, 60 * 60 * 1000, 55 * 60 * 1000) ??
        (historyPts.length >= 2 &&
        capturedMs - historyPts[0].ts >= 60_000 &&
        historyPts[0].ccu > 0
          ? Number(
              (
                ((payload.currentCcu - historyPts[0].ccu) / historyPts[0].ccu) *
                100
              ).toFixed(1)
            )
          : null);
      const growth24h = computeWindowGrowth(
        payload.currentCcu,
        historyPts,
        24 * 60 * 60 * 1000,
        4 * 60 * 60 * 1000
      );
      const growth7d = computeWindowGrowth(
        payload.currentCcu,
        historyPts,
        7 * 24 * 60 * 60 * 1000,
        18 * 60 * 60 * 1000
      );
      const growth30d = computeWindowGrowth(
        payload.currentCcu,
        historyPts,
        30 * 24 * 60 * 60 * 1000,
        48 * 60 * 60 * 1000
      );

      const record = livePayloadToGameRecord(
        payload,
        data.capturedAt,
        targetMap.get(payload.universeId) ?? 'tier_2',
        prev
      );
      record.growth1h = growth1h;
      record.growth24h = growth24h;
      record.growth7d = growth7d;
      record.growth30d = growth30d;
      record.snapshotCount = Math.max(historyPts.length, (prev?.snapshotCount ?? 0) + 1);

      const snapshotDoc = !meta.snapExists
        ? {
            universeId: payload.universeId,
            ccu: payload.currentCcu,
            visits: payload.totalVisits,
            favorites: payload.favorites,
            upVotes: payload.upVotes,
            downVotes: payload.downVotes,
            capturedAt: data.capturedAt,
            capturedAtMs: capturedMs,
            dataSource: 'games.roblox.com/v1/games',
            collectionStatus: payload.upVotes !== null ? 'observed' : 'partial',
          }
        : null;

      const hourlyDoc = meta.existingHourly
        ? (() => {
            const h = meta.existingHourly;
            const nextSamples = h.sampleCount + 1;
            const nextAvg = (h.avgCcu * h.sampleCount + payload.currentCcu) / nextSamples;
            return {
              universeId: payload.universeId,
              hourBucket,
              bucketMs: hourBucketMs,
              avgCcu: Number(nextAvg.toFixed(1)),
              minCcu: Math.min(h.minCcu, payload.currentCcu),
              maxCcu: Math.max(h.maxCcu, payload.currentCcu),
              latestVisits: payload.totalVisits,
              latestFavorites: payload.favorites,
              sampleCount: nextSamples,
              updatedAt: data.capturedAt,
            };
          })()
        : {
            universeId: payload.universeId,
            hourBucket,
            bucketMs: hourBucketMs,
            avgCcu: payload.currentCcu,
            minCcu: payload.currentCcu,
            maxCcu: payload.currentCcu,
            latestVisits: payload.totalVisits,
            latestFavorites: payload.favorites,
            sampleCount: 1,
            updatedAt: data.capturedAt,
          };

      const dailyDoc = meta.existingDaily
        ? (() => {
            const d = meta.existingDaily;
            const nextSamples = d.sampleCount + 1;
            const nextAvg = (d.avgCcu * d.sampleCount + payload.currentCcu) / nextSamples;
            return {
              universeId: payload.universeId,
              dayBucket,
              bucketMs: dayBucketMs,
              avgCcu: Number(nextAvg.toFixed(1)),
              minCcu: Math.min(d.minCcu, payload.currentCcu),
              maxCcu: Math.max(d.maxCcu, payload.currentCcu),
              visitsEnd: payload.totalVisits,
              favoritesEnd: payload.favorites,
              likeRatio: payload.likeRatio,
              sampleCount: nextSamples,
              updatedAt: data.capturedAt,
            };
          })()
        : {
            universeId: payload.universeId,
            dayBucket,
            bucketMs: dayBucketMs,
            avgCcu: payload.currentCcu,
            minCcu: payload.currentCcu,
            maxCcu: payload.currentCcu,
            visitsEnd: payload.totalVisits,
            favoritesEnd: payload.favorites,
            likeRatio: payload.likeRatio,
            sampleCount: 1,
            updatedAt: data.capturedAt,
          };

      const peakDoc =
        !meta.existingPeak ||
        payload.currentCcu >= meta.existingPeak.highestObservedCcu
          ? {
              universeId: payload.universeId,
              gameName: record.name,
              highestObservedCcu: record.peakCcuObserved,
              highestObservedAt: record.peakCcuAt || data.capturedAt,
              provenance: 'observed_peak',
              updatedAt: data.capturedAt,
            }
          : null;

      return { payload, meta, record, snapshotDoc, hourlyDoc, dailyDoc, peakDoc };
    });

    const batch = writeBatch(db);
    for (const item of preparedItems) {
      batch.set(doc(db, 'games', item.payload.universeId), item.record);
      if (item.snapshotDoc) {
        batch.set(doc(db, 'game_snapshots', item.meta.snapId), item.snapshotDoc);
      }
      batch.set(doc(db, 'game_hourly_stats', item.meta.hourlyId), item.hourlyDoc);
      batch.set(doc(db, 'game_daily_stats', item.meta.dailyId), item.dailyDoc);
      if (item.peakDoc) {
        batch.set(doc(db, 'game_records', item.payload.universeId), item.peakDoc);
      }
    }

    try {
      await batch.commit();
      for (const item of preparedItems) {
        updatedGamesList.push(item.record);
      }
    } catch (batchErr) {
      // Fallback: isolate and save each valid game individually so one bad record never aborts the batch
      for (const item of preparedItems) {
        try {
          const singleBatch = writeBatch(db);
          singleBatch.set(doc(db, 'games', item.payload.universeId), item.record);
          if (item.snapshotDoc) {
            singleBatch.set(doc(db, 'game_snapshots', item.meta.snapId), item.snapshotDoc);
          }
          singleBatch.set(doc(db, 'game_hourly_stats', item.meta.hourlyId), item.hourlyDoc);
          singleBatch.set(doc(db, 'game_daily_stats', item.meta.dailyId), item.dailyDoc);
          if (item.peakDoc) {
            singleBatch.set(doc(db, 'game_records', item.payload.universeId), item.peakDoc);
          }
          await singleBatch.commit();
          updatedGamesList.push(item.record);
        } catch (itemErr) {
          const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
          errors.push(`Universe ${item.payload.universeId}: ${msg.slice(0, 120)}`);
        }
      }
      if (updatedGamesList.length === 0) {
        handleFirestoreError(batchErr, OperationType.WRITE, `games_batch_${batchIdx + 1}`);
      }
    }
  }

  const completedMs = Date.now();
  const completedAt = new Date(completedMs).toISOString();
  const succeeded = updatedGamesList.length;
  const failed = Math.max(0, targetIds.length - succeeded);
  const status: CollectionJob['status'] =
    succeeded === 0 ? 'failed' : failed > 0 ? 'partial' : 'success';

  const job: CollectionJob = {
    id: `job_${startedMs}`,
    tier: options.tier,
    triggeredBy: options.triggeredBy.slice(0, 120),
    startedAt,
    completedAt,
    durationMs: completedMs - startedMs,
    gamesAttempted: targetIds.length,
    gamesSucceeded: succeeded,
    gamesFailed: failed,
    apiRequests: data.telemetry.apiRequests,
    http429Count: data.telemetry.http429Count,
    status,
    errorSummary: errors.length > 0 ? errors.join(' | ').slice(0, 950) : null,
  };

  try {
    await setDoc(doc(db, 'collection_jobs', job.id), {
      tier: job.tier,
      triggeredBy: job.triggeredBy,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationMs: job.durationMs,
      gamesAttempted: job.gamesAttempted,
      gamesSucceeded: job.gamesSucceeded,
      gamesFailed: job.gamesFailed,
      apiRequests: job.apiRequests,
      http429Count: job.http429Count,
      status: job.status,
      errorSummary: job.errorSummary,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `collection_jobs/${job.id}`);
  }

  options.onProgress?.('Refreshing catalog...');
  const allUpdated = await fetchAllStoredGames();
  return { job, updatedGames: allUpdated };
}

export async function pruneExpiredRawSnapshots(
  retentionRawHours: number
): Promise<number> {
  const authHeaders = await getAdminAuthHeaders();
  const supaRes = await fetch('/api/supabase/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ action: 'prune', retentionRawHours }),
  });
  if (supaRes.ok) {
    const data = (await supaRes.json()) as {
      configured?: boolean;
      removed?: number;
    };
    if (data.configured) return data.removed ?? 0;
  } else if (supaRes.status === 401 || supaRes.status === 403 || supaRes.status >= 500) {
    const errBody = (await supaRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Supabase prune error (HTTP ${supaRes.status})`);
  }

  const cutoffMs = Date.now() - retentionRawHours * 60 * 60 * 1000;
  const path = 'game_snapshots';
  try {
    const q = query(
      collection(db, path),
      where('capturedAtMs', '<', cutoffMs),
      limit(400)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const batch = writeBatch(db);
    snap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
