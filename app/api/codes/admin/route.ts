import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCodesAdminOverview,
  moderateGameCode,
  runCodesCollectionCycle,
  toggleCodeSource,
} from '@/lib/codes-server';
import { verifyAdminBearerToken } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const admin = await verifyAdminBearerToken(req.headers.get('authorization'));
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized: verified owner admin token required.' },
      { status: 401 }
    );
  }

  try {
    const overview = await fetchCodesAdminOverview();
    return NextResponse.json(overview, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error in GET /api/codes/admin:', error);
    return NextResponse.json(
      { error: 'Unable to load codes admin overview.' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    if (action === 'trigger_collection') {
      const providerId =
        typeof body.providerId === 'string' ? body.providerId : 'all';
      const universeId =
        typeof body.universeId === 'string' && /^[0-9]{1,20}$/.test(body.universeId)
          ? body.universeId
          : null;
      const maxGames =
        typeof body.maxGames === 'number'
          ? Math.min(Math.max(body.maxGames, 1), 30)
          : 8;

      const result = await runCodesCollectionCycle({
        providerId,
        universeId,
        maxGames,
        triggeredBy: admin.email,
      });
      return NextResponse.json(result, { status: 200 });
    }

    if (action === 'toggle_source') {
      const sourceId = typeof body.sourceId === 'string' ? body.sourceId : '';
      const enabled = Boolean(body.enabled);
      if (!sourceId) {
        return NextResponse.json(
          { error: 'Missing sourceId.' },
          { status: 400 }
        );
      }
      const result = await toggleCodeSource(sourceId, enabled);
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    }

    if (action === 'moderate_code') {
      const codeId = Number(body.codeId);
      const modAction = typeof body.modAction === 'string' ? body.modAction : '';
      if (!Number.isInteger(codeId) || codeId <= 0) {
        return NextResponse.json({ error: 'Invalid codeId.' }, { status: 400 });
      }
      const validActions = new Set([
        'approve_active',
        'mark_expired',
        'mark_unverified',
        'mark_pending',
        'update_reward',
        'delete_code',
      ]);
      if (!validActions.has(modAction)) {
        return NextResponse.json(
          { error: 'Invalid moderation action.' },
          { status: 400 }
        );
      }

      const result = await moderateGameCode({
        codeId,
        action: modAction as
          | 'approve_active'
          | 'mark_expired'
          | 'mark_unverified'
          | 'mark_pending'
          | 'update_reward'
          | 'delete_code',
        rewardDescription:
          typeof body.rewardDescription === 'string'
            ? body.rewardDescription
            : null,
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 200) : undefined,
        actor: admin.email,
      });

      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json(
      { error: 'Unsupported codes admin action.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/codes/admin:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Codes admin operation failed.',
      },
      { status: 500 }
    );
  }
}
