import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface RobloxGamePassItem {
  id: number;
  name: string;
  displayName: string;
  price: number | null;
  isForSale: boolean;
  iconUrl: string | null;
  productId: number | null;
}

export interface RobloxDevProductItem {
  id: number;
  name: string;
  description: string;
  priceInRobux: number | null;
  iconUrl: string | null;
}

export interface RobloxBadgeItem {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  iconUrl: string | null;
  awardedCount: number;
  pastDayAwardedCount: number;
  winRatePercentage: number;
  created: string | null;
}

export interface RobloxSocialLinkItem {
  id: string;
  title: string;
  url: string;
  type:
    | 'Discord'
    | 'YouTube'
    | 'Twitter'
    | 'Instagram'
    | 'TikTok'
    | 'Twitch'
    | 'RobloxGroup'
    | 'Guilded'
    | 'Website';
  source: 'roblox_social' | 'group_social' | 'description';
}

export interface RobloxMediaItem {
  id: string;
  type: 'logo' | 'thumbnail';
  imageUrl: string;
  label: string;
}

export interface RobloxSimilarGameItem {
  universeId: string;
  rootPlaceId: string;
  name: string;
  creatorName: string;
  genre: string;
  currentCcu: number;
  totalVisits: number;
  favorites: number;
  likeRatio: number | null;
  iconUrl: string | null;
}

export interface RegionalChartRank {
  regionCode: string;
  regionLabel: string;
  rank: number | null;
  sortTitle: string | null;
}

export interface RobloxPublicGameDetailsResponse {
  universeId: string;
  meta: {
    created: string | null;
    updated: string | null;
    maxPlayers: number | null;
    price: number | null;
    copyingAllowed: boolean;
    playing: number | null;
    visits: number | null;
    favoritedCount: number | null;
  };
  gamePasses: RobloxGamePassItem[];
  devProducts: RobloxDevProductItem[];
  devProductsRestricted: boolean;
  badges: RobloxBadgeItem[];
  socialLinks: RobloxSocialLinkItem[];
  media: RobloxMediaItem[];
  similarGames: RobloxSimilarGameItem[];
  regionalRanks: RegionalChartRank[];
  fetchedAt: string;
}

const REGIONS: Array<{ code: string; label: string }> = [
  { code: 'all', label: 'Global' },
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'br', label: 'Brazil' },
  { code: 'jp', label: 'Japan' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: 'in', label: 'India' },
  { code: 'ph', label: 'Philippines' },
  { code: 'kr', label: 'South Korea' },
];

// Lightweight server-side caches
const detailsCache = new Map<
  string,
  { expiresAt: number; payload: RobloxPublicGameDetailsResponse }
>();

interface RegionChartCacheEntry {
  expiresAt: number;
  // universeId -> { rank, sortTitle }
  ranks: Map<string, { rank: number; sortTitle: string }>;
}
const regionChartsCache = new Map<string, RegionChartCacheEntry>();

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; data: T | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RoMetricAnalytics/2.0 (+https://rometrics.vercel.app)',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }
    const json = (await res.json()) as T;
    return { ok: true, status: res.status, data: json };
  } catch {
    clearTimeout(timer);
    return { ok: false, status: 0, data: null };
  }
}

function sanitizeHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : trimmed.startsWith('discord.gg/') ||
        trimmed.startsWith('x.com/') ||
        trimmed.startsWith('twitter.com/') ||
        trimmed.startsWith('youtube.com/') ||
        trimmed.startsWith('youtu.be/')
      ? `https://${trimmed}`
      : trimmed;
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    parsed.protocol = 'https:';
    return parsed.toString();
  } catch {
    return null;
  }
}

