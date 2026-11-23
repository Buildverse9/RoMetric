import {
  CODE_PROVIDERS,
  getCodeProvider,
  isValidPromoCodeFormat,
  normalizePromoCode,
  sanitizePlainText,
  validatePublicHttpsUrl,
} from './codes-providers';
import type {
  CodeCollectionLog,
  CodeCoverageStatus,
  CodeSourceRecord,
  CodeStatus,
  CodeVerificationLog,
  CodesAdminOverview,
  GameCodeDirectoryItem,
  GameCodeRecord,
  GameCodesDetailPayload,
  ProviderGameTarget,
} from './codes-types';
import { resolveRobloxExperience } from './roblox-api';
import {
  isSupabaseConfigured,
  isSupabaseWriteConfigured,
  saveGameToSupabase,
  supabaseRest,
} from './supabase-server';

interface DbCodeSourceRow {
  id: string;
  name: string;
  provider_type: 'roblox_official' | 'mediawiki' | 'bloxarchive' | 'community';
  enabled: boolean;
  requires_api_key: boolean;
  attribution_label: string;
  attribution_url: string | null;
  license_notice: string | null;
  rate_limit_rpm: number;
  last_run_at: string | null;
  last_status: 'healthy' | 'degraded' | 'error' | 'disabled' | 'idle' | null;
  last_error: string | null;
  consecutive_failures: number;
  requests_today: number;
  requests_reset_date: string;
  updated_at: string;
}

interface DbGameCodeRow {
  id: number;
  universe_id: number;
  code: string;
  normalized_code: string;
  reward_description: string | null;
  status: CodeStatus;
  source_id: string;
  source_url: string | null;
  source_reported_status: string | null;
  admin_locked: boolean;
  submitted_by_note: string | null;
  discovered_at: string;
  last_verified_at: string | null;
  expires_at: string | null;
  updated_at: string;
}

interface DbGameCodesMetaRow {
  universe_id: number;
  root_place_id: number;
  name: string;
  slug: string;
  description?: string | null;
  creator_id: number;
  creator_name: string;
  creator_type?: 'User' | 'Group';
  creator_verified?: boolean;
  genre: string;
  icon_url: string | null;
  thumbnail_url: string | null;
  current_ccu: number;
  total_visits?: number;
  code_coverage_status?: CodeCoverageStatus;
  active_code_count?: number;
  total_code_count?: number;
  wiki_subdomain?: string | null;
  codes_last_checked_at?: string | null;
}

interface DbCollectionLogRow {
  id: number;
  source_id: string;
  triggered_by: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  games_checked: number;
  games_with_provider_data: number;
  codes_discovered: number;
  codes_updated: number;
  codes_expired: number;
  api_requests: number;
  http_429_count: number;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  error_summary: string | null;
}

interface DbVerificationLogRow {
  id: number;
  code_id: number | null;
  universe_id: number;
  code_text: string;
  previous_status: string | null;
  new_status: string;
  actor: string;
  reason: string | null;
  verified_at: string;
}

// Per-IP sliding window rate limiter for public community code submissions (5 / 15 min)
const submitRateLimits = new Map<string, number[]>();
const SUBMIT_WINDOW_MS = 15 * 60_000;
const SUBMIT_MAX_PER_WINDOW = 5;

function checkSubmitRateLimit(clientIp: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const key = clientIp || 'unknown';
  const existing = (submitRateLimits.get(key) ?? []).filter(
    (ts) => now - ts < SUBMIT_WINDOW_MS
  );
  if (existing.length >= SUBMIT_MAX_PER_WINDOW) {
    const oldest = existing[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((SUBMIT_WINDOW_MS - (now - oldest)) / 1000)
    );
    submitRateLimits.set(key, existing);
    return { allowed: false, retryAfterSec };
  }
  existing.push(now);
  submitRateLimits.set(key, existing);
  return { allowed: true, retryAfterSec: 0 };
}

function mapSourceRow(row: DbCodeSourceRow): CodeSourceRecord {
  const adapter = getCodeProvider(row.id);
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    enabled: Boolean(row.enabled),
    requiresApiKey: Boolean(row.requires_api_key),
    apiKeyConfigured: adapter ? adapter.isConfigured() : true,
    attributionLabel: row.attribution_label,
    attributionUrl: row.attribution_url,
    licenseNotice: row.license_notice,
    rateLimitRpm: Number(row.rate_limit_rpm ?? 30),
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastError: row.last_error,
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    requestsToday: Number(row.requests_today ?? 0),
    updatedAt: row.updated_at,
  };
}

function mapCodeRow(
  row: DbGameCodeRow,
  sourceMap?: Map<string, CodeSourceRecord>,
  gameMap?: Map<string, { name: string; slug: string }>
): GameCodeRecord {
  const uid = String(row.universe_id);
  const src = sourceMap?.get(row.source_id);
  const gm = gameMap?.get(uid);
  return {
    id: Number(row.id),
    universeId: uid,
    gameName: gm?.name,
    gameSlug: gm?.slug,
    code: row.code,
    normalizedCode: row.normalized_code,
    rewardDescription: row.reward_description,
    status: row.status,
    sourceId: row.source_id,
    sourceName: src?.name,
    sourceAttributionLabel: src?.attributionLabel,
    sourceLicenseNotice: src?.licenseNotice ?? null,
    sourceUrl: row.source_url,
    sourceReportedStatus: row.source_reported_status,
    adminLocked: Boolean(row.admin_locked),
    submittedByNote: row.submitted_by_note,
    discoveredAt: row.discovered_at,
    lastVerifiedAt: row.last_verified_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  };
}

function mapCollectionLogRow(row: DbCollectionLogRow): CodeCollectionLog {
  return {
    id: Number(row.id),
    sourceId: row.source_id,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: Number(row.duration_ms ?? 0),
    gamesChecked: Number(row.games_checked ?? 0),
    gamesWithProviderData: Number(row.games_with_provider_data ?? 0),
    codesDiscovered: Number(row.codes_discovered ?? 0),
    codesUpdated: Number(row.codes_updated ?? 0),
    codesExpired: Number(row.codes_expired ?? 0),
    apiRequests: Number(row.api_requests ?? 0),
    http429Count: Number(row.http_429_count ?? 0),
    status: row.status,
    errorSummary: row.error_summary,
  };
}

