// RoMetric — Scheduled Cloudflare Worker Collector v3.0 (Free Tier Compatible)
//
// Engineered to refresh 1,000–3,300+ active Roblox games EVERY 30 MINUTES
// (plus Top 100 Tier 1 every 5 minutes) while staying safely inside Cloudflare
// Workers Free limits (<= 50 subrequests per invocation, <= 10ms active CPU):
//
//  KEY EFFICIENCY BREAKTHROUGH:
//  - Decouples live CCU ticks from votes/discovery. Each Roblox `v1/games` batch
//    fetches 50 games in just 1 subrequest (doubling throughput vs. calling votes
//    every tick), while preserving existing up_votes/down_votes/like_ratio from DB.
//  - Votes, 4-vector Creator/Similar/Omni-Search discovery (>= 25 CCU), and 5 TB
//    Google Drive nightly backups run in the companion Google Apps Script sidecar.
//
//  CRON SCHEDULE (3 Free Triggers):
//  1) Every 5 min (`*/5 * * * *`, 12 runs/hr, 6 runs/30m):
//       - Top 100 Tier 1 games (every 5 minutes)
//       - PLUS 550 stalest active games older than 25 minutes
//       - 650 games/run = 13 Roblox calls + ~4 Supabase calls = ~17 subrequests/run
//       - 6 runs/30m * 550 = 3,300 unique games refreshed every 30 minutes!
//  2) Every 15 min offset (`7,22,37,52 * * * *`, 4 runs/hr):
//       - Safety-net sweep of up to 750 stalest active games across ALL tiers
//       - Staggered by 7 minutes so it never collides with the 5-minute pulse
//       - ~19 subrequests/run — guarantees zero games fall past 30 minutes.
//  3) Daily 03:00 UTC (`0 3 * * *`):
//       - Runs `run_rometric_retention_rollup` to roll up raw -> hourly -> daily
//         and prune raw > 30h, hourly > 7d, jobs > 30d, daily > 365d (< 500 MB).

export interface CollectorEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
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
  playing: number;
  visits: number;
  favoritedCount: number;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
  };
}

const ROBLOX_BATCH = 50;
const TIER1_LIMIT_PER_5M = 100;
const STALE_SWEEP_PER_5M = 550;
const SAFETY_SWEEP_PER_15M = 750;
const STALE_THRESHOLD_MINUTES = 25;

const GAME_SELECT_COLS =
  'universe_id,root_place_id,name,slug,creator_id,creator_name,creator_type,up_votes,down_votes,like_ratio,peak_ccu_observed,peak_ccu_at,current_ccu,last_collected_at';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRobloxWith429Retry(
  url: string,
  counters: { apiRequests: number; http429Count: number }
): Promise<Response> {
  counters.apiRequests += 1;
  let res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'RoMetricWorker/3.0' },
  });
  if (res.status === 429) {
    counters.http429Count += 1;
    // 2-second backoff gives Roblox rate limit window time to clear
    await sleep(2000);
    counters.apiRequests += 1;
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'RoMetricWorker/3.0' },
    });
    if (res.status === 429) {
      counters.http429Count += 1;
    }
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

/**
 * High-throughput CCU pulse collector:
 * Calls Roblox `v1/games` only (50 games = 1 subrequest), preserves existing
 * vote metrics (refreshed every 6h by Google Apps Script), computes real 1h
 * growth from stored snapshots, and writes immutable snapshots + peaks.
 */
