/**
 * RoMetric — Scheduled Cloudflare Worker Collector (Free Tier Compatible)
 *
 * Designed specifically for Cloudflare Workers Free limits:
 *  - <= 50 subrequests per invocation (polls up to 400 games/run = 16 Roblox API calls + 4 DB writes)
 *  - <= 10 ms active CPU time per run
 *  - 3 Cron Triggers max (Tier 1 every 5m, Tier 2/3 chunked every 15m, Daily rollup at 03:00 UTC)
 *  - Zero hardcoded secrets (configured via `wrangler secret put`)
 */

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
  peak_ccu_observed: number;
  peak_ccu_at: string | null;
}

interface RobloxGameItem {
  id: number;
  rootPlaceId: number;
  name: string;
  playing: number;
  visits: number;
  favoritedCount: number;
  updated?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
    hasVerifiedBadge?: boolean;
  };
}

interface RobloxVoteItem {
  id: number;
  upVotes: number;
  downVotes: number;
}

const MAX_GAMES_PER_RUN = 350; // Keeps total subrequests well below Cloudflare Free's 50-fetch cap
const ROBLOX_BATCH = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRobloxWith429Retry(
  url: string,
  counters: { apiRequests: number; http429Count: number }
): Promise<Response> {
  counters.apiRequests += 1;
  let res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'RoMetricWorker/1.0' },
  });
  if (res.status === 429) {
    counters.http429Count += 1;
    await sleep(1200);
    counters.apiRequests += 1;
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'RoMetricWorker/1.0' },
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

async function runTierBatch(
  env: CollectorEnv,
  tier: 'tier_1' | 'tier_2' | 'tier_3'
): Promise<void> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const counters = { apiRequests: 0, http429Count: 0 };
  const errors: string[] = [];

  // Select stalest active games for this tier, including required NOT NULL columns
  const selectRes = await supabaseFetch(
    env,
    `games?select=universe_id,root_place_id,name,slug,creator_id,creator_name,creator_type,peak_ccu_observed,peak_ccu_at&active=eq.true&tracking_tier=eq.${tier}&order=last_collected_at.asc&limit=${MAX_GAMES_PER_RUN}`
  );
  if (!selectRes.ok) {
    const body = await selectRes.text();
    throw new Error(`Supabase select failed (HTTP ${selectRes.status}): ${body.slice(0, 200)}`);
  }
  const rows = (await selectRes.json()) as DbGameRow[];
  if (rows.length === 0) return;

  const existingMap = new Map(rows.map((r) => [r.universe_id, r]));
  const ids = rows.map((r) => r.universe_id);
  const nowIso = new Date().toISOString();
  const capturedMinute = Math.floor(Date.now() / 60_000);

  const snapshotsToInsert: Array<Record<string, unknown>> = [];
  const gamesToPatch: Array<Record<string, unknown>> = [];
  const peaksToUpsert: Array<Record<string, unknown>> = [];

  for (let i = 0; i < ids.length; i += ROBLOX_BATCH) {
    const chunk = ids.slice(i, i + ROBLOX_BATCH).join(',');

    const [gamesRes, votesRes] = await Promise.all([
      fetchRobloxWith429Retry(
        `https://games.roblox.com/v1/games?universeIds=${chunk}`,
        counters
      ),
      fetchRobloxWith429Retry(
        `https://games.roblox.com/v1/games/votes?universeIds=${chunk}`,
        counters
      ),
    ]);

    if (!gamesRes.ok) {
      errors.push(`games API HTTP ${gamesRes.status}`);
      continue;
    }

    const gamesJson = (await gamesRes.json()) as { data?: RobloxGameItem[] };
    const votesJson = votesRes.ok
      ? ((await votesRes.json()) as { data?: RobloxVoteItem[] })
      : { data: [] };
    const voteMap = new Map((votesJson.data || []).map((v) => [v.id, v]));

    for (const g of gamesJson.data || []) {
      const existing = existingMap.get(g.id);
      if (!existing) continue;

      const vote = voteMap.get(g.id);
      const up = vote ? vote.upVotes : null;
      const down = vote ? vote.downVotes : null;
      const likeRatio =
        up !== null && down !== null && up + down > 0
          ? Number(((up / (up + down)) * 100).toFixed(2))
          : null;

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

      snapshotsToInsert.push({
        universe_id: g.id,
        ccu,
        visits: Math.max(0, g.visits || 0),
        favorites: Math.max(0, g.favoritedCount || 0),
        up_votes: up,
        down_votes: down,
        captured_at: nowIso,
        captured_minute: capturedMinute,
        data_source_id: 'roblox_games_v1',
        collection_status: vote ? 'observed' : 'partial',
      });

      // Every object in a PostgREST bulk upsert MUST have identical keys (prevents PGRST102)
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
        up_votes: up,
        down_votes: down,
        like_ratio: likeRatio,
        peak_ccu_observed: peakCcu,
        peak_ccu_at: peakCcuAt,
        collection_status: vote ? 'observed' : 'partial',
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
      tier,
      triggered_by: 'cloudflare_cron',
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

const workerHandler = {
  async fetch(): Promise<Response> {
    return new Response(
      JSON.stringify({ service: 'rometric-collector', status: 'ok' }),
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
      ctx.waitUntil(runTierBatch(env, 'tier_1'));
      return;
    }

    // Every 15 minutes: alternate Tier 2 and Tier 3 chunks
    const minute = new Date(event.scheduledTime).getUTCMinutes();
    const targetTier = minute % 30 === 0 ? 'tier_2' : 'tier_3';
    ctx.waitUntil(runTierBatch(env, targetTier));
  },
};

export default workerHandler;
