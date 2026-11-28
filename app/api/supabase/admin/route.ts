import { NextRequest, NextResponse } from 'next/server';
import {
  invalidateSupabaseReadCaches,
  isSupabaseWriteConfigured,
  isValidNumericId,
  isValidTrackingTier,
  mapSupabaseJobRow,
  mapSupabaseRowToGame,
  runSupabaseCollectionCycle,
  saveGameToSupabase,
  supabaseRest,
  verifyAdminBearerToken,
  type SupabaseGameRow,
  type SupabaseJobRow,
} from '@/lib/supabase-server';
import type { LiveRobloxGamePayload } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ADMIN_GAMES_SELECT =
  'universe_id,root_place_id,name,slug,creator_id,creator_name,creator_type,creator_verified,genre,icon_url,thumbnail_url,current_ccu,total_visits,favorites,up_votes,down_votes,like_ratio,growth_1h,growth_24h,growth_7d,growth_30d,peak_ccu_observed,peak_ccu_at,tracking_tier,active,data_source_id,collection_status,first_observed_at,last_collected_at,roblox_updated_at,updated_at';

function parseExactCount(res: Response, fallbackLen = 0): number {
  if (!res.ok) return fallbackLen;
  const contentRange = res.headers.get('content-range');
  const totalMatch = contentRange?.match(/\/(\d+)$/);
  if (totalMatch) return Number(totalMatch[1]);
  return fallbackLen;
}