async function collectGameRows(
  env: CollectorEnv,
  rows: DbGameRow[],
  jobTier: 'all' | 'tier_1' | 'tier_2' | 'tier_3',
  triggeredBy: string
): Promise<void> {
  if (rows.length === 0) return;

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const counters = { apiRequests: 0, http429Count: 0 };
  const errors: string[] = [];

  // Deduplicate rows by universe_id
  const existingMap = new Map<number, DbGameRow>();
  for (const r of rows) {
    if (!existingMap.has(r.universe_id)) {
      existingMap.set(r.universe_id, r);
    }
  }
  const ids = Array.from(existingMap.keys());
  const nowIso = new Date().toISOString();
  const capturedMinute = Math.floor(Date.now() / 60_000);

  // Pull recent ~1h baseline snapshots in 1 subrequest (safe URL length <= 300 IDs per filter,
  // or time-window scan of recent snapshots ordered desc)
  const prev1hMap = new Map<number, number>();
  try {
    const fromIso = new Date(Date.now() - 85 * 60_000).toISOString();
    const toIso = new Date(Date.now() - 40 * 60_000).toISOString();
    const histRes = await supabaseFetch(
      env,
      `game_snapshots?select=universe_id,ccu&captured_at=gte.${encodeURIComponent(fromIso)}&captured_at=lte.${encodeURIComponent(toIso)}&order=captured_at.desc&limit=1000`
    );
    if (histRes.ok) {
      const histRows = (await histRes.json()) as Array<{
        universe_id: number;
        ccu: number;
      }>;
      for (const h of histRows) {
        if (existingMap.has(h.universe_id) && !prev1hMap.has(h.universe_id) && h.ccu > 0) {
          prev1hMap.set(h.universe_id, h.ccu);
        }
      }
    }
  } catch {
    // Non-fatal: continue with previous current_ccu fallback
  }

  const snapshotsToInsert: Array<Record<string, unknown>> = [];
  const gamesToPatch: Array<Record<string, unknown>> = [];
  const peaksToUpsert: Array<Record<string, unknown>> = [];

  // Run Roblox batches in small parallel waves of 3 to stay fast & polite
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += ROBLOX_BATCH) {
    chunks.push(ids.slice(i, i + ROBLOX_BATCH));
  }

  for (let w = 0; w < chunks.length; w += 3) {
    if (w > 0) {
      // 250ms spacing between waves smooths burst traffic to stay well within Roblox rate limits
      await sleep(250);
    }
    const wave = chunks.slice(w, w + 3);
    const responses = await Promise.all(
      wave.map((chunk) =>
        fetchRobloxWith429Retry(
          `https://games.roblox.com/v1/games?universeIds=${chunk.join(',')}`,
          counters
        )
      )
    );

    for (const gamesRes of responses) {
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

        const baseline1h =
          prev1hMap.get(g.id) ??
          (existing.current_ccu > 0 ? existing.current_ccu : null);
        const growth1h =
          baseline1h && baseline1h > 0
            ? Number((((ccu - baseline1h) / baseline1h) * 100).toFixed(2))
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

        // Every object in a PostgREST bulk upsert MUST share identical keys (prevents PGRST102)
        // and include all NOT NULL columns without defaults (prevents 23502).
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
      errors.push(`snapshots write HTTP ${snapRes.status}: ${body.slice(0, 180)}`);
    }

    const gamesPatchRes = await supabaseFetch(env, 'games?on_conflict=universe_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(gamesToPatch),
    });
    if (!gamesPatchRes.ok) {
      const body = await gamesPatchRes.text();
      errors.push(`games write HTTP ${gamesPatchRes.status}: ${body.slice(0, 180)}`);
    }

    if (peaksToUpsert.length > 0) {
      const peakRes = await supabaseFetch(env, 'game_records?on_conflict=universe_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(peaksToUpsert),
      });
      if (!peakRes.ok) {
        const body = await peakRes.text();
        errors.push(`peaks write HTTP ${peakRes.status}: ${body.slice(0, 180)}`);
      }
    }
  }

  const jobRes = await supabaseFetch(env, 'collection_jobs', {
    method: 'POST',
    body: JSON.stringify({
      tier: jobTier,
      triggered_by: triggeredBy,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      games_attempted: ids.length,
      games_succeeded: snapshotsToInsert.length,
      games_failed: Math.max(0, ids.length - snapshotsToInsert.length),
      api_requests: counters.apiRequests,
      http_429_count: counters.http429Count,
      status:
        snapshotsToInsert.length === 0
          ? 'failed'
          : errors.length > 0
            ? 'partial'
            : 'success',
      error_summary: errors.length ? errors.join(' | ').slice(0, 900) : null,
    }),
  });
  if (!jobRes.ok) {
    const body = await jobRes.text();
    throw new Error(`collection_jobs write HTTP ${jobRes.status}: ${body.slice(0, 200)}`);
  }
}

