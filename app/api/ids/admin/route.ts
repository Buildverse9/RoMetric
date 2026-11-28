import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type {
  CuratedAssetHubType,
  CuratedAssetIdRecord,
} from '@/lib/asset-ids-data';
import {
  adminAddCuratedAssetId,
  adminDeleteCuratedAssetId,
  fetchCuratedAssetIds,
} from '@/lib/asset-ids-server';
import { verifyAdminBearerToken } from '@/lib/supabase-server';

const VALID_CURATED_HUBS = new Set<CuratedAssetHubType>([
  'crosshairs',
  'decals',
  'music',
]);

const VALID_CROSSHAIR_STYLES = new Set<
  NonNullable<CuratedAssetIdRecord['crosshairStyle']>
>(['dot', 'plus', 'circle-dot', 't-cross', 'diamond', 'box']);

export async function GET(req: NextRequest) {
  const auth = await verifyAdminBearerToken(req.headers.get('authorization'));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const items = await fetchCuratedAssetIds();
  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminBearerToken(req.headers.get('authorization'));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const action = String(body.action || '').trim();
  const rawHub = String(body.hubType || '').trim().toLowerCase();
  if (!VALID_CURATED_HUBS.has(rawHub as CuratedAssetHubType)) {
    return NextResponse.json(
      { error: 'hubType must be crosshairs, decals, or music.' },
      { status: 400 }
    );
  }
  const hubType = rawHub as CuratedAssetHubType;

  if (action === 'add_asset_id') {
    const rawTags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t))
      : typeof body.tags === 'string'
        ? body.tags.split(',')
        : [];
    const rawStyle = String(body.crosshairStyle || '').trim();
    const crosshairStyle =
      hubType === 'crosshairs' &&
      VALID_CROSSHAIR_STYLES.has(
        rawStyle as NonNullable<CuratedAssetIdRecord['crosshairStyle']>
      )
        ? (rawStyle as CuratedAssetIdRecord['crosshairStyle'])
        : hubType === 'crosshairs'
          ? 'dot'
          : undefined;
    const rawColor = String(body.crosshairColor || '').trim();
    const crosshairColor =
      hubType === 'crosshairs' && /^#[0-9a-fA-F]{3,8}$/.test(rawColor)
        ? rawColor
        : hubType === 'crosshairs'
          ? '#10e89a'
          : undefined;

    const result = await adminAddCuratedAssetId({
      assetId: String(body.assetId || ''),
      title: String(body.title || ''),
      hubType,
      subCategory: String(body.subCategory || 'General'),
      creatorOrArtist: String(body.creatorOrArtist || 'RoMetric Admin'),
      tags: rawTags,
      crosshairStyle,
      crosshairColor,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Unable to add Asset ID.' },
        { status: 400 }
      );
    }

    revalidatePath('/ids');
    revalidatePath(`/ids/${hubType}`);

    return NextResponse.json({
      ok: true,
      item: result.item,
      message: `Published Asset ID ${result.item?.assetId} to ${hubType}.`,
    });
  }

  if (action === 'delete_asset_id') {
    const result = await adminDeleteCuratedAssetId({
      id: body.id ? String(body.id) : undefined,
      hubType,
      assetId: String(body.assetId || ''),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Unable to delete Asset ID.' },
        { status: 400 }
      );
    }

    revalidatePath('/ids');
    revalidatePath(`/ids/${hubType}`);

    return NextResponse.json({
      ok: true,
      message: `Removed Asset ID ${String(body.assetId || '')} from ${hubType}.`,
    });
  }

  return NextResponse.json(
    { error: 'Unsupported action. Use add_asset_id or delete_asset_id.' },
    { status: 400 }
  );
}
