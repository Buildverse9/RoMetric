// RoMetric — Scheduled Cloudflare Worker Collector v4.1 (Free Tier, Zero-429, Tier 2 R2 Warm History)
//
// Designed for universal 25+ CCU Roblox tracking strictly inside Cloudflare
// Workers Free limits (<= 50 subrequests/run, <= 10ms active CPU/run, 3 crons)
// with ZERO Roblox HTTP 429 rate-limit errors + 3-Tier Hot/Warm/Cold storage:
//
//  EMPIRICALLY VERIFIED ROBLOX LIMITS:
//  - `games.roblox.com/v1/games`: 50 universe IDs max per request, 300 req/60s.
//  - Live headers `x-ratelimit-remaining` & `x-ratelimit-reset` are read on EVERY
//    response. If remaining <= 25 or any 429 occurs, the governor halts new
//    batches immediately (zero retry storms), flushes collected rows, and lets
//    the next 1-minute tick resume cleanly.
//
//  TIGHT-MARGIN MATH (PER 1-MINUTE PULSE):
//  - Up to 900 stalest active games (>35 min old) = 18 Roblox calls (50 IDs/call)
//    + 1 SELECT + 4-5 bulk writes = 23-24 / 50 subrequests, ~4-6 ms CPU.
//  - Runs in smooth 2-wide waves with 400ms gap (~18 req/min = 6% of 300/min cap).
//  - Throughput: up to 27,000 games every 30 min (54,000 every 60 min).
//  - Exits in 1 subrequest (<1ms CPU) whenever all games are fresher than 35 min.
//
//  TIER 2 WARM HISTORY (CLOUDFLARE R2 FREE: 10 GB, $0 EGRESS, 1M WRITES/MO):
//  - History is partitioned into 64 deterministic shards (`shards/history-00..63.json`,
//    keyed by `universeId % 64`), holding 14d hourly + up to 5 years daily points.
//  - Each 15-min cron tick refreshes 2 shards (~5,760 Class A writes/mo = <0.6%
//    of R2's 1,000,000 free writes/mo cap) so every game syncs 3x/day.
//  - `GET /history/:universeId?range=7d|30d|90d|all` reads straight from R2 at $0 egress.
//
//  ZERO-EXTRA-CALL PASSIVE CODE DISCOVERY:
//  - Every `v1/games` payload already includes each game's full `description`.
//  - The worker scans descriptions containing "code" for explicit promo codes
//    and bulk-inserts newly discovered codes (`ignore-duplicates`, preserving
//    existing & `admin_locked` rows) with ZERO extra Roblox API calls.

interface R2ObjectBody {
  text(): Promise<string>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }
  ): Promise<unknown>;
}

export interface CollectorEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  HISTORY_BUCKET?: R2Bucket;
}

interface WorkerScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface DbGameRow {
  universe_id: number;
  root_place_id: number;
  name: string;
  slug: string;
  creator_id: number;
  creator_name: string;
  creator_type: 'User' | 'Group';
  up_votes: number | null;
  down_votes: number | null;
  like_ratio: number | null;
  peak_ccu_observed: number;
  peak_ccu_at: string | null;
  current_ccu: number;
  last_collected_at: string | null;
}

interface RobloxGameItem {
  id: number;
  rootPlaceId: number;
  name: string;
  description?: string | null;
  playing: number;
  visits: number;
  favoritedCount: number;
  genre?: string;
  genre_l1?: string;
  updated?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
    hasVerifiedBadge?: boolean;
  };
}

interface RateGovernorState {
  apiRequests: number;
  http429Count: number;
  minRemaining: number;
  tripped: boolean;
}

const ROBLOX_BATCH = 50;
const MAX_GAMES_PER_1M_PULSE = 900; // 18 Roblox calls = ~23-24 total subrequests, ~4-6ms CPU
const STALE_THRESHOLD_MINUTES = 35; // Guarantees every active game refreshes every 30-60 min
const WAVE_WIDTH = 2;
const WAVE_GAP_MS = 400;
const RATE_LIMIT_FLOOR = 25; // Stop proactively while 25+ requests still remain in window
const MIN_DISCOVERY_CCU = 25;
const DORMANT_CCU_THRESHOLD = 15; // Hysteresis band (enter >= 25, exit < 15 for 7+ days)
const DORMANT_GRACE_DAYS = 7;

const GAME_SELECT_COLS =
  'universe_id,root_place_id,name,slug,creator_id,creator_name,creator_type,up_votes,down_votes,like_ratio,peak_ccu_observed,peak_ccu_at,current_ccu,last_collected_at';

