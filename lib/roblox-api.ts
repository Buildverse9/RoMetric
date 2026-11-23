import type {
  LiveRobloxGamePayload,
  RobloxFetchResponse,
  TrackingTier,
} from './types';
import { computeLikeRatio } from './format';
import { SEED_UNIVERSES } from './seed-universes';

const ALLOWED_HOSTS = new Set([
  'games.roblox.com',
  'thumbnails.roblox.com',
  'apis.roblox.com',
]);

const MAX_BATCH_SIZE = 50; // Roblox enforced batch cap for v1/games & votes
const CACHE_TTL_MS = 60_000; // 60s server memory cache to reduce redundant Roblox calls
const MEDIA_CACHE_TTL_MS = 15 * 60_000; // 15m cache for icon & thumbnail URLs
const DISCOVERY_CACHE_TTL_MS = 5 * 60_000; // 5m cache for live Explore chart discovery

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface DiscoveredUniverseEntry {
  universeId: string;
  tier: TrackingTier;
  chartSource: string;
  previewCcu: number;
}

const fetchCache = new Map<string, CacheEntry<RobloxFetchResponse>>();
const mediaCache = new Map<
  string,
  CacheEntry<{ iconUrl: string | null; thumbnailUrl: string | null }>
>();
let discoveryCache: CacheEntry<DiscoveredUniverseEntry[]> | null = null;

interface FetchStats {
  apiRequests: number;
  http429Count: number;
  errors: string[];
}

function assertAllowedUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Blocked outbound host: ${parsed.hostname}`);
  }
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRobloxJson<T>(
  rawUrl: string,
  stats: FetchStats,
  maxAttempts = 3
): Promise<T | null> {
  const safeUrl = assertAllowedUrl(rawUrl);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    stats.apiRequests += 1;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);

      const res = await fetch(safeUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RoMetricAnalytics/1.0 (+https://rometrics.vercel.app)',
        },
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        stats.http429Count += 1;
        const retryAfterHeader = res.headers.get('retry-after');
        const resetHeader = res.headers.get('x-ratelimit-reset');
        const waitSec = Number(retryAfterHeader || resetHeader || 0);
        const backoffMs =
          waitSec > 0 && waitSec <= 10
            ? waitSec * 1000
            : Math.min(4000, 600 * Math.pow(2, attempt - 1) + Math.random() * 250);

        if (attempt < maxAttempts) {
          await sleep(backoffMs);
          continue;
        }
        stats.errors.push(`HTTP 429 rate-limited on ${safeUrl.pathname}`);
        return null;
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt < maxAttempts) {
          await sleep(500 * attempt);
          continue;
        }
        stats.errors.push(`HTTP ${res.status} on ${safeUrl.pathname}`);
        return null;
      }

      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining !== null && Number(remaining) <= 2) {
        await sleep(350);
      }

      return (await res.json()) as T;
    } catch (err) {
      if (attempt < maxAttempts) {
        await sleep(500 * attempt);
        continue;
      }
      stats.errors.push(
        `Network error on ${safeUrl.pathname}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      return null;
    }
  }
  return null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface RobloxGameApiItem {
  id: number;
  rootPlaceId: number;
  name: string;
  description?: string | null;
  creator?: {
    id: number;
    name: string;
    type: string;
    hasVerifiedBadge?: boolean;
  };
  playing?: number;
  visits?: number;
  favoritedCount?: number;
  genre?: string;
  genre_l1?: string;
  updated?: string;
}

interface RobloxVotesApiItem {
  id: number;
  upVotes: number;
  downVotes: number;
}

interface RobloxIconApiItem {
  targetId: number;
  state: string;
  imageUrl?: string;
}

interface RobloxMultiThumbApiItem {
  universeId: number;
  thumbnails?: Array<{
    state: string;
    imageUrl?: string;
  }>;
}