function mapVerificationLogRow(row: DbVerificationLogRow): CodeVerificationLog {
  return {
    id: Number(row.id),
    codeId: row.code_id !== null ? Number(row.code_id) : null,
    universeId: String(row.universe_id),
    codeText: row.code_text,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    actor: row.actor,
    reason: row.reason,
    verifiedAt: row.verified_at,
  };
}

async function checkCodesSchemaReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const res = await supabaseRest('code_sources?select=id&limit=1');
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchAllSourcesMap(): Promise<{
  list: CodeSourceRecord[];
  map: Map<string, CodeSourceRecord>;
}> {
  const res = await supabaseRest('code_sources?select=*&order=id.asc');
  if (!res.ok) return { list: [], map: new Map() };
  const rows = (await res.json()) as DbCodeSourceRow[];
  const list = rows.map(mapSourceRow);
  const map = new Map(list.map((s) => [s.id, s]));
  return { list, map };
}

async function fetchAllActiveGamesForCodes(limit = 1500): Promise<DbGameCodesMetaRow[]> {
  const out: DbGameCodesMetaRow[] = [];
  const pageSize = 500;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const res = await supabaseRest(
      `games?select=universe_id,root_place_id,name,slug,creator_id,creator_name,genre,icon_url,thumbnail_url,current_ccu,code_coverage_status,active_code_count,total_code_count,codes_last_checked_at&active=eq.true&order=current_ccu.desc&limit=${pageSize}&offset=${offset}`
    );
    if (!res.ok) break;
    const rows = (await res.json()) as DbGameCodesMetaRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function fetchAllCodesPaginated(maxRows = 5000): Promise<DbGameCodeRow[]> {
  const out: DbGameCodeRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const res = await supabaseRest(
      `game_codes?select=*&order=updated_at.desc&limit=${pageSize}&offset=${offset}`
    );
    if (!res.ok) break;
    const rows = (await res.json()) as DbGameCodeRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

export async function fetchCodesDirectory(options: {
  q?: string;
  status?: 'all' | 'active' | 'pending_verification' | 'expired' | 'unverified';
  sort?: 'recently_updated' | 'popular' | 'most_codes';
  onlyWithCodes?: boolean;
} = {}): Promise<{
  configured: boolean;
  schemaReady: boolean;
  games: GameCodeDirectoryItem[];
  sources: CodeSourceRecord[];
  stats: {
    totalGamesCovered: number;
    totalGamesTracked: number;
    totalActiveCodes: number;
    totalPendingCodes: number;
    totalExpiredCodes: number;
    totalCodes: number;
  };
}> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      schemaReady: false,
      games: [],
      sources: [],
      stats: {
        totalGamesCovered: 0,
        totalGamesTracked: 0,
        totalActiveCodes: 0,
        totalPendingCodes: 0,
        totalExpiredCodes: 0,
        totalCodes: 0,
      },
    };
  }

  const schemaReady = await checkCodesSchemaReady();
  if (!schemaReady) {
    return {
      configured: true,
      schemaReady: false,
      games: [],
      sources: [],
      stats: {
        totalGamesCovered: 0,
        totalGamesTracked: 0,
        totalActiveCodes: 0,
        totalPendingCodes: 0,
        totalExpiredCodes: 0,
        totalCodes: 0,
      },
    };
  }

  const [{ list: sources }, gameRows, codeRows] = await Promise.all([
    fetchAllSourcesMap(),
    fetchAllActiveGamesForCodes(1500),
    fetchAllCodesPaginated(5000),
  ]);

  // Group codes by universe_id
  const codesByUniverse = new Map<string, DbGameCodeRow[]>();
  let totalActiveCodes = 0;
  let totalPendingCodes = 0;
  let totalExpiredCodes = 0;

  for (const c of codeRows) {
    const uid = String(c.universe_id);
    const arr = codesByUniverse.get(uid) ?? [];
    arr.push(c);
    codesByUniverse.set(uid, arr);

    if (c.status === 'active') totalActiveCodes += 1;
    else if (c.status === 'pending_verification') totalPendingCodes += 1;
    else if (c.status === 'expired') totalExpiredCodes += 1;
  }

  const q = (options.q || '').trim().toLowerCase();
  const statusFilter = options.status || 'all';
  const sortMode = options.sort || 'popular';

  let totalGamesCovered = 0;
  const items: GameCodeDirectoryItem[] = [];

  for (const g of gameRows) {
    const uid = String(g.universe_id);
    const list = codesByUniverse.get(uid) ?? [];
    let activeCount = 0;
    let pendingCount = 0;
    let expiredCount = 0;
    let unverifiedCount = 0;
    let latestUpdated: string | null = null;

    for (const c of list) {
      if (c.status === 'active') activeCount += 1;
      else if (c.status === 'pending_verification') pendingCount += 1;
      else if (c.status === 'expired') expiredCount += 1;
      else unverifiedCount += 1;
      if (!latestUpdated || c.updated_at > latestUpdated) {
        latestUpdated = c.updated_at;
      }
    }

    const coverage: CodeCoverageStatus =
      list.length > 0
        ? 'covered'
        : g.code_coverage_status || 'unchecked';

    if (list.length > 0) totalGamesCovered += 1;

    // Apply status filter
    if (statusFilter === 'active' && activeCount === 0) continue;
    if (statusFilter === 'pending_verification' && pendingCount === 0) continue;
    if (statusFilter === 'expired' && expiredCount === 0) continue;
    if (statusFilter === 'unverified' && unverifiedCount === 0) continue;
    if (options.onlyWithCodes && list.length === 0) continue;

    // Apply search query (matches game name, creator, universe ID, OR code string / reward)
    let matchingCodes: GameCodeDirectoryItem['matchingCodes'] = undefined;
    if (q) {
      const gameMatches =
        g.name.toLowerCase().includes(q) ||
        g.creator_name.toLowerCase().includes(q) ||
        uid.includes(q);

      const matchedCodeRows = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.normalized_code.toLowerCase().includes(q) ||
          (c.reward_description || '').toLowerCase().includes(q)
      );

      if (!gameMatches && matchedCodeRows.length === 0) {
        continue;
      }

      if (matchedCodeRows.length > 0) {
        matchingCodes = matchedCodeRows.slice(0, 4).map((c) => ({
          id: Number(c.id),
          code: c.code,
          rewardDescription: c.reward_description,
          status: c.status,
        }));
      }
    }

    items.push({
      universeId: uid,
      rootPlaceId: String(g.root_place_id),
      name: g.name,
      slug: g.slug || uid,
      creatorName: g.creator_name,
      creatorId: String(g.creator_id),
      genre: g.genre || 'All Genres',
      iconUrl: g.icon_url,
      thumbnailUrl: g.thumbnail_url,
      currentCcu: Number(g.current_ccu ?? 0),
      codeCoverageStatus: coverage,
      activeCodeCount: activeCount,
      pendingCodeCount: pendingCount,
      expiredCodeCount: expiredCount,
      unverifiedCodeCount: unverifiedCount,
      totalCodeCount: list.length,
      codesLastCheckedAt: g.codes_last_checked_at ?? null,
      latestCodeUpdatedAt: latestUpdated,
      matchingCodes,
    });
  }

  // Sort results
  items.sort((a, b) => {
    if (sortMode === 'recently_updated') {
      const ta = a.latestCodeUpdatedAt ? Date.parse(a.latestCodeUpdatedAt) : 0;
      const tb = b.latestCodeUpdatedAt ? Date.parse(b.latestCodeUpdatedAt) : 0;
      if (tb !== ta) return tb - ta;
      return b.activeCodeCount - a.activeCodeCount || b.currentCcu - a.currentCcu;
    }
    if (sortMode === 'most_codes') {
      if (b.activeCodeCount !== a.activeCodeCount) {
        return b.activeCodeCount - a.activeCodeCount;
      }
      if (b.totalCodeCount !== a.totalCodeCount) {
        return b.totalCodeCount - a.totalCodeCount;
      }
      return b.currentCcu - a.currentCcu;
    }
    // Default 'popular': prioritize games that have codes when viewing All, then by CCU
    const aHas = a.totalCodeCount > 0 ? 1 : 0;
    const bHas = b.totalCodeCount > 0 ? 1 : 0;
    if (bHas !== aHas && !q) return bHas - aHas;
    return b.currentCcu - a.currentCcu;
  });

  return {
    configured: true,
    schemaReady: true,
    games: items.slice(0, 120),
    sources,
    stats: {
      totalGamesCovered,
      totalGamesTracked: gameRows.length,
      totalActiveCodes,
      totalPendingCodes,
      totalExpiredCodes,
      totalCodes: codeRows.length,
    },
  };
}

