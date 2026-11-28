import { NextRequest, NextResponse } from 'next/server';
import type { CuratedAssetHubType } from '@/lib/asset-ids-data';
import { fetchCuratedAssetIds } from '@/lib/asset-ids-server';

const VALID_CURATED_HUBS = new Set<CuratedAssetHubType>([
  'crosshairs',
  'decals',
  'music',
]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawHub = (sp.get('hubType') || '').trim().toLowerCase();
  const subCategory = (sp.get('subCategory') || '').trim();
  const query = (sp.get('q') || '').trim();

  const hubType = VALID_CURATED_HUBS.has(rawHub as CuratedAssetHubType)
    ? (rawHub as CuratedAssetHubType)
    : undefined;

  const items = await fetchCuratedAssetIds({
    hubType,
    subCategory: subCategory || undefined,
    query: query || undefined,
  });

  return NextResponse.json(
    {
      items,
      total: items.length,
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      },
    }
  );
}
