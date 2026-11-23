import { NextResponse } from 'next/server';
import { fetchLiveRobloxGames } from '@/lib/roblox-api';

export const dynamic = 'force-dynamic';

export interface RobloxChartGameEntry {
  rank: number;
  universeId: string;
  rootPlaceId: string;
  name: string;
  creatorName: string;
  currentCcu: number;
  likeRatio: number | null;
  iconUrl: string | null;
}

export interface RobloxOfficialChartColumn {
  id: 'top-trending' | 'up-and-coming' | 'top-earning' | 'fun-with-friends';
  title: string;
  robloxUrl: string;
  games: RobloxChartGameEntry[];
}

export interface RobloxOfficialChartsResponse {
  capturedAt: string;
  charts: RobloxOfficialChartColumn[];
}

interface ExploreSortGame {
  universeId?: number;
  rootPlaceId?: number;
  name?: string;
  playerCount?: number;
}

interface ExploreSortsRes {
  sorts?: Array<{
    sortId?: string;
    sortDisplayName?: string;
    games?: ExploreSortGame[];
  }>;
}

interface ExploreSortContentRes {
  games?: ExploreSortGame[];
}

const CHART_DEFINITIONS: Array<{
  id: RobloxOfficialChartColumn['id'];
  title: string;
  robloxUrl: string;
  sortAliases: string[];
}> = [
  {
    id: 'top-trending',
    title: 'Top Trending',
    robloxUrl: 'https://www.roblox.com/charts/top-trending',
    sortAliases: ['top-trending', 'Top_Trending_V4', 'Top_Trending'],
  },
  {
    id: 'up-and-coming',
    title: 'Up-and-Coming',
    robloxUrl: 'https://www.roblox.com/charts/up-and-coming',
    sortAliases: ['up-and-coming', 'Up_And_Coming_V4', 'Up_And_Coming'],
  },
  {
    id: 'top-earning',
    title: 'Top Earning',
    robloxUrl: 'https://www.roblox.com/charts/top-earning',
    sortAliases: ['top-earning', 'Top_Earning_V4', 'Top_Earning', 'top-grossing'],
  },
  {
    id: 'fun-with-friends',
    title: 'Fun with Friends',
    robloxUrl: 'https://www.roblox.com/charts/fun-with-friends',
    sortAliases: ['fun-with-friends', 'Fun_with_Friends_V4', 'Fun_With_Friends'],
  },
];

const CHARTS_CACHE_TTL_MS = 3 * 60_000;
let chartsCache: {
  value: RobloxOfficialChartsResponse;
  expiresAt: number;
} | null = null;

async function fetchJsonSafe<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9_000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RoMetricAnalytics/1.0 (+https://rometrics.vercel.app)',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  if (chartsCache && chartsCache.expiresAt > Date.now()) {
    return NextResponse.json(chartsCache.value, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      },
    });
  }

  const sessionId = `rometric-charts-${Date.now()}`;
  const rawByChart = new Map<RobloxOfficialChartColumn['id'], ExploreSortGame[]>();

  // 1) Fetch get-sorts + direct get-sort-content for all 4 official charts in parallel
  const [sortsRes, ...directContents] = await Promise.all([
    fetchJsonSafe<ExploreSortsRes>(
      `https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${sessionId}`
    ),
    ...CHART_DEFINITIONS.map((def) =>
      fetchJsonSafe<ExploreSortContentRes>(
        `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=${sessionId}&sortId=${encodeURIComponent(def.id)}`
      )
    ),
  ]);

  // Seed from direct get-sort-content responses
  CHART_DEFINITIONS.forEach((def, idx) => {
    const directGames = directContents[idx]?.games ?? [];
    if (directGames.length > 0) {
      rawByChart.set(def.id, directGames);
    }
  });

  // Match any remaining charts from get-sorts payload (handling Roblox V4 sortId names)
  if (sortsRes?.sorts) {
    for (const def of CHART_DEFINITIONS) {
      if ((rawByChart.get(def.id)?.length ?? 0) >= 5) continue;
      const lowerAliases = def.sortAliases.map((a) => a.toLowerCase());
      const lowerTitle = def.title.toLowerCase();

      const matchedSort = sortsRes.sorts.find((s) => {
        const sid = (s.sortId || '').toLowerCase();
        const sname = (s.sortDisplayName || '').toLowerCase();
        return (
          lowerAliases.includes(sid) ||
          sid.includes(def.id.replace(/-/g, '_')) ||
          sid.includes(def.id) ||
          sname.includes(lowerTitle)
        );
      });

      if (matchedSort?.games && matchedSort.games.length > 0) {
        rawByChart.set(def.id, matchedSort.games);
      } else if (matchedSort?.sortId) {
        const extra = await fetchJsonSafe<ExploreSortContentRes>(
          `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=${sessionId}&sortId=${encodeURIComponent(matchedSort.sortId)}`
        );
        if (extra?.games && extra.games.length > 0) {
          rawByChart.set(def.id, extra.games);
        }
      }
    }
  }

  // Collect all unique top 6 universe IDs across all 4 charts for a single batched enrichment call
  const uniqueIds = new Set<string>();
  for (const def of CHART_DEFINITIONS) {
    const list = (rawByChart.get(def.id) ?? []).slice(0, 6);
    for (const item of list) {
      if (item?.universeId) {
        uniqueIds.add(String(item.universeId));
      }
    }
  }

  const enrichedMap = new Map<
    string,
    {
      rootPlaceId: string;
      name: string;
      creatorName: string;
      currentCcu: number;
      likeRatio: number | null;
      iconUrl: string | null;
    }
  >();

  if (uniqueIds.size > 0) {
    try {
      const liveRes = await fetchLiveRobloxGames(Array.from(uniqueIds));
      for (const g of liveRes.games) {
        enrichedMap.set(g.universeId, {
          rootPlaceId: g.rootPlaceId,
          name: g.name,
          creatorName: g.creatorName,
          currentCcu: g.currentCcu,
          likeRatio: g.likeRatio,
          iconUrl: g.iconUrl,
        });
      }
    } catch {
      // Keep raw chart entries if batch enrichment fails
    }
  }

  const charts: RobloxOfficialChartColumn[] = CHART_DEFINITIONS.map((def) => {
    const rawList = (rawByChart.get(def.id) ?? []).slice(0, 5);
    const seen = new Set<string>();
    const games: RobloxChartGameEntry[] = [];

    for (const item of rawList) {
      if (!item?.universeId) continue;
      const uid = String(item.universeId);
      if (seen.has(uid)) continue;
      seen.add(uid);

      const enriched = enrichedMap.get(uid);
      games.push({
        rank: games.length + 1,
        universeId: uid,
        rootPlaceId: enriched?.rootPlaceId ?? String(item.rootPlaceId ?? uid),
        name: enriched?.name ?? item.name ?? `Experience ${uid}`,
        creatorName: enriched?.creatorName ?? 'Roblox Creator',
        currentCcu:
          enriched?.currentCcu ?? Math.max(0, Number(item.playerCount ?? 0)),
        likeRatio: enriched?.likeRatio ?? null,
        iconUrl: enriched?.iconUrl ?? null,
      });
    }

    return {
      id: def.id,
      title: def.title,
      robloxUrl: def.robloxUrl,
      games,
    };
  });

  const payload: RobloxOfficialChartsResponse = {
    capturedAt: new Date().toISOString(),
    charts,
  };

  if (charts.some((c) => c.games.length > 0)) {
    chartsCache = {
      value: payload,
      expiresAt: Date.now() + CHARTS_CACHE_TTL_MS,
    };
  }

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
    },
  });
}