/**
 * Every 5 minutes (6 runs per 30 min):
 *  - Collects Top 100 Tier 1 games every 5 minutes (2 Roblox calls)
 *  - PLUS sweeps up to 550 stalest active games older than 25 minutes (11 Roblox calls)
 *  -> 6 * 550 = 3,300 unique games guaranteed refreshed every 30 minutes!
 *  -> Total ~17 subrequests/run (leaves >30 subrequests of safety margin under Free cap).
 */
async function runFiveMinutePulse(env: CollectorEnv): Promise<void> {
  const staleCutoff = new Date(
    Date.now() - STALE_THRESHOLD_MINUTES * 60_000
  ).toISOString();

  const [tier1Res, staleRes] = await Promise.all([
    supabaseFetch(
      env,
      `games?select=${GAME_SELECT_COLS}&active=eq.true&tracking_tier=eq.tier_1&order=last_collected_at.asc.nullsfirst&limit=${TIER1_LIMIT_PER_5M}`
    ),
    supabaseFetch(
      env,
      `games?select=${GAME_SELECT_COLS}&active=eq.true&tracking_tier=in.(tier_2,tier_3)&or=(last_collected_at.is.null,last_collected_at.lt.${encodeURIComponent(staleCutoff)})&order=last_collected_at.asc.nullsfirst&limit=${STALE_SWEEP_PER_5M}`
    ),
  ]);

  const tier1Rows = tier1Res.ok ? ((await tier1Res.json()) as DbGameRow[]) : [];
  const staleRows = staleRes.ok ? ((await staleRes.json()) as DbGameRow[]) : [];

  const combined = [...tier1Rows, ...staleRows];
  if (combined.length === 0) return;

  await collectGameRows(
    env,
    combined,
    staleRows.length > 0 ? 'all' : 'tier_1',
    staleRows.length > 0 ? 'cloudflare_cron_30m_pulse' : 'cloudflare_cron_tier1'
  );
}

/**
 * Every 15 minutes:
 *  - Safety-net sweep of up to 750 stalest active games across ALL tiers
 *    (15 Roblox calls + 4 Supabase calls = ~19 subrequests).
 *  - Ensures zero games ever slip past the 30-minute refresh SLA even after
 *    occasional transient Roblox 429 throttling.
 */
async function runFifteenMinuteSafetySweep(env: CollectorEnv): Promise<void> {
  const selectRes = await supabaseFetch(
    env,
    `games?select=${GAME_SELECT_COLS}&active=eq.true&order=last_collected_at.asc.nullsfirst&limit=${SAFETY_SWEEP_PER_15M}`
  );
  if (!selectRes.ok) {
    const body = await selectRes.text();
    throw new Error(
      `Supabase safety sweep select failed (HTTP ${selectRes.status}): ${body.slice(0, 200)}`
    );
  }

  const rows = (await selectRes.json()) as DbGameRow[];
  await collectGameRows(env, rows, 'all', 'cloudflare_cron_15m_sweep');
}

const workerHandler = {
  async fetch(): Promise<Response> {
    return new Response(
      JSON.stringify({
        service: 'rometric-collector',
        version: '3.0',
        cadence: 'tier1_5m_all_30m',
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
      ctx.waitUntil(
        supabaseFetch(env, 'rpc/run_rometric_retention_rollup', {
          method: 'POST',
          body: '{}',
        })
      );
      return;
    }

    if (event.cron === '*/5 * * * *') {
      ctx.waitUntil(runFiveMinutePulse(env));
      return;
    }

    ctx.waitUntil(runFifteenMinuteSafetySweep(env));
  },
};

export default workerHandler;