export async function fetchGameCodesBySlugOrId(
  slugOrId: string
): Promise<GameCodesDetailPayload> {
  const clean = slugOrId.trim().toLowerCase().slice(0, 140);
  if (!clean || !isSupabaseConfigured()) {
    return {
      configured: isSupabaseConfigured(),
      schemaReady: false,
      game: null,
      codes: [],
      sources: [],
      relatedGames: [],
    };
  }

  const schemaReady = await checkCodesSchemaReady();
  const isNumeric = /^[0-9]{1,20}$/.test(clean);

  const selectCols = schemaReady
    ? 'universe_id,root_place_id,name,slug,creator_id,creator_name,creator_verified,genre,icon_url,thumbnail_url,current_ccu,total_visits,code_coverage_status,codes_last_checked_at'
    : 'universe_id,root_place_id,name,slug,creator_id,creator_name,creator_verified,genre,icon_url,thumbnail_url,current_ccu,total_visits';

  const filterQuery = isNumeric
    ? `or=(universe_id.eq.${clean},root_place_id.eq.${clean})`
    : `slug=eq.${encodeURIComponent(clean)}`;

  let gameRes = await supabaseRest(
    `games?select=${selectCols}&${filterQuery}&order=current_ccu.desc&limit=1`
  );
  let gameRows: DbGameCodesMetaRow[] = gameRes.ok
    ? ((await gameRes.json()) as DbGameCodesMetaRow[])
    : [];

  // Fallback 1: match with or without trailing '-codes'
  if (gameRows.length === 0 && !isNumeric) {
    const altSlug = clean.endsWith('-codes')
      ? clean.replace(/-codes$/, '')
      : `${clean}-codes`;
    gameRes = await supabaseRest(
      `games?select=${selectCols}&slug=eq.${encodeURIComponent(altSlug)}&order=current_ccu.desc&limit=1`
    );
    if (gameRes.ok) {
      gameRows = (await gameRes.json()) as DbGameCodesMetaRow[];
    }
  }

  // Fallback 2: match slug suffix with universeId or rootPlaceId e.g. "blox-fruits-994732206"
  if (gameRows.length === 0 && !isNumeric) {
    const trailingId = clean.match(/-?([0-9]{5,20})$/)?.[1];
    if (trailingId) {
      gameRes = await supabaseRest(
        `games?select=${selectCols}&or=(universe_id.eq.${trailingId},root_place_id.eq.${trailingId})&limit=1`
      );
      if (gameRes.ok) {
        gameRows = (await gameRes.json()) as DbGameCodesMetaRow[];
      }
    }
  }

  if (gameRows.length === 0) {
    return {
      configured: true,
      schemaReady,
      game: null,
      codes: [],
      sources: [],
      relatedGames: [],
    };
  }

  const g = gameRows[0];
  const uid = String(g.universe_id);

  if (!schemaReady) {
    return {
      configured: true,
      schemaReady: false,
      game: {
        universeId: uid,
        rootPlaceId: String(g.root_place_id),
        name: g.name,
        slug: g.slug || uid,
        creatorName: g.creator_name,
        creatorId: String(g.creator_id),
        creatorVerified: Boolean(g.creator_verified),
        genre: g.genre || 'All Genres',
        iconUrl: g.icon_url,
        thumbnailUrl: g.thumbnail_url,
        currentCcu: Number(g.current_ccu ?? 0),
        totalVisits: Number(g.total_visits ?? 0),
        codeCoverageStatus: 'unchecked',
        codesLastCheckedAt: null,
      },
      codes: [],
      sources: [],
      relatedGames: [],
    };
  }

  const [{ list: sources, map: sourceMap }, codesRes, relatedRes] =
    await Promise.all([
      fetchAllSourcesMap(),
      supabaseRest(
        `game_codes?select=*&universe_id=eq.${uid}&order=updated_at.desc&limit=200`
      ),
      supabaseRest(
        `games?select=universe_id,name,slug,icon_url,genre,current_ccu,active_code_count&active=eq.true&total_code_count=gt.0&universe_id=neq.${uid}&order=active_code_count.desc,current_ccu.desc&limit=16`
      ),
    ]);

  const rawCodes: DbGameCodeRow[] = codesRes.ok
    ? ((await codesRes.json()) as DbGameCodeRow[])
    : [];

  const relatedRaw: DbGameCodesMetaRow[] = relatedRes.ok
    ? ((await relatedRes.json()) as DbGameCodesMetaRow[])
    : [];

  // Prioritize same-genre related games first, then highest active code count
  const sortedRelated = relatedRaw
    .sort((a, b) => {
      const aSame = a.genre === g.genre ? 1 : 0;
      const bSame = b.genre === g.genre ? 1 : 0;
      if (bSame !== aSame) return bSame - aSame;
      return (
        Number(b.active_code_count ?? 0) - Number(a.active_code_count ?? 0) ||
        Number(b.current_ccu ?? 0) - Number(a.current_ccu ?? 0)
      );
    })
    .slice(0, 6)
    .map((r) => ({
      universeId: String(r.universe_id),
      name: r.name,
      slug: r.slug || String(r.universe_id),
      iconUrl: r.icon_url,
      genre: r.genre || 'All Genres',
      currentCcu: Number(r.current_ccu ?? 0),
      activeCodeCount: Number(r.active_code_count ?? 0),
    }));

  const mappedCodes = rawCodes.map((row) => mapCodeRow(row, sourceMap));

  return {
    configured: true,
    schemaReady: true,
    game: {
      universeId: uid,
      rootPlaceId: String(g.root_place_id),
      name: g.name,
      slug: g.slug || uid,
      creatorName: g.creator_name,
      creatorId: String(g.creator_id),
      creatorVerified: Boolean(g.creator_verified),
      genre: g.genre || 'All Genres',
      iconUrl: g.icon_url,
      thumbnailUrl: g.thumbnail_url,
      currentCcu: Number(g.current_ccu ?? 0),
      totalVisits: Number(g.total_visits ?? 0),
      codeCoverageStatus:
        mappedCodes.length > 0
          ? 'covered'
          : g.code_coverage_status || 'unchecked',
      codesLastCheckedAt: g.codes_last_checked_at ?? null,
    },
    codes: mappedCodes,
    sources,
    relatedGames: sortedRelated,
  };
}

