import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  adminAddGameCode,
  adminDeleteGameCode,
  fetchCodesAdminOverview,
  moderateGameCode,
  runCodesCollectionCycle,
  toggleCodeSource,
} from '@/lib/codes-server';
import type { CodeStatus } from '@/lib/codes-types';
import { verifyAdminBearerToken } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function revalidateCodesPaths(gameSlug?: string | null, universeId?: string | null) {
  try {
    revalidatePath('/codes');
    if (gameSlug) {
      revalidatePath(`/codes/${encodeURIComponent(gameSlug)}`);
      revalidatePath(`/codes/${gameSlug}`);
    }
    if (universeId) {
      revalidatePath(`/codes/${universeId}`);
    }
  } catch {
    // Ignore revalidation errors in non-ISR contexts
  }
}

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

    if (action === 'admin_add_code') {
      const gameInput =
        typeof body.gameInput === 'string' ? body.gameInput.trim() : '';
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const rewardDescription =
        typeof body.rewardDescription === 'string'
          ? body.rewardDescription.trim()
          : null;
      const sourceUrl =
        typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : null;
      const note = typeof body.note === 'string' ? body.note.trim() : null;
      const rawStatus = typeof body.status === 'string' ? body.status : 'active';
      const validStatuses = new Set<CodeStatus>([
        'active',
        'pending_verification',
        'expired',
        'unverified',
      ]);
      const status: CodeStatus = validStatuses.has(rawStatus as CodeStatus)
        ? (rawStatus as CodeStatus)
        : 'active';

      const result = await adminAddGameCode({
        gameInput,
        code,
        rewardDescription,
        status,
        sourceUrl,
        note,
        actor: admin.email,
      });

      if (result.ok) {
        revalidateCodesPaths(result.gameSlug, result.universeId);
      }

      return NextResponse.json(result, {
        status: result.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (action === 'admin_delete_code') {
      const codeId =
        typeof body.codeId === 'number' && Number.isInteger(body.codeId)
          ? body.codeId
          : null;
      const universeId =
        typeof body.universeId === 'string' &&
        /^[0-9]{1,20}$/.test(body.universeId.trim())
          ? body.universeId.trim()
          : null;
      const code =
        typeof body.code === 'string' ? body.code.trim().slice(0, 60) : null;
      const reason =
        typeof body.reason === 'string' ? body.reason.slice(0, 200) : undefined;

      if (!codeId && (!universeId || !code)) {
        return NextResponse.json(
          { error: 'Missing codeId or universeId + code.' },
          { status: 400 }
        );
      }

      const result = await adminDeleteGameCode({
        codeId,
        universeId,
        code,
        reason,
        actor: admin.email,
      });

      if (result.ok) {
        revalidateCodesPaths(result.gameSlug, result.universeId);
      }

      return NextResponse.json(result, {
        status: result.ok ? 200 : 400,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

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
      revalidateCodesPaths(null, universeId);
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
      const universeId =
        typeof body.universeId === 'string' &&
        /^[0-9]{1,20}$/.test(body.universeId.trim())
          ? body.universeId.trim()
          : null;
      const code =
        typeof body.code === 'string' ? body.code.trim().slice(0, 60) : null;
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
        universeId,
        code,
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

      if (result.ok) {
        revalidateCodesPaths(result.gameSlug, result.universeId);
      }

      return NextResponse.json(result, {
        status: result.ok ? 200 : 400,
        headers: { 'Cache-Control': 'no-store' },
      });
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