interface RobloxExploreSortGame {
  universeId?: number;
  name?: string;
  playerCount?: number;
}

interface RobloxExploreSortsResponse {
  sorts?: Array<{
    sortId?: string;
    games?: RobloxExploreSortGame[];
  }>;
}

interface RobloxOmniSearchResponse {
  searchResults?: Array<{
    contents?: Array<{
      universeId?: number;
      rootPlaceId?: number;
      name?: string;
      playerCount?: number;
    }>;
  }>;
}

interface RobloxExploreSortContentResponse {
  games?: RobloxExploreSortGame[];
  nextPageToken?: string | null;
}

export function sanitizeUniverseIds(ids: string[], maxCount = 1000): string[] {
  const unique = new Set<string>();
  for (const raw of ids) {
    const trimmed = String(raw).trim();
    if (/^[0-9]{1,20}$/.test(trimmed)) {
      unique.add(trimmed);
    }
    if (unique.size >= maxCount) break;
  }
  return Array.from(unique);
}

/**
 * Discovers live Roblox experiences directly from Roblox's official Explore API:
 * 1) Fetches all Explore sorts (`get-sorts`) and harvests every chart returned.
 * 2) Paginates key sorts (`get-sort-content` with `pageToken`) to uncover 500+
 *    active experiences across Top Playing Now, Trending, Up-and-Coming, Top Earning,
 *    Top Rated, Most Popular, and genre charts.
 * 3) Merges curated classics so evergreen hits are always tracked.
 */
export async function discoverLiveRobloxCharts(
  maxGames = 500,
  bypassCache = false
): Promise<DiscoveredUniverseEntry[]> {
  if (
    !bypassCache &&
    discoveryCache &&
    discoveryCache.expiresAt > Date.now() &&
    discoveryCache.value.length >= maxGames
  ) {
    return discoveryCache.value.slice(0, maxGames);
  }

  const stats: FetchStats = { apiRequests: 0, http429Count: 0, errors: [] };
  const sessionId = `rometric-${Date.now()}`;
  const sortsRes = await fetchRobloxJson<RobloxExploreSortsResponse>(
    `https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${sessionId}`,
    stats,
    2
  );

  const byUniverse = new Map<
    string,
    { previewCcu: number; chartSource: string }
  >();

  const recordItems = (items: RobloxExploreSortGame[] | undefined, source: string) => {
    if (!items) return;
    for (const item of items) {
      if (!item?.universeId) continue;
      const id = String(item.universeId);
      if (!/^[0-9]{1,20}$/.test(id)) continue;
      const ccu = Math.max(0, Number(item.playerCount ?? 0));
      const existing = byUniverse.get(id);
      if (!existing || ccu > existing.previewCcu) {
        byUniverse.set(id, {
          previewCcu: ccu,
          chartSource: source,
        });
      }
    }
  };

  const discoveredSortIds: string[] = [];
  if (sortsRes?.sorts) {
    for (const sort of sortsRes.sorts) {
      const sortId = sort.sortId || 'explore';
      if (sort.sortId) discoveredSortIds.push(sort.sortId);
      recordItems(sort.games, sortId);
    }
  }

  // Deep-paginate top charts via get-sort-content to scale beyond 85 games to 500+
  const prioritySorts = [
    'top-playing-now',
    'top-trending',
    'up-and-coming',
    'top-earning',
    'most-popular',
    'top-rated',
    'top-revisited',
    'fun-with-friends',
    ...discoveredSortIds,
  ];
  const uniqueSorts = Array.from(new Set(prioritySorts)).slice(0, 12);

  for (const sortId of uniqueSorts) {
    if (byUniverse.size >= maxGames + 120) break;
    let pageToken: string | null = null;
    for (let page = 0; page < 3; page++) {
      const tokenParam: string = pageToken
        ? `&pageToken=${encodeURIComponent(pageToken)}`
        : '';
      const content: RobloxExploreSortContentResponse | null =
        await fetchRobloxJson<RobloxExploreSortContentResponse>(
          `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=${sessionId}&sortId=${encodeURIComponent(sortId)}${tokenParam}`,
          stats,
          2
        );
      if (!content?.games || content.games.length === 0) break;
      recordItems(content.games, sortId);
      pageToken = content.nextPageToken || null;
      if (!pageToken || byUniverse.size >= maxGames + 120) break;
    }
  }

  // Merge curated fallback classics so major evergreen games are always covered
  for (const seed of SEED_UNIVERSES) {
    if (!byUniverse.has(seed.universeId)) {
      byUniverse.set(seed.universeId, {
        previewCcu: 0,
        chartSource: 'curated_classic',
      });
    }
  }

  const ranked = Array.from(byUniverse.entries())
    .sort((a, b) => b[1].previewCcu - a[1].previewCcu)
    .slice(0, Math.max(maxGames, 600))
    .map(([universeId, meta], idx): DiscoveredUniverseEntry => ({
      universeId,
      tier: idx < 50 ? 'tier_1' : idx < 200 ? 'tier_2' : 'tier_3',
      chartSource: meta.chartSource,
      previewCcu: meta.previewCcu,
    }));

  if (ranked.length > 0) {
    discoveryCache = {
      value: ranked,
      expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
    };
  }

  return ranked.slice(0, maxGames);
}