export const fetchGameCodesDetail = fetchGameCodesBySlugOrId;

/**
 * Returns ONLY games that actually have codes (total_code_count > 0) for XML sitemap,
 * ensuring RoMetric never emits thousands of thin/empty SEO pages.
 */
export async function fetchIndexableCodeGameSlugs(): Promise<
  Array<{ slug: string; universeId: string; updatedAt: string }>
> {
  if (!isSupabaseConfigured()) return [];
  const schemaReady = await checkCodesSchemaReady();
  if (!schemaReady) return [];

  const res = await supabaseRest(
    'games?select=universe_id,slug,codes_last_checked_at,updated_at&active=eq.true&total_code_count=gt.0&order=active_code_count.desc,current_ccu.desc&limit=500'
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{
    universe_id: number;
    slug: string;
    codes_last_checked_at: string | null;
    updated_at: string;
  }>;
  return rows
    .filter((r) => Boolean(r.slug))
    .map((r) => ({
      slug: r.slug,
      universeId: String(r.universe_id),
      updatedAt: r.codes_last_checked_at || r.updated_at || new Date().toISOString(),
    }));
}

async function recomputeGameCodeCounts(
  universeId: string,
  hasProviderData?: boolean,
  wikiSubdomain?: string | null
): Promise<void> {
  const codesRes = await supabaseRest(
    `game_codes?select=status&universe_id=eq.${universeId}`,
    { requireAdminKey: true }
  );
  const rows: Array<{ status: CodeStatus }> = codesRes.ok
    ? ((await codesRes.json()) as Array<{ status: CodeStatus }>)
    : [];

  const activeCount = rows.filter((r) => r.status === 'active').length;
  const totalCount = rows.length;
  const nowIso = new Date().toISOString();

  const patch: Record<string, unknown> = {
    active_code_count: activeCount,
    total_code_count: totalCount,
    codes_last_checked_at: nowIso,
    updated_at: nowIso,
  };

  if (totalCount > 0 || hasProviderData) {
    patch.code_coverage_status = 'covered';
  } else if (hasProviderData === false) {
    patch.code_coverage_status = 'no_provider_data';
  }

  if (wikiSubdomain) {
    patch.wiki_subdomain = wikiSubdomain;
  }

  await supabaseRest(`games?universe_id=eq.${universeId}`, {
    method: 'PATCH',
    requireAdminKey: true,
    body: patch,
  });
}

/**
 * Automated & Admin-triggered idempotent multi-provider code collection run.
 * - Deduplicates strictly by (universe_id, normalized_code)
 * - Preserves source-reported status and records last_verified_at UTC
 * - Never overwrites admin_locked rows
 * - Marks games with no supporting provider as 'no_provider_data'
 * - Runs games in fast concurrent chunks so Vercel manual runs finish quickly
 */
export async function runCodesCollectionCycle(options: {
  providerId?: string | null;
  universeId?: string | null;
  maxGames?: number;
  triggeredBy: string;
}): Promise<{
  ok: boolean;
  gamesChecked: number;
  gamesWithProviderData: number;
  codesDiscovered: number;
  codesUpdated: number;
  codesExpired: number;
  apiRequests: number;
  http429Count: number;
  durationMs: number;
  errors: string[];
  runs: CodeCollectionLog[];
}> {
  if (!isSupabaseWriteConfigured()) {
    throw new Error('Supabase service role key is not configured.');
  }

  const cycleStartedMs = Date.now();
  const { list: dbSources, map: sourceMap } = await fetchAllSourcesMap();
  const maxGames = Math.min(Math.max(Number(options.maxGames ?? 8), 1), 30);

  // Select target adapters
  const targetAdapters = CODE_PROVIDERS.filter((adapter) => {
    if (options.providerId && options.providerId !== 'all') {
      return adapter.id === options.providerId;
    }
    const dbSrc = sourceMap.get(adapter.id);
    if (dbSrc && !dbSrc.enabled) {
      if (adapter.requiresApiKey && adapter.isConfigured() && dbSrc.lastStatus === 'disabled') {
        return true;
      }
      return false;
    }
    return adapter.isConfigured();
  });

  // Load target games (either a single universeId or top/stalest active games)
  let targetGames: ProviderGameTarget[] = [];
  if (options.universeId && /^[0-9]{1,20}$/.test(options.universeId)) {
    const gRes = await supabaseRest(
      `games?select=universe_id,root_place_id,name,slug,description,creator_id,creator_type,wiki_subdomain&universe_id=eq.${options.universeId}&limit=1`,
      { requireAdminKey: true }
    );
    const rows = gRes.ok ? ((await gRes.json()) as DbGameCodesMetaRow[]) : [];
    targetGames = rows.map((r) => ({
      universeId: String(r.universe_id),
      rootPlaceId: String(r.root_place_id),
      name: r.name,
      slug: r.slug || String(r.universe_id),
      description: r.description ?? null,
      creatorId: String(r.creator_id),
      creatorType: r.creator_type === 'Group' ? 'Group' : 'User',
      wikiSubdomain: r.wiki_subdomain ?? null,
    }));
  } else {
    const gRes = await supabaseRest(
      `games?select=universe_id,root_place_id,name,slug,description,creator_id,creator_type,wiki_subdomain,codes_last_checked_at,current_ccu&active=eq.true&order=codes_last_checked_at.asc.nullsfirst,current_ccu.desc&limit=${maxGames}`,
      { requireAdminKey: true }
    );
    const rows = gRes.ok ? ((await gRes.json()) as DbGameCodesMetaRow[]) : [];
    targetGames = rows.map((r) => ({
      universeId: String(r.universe_id),
      rootPlaceId: String(r.root_place_id),
      name: r.name,
      slug: r.slug || String(r.universe_id),
      description: r.description ?? null,
      creatorId: String(r.creator_id),
      creatorType: r.creator_type === 'Group' ? 'Group' : 'User',
      wikiSubdomain: r.wiki_subdomain ?? null,
    }));
  }

  const runs: CodeCollectionLog[] = [];
  const allErrors: string[] = [];
  const gamesWithDataSet = new Set<string>();
  let totalCodesDiscovered = 0;
  let totalCodesUpdated = 0;
  let totalCodesExpired = 0;
  let totalApiRequests = 0;
  let totalHttp429 = 0;

  const todayUtcDate = new Date().toISOString().slice(0, 10);

  if (targetAdapters.length === 0) {
    return {
      ok: false,
      gamesChecked: 0,
      gamesWithProviderData: 0,
      codesDiscovered: 0,
      codesUpdated: 0,
      codesExpired: 0,
      apiRequests: 0,
      http429Count: 0,
      durationMs: Date.now() - cycleStartedMs,
      errors: ['No enabled and configured providers matched your selection.'],
      runs: [],
    };
  }

  for (const adapter of targetAdapters) {
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const dbSrc = dbSources.find((s) => s.id === adapter.id);

    let gamesChecked = 0;
    let gamesWithProviderData = 0;
    let codesDiscovered = 0;
    let codesUpdated = 0;
    let codesExpired = 0;
    let apiRequests = 0;
    let http429Count = 0;
    const errors: string[] = [];

    if (!adapter.isConfigured()) {
      const skippedLogRes = await supabaseRest('code_collection_logs', {
        method: 'POST',
        requireAdminKey: true,
        headers: { Prefer: 'return=representation' },
        body: {
          source_id: adapter.id,
          triggered_by: options.triggeredBy,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          games_checked: 0,
          games_with_provider_data: 0,
          codes_discovered: 0,
          codes_updated: 0,
          codes_expired: 0,
          api_requests: 0,
          http_429_count: 0,
          status: 'skipped',
          error_summary: 'Provider API key not configured on server.',
        },
      });
      if (skippedLogRes.ok) {
        const inserted = (await skippedLogRes.json()) as DbCollectionLogRow[];
        if (inserted[0]) runs.push(mapCollectionLogRow(inserted[0]));
      }
      allErrors.push(`${adapter.name}: API key not configured.`);
      continue;
    }

    // Process games in fast concurrent chunks of 4 so Vercel never times out
    const CHUNK_SIZE = 4;
    for (let i = 0; i < targetGames.length; i += CHUNK_SIZE) {
      const chunk = targetGames.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (game) => {
          gamesChecked += 1;
          try {
            const res = await adapter.fetchForGame(game);
            apiRequests += res.apiRequests;
            http429Count += res.http429Count;
            if (res.error) errors.push(`${game.name}: ${res.error}`);

            if (res.hasProviderData) {
              gamesWithProviderData += 1;
              gamesWithDataSet.add(game.universeId);
            }

            if (res.codes.length > 0) {
              const existingRes = await supabaseRest(
                `game_codes?select=*&universe_id=eq.${game.universeId}`,
                { requireAdminKey: true }
              );
              const existingRows: DbGameCodeRow[] = existingRes.ok
                ? ((await existingRes.json()) as DbGameCodeRow[])
                : [];
              const existingByNorm = new Map(
                existingRows.map((r) => [r.normalized_code, r])
              );

              const nowIso = new Date().toISOString();
              const verificationRows: Array<Record<string, unknown>> = [];

              for (const item of res.codes) {
                const norm = normalizePromoCode(item.code);
                const prev = existingByNorm.get(norm);

                const isExpiredByDate =
                  item.expiresAt !== null &&
                  Date.parse(item.expiresAt) < Date.now();
                const targetStatus: CodeStatus = isExpiredByDate
                  ? 'expired'
                  : item.status;

                if (!prev) {
                  const insertRes = await supabaseRest(
                    'game_codes?on_conflict=universe_id,normalized_code',
                    {
                      method: 'POST',
                      requireAdminKey: true,
                      headers: {
                        Prefer: 'resolution=merge-duplicates,return=representation',
                      },
                      body: {
                        universe_id: Number(game.universeId),
                        code: item.code.slice(0, 48),
                        normalized_code: norm.slice(0, 48),
                        reward_description: item.rewardDescription,
                        status: targetStatus,
                        source_id: adapter.id,
                        source_url: item.sourceUrl,
                        source_reported_status: item.sourceReportedStatus,
                        admin_locked: false,
                        discovered_at: nowIso,
                        last_verified_at: nowIso,
                        expires_at: item.expiresAt,
                        updated_at: nowIso,
                      },
                    }
                  );
                  if (insertRes.ok) {
                    codesDiscovered += 1;
                    if (targetStatus === 'expired') codesExpired += 1;
                    const inserted = (await insertRes.json()) as DbGameCodeRow[];
                    verificationRows.push({
                      code_id: inserted[0]?.id ?? null,
                      universe_id: Number(game.universeId),
                      code_text: item.code.slice(0, 48),
                      previous_status: null,
                      new_status: targetStatus,
                      actor: `provider:${adapter.id}`,
                      reason: `Discovered via ${adapter.name} (${item.sourceReportedStatus})`,
                      verified_at: nowIso,
                    });
                  }
                } else {
                  const effectiveStatus = prev.admin_locked
                    ? prev.status
                    : targetStatus;
                  const statusChanged = prev.status !== effectiveStatus;

                  const patchBody: Record<string, unknown> = {
                    last_verified_at: nowIso,
                    updated_at: nowIso,
                    source_reported_status: item.sourceReportedStatus,
                  };
                  if (!prev.reward_description && item.rewardDescription) {
                    patchBody.reward_description = item.rewardDescription;
                  }
                  if (!prev.expires_at && item.expiresAt) {
                    patchBody.expires_at = item.expiresAt;
                  }
                  if (!prev.admin_locked) {
                    patchBody.status = effectiveStatus;
                  }

                  const patchRes = await supabaseRest(
                    `game_codes?id=eq.${prev.id}`,
                    {
                      method: 'PATCH',
                      requireAdminKey: true,
                      body: patchBody,
                    }
                  );
                  if (patchRes.ok) {
                    codesUpdated += 1;
                    if (statusChanged && effectiveStatus === 'expired') {
                      codesExpired += 1;
                    }
                    if (statusChanged) {
                      verificationRows.push({
                        code_id: prev.id,
                        universe_id: Number(game.universeId),
                        code_text: prev.code,
                        previous_status: prev.status,
                        new_status: effectiveStatus,
                        actor: `provider:${adapter.id}`,
                        reason: `Updated from provider status (${item.sourceReportedStatus})`,
                        verified_at: nowIso,
                      });
                    }
                  }
                }
              }

              if (verificationRows.length > 0) {
                await supabaseRest('code_verification_logs', {
                  method: 'POST',
                  requireAdminKey: true,
                  body: verificationRows,
                });
              }
            }

            await recomputeGameCodeCounts(
              game.universeId,
              res.hasProviderData,
              res.resolvedWikiSubdomain
            );
          } catch (err) {
            errors.push(
              `${game.name}: ${err instanceof Error ? err.message : 'Unexpected provider error'}`
            );
          }
        })
      );
    }

    const durationMs = Date.now() - startedMs;
    const runStatus: 'success' | 'partial' | 'failed' =
      errors.length === 0
        ? 'success'
        : gamesWithProviderData > 0 || codesDiscovered > 0 || codesUpdated > 0
          ? 'partial'
          : 'failed';

    const logRes = await supabaseRest('code_collection_logs', {
      method: 'POST',
      requireAdminKey: true,
      headers: { Prefer: 'return=representation' },
      body: {
        source_id: adapter.id,
        triggered_by: options.triggeredBy,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        games_checked: gamesChecked,
        games_with_provider_data: gamesWithProviderData,
        codes_discovered: codesDiscovered,
        codes_updated: codesUpdated,
        codes_expired: codesExpired,
        api_requests: apiRequests,
        http_429_count: http429Count,
        status: runStatus,
        error_summary:
          errors.length > 0 ? errors.slice(0, 5).join(' | ').slice(0, 600) : null,
      },
    });

    if (logRes.ok) {
      const inserted = (await logRes.json()) as DbCollectionLogRow[];
      if (inserted[0]) runs.push(mapCollectionLogRow(inserted[0]));
    }

    const prevReqToday =
      dbSrc && dbSrc.updatedAt?.slice(0, 10) === todayUtcDate
        ? dbSrc.requestsToday
        : 0;
    await supabaseRest(`code_sources?id=eq.${encodeURIComponent(adapter.id)}`, {
      method: 'PATCH',
      requireAdminKey: true,
      body: {
        last_run_at: new Date().toISOString(),
        last_status:
          runStatus === 'success'
            ? 'healthy'
            : runStatus === 'partial'
              ? 'degraded'
              : 'error',
        last_error: errors[0]?.slice(0, 300) ?? null,
        consecutive_failures:
          runStatus === 'failed' ? (dbSrc?.consecutiveFailures ?? 0) + 1 : 0,
        requests_today: prevReqToday + apiRequests,
        requests_reset_date: todayUtcDate,
        updated_at: new Date().toISOString(),
      },
    });

    totalCodesDiscovered += codesDiscovered;
    totalCodesUpdated += codesUpdated;
    totalCodesExpired += codesExpired;
    totalApiRequests += apiRequests;
    totalHttp429 += http429Count;
    if (errors.length > 0) {
      allErrors.push(...errors.slice(0, 3));
    }
  }

  return {
    ok: true,
    gamesChecked: targetGames.length,
    gamesWithProviderData: gamesWithDataSet.size,
    codesDiscovered: totalCodesDiscovered,
    codesUpdated: totalCodesUpdated,
    codesExpired: totalCodesExpired,
    apiRequests: totalApiRequests,
    http429Count: totalHttp429,
    durationMs: Date.now() - cycleStartedMs,
    errors: allErrors,
    runs,
  };
}