function detectSocialType(
  rawType: string | null | undefined,
  url: string
): RobloxSocialLinkItem['type'] {
  const hint = `${rawType || ''} ${url}`.toLowerCase();
  if (hint.includes('discord')) return 'Discord';
  if (hint.includes('youtube') || hint.includes('youtu.be')) return 'YouTube';
  if (hint.includes('twitter') || hint.includes('x.com')) return 'Twitter';
  if (hint.includes('instagram')) return 'Instagram';
  if (hint.includes('tiktok')) return 'TikTok';
  if (hint.includes('twitch')) return 'Twitch';
  if (hint.includes('guilded')) return 'Guilded';
  if (hint.includes('roblox.com/groups') || hint.includes('roblox.com/communities') || hint.includes('robloxgroup')) {
    return 'RobloxGroup';
  }
  return 'Website';
}

function extractSocialLinksFromDescription(description: string): RobloxSocialLinkItem[] {
  if (!description) return [];
  const found: RobloxSocialLinkItem[] = [];
  const seen = new Set<string>();
  const urlRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/[A-Za-z0-9_-]+|discord\.com\/invite\/[A-Za-z0-9_-]+|(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+|youtube\.com\/(?:@|c\/|channel\/)[A-Za-z0-9_-]+|instagram\.com\/[A-Za-z0-9_.]+|tiktok\.com\/@[A-Za-z0-9_.]+|twitch\.tv\/[A-Za-z0-9_]+|roblox\.com\/(?:groups|communities)\/\d+)/gi;
  const matches = description.match(urlRegex) || [];
  for (const m of matches) {
    const clean = sanitizeHttpsUrl(m);
    if (!clean) continue;
    const norm = clean.toLowerCase().replace(/\/+$/, '');
    if (seen.has(norm)) continue;
    seen.add(norm);
    const type = detectSocialType('', clean);
    found.push({
      id: `desc-${found.length}`,
      title: type === 'RobloxGroup' ? 'Roblox Community' : type,
      url: clean,
      type,
      source: 'description',
    });
  }
  return found;
}

