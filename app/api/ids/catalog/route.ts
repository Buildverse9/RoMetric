import { NextRequest, NextResponse } from 'next/server';
import type {
  LiveCatalogAssetItem,
  LiveCatalogHubType,
} from '@/lib/asset-ids-data';

export const revalidate = 900;

interface RobloxCatalogRawItem {
  id?: number;
  itemType?: string;
  name?: string;
  creatorName?: string;
  price?: number | null;
  lowestPrice?: number | null;
  favoriteCount?: number;
}

interface RobloxCatalogResponse {
  nextPageCursor?: string | null;
  data?: RobloxCatalogRawItem[];
}

interface RobloxThumbnailResponse {
  data?: Array<{
    targetId?: number;
    state?: string;
    imageUrl?: string;
  }>;
}

const VALID_CATALOG_HUBS = new Set<LiveCatalogHubType>([
  'hair',
  'faces',
  'gears',
]);

function buildCatalogQueryParams(
  category: LiveCatalogHubType,
  keyword: string,
  cursor: string,
  sort: string
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('Limit', '30');

  if (category === 'hair') {
    params.set('Category', '11');
    params.set('Subcategory', '20');
  } else if (category === 'faces') {
    params.set('Category', '4');
    params.set('Subcategory', '10');
  } else {
    params.set('Category', '5');
  }

  if (sort === 'favorites') {
    params.set('SortType', '1');
  } else if (sort === 'updated') {
    params.set('SortType', '3');
  } else if (sort === 'bestselling') {
    params.set('SortType', '2');
  } else {
    params.set('SortType', keyword ? '0' : '1');
  }

  if (keyword) {
    params.set('Keyword', keyword);
  }
  if (cursor) {
    params.set('Cursor', cursor);
  }

  return params;
}

async function fetchCatalogThumbnails(
  assetIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (assetIds.length === 0) return map;

  try {
    const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${encodeURIComponent(
      assetIds.slice(0, 50).join(',')
    )}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RoMetric/1.0 (+https://rometrics.vercel.app)',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return map;
    const json = (await res.json()) as RobloxThumbnailResponse;
    for (const row of json.data || []) {
      if (row.targetId && row.imageUrl) {
        map.set(String(row.targetId), row.imageUrl);
      }
    }
  } catch {
    // Non-fatal
  }
  return map;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawCategory = (sp.get('category') || 'hair').trim().toLowerCase();
  if (!VALID_CATALOG_HUBS.has(rawCategory as LiveCatalogHubType)) {
    return NextResponse.json(
      { error: 'Invalid catalog category. Must be hair, faces, or gears.' },
      { status: 400 }
    );
  }

  const category = rawCategory as LiveCatalogHubType;
  const keyword = (sp.get('q') || '').trim().slice(0, 60);
  const cursor = (sp.get('cursor') || '').trim().slice(0, 120);
  const sort = (sp.get('sort') || 'favorites').trim().toLowerCase();

  const params = buildCatalogQueryParams(category, keyword, cursor, sort);
  const catalogUrl = `https://catalog.roblox.com/v1/search/items/details?${params.toString()}`;

  try {
    const res = await fetch(catalogUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RoMetric/1.0 (+https://rometrics.vercel.app)',
      },
      next: { revalidate: 900 },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          category,
          items: [],
          nextPageCursor: null,
          rateLimited: res.status === 429,
          error:
            res.status === 429
              ? 'Roblox Catalog API is temporarily rate-limiting requests. Try again in a moment.'
              : `Roblox Catalog API returned status ${res.status}.`,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        }
      );
    }

    const payload = (await res.json()) as RobloxCatalogResponse;
    const rawItems = (payload.data || []).filter(
      (item) => typeof item.id === 'number' && item.id > 0 && item.name
    );

    const assetIds = rawItems.map((item) => String(item.id));
    const thumbnails = await fetchCatalogThumbnails(assetIds);

    const items: LiveCatalogAssetItem[] = rawItems.map((item) => {
      const idStr = String(item.id);
      const priceVal =
        typeof item.lowestPrice === 'number'
          ? item.lowestPrice
          : typeof item.price === 'number'
            ? item.price
            : null;
      return {
        assetId: idStr,
        name: String(item.name || 'Untitled Asset').trim(),
        creatorName: String(item.creatorName || 'Roblox').trim(),
        priceRobux: priceVal,
        favoriteCount:
          typeof item.favoriteCount === 'number' ? item.favoriteCount : 0,
        thumbnailUrl: thumbnails.get(idStr) || null,
        itemType: String(item.itemType || 'Asset'),
        hubType: category,
      };
    });

    return NextResponse.json(
      {
        category,
        items,
        nextPageCursor: payload.nextPageCursor || null,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        category,
        items: [],
        nextPageCursor: null,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to reach Roblox Catalog API.',
      },
      { status: 200 }
    );
  }
}