/**
 * Public Developer & Community Submission handler:
 * - Honeypot spam check + sliding-window IP rate limiting
 * - Resolves Roblox game URL or Universe ID (auto-registering newly discovered games)
 * - Strictly inserts into Pending Verification (NEVER auto-marked Active)
 */
export async function submitCommunityCode(
  input: {
    gameInput: string;
    code: string;
    rewardDescription?: string;
    sourceUrl?: string;
    submitterNote?: string;
    websiteHoneypot?: string;
  },
  clientIp: string
): Promise<{
  ok: boolean;
  status: number;
  message: string;
  gameSlug?: string;
  universeId?: string;
}> {
  // Silent honeypot rejection for spam bots
  if (input.websiteHoneypot && input.websiteHoneypot.trim().length > 0) {
    return {
      ok: true,
      status: 200,
      message: 'Submission received for review.',
    };
  }

  const rate = checkSubmitRateLimit(clientIp);
  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      message: `Too many submissions. Please try again in ${rate.retryAfterSec} seconds.`,
    };
  }

  if (!isSupabaseWriteConfigured()) {
    return {
      ok: false,
      status: 503,
      message: 'Code submissions database is not configured yet.',
    };
  }

  const schemaReady = await checkCodesSchemaReady();
  if (!schemaReady) {
    return {
      ok: false,
      status: 503,
      message:
        'The Game Codes database tables have not been initialized in Supabase yet.',
    };
  }

  const rawCode = (input.code || '').trim();
  if (!isValidPromoCodeFormat(rawCode)) {
    return {
      ok: false,
      status: 400,
      message:
        'Please enter a valid Roblox code (3–42 characters, letters/numbers/symbols, no spaces).',
    };
  }

  const cleanSourceUrl = input.sourceUrl?.trim()
    ? validatePublicHttpsUrl(input.sourceUrl)
    : null;
  if (input.sourceUrl?.trim() && !cleanSourceUrl) {
    return {
      ok: false,
      status: 400,
      message: 'Source URL must be a valid public https:// link.',
    };
  }

  const resolved = await resolveRobloxExperience(input.gameInput || '');
  if (!resolved.game) {
    return {
      ok: false,
      status: 404,
      message:
        resolved.error ||
        'Could not resolve that Roblox game URL or Universe ID.',
    };
  }

  const game = resolved.game;
  const nowIso = new Date().toISOString();

  // Ensure the game exists in RoMetric's games table (auto-discover new games!)
  const existingGameRes = await supabaseRest(
    `games?select=universe_id,slug&universe_id=eq.${game.universeId}&limit=1`,
    { requireAdminKey: true }
  );
  const existingGameRows = existingGameRes.ok
    ? ((await existingGameRes.json()) as Array<{ universe_id: number; slug: string }>)
    : [];

  let gameSlug = existingGameRows[0]?.slug;
  if (!gameSlug) {
    const saved = await saveGameToSupabase(game, 'tier_3', nowIso);
    gameSlug = saved.slug;
  }

  const norm = normalizePromoCode(rawCode);

  // Check duplicate code for this Universe ID
  const dupRes = await supabaseRest(
    `game_codes?select=id,status&universe_id=eq.${game.universeId}&normalized_code=eq.${encodeURIComponent(norm)}&limit=1`,
    { requireAdminKey: true }
  );
  const dupRows = dupRes.ok
    ? ((await dupRes.json()) as Array<{ id: number; status: CodeStatus }>)
    : [];

  if (dupRows.length > 0) {
    return {
      ok: false,
      status: 409,
      message: `Code "${rawCode}" is already recorded for ${game.name} (status: ${dupRows[0].status.replace('_', ' ')}).`,
      gameSlug,
      universeId: game.universeId,
    };
  }

  const cleanReward = sanitizePlainText(input.rewardDescription, 180);
  const cleanNote = sanitizePlainText(input.submitterNote, 140);

  const insertRes = await supabaseRest('game_codes', {
    method: 'POST',
    requireAdminKey: true,
    headers: { Prefer: 'return=representation' },
    body: {
      universe_id: Number(game.universeId),
      code: rawCode.slice(0, 48),
      normalized_code: norm.slice(0, 48),
      reward_description: cleanReward,
      status: 'pending_verification',
      source_id: 'community_submissions',
      source_url: cleanSourceUrl,
      source_reported_status: 'community_submitted',
      admin_locked: false,
      submitted_by_note: cleanNote,
      discovered_at: nowIso,
      last_verified_at: null,
      expires_at: null,
      updated_at: nowIso,
    },
  });

  if (!insertRes.ok) {
    return {
      ok: false,
      status: 500,
      message: 'Unable to save submission right now. Please try again shortly.',
    };
  }

  const inserted = (await insertRes.json()) as DbGameCodeRow[];
  await supabaseRest('code_verification_logs', {
    method: 'POST',
    requireAdminKey: true,
    body: {
      code_id: inserted[0]?.id ?? null,
      universe_id: Number(game.universeId),
      code_text: rawCode.slice(0, 48),
      previous_status: null,
      new_status: 'pending_verification',
      actor: 'community_form',
      reason: cleanSourceUrl
        ? `Submitted with source URL: ${cleanSourceUrl}`
        : 'Submitted via public community form',
      verified_at: nowIso,
    },
  });

  await recomputeGameCodeCounts(game.universeId, true);

  return {
    ok: true,
    status: 201,
    message: `Submitted "${rawCode}" for ${game.name}. It is now in Pending Verification awaiting Admin review.`,
    gameSlug,
    universeId: game.universeId,
  };
}