const PASSIVE_CODE_STOP_WORDS = new Set([
  'CODE', 'CODES', 'ACTIVE', 'EXPIRED', 'WORKING', 'REWARD', 'REWARDS', 'FREE',
  'NEW', 'UPDATE', 'ROBLOX', 'GAME', 'HTTPS', 'HTTP', 'NONE', 'TBA', 'TBD',
  'COMING', 'SOON', 'LIKE', 'LIKES', 'GOAL', 'NEXT', 'GROUP', 'DISCORD', 'HERE',
  'THE', 'AND', 'FOR', 'WITH', 'FROM', 'THIS', 'THAT', 'WILL', 'YOUR', 'MORE',
  'UNLOCK', 'CLAIM', 'REDEEM', 'BELOW', 'ABOVE', 'SERVER', 'GAMEPASS', 'VERSION',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(input: string): string {
  const cleaned = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return cleaned || 'experience';
}

function isValidPromoCodeFast(raw: string): boolean {
  if (!raw || raw.length < 3 || raw.length > 42) return false;
  if (!/^[A-Za-z0-9_!@#$%&*+?-]+$/.test(raw)) return false;
  if (/^\d{1,3}$/.test(raw)) return false;
  return !PASSIVE_CODE_STOP_WORDS.has(raw.toUpperCase());
}

/**
 * Lightweight, low-CPU passive promo code extractor for Roblox game descriptions
 * already returned inside `v1/games` responses (zero extra subrequests).
 */
function extractPassiveDescriptionCodes(
  universeId: number,
  rootPlaceId: number,
  description: string | null | undefined,
  nowIso: string
): Array<Record<string, unknown>> {
  if (!description || description.length < 10) return [];
  if (!/code/i.test(description)) return [];

  const text = description.slice(0, 2200);
  const seen = new Set<string>();
  const found: Array<Record<string, unknown>> = [];
  const sourceUrl = `https://www.roblox.com/games/${rootPlaceId || universeId}`;

  const patterns = [
    /(?:use\s+|new\s+|latest\s+|active\s+)?code\s*[:=\-–]\s*["'`*]?([A-Za-z0-9_!@#$%&*-]{3,36})["'`*]?(?:\s*[-–(:]\s*([^\n\r)]{3,110}))?/gi,
    /new\s+code\s+(?:at\s+[\d,.kKmM]+\s+likes\s*[:\-–]\s*)?["'`]([A-Za-z0-9_!@#$%&*-]{3,36})["'`]/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const rawCode = (m[1] || '').trim();
      const norm = rawCode.toUpperCase();
      if (!isValidPromoCodeFast(rawCode) || seen.has(norm)) continue;
      seen.add(norm);
      const reward = m[2] ? m[2].replace(/\s+/g, ' ').trim().slice(0, 160) : null;
      found.push({
        universe_id: universeId,
        code: rawCode.slice(0, 48),
        normalized_code: norm.slice(0, 48),
        reward_description: reward,
        status: 'active',
        source_id: 'roblox_official_signals',
        source_url: sourceUrl,
        source_reported_status: 'announced_in_game_description',
        admin_locked: false,
        discovered_at: nowIso,
        last_verified_at: nowIso,
        expires_at: null,
        updated_at: nowIso,
      });
      if (found.length >= 6) return found;
    }
  }

  // Comma-separated multi-code announcements: "Codes: CODE1, CODE2, CODE3"
  const multiRe = /(?:active\s+|working\s+|new\s+)?codes\s*[:\-–]\s*([^\n\r]{4,180})/gi;
  let mm: RegExpExecArray | null;
  while ((mm = multiRe.exec(text)) !== null) {
    const tokens = mm[1].split(/[,/|]+/);
    for (const rawTok of tokens) {
      const tok = rawTok.trim().replace(/^["'`*\[\(]+|["'`*\]\).,!]+$/g, '');
      const norm = tok.toUpperCase();
      if (!isValidPromoCodeFast(tok) || seen.has(norm)) continue;
      seen.add(norm);
      found.push({
        universe_id: universeId,
        code: tok.slice(0, 48),
        normalized_code: norm.slice(0, 48),
        reward_description: null,
        status: 'active',
        source_id: 'roblox_official_signals',
        source_url: sourceUrl,
        source_reported_status: 'announced_in_game_description',
        admin_locked: false,
        discovered_at: nowIso,
        last_verified_at: nowIso,
        expires_at: null,
        updated_at: nowIso,
      });
      if (found.length >= 8) return found;
    }
  }

  return found;
}

/**
 * Proactive header-driven Roblox fetch:
 * Inspects `x-ratelimit-remaining` on every response and immediately trips
 * the circuit breaker before HTTP 429 can ever happen (zero retry storms).
 */
async function fetchRobloxGoverned(
  url: string,
  gov: RateGovernorState
): Promise<Response | null> {
  if (gov.tripped) return null;
  gov.apiRequests += 1;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RoMetricWorker/4.0',
    },
  });

  const remHeader = res.headers.get('x-ratelimit-remaining');
  if (remHeader !== null) {
    const parsedRem = Number.parseInt(remHeader, 10);
    if (Number.isFinite(parsedRem)) {
      if (parsedRem < gov.minRemaining) gov.minRemaining = parsedRem;
      if (parsedRem <= RATE_LIMIT_FLOOR) {
        gov.tripped = true;
      }
    }
  }

  if (res.status === 429) {
    gov.http429Count += 1;
    gov.tripped = true;
    return res;
  }

  return res;
}

async function supabaseFetch(
  env: CollectorEnv,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const isJwt = key.startsWith('eyJ');

  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
    ...(isJwt ? { Authorization: `Bearer ${key}` } : {}),
  };

  if (init.headers) {
    const extra = init.headers as Record<string, string>;
    for (const [k, v] of Object.entries(extra)) {
      headers[k] = v;
    }
  }

  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers,
  });
}

async function flushPassiveCodes(
  env: CollectorEnv,
  passiveCodes: Array<Record<string, unknown>>,
  errors: string[]
): Promise<void> {
  if (passiveCodes.length === 0) return;

  // Deduplicate by (universe_id, normalized_code) within the batch
  const deduped: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const row of passiveCodes) {
    const key = `${row.universe_id}:${row.normalized_code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  // `ignore-duplicates` ensures we NEVER overwrite admin_locked rows or richer wiki rewards
  const res = await supabaseFetch(
    env,
    'game_codes?on_conflict=universe_id,normalized_code',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(deduped.slice(0, 200)),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    errors.push(`passive codes write HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
}

/**
 * High-throughput, zero-429 CCU pulse collector:
 * - Fetches up to 900 stalest games (>35m old) in 50-ID chunks (2-wide waves, 400ms gap).
 * - Preserves existing vote metrics (refreshed every 6h by Apps Script).
 * - Passively discovers new promo codes from game descriptions at ZERO extra Roblox cost.
 */
async function runOneMinuteAdaptivePulse(env: CollectorEnv): Promise<void> {
  const staleCutoff = new Date(
    Date.now() - STALE_THRESHOLD_MINUTES * 60_000
  ).toISOString();

  // 1 subrequest: pull only games that actually need a refresh (>35 min old or never collected)
  const selectRes = await supabaseFetch(
    env,
    `games?select=${GAME_SELECT_COLS}&active=eq.true&or=(last_collected_at.is.null,last_collected_at.lt.${encodeURIComponent(staleCutoff)})&order=last_collected_at.asc.nullsfirst,current_ccu.desc&limit=${MAX_GAMES_PER_1M_PULSE}`
  );
  if (!selectRes.ok) {
    const body = await selectRes.text();
    throw new Error(
      `Supabase pulse select failed (HTTP ${selectRes.status}): ${body.slice(0, 200)}`
    );
  }

  const rows = (await selectRes.json()) as DbGameRow[];
  // Exit immediately if all active games are fresher than 35 minutes (1 subrequest, <1ms CPU!)
  if (rows.length === 0) return;

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const gov: RateGovernorState = {
    apiRequests: 0,
    http429Count: 0,
    minRemaining: 300,
    tripped: false,
  };
  const errors: string[] = [];

  const existingMap = new Map<number, DbGameRow>();
  for (const r of rows) {
    if (!existingMap.has(r.universe_id)) {
      existingMap.set(r.universe_id, r);
    }
  }
  const ids = Array.from(existingMap.keys());
  const nowIso = new Date().toISOString();
  const capturedMinute = Math.floor(Date.now() / 60_000);

  const snapshotsToInsert: Array<Record<string, unknown>> = [];
  const gamesToPatch: Array<Record<string, unknown>> = [];
  const peaksToUpsert: Array<Record<string, unknown>> = [];
  const passiveCodesToInsert: Array<Record<string, unknown>> = [];

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += ROBLOX_BATCH) {
    chunks.push(ids.slice(i, i + ROBLOX_BATCH));
  }

  for (let w = 0; w < chunks.length; w += WAVE_WIDTH) {
    if (gov.tripped) {
      errors.push(
        `Rate governor paused cleanly at remaining=${gov.minRemaining}; deferred remaining chunks to next minute.`
      );
      break;
    }
    if (w > 0) {
      await sleep(WAVE_GAP_MS);
    }

    const wave = chunks.slice(w, w + WAVE_WIDTH);
    const responses = await Promise.all(
      wave.map((chunk) =>
        fetchRobloxGoverned(
          `https://games.roblox.com/v1/games?universeIds=${chunk.join(',')}`,
          gov
        )
      )
    );

    for (const gamesRes of responses) {
      if (!gamesRes) continue;
      if (!gamesRes.ok) {
        errors.push(`games API HTTP ${gamesRes.status}`);
        continue;
      }

      const gamesJson = (await gamesRes.json()) as { data?: RobloxGameItem[] };
      for (const g of gamesJson.data || []) {
        const existing = existingMap.get(g.id);
        if (!existing) continue;

        const ccu = Math.max(0, g.playing || 0);
        const prevPeak = existing.peak_ccu_observed ?? 0;
        const isPeak = ccu >= prevPeak;
        const peakCcu = isPeak ? ccu : prevPeak;
        const peakCcuAt = isPeak ? nowIso : (existing.peak_ccu_at ?? nowIso);
        const creatorType: 'User' | 'Group' =
          g.creator?.type === 'User'
            ? 'User'
            : g.creator?.type === 'Group'
              ? 'Group'
              : existing.creator_type;

        const growth1h =
          existing.current_ccu > 0
            ? Number((((ccu - existing.current_ccu) / existing.current_ccu) * 100).toFixed(2))
            : null;

        snapshotsToInsert.push({
          universe_id: g.id,
          ccu,
          visits: Math.max(0, g.visits || 0),
          favorites: Math.max(0, g.favoritedCount || 0),
          up_votes: existing.up_votes,
          down_votes: existing.down_votes,
          captured_at: nowIso,
          captured_minute: capturedMinute,
          data_source_id: 'roblox_games_v1',
          collection_status: 'observed',
        });

        gamesToPatch.push({
          universe_id: g.id,
          root_place_id: g.rootPlaceId || existing.root_place_id || g.id,
          name: g.name || existing.name,
          slug: existing.slug,
          creator_id: g.creator?.id ?? existing.creator_id,
          creator_name: g.creator?.name || existing.creator_name,
          creator_type: creatorType,
          current_ccu: ccu,
          total_visits: Math.max(0, g.visits || 0),
          favorites: Math.max(0, g.favoritedCount || 0),
          up_votes: existing.up_votes,
          down_votes: existing.down_votes,
          like_ratio: existing.like_ratio,
          growth_1h: growth1h,
          peak_ccu_observed: peakCcu,
          peak_ccu_at: peakCcuAt,
          collection_status: 'observed',
          last_collected_at: nowIso,
          updated_at: nowIso,
        });

        if (isPeak) {
          peaksToUpsert.push({
            universe_id: g.id,
            highest_observed_ccu: peakCcu,
            highest_observed_at: peakCcuAt,
            provenance: 'observed_peak',
            updated_at: nowIso,
          });
        }

        // Zero-extra-call passive code discovery from live description text
        if (g.description) {
          const extracted = extractPassiveDescriptionCodes(
            g.id,
            g.rootPlaceId || existing.root_place_id,
            g.description,
            nowIso
          );
          if (extracted.length > 0) {
            passiveCodesToInsert.push(...extracted);
          }
        }
      }
    }
  }

  if (snapshotsToInsert.length > 0) {
    const snapRes = await supabaseFetch(
      env,
      'game_snapshots?on_conflict=universe_id,captured_minute',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify(snapshotsToInsert),
      }
    );
    if (!snapRes.ok) {
      const body = await snapRes.text();
      errors.push(`snapshots write HTTP ${snapRes.status}: ${body.slice(0, 160)}`);
    }

    const gamesPatchRes = await supabaseFetch(env, 'games?on_conflict=universe_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(gamesToPatch),
    });
    if (!gamesPatchRes.ok) {
      const body = await gamesPatchRes.text();
      errors.push(`games write HTTP ${gamesPatchRes.status}: ${body.slice(0, 160)}`);
    }

    if (peaksToUpsert.length > 0) {
      const peakRes = await supabaseFetch(env, 'game_records?on_conflict=universe_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(peaksToUpsert),
      });
      if (!peakRes.ok) {
        const body = await peakRes.text();
        errors.push(`peaks write HTTP ${peakRes.status}: ${body.slice(0, 160)}`);
      }
    }

    await flushPassiveCodes(env, passiveCodesToInsert, errors);
  }

  await supabaseFetch(env, 'collection_jobs', {
    method: 'POST',
    body: JSON.stringify({
      tier: 'all',
      triggered_by: 'cloudflare_cron_1m_pulse',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      games_attempted: ids.length,
      games_succeeded: snapshotsToInsert.length,
      games_failed: Math.max(0, ids.length - snapshotsToInsert.length),
      api_requests: gov.apiRequests,
      http_429_count: gov.http429Count,
      status:
        snapshotsToInsert.length === 0
          ? 'failed'
          : errors.length > 0
            ? 'partial'
            : 'success',
      error_summary: errors.length ? errors.join(' | ').slice(0, 900) : null,
    }),
  });
}