export async function fetchLiveRobloxGames(
  rawIds: string[],
  bypassCache = false
): Promise<RobloxFetchResponse> {
  const universeIds = sanitizeUniverseIds(rawIds, 600);
  const capturedAt = new Date().toISOString();

  if (universeIds.length === 0) {
    return {
      capturedAt,
      dataSource: 'games.roblox.com/v1/games',
      games: [],
      telemetry: {
        requestedCount: 0,
        returnedCount: 0,
        apiRequests: 0,
        http429Count: 0,
        errors: [],
        cached: false,
      },
    };
  }

  const cacheKey = [...universeIds].sort().join(',');
  if (!bypassCache) {
    const cached = fetchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.value,
        telemetry: {
          ...cached.value.telemetry,
          cached: true,
        },
      };
    }
  }

  const stats: FetchStats = {
    apiRequests: 0,
    http429Count: 0,
    errors: [],
  };

  const chunks = chunkArray(universeIds, MAX_BATCH_SIZE);
  const gamesMap = new Map<string, RobloxGameApiItem>();
  const votesMap = new Map<string, { upVotes: number; downVotes: number }>();
  const iconsMap = new Map<string, string>();
  const thumbsMap = new Map<string, string>();

  const now = Date.now();

  for (const batch of chunks) {
    const joined = batch.join(',');

    const mediaMissing = batch.filter((id) => {
      const m = mediaCache.get(id);
      if (m && m.expiresAt > now) {
        if (m.value.iconUrl) iconsMap.set(id, m.value.iconUrl);
        if (m.value.thumbnailUrl) thumbsMap.set(id, m.value.thumbnailUrl);
        return false;
      }
      return true;
    });

    const [gamesRes, votesRes, iconsRes, thumbsRes] = await Promise.all([
      fetchRobloxJson<{ data?: RobloxGameApiItem[] }>(
        `https://games.roblox.com/v1/games?universeIds=${joined}`,
        stats
      ),
      fetchRobloxJson<{ data?: RobloxVotesApiItem[] }>(
        `https://games.roblox.com/v1/games/votes?universeIds=${joined}`,
        stats
      ),
      mediaMissing.length > 0
        ? fetchRobloxJson<{ data?: RobloxIconApiItem[] }>(
            `https://thumbnails.roblox.com/v1/games/icons?universeIds=${mediaMissing.join(',')}&returnPolicy=PlaceHolder&size=256x256&format=Png&isCircular=false`,
            stats
          )
        : Promise.resolve(null),
      mediaMissing.length > 0
        ? fetchRobloxJson<{ data?: RobloxMultiThumbApiItem[] }>(
            `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${mediaMissing.join(',')}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`,
            stats
          )
        : Promise.resolve(null),
    ]);

    if (gamesRes?.data) {
      for (const item of gamesRes.data) {
        if (item?.id) {
          gamesMap.set(String(item.id), item);
        }
      }
    }

    if (votesRes?.data) {
      for (const v of votesRes.data) {
        if (v?.id !== undefined) {
          votesMap.set(String(v.id), {
            upVotes: Math.max(0, Number(v.upVotes ?? 0)),
            downVotes: Math.max(0, Number(v.downVotes ?? 0)),
          });
        }
      }
    }

    if (iconsRes?.data) {
      for (const icon of iconsRes.data) {
        if (icon?.targetId && icon.imageUrl && icon.imageUrl.startsWith('https://')) {
          iconsMap.set(String(icon.targetId), icon.imageUrl);
        }
      }
    }

    if (thumbsRes?.data) {
      for (const entry of thumbsRes.data) {
        const firstThumb = entry.thumbnails?.find(
          (t) => t.imageUrl && t.imageUrl.startsWith('https://')
        );
        if (entry?.universeId && firstThumb?.imageUrl) {
          thumbsMap.set(String(entry.universeId), firstThumb.imageUrl);
        }
      }
    }

    for (const id of mediaMissing) {
      mediaCache.set(id, {
        value: {
          iconUrl: iconsMap.get(id) ?? null,
          thumbnailUrl: thumbsMap.get(id) ?? null,
        },
        expiresAt: Date.now() + MEDIA_CACHE_TTL_MS,
      });
    }

    if (chunks.length > 1) {
      await sleep(150);
    }
  }

  const normalized: LiveRobloxGamePayload[] = [];

  for (const id of universeIds) {
    const raw = gamesMap.get(id);
    if (!raw) continue;

    const votes = votesMap.get(id);
    const upVotes = votes ? votes.upVotes : null;
    const downVotes = votes ? votes.downVotes : null;
    const genreLabel = (raw.genre_l1 || raw.genre || 'All Genres').trim() || 'All Genres';
    const rawRootPlace = raw.rootPlaceId ? String(raw.rootPlaceId) : String(raw.id);
    const safeRootPlaceId = /^[0-9]{1,32}$/.test(rawRootPlace)
      ? rawRootPlace
      : String(raw.id);
    const safeName = (raw.name || `Experience ${raw.id}`).trim().slice(0, 200) || `Experience ${raw.id}`;
    const safeCreatorName =
      (raw.creator?.name || 'Unknown Creator').trim().slice(0, 120) || 'Unknown Creator';
    const safeCreatorId = String(raw.creator?.id ?? '0').trim().slice(0, 32) || '0';

    normalized.push({
      universeId: String(raw.id),
      rootPlaceId: safeRootPlaceId,
      name: safeName,
      description: (raw.description || '').slice(0, 1800),
      creatorId: safeCreatorId,
      creatorName: safeCreatorName,
      creatorType: raw.creator?.type === 'Group' ? 'Group' : 'User',
      creatorVerified: Boolean(raw.creator?.hasVerifiedBadge),
      genre: genreLabel.slice(0, 80),
      currentCcu: Math.max(0, Number(raw.playing ?? 0) || 0),
      totalVisits: Math.max(0, Number(raw.visits ?? 0) || 0),
      favorites: Math.max(0, Number(raw.favoritedCount ?? 0) || 0),
      upVotes,
      downVotes,
      likeRatio: computeLikeRatio(upVotes, downVotes),
      iconUrl: iconsMap.get(id) ?? null,
      thumbnailUrl: thumbsMap.get(id) ?? null,
      robloxUpdatedAt: raw.updated ? String(raw.updated).slice(0, 40) : null,
    });
  }

  const response: RobloxFetchResponse = {
    capturedAt,
    dataSource: 'games.roblox.com/v1/games',
    games: normalized,
    telemetry: {
      requestedCount: universeIds.length,
      returnedCount: normalized.length,
      apiRequests: stats.apiRequests,
      http429Count: stats.http429Count,
      errors: stats.errors,
      cached: false,
    },
  };

  if (normalized.length > 0) {
    fetchCache.set(cacheKey, {
      value: response,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return response;
}

/**
 * Resolves a Roblox URL (roblox.com/games/{placeId}/...), Place ID, Universe ID,
 * or experience name (via official Roblox omni-search) into a verified LiveRobloxGamePayload.
 */
export async function resolveRobloxExperience(input: string): Promise<{
  game: LiveRobloxGamePayload | null;
  resolvedFrom: 'universe_id' | 'place_id' | 'search' | null;
  error: string | null;
}> {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 300) {
    return {
      game: null,
      resolvedFrom: null,
      error: 'Please enter a valid Roblox game name, Universe ID, Place ID, or URL.',
    };
  }

  let candidateId: string | null = null;
  let forcePlaceLookup = false;

  const urlMatch = trimmed.match(/roblox\.com\/games\/([0-9]{1,20})/i);
  if (urlMatch) {
    candidateId = urlMatch[1];
    forcePlaceLookup = true;
  } else if (/^[0-9]{1,20}$/.test(trimmed)) {
    candidateId = trimmed;
  }

  const stats: FetchStats = { apiRequests: 0, http429Count: 0, errors: [] };

  // Path A: Direct ID or URL lookup
  if (candidateId) {
    if (!forcePlaceLookup) {
      const direct = await fetchLiveRobloxGames([candidateId], true);
      if (direct.games.length > 0) {
        return { game: direct.games[0], resolvedFrom: 'universe_id', error: null };
      }
    }

    const placeLookup = await fetchRobloxJson<{ universeId?: number | null }>(
      `https://apis.roblox.com/universes/v1/places/${candidateId}/universe`,
      stats
    );

    if (placeLookup?.universeId) {
      const fetched = await fetchLiveRobloxGames([String(placeLookup.universeId)], true);
      if (fetched.games.length > 0) {
        return { game: fetched.games[0], resolvedFrom: 'place_id', error: null };
      }
    }

    return {
      game: null,
      resolvedFrom: null,
      error:
        stats.errors[0] ||
        `No public Roblox experience found for ID ${candidateId}. Verify the ID is public and active.`,
    };
  }

  // Path B: Official Roblox name search (e.g., "Steal An Egg")
  const searchRes = await fetchRobloxJson<RobloxOmniSearchResponse>(
    `https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(trimmed)}&sessionId=rometric-search-${Date.now()}&pageType=all`,
    stats,
    2
  );

  const candidates =
    searchRes?.searchResults?.flatMap((r) => r.contents ?? []).filter((c) => c?.universeId) ??
    [];

  if (candidates.length > 0) {
    const lowerQuery = trimmed.toLowerCase();
    // Prefer exact/strong title match with highest player count
    const sorted = [...candidates].sort((a, b) => {
      const aExact = (a.name || '').toLowerCase() === lowerQuery ? 1 : 0;
      const bExact = (b.name || '').toLowerCase() === lowerQuery ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return Number(b.playerCount ?? 0) - Number(a.playerCount ?? 0);
    });
    const bestUniverseId = String(sorted[0].universeId);
    const fetched = await fetchLiveRobloxGames([bestUniverseId], true);
    if (fetched.games.length > 0) {
      return { game: fetched.games[0], resolvedFrom: 'search', error: null };
    }
  }

  return {
    game: null,
    resolvedFrom: null,
    error:
      stats.errors[0] ||
      `No public Roblox experience matched "${trimmed}". Try the exact name, Place ID, or roblox.com/games URL.`,
  };
}