export async function fetchCodesAdminOverview(): Promise<CodesAdminOverview> {
  if (!isSupabaseWriteConfigured()) {
    return {
      configured: false,
      schemaReady: false,
      summary: {
        totalGamesTracked: 0,
        gamesCovered: 0,
        gamesWithoutCoverage: 0,
        totalCodes: 0,
        activeCodes: 0,
        pendingCodes: 0,
        expiredCodes: 0,
        unverifiedCodes: 0,
        lastCollectionAt: null,
        totalApiRequestsToday: 0,
      },
      sources: [],
      reviewQueue: [],
      recentCodes: [],
      collectionLogs: [],
      verificationLogs: [],
    };
  }

  const schemaReady = await checkCodesSchemaReady();
  if (!schemaReady) {
    return {
      configured: true,
      schemaReady: false,
      summary: {
        totalGamesTracked: 0,
        gamesCovered: 0,
        gamesWithoutCoverage: 0,
        totalCodes: 0,
        activeCodes: 0,
        pendingCodes: 0,
        expiredCodes: 0,
        unverifiedCodes: 0,
        lastCollectionAt: null,
        totalApiRequestsToday: 0,
      },
      sources: [],
      reviewQueue: [],
      recentCodes: [],
      collectionLogs: [],
      verificationLogs: [],
    };
  }

  const [
    { list: sources, map: sourceMap },
    gamesRows,
    allCodes,
    colLogsRes,
    verLogsRes,
  ] = await Promise.all([
    fetchAllSourcesMap(),
    fetchAllActiveGamesForCodes(2500),
    fetchAllCodesPaginated(5000),
    supabaseRest(
      'code_collection_logs?select=*&order=started_at.desc&limit=30',
      { requireAdminKey: true }
    ),
    supabaseRest(
      'code_verification_logs?select=*&order=verified_at.desc&limit=40',
      { requireAdminKey: true }
    ),
  ]);

  const gameMap = new Map(
    gamesRows.map((g) => [
      String(g.universe_id),
      { name: g.name, slug: g.slug || String(g.universe_id) },
    ])
  );

  const coveredUniverseIds = new Set<string>();
  let activeCodes = 0;
  let pendingCodes = 0;
  let expiredCodes = 0;
  let unverifiedCodes = 0;

  for (const c of allCodes) {
    coveredUniverseIds.add(String(c.universe_id));
    if (c.status === 'active') activeCodes += 1;
    else if (c.status === 'pending_verification') pendingCodes += 1;
    else if (c.status === 'expired') expiredCodes += 1;
    else unverifiedCodes += 1;
  }

  const colLogs: CodeCollectionLog[] = colLogsRes.ok
    ? ((await colLogsRes.json()) as DbCollectionLogRow[]).map(mapCollectionLogRow)
    : [];

  const verLogs: CodeVerificationLog[] = verLogsRes.ok
    ? ((await verLogsRes.json()) as DbVerificationLogRow[]).map(
        mapVerificationLogRow
      )
    : [];

  const mappedCodes = allCodes.map((row) => mapCodeRow(row, sourceMap, gameMap));
  const reviewQueue = mappedCodes
    .filter(
      (c) => c.status === 'pending_verification' || c.status === 'unverified'
    )
    .slice(0, 60);

  const totalApiRequestsToday = sources.reduce(
    (sum, s) => sum + s.requestsToday,
    0
  );

  return {
    configured: true,
    schemaReady: true,
    summary: {
      totalGamesTracked: gamesRows.length,
      gamesCovered: coveredUniverseIds.size,
      gamesWithoutCoverage: Math.max(0, gamesRows.length - coveredUniverseIds.size),
      totalCodes: allCodes.length,
      activeCodes,
      pendingCodes,
      expiredCodes,
      unverifiedCodes,
      lastCollectionAt: colLogs[0]?.completedAt ?? null,
      totalApiRequestsToday,
    },
    sources,
    reviewQueue,
    recentCodes: mappedCodes.slice(0, 80),
    collectionLogs: colLogs,
    verificationLogs: verLogs,
  };
}