async function getRegionRanksMap(regionCode: string): Promise<Map<string, { rank: number; sortTitle: string }>> {
  const cached = regionChartsCache.get(regionCode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ranks;
  }

  const ranks = new Map<string, { rank: number; sortTitle: string }>();
  const sessionId = `rometric-region-${regionCode}-${Date.now()}`;
  const url = `https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${sessionId}&device=computer&country=${encodeURIComponent(regionCode)}`;
  const res = await fetchJsonWithTimeout<{
    sorts?: Array<{
      sortId?: string;
      sortDisplayName?: string;
      games?: Array<{ universeId?: number }>;
    }>;
  }>(url, 6500);

  if (res.ok && res.data?.sorts) {
    // Prioritize Top Playing Now / Most Popular / Top Trending sorts first
    const priorityOrder = [
      'top-playing-now',
      'most-popular',
      'top-trending',
      'top-earning',
      'up-and-coming',
      'top-rated',
    ];
    const sortedSorts = [...res.data.sorts].sort((a, b) => {
      const ia = priorityOrder.indexOf(a.sortId || '');
      const ib = priorityOrder.indexOf(b.sortId || '');
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    for (const sort of sortedSorts) {
      const title = sort.sortDisplayName || sort.sortId || 'Explore';
      const list = sort.games || [];
      for (let i = 0; i < list.length; i++) {
        const uid = list[i]?.universeId ? String(list[i].universeId) : null;
        if (!uid) continue;
        const existing = ranks.get(uid);
        const rank = i + 1;
        if (!existing || rank < existing.rank) {
          ranks.set(uid, { rank, sortTitle: title });
        }
      }
    }
  }

  regionChartsCache.set(regionCode, {
    expiresAt: Date.now() + 15 * 60 * 1000,
    ranks,
  });

  return ranks;
}

export async function GET(req: NextRequest) {
  const universeId = req.nextUrl.searchParams.get('universeId')?.trim() ?? '';
  if (!/^[0-9]{1,20}$/.test(universeId)) {
    return NextResponse.json(
      { error: 'Valid numeric universeId is required.' },
      { status: 400 }
    );
  }

  const cached = detailsCache.get(universeId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  }

  // Parallel public Roblox API calls
  const [
    gameRes,
    passesRes,
    devProdRes,
    badgesRes,
    socialRes,
    iconRes,
    thumbsRes,
    mediaRes,
    recsRes,
    ...regionMaps
  ] = await Promise.all([
    fetchJsonWithTimeout<{
      data?: Array<{
        id: number;
        description?: string | null;
        created?: string;
        updated?: string;
        maxPlayers?: number;
        price?: number | null;
        copyingAllowed?: boolean;
        playing?: number;
        visits?: number;
        favoritedCount?: number;
        creator?: { id?: number; type?: string; name?: string };
      }>;
    }>(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
    fetchJsonWithTimeout<{
      gamePasses?: Array<{
        id: number;
        name?: string;
        displayName?: string;
        price?: number | null;
        isForSale?: boolean;
        iconImageAssetId?: number;
        productId?: number | null;
      }>;
      data?: Array<{
        id: number;
        name?: string;
        displayName?: string;
        price?: number | null;
        isForSale?: boolean;
        productId?: number | null;
      }>;
    }>(
      `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=50`
    ),
    fetchJsonWithTimeout<{
      developerProducts?: Array<{
        id?: number;
        productId?: number;
        name?: string;
        description?: string;
        priceInRobux?: number | null;
        iconImageAssetId?: number | null;
      }>;
      DeveloperProducts?: Array<{
        DeveloperProductId?: number;
        ProductId?: number;
        Name?: string;
        Description?: string;
        PriceInRobux?: number | null;
        IconImageAssetId?: number | null;
      }>;
    }>(
      `https://apis.roblox.com/developer-products/v1/universes/${universeId}/developerproducts?pageNumber=1&pageSize=50`
    ),
    fetchJsonWithTimeout<{
      data?: Array<{
        id: number;
        name?: string;
        description?: string;
        enabled?: boolean;
        iconImageId?: number;
        created?: string;
        statistics?: {
          pastDayAwardedCount?: number;
          awardedCount?: number;
          winRatePercentage?: number;
        };
      }>;
    }>(
      `https://badges.roblox.com/v1/universes/${universeId}/badges?limit=50&sortOrder=Desc`
    ),
    fetchJsonWithTimeout<{
      data?: Array<{ id?: number | string; title?: string; url?: string; type?: string }>;
    }>(`https://games.roblox.com/v1/games/${universeId}/social-links/list`),
    fetchJsonWithTimeout<{
      data?: Array<{ targetId: number; imageUrl?: string }>;
    }>(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`
    ),
    fetchJsonWithTimeout<{
      data?: Array<{
        universeId: number;
        thumbnails?: Array<{ targetId?: number; imageUrl?: string; state?: string }>;
      }>;
    }>(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`
    ),
    fetchJsonWithTimeout<{
      data?: Array<{ assetTypeId?: number; imageId?: number; approved?: boolean }>;
    }>(`https://games.roblox.com/v2/games/${universeId}/media`),
    fetchJsonWithTimeout<{
      games?: Array<{
        universeId?: number;
        placeId?: number;
        name?: string;
        creatorName?: string;
        playerCount?: number;
      }>;
    }>(
      `https://games.roblox.com/v1/games/recommendations/game/${universeId}?maxRows=12`
    ),
    ...REGIONS.map((r) => getRegionRanksMap(r.code)),
  ]);

  const liveGame = gameRes.data?.data?.[0];
  const creatorId = liveGame?.creator?.id;
  const creatorType = liveGame?.creator?.type;

  // Fetch secondary icons & group social links & similar game details in one parallel wave
  const rawPasses = passesRes.data?.gamePasses || passesRes.data?.data || [];
  const passIds = rawPasses.slice(0, 50).map((p) => p.id);

  const rawBadges = badgesRes.data?.data || [];
  const badgeIds = rawBadges.slice(0, 50).map((b) => b.id);

  const rawMediaImageIds = (mediaRes.data?.data || [])
    .filter((m) => m.imageId && m.approved !== false)
    .map((m) => m.imageId!)
    .slice(0, 12);

  const similarIds = (recsRes.data?.games || [])
    .map((g) => g.universeId)
    .filter((id): id is number => Boolean(id) && String(id) !== universeId)
    .slice(0, 10);

  const [
    passIconsRes,
    badgeIconsRes,
    mediaAssetsRes,
    groupSocialRes,
    similarGamesRes,
    similarVotesRes,
    similarIconsRes,
  ] = await Promise.all([
    passIds.length > 0
      ? fetchJsonWithTimeout<{ data?: Array<{ targetId: number; imageUrl?: string }> }>(
          `https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${passIds.join(',')}&size=150x150&format=Png&isCircular=false`
        )
      : Promise.resolve({ ok: false, status: 0, data: null }),
    badgeIds.length > 0
      ? fetchJsonWithTimeout<{ data?: Array<{ targetId: number; imageUrl?: string }> }>(
          `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${badgeIds.join(',')}&size=150x150&format=Png&isCircular=false`
        )
      : Promise.resolve({ ok: false, status: 0, data: null }),
    rawMediaImageIds.length > 0
      ? fetchJsonWithTimeout<{ data?: Array<{ targetId: number; imageUrl?: string }> }>(
          `https://thumbnails.roblox.com/v1/assets?assetIds=${rawMediaImageIds.join(',')}&size=768x432&format=Png&isCircular=false`
        )
      : Promise.resolve({ ok: false, status: 0, data: null }),
    creatorType === 'Group' && creatorId && creatorId > 0
      ? fetchJsonWithTimeout<{
          data?: Array<{ id?: number | string; title?: string; url?: string; type?: string }>;
        }>(`https://groups.roblox.com/v1/groups/${creatorId}/social-links`)
      : Promise.resolve({ ok: false, status: 0, data: null }),
    similarIds.length > 0
      ? fetchJsonWithTimeout<{
          data?: Array<{
            id: number;
            rootPlaceId: number;
            name: string;
            playing: number;
            visits: number;
            favoritedCount: number;
            genre_l1?: string;
            genre?: string;
            creator?: { name?: string };
          }>;
        }>(`https://games.roblox.com/v1/games?universeIds=${similarIds.join(',')}`)
      : Promise.resolve({ ok: false, status: 0, data: null }),
    similarIds.length > 0
      ? fetchJsonWithTimeout<{
          data?: Array<{ id: number; upVotes: number; downVotes: number }>;
        }>(`https://games.roblox.com/v1/games/votes?universeIds=${similarIds.join(',')}`)
      : Promise.resolve({ ok: false, status: 0, data: null }),
    similarIds.length > 0
      ? fetchJsonWithTimeout<{
          data?: Array<{ targetId: number; imageUrl?: string }>;
        }>(
          `https://thumbnails.roblox.com/v1/games/icons?universeIds=${similarIds.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`
        )
      : Promise.resolve({ ok: false, status: 0, data: null }),
  ]);

  // Map Game Passes
  const passIconMap = new Map(
    (passIconsRes.data?.data || [])
      .filter((x) => x.imageUrl && x.imageUrl.startsWith('https://'))
      .map((x) => [x.targetId, x.imageUrl!])
  );
  const gamePasses: RobloxGamePassItem[] = rawPasses.slice(0, 50).map((p) => ({
    id: p.id,
    name: p.name || `Pass #${p.id}`,
    displayName: p.displayName || p.name || `Pass #${p.id}`,
    price: p.price !== null && p.price !== undefined ? Number(p.price) : null,
    isForSale: p.isForSale !== false && p.price !== null && p.price !== undefined,
    iconUrl: passIconMap.get(p.id) ?? null,
    productId: p.productId ?? null,
  }));

  // Map Developer Products
  const rawDevProducts =
    devProdRes.data?.developerProducts ||
    devProdRes.data?.DeveloperProducts ||
    [];
  const devProducts: RobloxDevProductItem[] = rawDevProducts.slice(0, 50).map((dp) => {
    const rec = dp as Record<string, unknown>;
    return {
      id: Number(rec.id ?? rec.DeveloperProductId ?? rec.productId ?? rec.ProductId ?? 0),
      name: String(rec.name ?? rec.Name ?? 'Developer Product'),
      description: String(rec.description ?? rec.Description ?? ''),
      priceInRobux:
        rec.priceInRobux !== undefined && rec.priceInRobux !== null
          ? Number(rec.priceInRobux)
          : rec.PriceInRobux !== undefined && rec.PriceInRobux !== null
            ? Number(rec.PriceInRobux)
            : null,
      iconUrl: null,
    };
  });
  const devProductsRestricted =
    !devProdRes.ok && (devProdRes.status === 401 || devProdRes.status === 403 || devProdRes.status === 404);

  // Map Badges
  const badgeIconMap = new Map(
    (badgeIconsRes.data?.data || [])
      .filter((x) => x.imageUrl && x.imageUrl.startsWith('https://'))
      .map((x) => [x.targetId, x.imageUrl!])
  );
  const badges: RobloxBadgeItem[] = rawBadges.slice(0, 50).map((b) => ({
    id: b.id,
    name: b.name || `Badge #${b.id}`,
    description: b.description || '',
    enabled: b.enabled !== false,
    iconUrl: badgeIconMap.get(b.id) ?? null,
    awardedCount: Number(b.statistics?.awardedCount ?? 0),
    pastDayAwardedCount: Number(b.statistics?.pastDayAwardedCount ?? 0),
    winRatePercentage: Number(((b.statistics?.winRatePercentage ?? 0) * 100).toFixed(2)),
    created: b.created ?? null,
  }));

  // Map Social Links (Roblox Game Socials + Group Socials + Verified Description Links)
  const socialLinks: RobloxSocialLinkItem[] = [];
  const seenSocialUrls = new Set<string>();
  const addSocial = (
    item: Omit<RobloxSocialLinkItem, 'url'> & { url: string | null }
  ) => {
    if (!item.url) return;
    const key = item.url.toLowerCase().replace(/\/+$/, '');
    if (seenSocialUrls.has(key)) return;
    seenSocialUrls.add(key);
    socialLinks.push({ ...item, url: item.url });
  };

  for (const s of socialRes.data?.data || []) {
    const clean = sanitizeHttpsUrl(s.url);
    if (!clean) continue;
    const type = detectSocialType(s.type, clean);
    addSocial({
      id: `game-social-${s.id ?? socialLinks.length}`,
      title: s.title?.trim() || type,
      url: clean,
      type,
      source: 'roblox_social',
    });
  }
  for (const s of groupSocialRes.data?.data || []) {
    const clean = sanitizeHttpsUrl(s.url);
    if (!clean) continue;
    const type = detectSocialType(s.type, clean);
    addSocial({
      id: `group-social-${s.id ?? socialLinks.length}`,
      title: s.title?.trim() || type,
      url: clean,
      type,
      source: 'group_social',
    });
  }
  for (const s of extractSocialLinksFromDescription(liveGame?.description || '')) {
    addSocial(s);
  }
  if (creatorType === 'Group' && creatorId && creatorId > 0) {
    addSocial({
      id: `roblox-group-${creatorId}`,
      title: liveGame?.creator?.name
        ? `${liveGame.creator.name} (Roblox Group)`
        : 'Official Roblox Group',
      url: `https://www.roblox.com/groups/${creatorId}`,
      type: 'RobloxGroup',
      source: 'group_social',
    });
  }

  // Map Media (Logo + All Thumbnails deduplicated)
  const media: RobloxMediaItem[] = [];
  const seenMedia = new Set<string>();
  const logoUrl = iconRes.data?.data?.[0]?.imageUrl;
  if (logoUrl && logoUrl.startsWith('https://')) {
    seenMedia.add(logoUrl);
    media.push({
      id: 'logo-main',
      type: 'logo',
      imageUrl: logoUrl,
      label: 'Experience Logo (512×512)',
    });
  }
  const multiThumbs = thumbsRes.data?.data?.[0]?.thumbnails || [];
  multiThumbs.forEach((t, idx) => {
    if (t.imageUrl && t.imageUrl.startsWith('https://') && !seenMedia.has(t.imageUrl)) {
      seenMedia.add(t.imageUrl);
      media.push({
        id: `thumb-${t.targetId ?? idx}`,
        type: 'thumbnail',
        imageUrl: t.imageUrl,
        label: `Thumbnail #${idx + 1}`,
      });
    }
  });
  (mediaAssetsRes.data?.data || []).forEach((m, idx) => {
    if (m.imageUrl && m.imageUrl.startsWith('https://') && !seenMedia.has(m.imageUrl)) {
      seenMedia.add(m.imageUrl);
      media.push({
        id: `media-${m.targetId ?? idx}`,
        type: 'thumbnail',
        imageUrl: m.imageUrl,
        label: `Gallery Asset #${media.length}`,
      });
    }
  });

  // Map Competition / Similar Games
  const simVoteMap = new Map(
    (similarVotesRes.data?.data || []).map((v) => [v.id, v])
  );
  const simIconMap = new Map(
    (similarIconsRes.data?.data || [])
      .filter((x) => x.imageUrl && x.imageUrl.startsWith('https://'))
      .map((x) => [x.targetId, x.imageUrl!])
  );
  const similarGames: RobloxSimilarGameItem[] = (similarGamesRes.data?.data || [])
    .map((g) => {
      const vote = simVoteMap.get(g.id);
      const ratio =
        vote && vote.upVotes + vote.downVotes > 0
          ? Number(((vote.upVotes / (vote.upVotes + vote.downVotes)) * 100).toFixed(1))
          : null;
      return {
        universeId: String(g.id),
        rootPlaceId: String(g.rootPlaceId || g.id),
        name: g.name,
        creatorName: g.creator?.name || 'Roblox Creator',
        genre: g.genre_l1 || g.genre || 'All Genres',
        currentCcu: Math.max(0, Number(g.playing || 0)),
        totalVisits: Math.max(0, Number(g.visits || 0)),
        favorites: Math.max(0, Number(g.favoritedCount || 0)),
        likeRatio: ratio,
        iconUrl: simIconMap.get(g.id) ?? null,
      };
    })
    .sort((a, b) => b.currentCcu - a.currentCcu);

  // Map Global & Local Region Chart Rankings
  const regionalRanks: RegionalChartRank[] = REGIONS.map((region, idx) => {
    const rankMap = regionMaps[idx];
    const entry = rankMap?.get(universeId) ?? null;
    return {
      regionCode: region.code.toUpperCase(),
      regionLabel: region.label,
      rank: entry?.rank ?? null,
      sortTitle: entry?.sortTitle ?? null,
    };
  });

  const payload: RobloxPublicGameDetailsResponse = {
    universeId,
    meta: {
      created: liveGame?.created ?? null,
      updated: liveGame?.updated ?? null,
      maxPlayers: liveGame?.maxPlayers ?? null,
      price: liveGame?.price ?? null,
      copyingAllowed: Boolean(liveGame?.copyingAllowed),
      playing: liveGame?.playing ?? null,
      visits: liveGame?.visits ?? null,
      favoritedCount: liveGame?.favoritedCount ?? null,
    },
    gamePasses,
    devProducts,
    devProductsRestricted,
    badges,
    socialLinks,
    media,
    similarGames,
    regionalRanks,
    fetchedAt: new Date().toISOString(),
  };

  detailsCache.set(universeId, {
    expiresAt: Date.now() + 5 * 60 * 1000,
    payload,
  });

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  });
}
