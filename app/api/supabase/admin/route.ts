import { NextRequest, NextResponse } from 'next/server';
import {
  isSupabaseWriteConfigured,
  isValidNumericId,
  isValidTrackingTier,
  mapSupabaseJobRow,
  runSupabaseCollectionCycle,
  saveGameToSupabase,
  supabaseRest,
  verifyAdminBearerToken,
  type SupabaseJobRow,
} from '@/lib/supabase-server';
import type { LiveRobloxGamePayload } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isSupabaseWriteConfigured()) {
    return NextResponse.json(
      { configured: false, jobs: [], snapshotCount: 0 },
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
    const [jobsRes, snapsRes] = await Promise.all([
      supabaseRest('collection_jobs?select=*&order=started_at.desc&limit=25', {
        requireAdminKey: true,
      }),
      supabaseRest('game_snapshots?select=id&limit=1', {
        requireAdminKey: true,
        headers: { Prefer: 'count=exact' },
      }),
    ]);

    const jobRows: SupabaseJobRow[] = jobsRes.ok
      ? ((await jobsRes.json()) as SupabaseJobRow[])
      : [];

    let snapshotCount = 0;
    if (snapsRes.ok) {
      const contentRange = snapsRes.headers.get('content-range');
      const totalMatch = contentRange?.match(/\/(\d+)$/);
      if (totalMatch) {
        snapshotCount = Number(totalMatch[1]);
      } else {
        const snapRows = (await snapsRes.json()) as Array<{ id: number }>;
        snapshotCount = snapRows.length;
      }
    }

    return NextResponse.json(
      {
        configured: true,
        jobs: jobRows.map(mapSupabaseJobRow),
        snapshotCount,
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
      return NextResponse.json({ configured: true, ok: true }, { status: 200 });
    }

    if (action === 'prune') {
      const rawHours = Number(body.retentionRawHours);
      const retentionHours = Number.isFinite(rawHours)
        ? Math.max(1, Math.min(720, Math.floor(rawHours)))
        : 48;
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
      return NextResponse.json(
        { configured: true, removed: Array.isArray(deleted) ? deleted.length : 0 },
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