export async function toggleCodeSource(
  sourceId: string,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseWriteConfigured()) {
    return { ok: false, error: 'Supabase service role key is not configured.' };
  }
  const res = await supabaseRest(
    `code_sources?id=eq.${encodeURIComponent(sourceId)}`,
    {
      method: 'PATCH',
      requireAdminKey: true,
      body: {
        enabled,
        last_status: enabled ? 'idle' : 'disabled',
        updated_at: new Date().toISOString(),
      },
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      ok: false,
      error: errText ? `Database error (${res.status}): ${errText.slice(0, 180)}` : `Database error (${res.status})`,
    };
  }
  return { ok: true };
}

export async function moderateGameCode(options: {
  codeId: number;
  action:
    | 'approve_active'
    | 'mark_expired'
    | 'mark_unverified'
    | 'mark_pending'
    | 'update_reward'
    | 'delete_code';
  rewardDescription?: string | null;
  reason?: string;
  actor: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!isSupabaseWriteConfigured()) {
    return { ok: false, error: 'Supabase write access not configured.' };
  }

  const existingRes = await supabaseRest(
    `game_codes?select=*&id=eq.${options.codeId}&limit=1`,
    { requireAdminKey: true }
  );
  const rows: DbGameCodeRow[] = existingRes.ok
    ? ((await existingRes.json()) as DbGameCodeRow[])
    : [];
  const existing = rows[0];
  if (!existing) {
    return { ok: false, error: 'Code record not found.' };
  }

  const uid = String(existing.universe_id);
  const nowIso = new Date().toISOString();

  if (options.action === 'delete_code') {
    await supabaseRest('code_verification_logs', {
      method: 'POST',
      requireAdminKey: true,
      body: {
        code_id: null,
        universe_id: existing.universe_id,
        code_text: existing.code,
        previous_status: existing.status,
        new_status: 'deleted',
        actor: options.actor,
        reason: options.reason || 'Removed by Admin (duplicate or invalid)',
        verified_at: nowIso,
      },
    });
    const delRes = await supabaseRest(`game_codes?id=eq.${options.codeId}`, {
      method: 'DELETE',
      requireAdminKey: true,
    });
    if (!delRes.ok) return { ok: false, error: 'Failed to delete code.' };
    await recomputeGameCodeCounts(uid);
    return { ok: true, message: 'Code deleted.' };
  }

  if (options.action === 'update_reward') {
    const cleanReward = sanitizePlainText(options.rewardDescription, 180);
    const patchRes = await supabaseRest(`game_codes?id=eq.${options.codeId}`, {
      method: 'PATCH',
      requireAdminKey: true,
      body: {
        reward_description: cleanReward,
        updated_at: nowIso,
      },
    });
    return {
      ok: patchRes.ok,
      message: patchRes.ok ? 'Reward description updated.' : undefined,
      error: patchRes.ok ? undefined : 'Failed to update reward description.',
    };
  }

  const statusMap: Record<
    'approve_active' | 'mark_expired' | 'mark_unverified' | 'mark_pending',
    CodeStatus
  > = {
    approve_active: 'active',
    mark_expired: 'expired',
    mark_unverified: 'unverified',
    mark_pending: 'pending_verification',
  };

  const nextStatus = statusMap[options.action];
  const patchRes = await supabaseRest(`game_codes?id=eq.${options.codeId}`, {
    method: 'PATCH',
    requireAdminKey: true,
    body: {
      status: nextStatus,
      admin_locked: true,
      last_verified_at: nowIso,
      updated_at: nowIso,
    },
  });
  if (!patchRes.ok) {
    return { ok: false, error: 'Failed to update code status.' };
  }

  await supabaseRest('code_verification_logs', {
    method: 'POST',
    requireAdminKey: true,
    body: {
      code_id: existing.id,
      universe_id: existing.universe_id,
      code_text: existing.code,
      previous_status: existing.status,
      new_status: nextStatus,
      actor: options.actor,
      reason: options.reason || `Admin updated status to ${nextStatus}`,
      verified_at: nowIso,
    },
  });

  await recomputeGameCodeCounts(uid);
  return { ok: true, message: `Marked as ${nextStatus.replace('_', ' ')}.` };
}