function sanitizePostgrestSearch(raw: string): string {
  // Strip PostgREST syntax/wildcard characters to prevent filter injection
  return raw
    .trim()
    .slice(0, 60)
    .replace(/[,()\\*%'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(req: NextRequest) {
  if (!isSupabaseWriteConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        jobs: [],
        games: [],
        totalActiveGames: 0,
        freshGames35m: 0,
        snapshotCount: 0,
        hourlyRowCount: 0,
        dailyRowCount: 0,
        warmD1Configured: false,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const admin = await verifyAdminBearerToken(req.headers.get('authorization'));
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized: verified owner admin token required.' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawQ = searchParams.get('q') || '';
    const cleanQ = sanitizePostgrestSearch(rawQ);
    const freshCutoffIso = new Date(Date.now() - 35 * 60_000).toISOString();

    let gamesQuery = `games?select=${ADMIN_GAMES_SELECT}&active=eq.true&order=current_ccu.desc&limit=150`;
    if (cleanQ) {
      if (isValidNumericId(cleanQ)) {
        gamesQuery = `games?select=${ADMIN_GAMES_SELECT}&active=eq.true&or=(universe_id.eq.${cleanQ},root_place_id.eq.${cleanQ})&order=current_ccu.desc&limit=150`;
      } else {
        const pattern = encodeURIComponent(`*${cleanQ}*`);
        gamesQuery = `games?select=${ADMIN_GAMES_SELECT}&active=eq.true&or=(name.ilike.${pattern},creator_name.ilike.${pattern})&order=current_ccu.desc&limit=150`;
      }
    }

    const [
      jobsRes,
      activeGamesCountRes,
      freshGamesCountRes,
      snapsRes,
      hourlyRes,
      dailyRes,
      liveGamesRes,
    ] = await Promise.all([
      supabaseRest('collection_jobs?select=*&order=started_at.desc&limit=25', {
        requireAdminKey: true,
      }),
      supabaseRest('games?select=universe_id&active=eq.true&limit=1', {
        requireAdminKey: true,
        headers: { Prefer: 'count=exact' },
      }),
      supabaseRest(
        `games?select=universe_id&active=eq.true&last_collected_at=gte.${encodeURIComponent(
          freshCutoffIso
        )}&limit=1`,
        {
          requireAdminKey: true,
          headers: { Prefer: 'count=exact' },
        }
      ),
      supabaseRest('game_snapshots?select=id&limit=1', {
        requireAdminKey: true,
        headers: { Prefer: 'count=exact' },
      }),
      supabaseRest('game_hourly_stats?select=universe_id&limit=1', {
        requireAdminKey: true,
        headers: { Prefer: 'count=exact' },
      }),
      supabaseRest('game_daily_stats?select=universe_id&limit=1', {
        requireAdminKey: true,
        headers: { Prefer: 'count=exact' },
      }),
      supabaseRest(gamesQuery, { requireAdminKey: true }),
    ]);

    const jobRows: SupabaseJobRow[] = jobsRes.ok
      ? ((await jobsRes.json()) as SupabaseJobRow[])
      : [];

    const gameRows: SupabaseGameRow[] = liveGamesRes.ok
      ? ((await liveGamesRes.json()) as SupabaseGameRow[])
      : [];

    const totalActiveGames = parseExactCount(activeGamesCountRes, gameRows.length);
    const freshGames35m = parseExactCount(freshGamesCountRes, 0);
    const snapshotCount = parseExactCount(snapsRes, 0);
    const hourlyRowCount = parseExactCount(hourlyRes, 0);
    const dailyRowCount = parseExactCount(dailyRes, 0);

    const warmUrl = (
      process.env.WARM_HISTORY_WORKER_URL ||
      process.env.R2_HISTORY_WORKER_URL ||
      ''
    ).trim();
    const warmD1Configured = Boolean(
      warmUrl && warmUrl.startsWith('https://') && !warmUrl.includes('YOUR_')
    );

    return NextResponse.json(
      {
        configured: true,
        jobs: jobRows.map(mapSupabaseJobRow),
        games: gameRows.map(mapSupabaseRowToGame),
        totalActiveGames,
        freshGames35m,
        snapshotCount,
        hourlyRowCount,
        dailyRowCount,
        warmD1Configured,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error in GET /api/supabase/admin:', error);
    return NextResponse.json(
      { configured: true, error: 'Unable to load Supabase admin telemetry.' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseWriteConfigured()) {
    return NextResponse.json(
      { configured: false },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const admin = await verifyAdminBearerToken(req.headers.get('authorization'));
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized: verified owner admin token required.' },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'collect') {
      const rawTier = body.tier;
      const tier =
        rawTier === 'all' ||
        rawTier === 'tier_1' ||
        rawTier === 'tier_2' ||
        rawTier === 'tier_3' ||
        rawTier === 'manual'
          ? rawTier
          : 'all';
      const result = await runSupabaseCollectionCycle({
        tier,
        triggeredBy: admin.email,
        includeLiveDiscovery: Boolean(body.includeLiveDiscovery),
      });
      return NextResponse.json({ configured: true, ...result }, { status: 200 });
    }

    if (action === 'add_game') {
      const payload = body.payload as LiveRobloxGamePayload | undefined;
      const tier = isValidTrackingTier(body.tier) ? body.tier : 'tier_1';
      const capturedAt =
        typeof body.capturedAt === 'string'
          ? body.capturedAt.slice(0, 40)
          : new Date().toISOString();

      if (!payload || !isValidNumericId(String(payload.universeId || ''))) {
        return NextResponse.json(
          { error: 'Valid Roblox experience payload is required.' },
          { status: 400 }
        );
      }

      const saved = await saveGameToSupabase(payload, tier, capturedAt);
      return NextResponse.json({ configured: true, game: saved }, { status: 200 });
    }

    if (action === 'update_game') {
      const universeId = String(body.universeId || '').trim();
      if (!isValidNumericId(universeId)) {
        return NextResponse.json({ error: 'Invalid universeId.' }, { status: 400 });
      }
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (isValidTrackingTier(body.trackingTier)) {
        patch.tracking_tier = body.trackingTier;
      }
      if (typeof body.active === 'boolean') {
        patch.active = body.active;
      }

      const res = await supabaseRest(
        `games?universe_id=eq.${encodeURIComponent(universeId)}`,
        {
          method: 'PATCH',
          requireAdminKey: true,
          body: patch,
        }
      );
      if (!res.ok) {
        throw new Error(`Supabase update failed (HTTP ${res.status})`);
      }
      invalidateSupabaseReadCaches();
      return NextResponse.json({ configured: true, ok: true }, { status: 200 });
    }

    if (action === 'delete_game') {
      const universeId = String(body.universeId || '').trim();
      if (!isValidNumericId(universeId)) {
        return NextResponse.json({ error: 'Invalid universeId.' }, { status: 400 });
      }
      const res = await supabaseRest(
        `games?universe_id=eq.${encodeURIComponent(universeId)}`,
        {
          method: 'DELETE',
          requireAdminKey: true,
        }
      );
      if (!res.ok) {
        throw new Error(`Supabase delete failed (HTTP ${res.status})`);
      }
      invalidateSupabaseReadCaches();
      return NextResponse.json({ configured: true, ok: true }, { status: 200 });
    }

    if (action === 'prune') {
      // First run the safe Postgres rollup+retention RPC so hourly & daily stats are preserved
      const rpcRes = await supabaseRest('rpc/run_rometric_retention_rollup', {
        method: 'POST',
        requireAdminKey: true,
        body: {},
      }).catch(() => null);

      const rawHours = Number(body.retentionRawHours);
      const retentionHours = Number.isFinite(rawHours)
        ? Math.max(1, Math.min(720, Math.floor(rawHours)))
        : 12;
      const cutoffIso = new Date(
        Date.now() - retentionHours * 60 * 60 * 1000
      ).toISOString();

      const res = await supabaseRest(
        `game_snapshots?captured_at=lt.${encodeURIComponent(cutoffIso)}`,
        {
          method: 'DELETE',
          requireAdminKey: true,
          headers: { Prefer: 'return=representation' },
        }
      );
      if (!res.ok) {
        throw new Error(`Supabase prune failed (HTTP ${res.status})`);
      }
      const deleted = (await res.json()) as unknown[];
      invalidateSupabaseReadCaches();
      return NextResponse.json(
        {
          configured: true,
          rolledUp: Boolean(rpcRes?.ok),
          removed: Array.isArray(deleted) ? deleted.length : 0,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Unknown admin action.' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/supabase/admin:', error);
    return NextResponse.json(
      {
        configured: true,
        error:
          error instanceof Error ? error.message : 'Supabase admin action failed.',
      },
      { status: 500 }
    );
  }
}