/**
 * Every 15 minutes (`*\/15 * * * *`):
 * Fast 25+ CCU Breakout Catcher!
 * Scans Roblox Explore Trending / Up-and-Coming / Top Playing sorts so brand-new
 * viral games crossing 25 CCU appear on RoMetric within 15 minutes (instead of
 * waiting for the hourly Apps Script deep graph crawl).
 * Stays cleanly under 30/50 subrequests and ~5ms CPU.
 */
async function runFifteenMinuteBreakoutCatcher(env: CollectorEnv): Promise<void> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const gov: RateGovernorState = {
    apiRequests: 0,
    http429Count: 0,
    minRemaining: 300,
    tripped: false,
  };
  const errors: string[] = [];

  const sessionId = `rometric-cf-${Date.now()}`;
  const sortIds = [
    'top-playing-now',
    'top-trending',
    'up-and-coming',
    'most-popular',
    'top-revisited',
    'fun-with-friends',
  ];

  const candidateIds = new Set<number>();

  // 6 subrequests (2-wide waves)
  for (let i = 0; i < sortIds.length; i += WAVE_WIDTH) {
    if (gov.tripped) break;
    if (i > 0) await sleep(WAVE_GAP_MS);
    const wave = sortIds.slice(i, i + WAVE_WIDTH);
    const responses = await Promise.all(
      wave.map((sid) =>
        fetchRobloxGoverned(
          `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=${encodeURIComponent(sessionId)}&sortId=${encodeURIComponent(sid)}`,
          gov
        )
      )
    );
    for (const res of responses) {
      if (!res || !res.ok) continue;
      const json = (await res.json()) as {
        games?: Array<{ universeId?: number; playerCount?: number }>;
      };
      for (const item of json.games || []) {
        const uid = Number(item.universeId);
        const hint = Number(item.playerCount ?? MIN_DISCOVERY_CCU);
        if (Number.isFinite(uid) && uid > 0 && hint >= 18) {
          candidateIds.add(uid);
        }
      }
    }
  }

  const allCandidates = Array.from(candidateIds).slice(0, 350);
  if (allCandidates.length === 0) return;

  // Check which candidates are already tracked (max 2 subrequests)
  const existingSet = new Set<number>();
  for (let i = 0; i < allCandidates.length; i += 200) {
    const slice = allCandidates.slice(i, i + 200);
    const res = await supabaseFetch(
      env,
      `games?select=universe_id,active&universe_id=in.(${slice.join(',')})`
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ universe_id: number; active: boolean }>;
      for (const r of rows) {
        if (r.active !== false) existingSet.add(r.universe_id);
      }
    }
  }

  const unseenIds = allCandidates.filter((id) => !existingSet.has(id)).slice(0, 250);
  if (unseenIds.length === 0) return;

  // Probe unseen candidates in 50-ID batches (max 5 subrequests)
  const qualified: RobloxGameItem[] = [];
  for (let i = 0; i < unseenIds.length; i += ROBLOX_BATCH) {
    if (gov.tripped) break;
    if (i > 0) await sleep(WAVE_GAP_MS);
    const chunk = unseenIds.slice(i, i + ROBLOX_BATCH);
    const res = await fetchRobloxGoverned(
      `https://games.roblox.com/v1/games?universeIds=${chunk.join(',')}`,
      gov
    );
    if (!res || !res.ok) continue;
    const json = (await res.json()) as { data?: RobloxGameItem[] };
    for (const g of json.data || []) {
      if (Number(g.playing || 0) >= MIN_DISCOVERY_CCU) {
        qualified.push(g);
      }
    }
  }

  const toEnroll = qualified
    .sort((a, b) => (b.playing || 0) - (a.playing || 0))
    .slice(0, 100);
  if (toEnroll.length === 0) return;

  // Fetch icons & thumbnails for newly enrolled games (max 4 subrequests)
  const iconMap = new Map<number, string>();
  const thumbMap = new Map<number, string>();
  for (let i = 0; i < toEnroll.length; i += ROBLOX_BATCH) {
    if (gov.tripped) break;
    const batch = toEnroll.slice(i, i + ROBLOX_BATCH);
    const idCsv = batch.map((g) => g.id).join(',');
    const [iconRes, thumbRes] = await Promise.all([
      fetchRobloxGoverned(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${idCsv}&returnPolicy=PlaceHolder&size=256x256&format=Png&isCircular=false`,
        gov
      ),
      fetchRobloxGoverned(
        `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${idCsv}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`,
        gov
      ),
    ]);

    if (iconRes && iconRes.ok) {
      const iJson = (await iconRes.json()) as {
        data?: Array<{ targetId?: number; imageUrl?: string }>;
      };
      for (const it of iJson.data || []) {
        if (it.targetId && it.imageUrl?.startsWith('https://')) {
          iconMap.set(it.targetId, it.imageUrl);
        }
      }
    }
    if (thumbRes && thumbRes.ok) {
      const tJson = (await thumbRes.json()) as {
        data?: Array<{
          universeId?: number;
          thumbnails?: Array<{ imageUrl?: string }>;
        }>;
      };
      for (const it of tJson.data || []) {
        const url = it.thumbnails?.find((t) => t.imageUrl?.startsWith('https://'))?.imageUrl;
        if (it.universeId && url) {
          thumbMap.set(it.universeId, url);
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  const capturedMinute = Math.floor(Date.now() / 60_000);
  const gameRows: Array<Record<string, unknown>> = [];
  const snapRows: Array<Record<string, unknown>> = [];
  const peakRows: Array<Record<string, unknown>> = [];
  const passiveCodes: Array<Record<string, unknown>> = [];

  for (const g of toEnroll) {
    const ccu = Math.max(0, Number(g.playing || 0));
    const tier = ccu >= 25000 ? 'tier_1' : ccu >= 2000 ? 'tier_2' : 'tier_3';
    const genreLabel = String(g.genre_l1 || g.genre || 'All Genres')
      .trim()
      .slice(0, 80);

    gameRows.push({
      universe_id: g.id,
      root_place_id: g.rootPlaceId || g.id,
      name: String(g.name || `Experience ${g.id}`).trim().slice(0, 200),
      slug: slugify(g.name || `experience-${g.id}`),
      description: String(g.description || '').slice(0, 1900),
      creator_id: g.creator?.id ?? 0,
      creator_name: String(g.creator?.name || 'Unknown Creator').slice(0, 120),
      creator_type: g.creator?.type === 'User' ? 'User' : 'Group',
      creator_verified: Boolean(g.creator?.hasVerifiedBadge),
      genre: genreLabel || 'All Genres',
      icon_url: iconMap.get(g.id) ?? null,
      thumbnail_url: thumbMap.get(g.id) ?? null,
      current_ccu: ccu,
      total_visits: Math.max(0, Number(g.visits || 0)),
      favorites: Math.max(0, Number(g.favoritedCount || 0)),
      peak_ccu_observed: ccu,
      peak_ccu_at: nowIso,
      tracking_tier: tier,
      active: true,
      data_source_id: 'roblox_games_v1',
      collection_status: 'observed',
      first_observed_at: nowIso,
      last_collected_at: nowIso,
      roblox_updated_at: g.updated ? String(g.updated).slice(0, 40) : null,
      updated_at: nowIso,
    });

    snapRows.push({
      universe_id: g.id,
      ccu,
      visits: Math.max(0, Number(g.visits || 0)),
      favorites: Math.max(0, Number(g.favoritedCount || 0)),
      up_votes: null,
      down_votes: null,
      captured_at: nowIso,
      captured_minute: capturedMinute,
      data_source_id: 'roblox_games_v1',
      collection_status: 'observed',
    });

    peakRows.push({
      universe_id: g.id,
      highest_observed_ccu: ccu,
      highest_observed_at: nowIso,
      provenance: 'observed_peak',
      updated_at: nowIso,
    });

    if (g.description) {
      passiveCodes.push(
        ...extractPassiveDescriptionCodes(g.id, g.rootPlaceId || g.id, g.description, nowIso)
      );
    }
  }

  const gRes = await supabaseFetch(env, 'games?on_conflict=universe_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(gameRows),
  });
  if (!gRes.ok) {
    errors.push(`breakout games upsert HTTP ${gRes.status}`);
  } else {
    await supabaseFetch(env, 'game_snapshots?on_conflict=universe_id,captured_minute', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(snapRows),
    });
    await supabaseFetch(env, 'game_records?on_conflict=universe_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(peakRows),
    });
    await flushPassiveCodes(env, passiveCodes, errors);
  }

  await supabaseFetch(env, 'collection_jobs', {
    method: 'POST',
    body: JSON.stringify({
      tier: 'all',
      triggered_by: 'cloudflare_cron_15m_breakout',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      games_attempted: unseenIds.length,
      games_succeeded: gRes.ok ? gameRows.length : 0,
      games_failed: gRes.ok ? 0 : gameRows.length,
      api_requests: gov.apiRequests,
      http_429_count: gov.http429Count,
      status: errors.length > 0 ? 'partial' : 'success',
      error_summary: errors.length ? errors.join(' | ').slice(0, 900) : null,
    }),
  });
}

// ============================================================================
// TIER 2 WARM HISTORY — 64-SHARD CLOUDFLARE R2 SYNC + ZERO-EGRESS READ API
// ============================================================================

const R2_SHARD_COUNT = 64;
const R2_MAX_HOURLY_POINTS = 336; // 14 days of hourly history
const R2_MAX_DAILY_POINTS = 1825; // 5 years of daily history

/** Compact tuple: [timestampMs, avgCcu, minCcu, maxCcu, visits, favorites] */
type R2HourlyTuple = [number, number, number, number, number, number];
/** Compact tuple: ["YYYY-MM-DD", avgCcu, minCcu, maxCcu, visits, favorites] */
type R2DailyTuple = [string, number, number, number, number, number];

interface R2ShardGameEntry {
  h: R2HourlyTuple[];
  d: R2DailyTuple[];
}

interface R2HistoryShardDoc {
  v: 1;
  shard: number;
  updatedAt: string;
  games: Record<string, R2ShardGameEntry>;
}

function shardKey(shardId: number): string {
  return `shards/history-${String(shardId).padStart(2, '0')}.json`;
}

function universeShardId(universeId: number): number {
  return Math.abs(Math.trunc(universeId)) % R2_SHARD_COUNT;
}

async function readR2Shard(
  bucket: R2Bucket,
  shardId: number
): Promise<R2HistoryShardDoc> {
  try {
    const obj = await bucket.get(shardKey(shardId));
    if (obj) {
      const parsed = JSON.parse(await obj.text()) as R2HistoryShardDoc;
      if (parsed && typeof parsed.games === 'object' && parsed.games !== null) {
        return parsed;
      }
    }
  } catch {
    // Initialize clean shard if missing or corrupted
  }
  return {
    v: 1,
    shard: shardId,
    updatedAt: new Date().toISOString(),
    games: {},
  };
}

/**
 * Syncs 2 deterministic R2 shards per 15-minute cron tick (~5,760 writes/month = <0.6%
 * of R2 Free's 1,000,000 Class A writes/month limit).
 * Pulls recent hourly & daily stats from Supabase using only 2-3 subrequests total.
 */
async function syncTwoR2HistoryShards(
  env: CollectorEnv,
  scheduledTime: number
): Promise<void> {
  if (!env.HISTORY_BUCKET) return;

  const tickIndex = Math.floor((scheduledTime || Date.now()) / (15 * 60_000));
  const shardA = (tickIndex * 2) % R2_SHARD_COUNT;
  const shardB = (tickIndex * 2 + 1) % R2_SHARD_COUNT;
  const targetShards = [shardA, shardB];

  // Fetch recent 36h hourly + recent 14d daily rows across active games belonging to these 2 shards
  // 1) Grab universe_ids active in Supabase (1 subrequest, lightweight)
  const gamesRes = await supabaseFetch(
    env,
    'games?select=universe_id&active=eq.true&order=current_ccu.desc&limit=5000'
  );
  if (!gamesRes.ok) return;
  const allGames = (await gamesRes.json()) as Array<{ universe_id: number }>;

  const idsByShard = new Map<number, number[]>([
    [shardA, []],
    [shardB, []],
  ]);
  for (const row of allGames) {
    const sid = universeShardId(row.universe_id);
    const list = idsByShard.get(sid);
    if (list && list.length < 300) {
      list.push(row.universe_id);
    }
  }

  const allTargetIds = [
    ...(idsByShard.get(shardA) ?? []),
    ...(idsByShard.get(shardB) ?? []),
  ];
  if (allTargetIds.length === 0) return;

  const idCsv = allTargetIds.join(',');
  const hourlyCutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  const dailyCutoff = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

  // 2 subrequests: recent hourly + recent daily for the 2 shards' games
  const [hourlyRes, dailyRes] = await Promise.all([
    supabaseFetch(
      env,
      `game_hourly_stats?select=universe_id,hour_bucket,avg_ccu,min_ccu,max_ccu,latest_visits,latest_favorites&universe_id=in.(${idCsv})&hour_bucket=gte.${encodeURIComponent(hourlyCutoff)}&order=hour_bucket.asc&limit=4000`
    ),
    supabaseFetch(
      env,
      `game_daily_stats?select=universe_id,day_bucket,avg_ccu,min_ccu,max_ccu,visits_end,favorites_end&universe_id=in.(${idCsv})&day_bucket=gte.${encodeURIComponent(dailyCutoff)}&order=day_bucket.asc&limit=4000`
    ),
  ]);

  const hourlyRows: Array<{
    universe_id: number;
    hour_bucket: string;
    avg_ccu: number;
    min_ccu: number;
    max_ccu: number;
    latest_visits: number;
    latest_favorites: number;
  }> = hourlyRes.ok ? ((await hourlyRes.json()) as never[]) : [];

  const dailyRows: Array<{
    universe_id: number;
    day_bucket: string;
    avg_ccu: number;
    min_ccu: number;
    max_ccu: number;
    visits_end: number;
    favorites_end: number;
  }> = dailyRes.ok ? ((await dailyRes.json()) as never[]) : [];

  if (hourlyRows.length === 0 && dailyRows.length === 0) return;

  const docs = new Map<number, R2HistoryShardDoc>();
  for (const sid of targetShards) {
    docs.set(sid, await readR2Shard(env.HISTORY_BUCKET, sid));
  }

  const touchedShards = new Set<number>();

  for (const r of hourlyRows) {
    const sid = universeShardId(r.universe_id);
    const doc = docs.get(sid);
    if (!doc) continue;
    const uid = String(r.universe_id);
    const entry = doc.games[uid] ?? { h: [], d: [] };
    const tsMs = Date.parse(r.hour_bucket);
    if (!Number.isFinite(tsMs)) continue;

    const tuple: R2HourlyTuple = [
      tsMs,
      Math.round(Number(r.avg_ccu) || 0),
      Math.round(Number(r.min_ccu) || 0),
      Math.round(Number(r.max_ccu) || 0),
      Math.round(Number(r.latest_visits) || 0),
      Math.round(Number(r.latest_favorites) || 0),
    ];

    const existingIdx = entry.h.findIndex((p) => p[0] === tsMs);
    if (existingIdx >= 0) {
      entry.h[existingIdx] = tuple;
    } else {
      entry.h.push(tuple);
    }
    doc.games[uid] = entry;
    touchedShards.add(sid);
  }

  for (const r of dailyRows) {
    const sid = universeShardId(r.universe_id);
    const doc = docs.get(sid);
    if (!doc) continue;
    const uid = String(r.universe_id);
    const entry = doc.games[uid] ?? { h: [], d: [] };
    const dayStr = String(r.day_bucket || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayStr)) continue;

    const tuple: R2DailyTuple = [
      dayStr,
      Math.round(Number(r.avg_ccu) || 0),
      Math.round(Number(r.min_ccu) || 0),
      Math.round(Number(r.max_ccu) || 0),
      Math.round(Number(r.visits_end) || 0),
      Math.round(Number(r.favorites_end) || 0),
    ];

    const existingIdx = entry.d.findIndex((p) => p[0] === dayStr);
    if (existingIdx >= 0) {
      entry.d[existingIdx] = tuple;
    } else {
      entry.d.push(tuple);
    }
    doc.games[uid] = entry;
    touchedShards.add(sid);
  }

  const nowIso = new Date().toISOString();
  for (const sid of touchedShards) {
    const doc = docs.get(sid);
    if (!doc) continue;
    for (const entry of Object.values(doc.games)) {
      if (entry.h.length > 1) {
        entry.h.sort((a, b) => a[0] - b[0]);
      }
      if (entry.h.length > R2_MAX_HOURLY_POINTS) {
        entry.h = entry.h.slice(-R2_MAX_HOURLY_POINTS);
      }
      if (entry.d.length > 1) {
        entry.d.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      }
      if (entry.d.length > R2_MAX_DAILY_POINTS) {
        entry.d = entry.d.slice(-R2_MAX_DAILY_POINTS);
      }
    }
    doc.updatedAt = nowIso;
    await env.HISTORY_BUCKET.put(shardKey(sid), JSON.stringify(doc), {
      httpMetadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=900',
      },
    });
  }
}

async function handleHistoryReadRequest(
  request: Request,
  env: CollectorEnv,
  universeIdStr: string
): Promise<Response> {
  if (!/^[0-9]{1,20}$/.test(universeIdStr)) {
    return new Response(JSON.stringify({ error: 'Invalid universeId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!env.HISTORY_BUCKET) {
    return new Response(JSON.stringify({ configured: false, points: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const range = (url.searchParams.get('range') || '30d').trim();
  const uidNum = Number(universeIdStr);
  const sid = universeShardId(uidNum);
  const doc = await readR2Shard(env.HISTORY_BUCKET, sid);
  const entry = doc.games[universeIdStr];

  if (!entry) {
    return new Response(
      JSON.stringify({ configured: true, universeId: universeIdStr, points: [] }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=900',
        },
      }
    );
  }

  const nowMs = Date.now();
  const points: Array<{
    t: string;
    ms: number;
    c: number;
    min: number;
    max: number;
    v: number;
    f: number;
    src: 'h' | 'd';
  }> = [];

  if (range === '7d') {
    const cutoffMs = nowMs - 7 * 86_400_000;
    for (const [ms, avg, min, max, v, f] of entry.h) {
      if (ms >= cutoffMs) {
        points.push({
          t: new Date(ms).toISOString(),
          ms,
          c: avg,
          min,
          max,
          v,
          f,
          src: 'h',
        });
      }
    }
  } else {
    const daysWindow =
      range === '30d' ? 30 : range === '90d' ? 90 : Number.MAX_SAFE_INTEGER;
    const cutoffStr =
      daysWindow === Number.MAX_SAFE_INTEGER
        ? ''
        : new Date(nowMs - daysWindow * 86_400_000).toISOString().slice(0, 10);
    for (const [dayStr, avg, min, max, v, f] of entry.d) {
      if (!cutoffStr || dayStr >= cutoffStr) {
        const iso = `${dayStr}T00:00:00.000Z`;
        points.push({
          t: iso,
          ms: Date.parse(iso),
          c: avg,
          min,
          max,
          v,
          f,
          src: 'd',
        });
      }
    }
  }

  return new Response(
    JSON.stringify({
      configured: true,
      universeId: universeIdStr,
      range,
      shard: sid,
      updatedAt: doc.updatedAt,
      points,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
      },
    }
  );
}

/**
 * Daily 03:00 UTC (`0 3 * * *`):
 * 1) Deactivates long-dormant games (< 15 CCU for 7+ days with peak < 100) using
 *    hysteresis so games hovering around 20-25 CCU never flap in/out.
 * 2) Runs `run_rometric_retention_rollup` to roll up raw -> hourly -> daily.
 */
async function runDailyMaintenance(env: CollectorEnv): Promise<void> {
  const cutoffIso = new Date(
    Date.now() - DORMANT_GRACE_DAYS * 86_400_000
  ).toISOString();
  const nowIso = new Date().toISOString();

  await supabaseFetch(
    env,
    `games?active=eq.true&current_ccu=lt.${DORMANT_CCU_THRESHOLD}&peak_ccu_observed=lt.100&first_observed_at=lt.${encodeURIComponent(cutoffIso)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        active: false,
        updated_at: nowIso,
      }),
    }
  );

  await supabaseFetch(env, 'rpc/run_rometric_retention_rollup', {
    method: 'POST',
    body: '{}',
  });
}

async function runFifteenMinuteTasks(
  env: CollectorEnv,
  scheduledTime: number
): Promise<void> {
  await runFifteenMinuteBreakoutCatcher(env);

  // Tier 2 R2 Warm History Sync (2 of 64 shards per 15-min tick = ~5,760 writes/month)
  try {
    await syncTwoR2HistoryShards(env, scheduledTime);
  } catch {
    // Non-fatal: next tick continues cleanly
  }

  // Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC), roll up & prune Tier 1 Supabase Hot snapshots
  const nowDate = new Date(scheduledTime || Date.now());
  if (nowDate.getUTCMinutes() < 15 && nowDate.getUTCHours() % 6 === 0) {
    try {
      await supabaseFetch(env, 'rpc/run_rometric_retention_rollup', {
        method: 'POST',
        body: '{}',
      });
    } catch {
      // Non-fatal: daily 03:00 UTC maintenance will catch up
    }
  }
}

const workerHandler = {
  async fetch(request: Request, env: CollectorEnv): Promise<Response> {
    const url = new URL(request.url);
    const historyMatch = url.pathname.match(/^\/history\/([0-9]{1,20})$/);
    if (request.method === 'GET' && historyMatch) {
      return handleHistoryReadRequest(request, env, historyMatch[1]);
    }

    return new Response(
      JSON.stringify({
        service: 'rometric-collector',
        version: '4.1',
        cadence: 'adaptive_30_to_60m_zero_429',
        min_discovery_ccu: MIN_DISCOVERY_CCU,
        passive_code_discovery: true,
        r2_warm_history_enabled: Boolean(env.HISTORY_BUCKET),
        r2_shards: R2_SHARD_COUNT,
        status: 'ok',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },

  async scheduled(
    event: WorkerScheduledEvent,
    env: CollectorEnv,
    ctx: WorkerExecutionContext
  ): Promise<void> {
    if (event.cron === '0 3 * * *') {
      ctx.waitUntil(runDailyMaintenance(env));
      return;
    }

    if (event.cron === '*/15 * * * *') {
      ctx.waitUntil(runFifteenMinuteTasks(env, event.scheduledTime));
      return;
    }

    ctx.waitUntil(runOneMinuteAdaptivePulse(env));
  },
};

export default workerHandler;
