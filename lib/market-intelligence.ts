import { slugify } from './format';
import { cleanSeoGameName } from './seo';
import type { DeveloperSummary, GameRecordData } from './types';

export interface GenreDefinition {
  slug: string;
  name: string;
  shortLabel: string;
  description: string;
  officialGenres: string[];
  keywords: string[];
}

export const GENRE_DEFINITIONS: GenreDefinition[] = [
  {
    slug: 'simulation',
    name: 'Simulation',
    shortLabel: 'Simulation',
    description:
      'Progression, pet hatching, economy loops, and incremental Roblox simulators tracked by live concurrent players.',
    officialGenres: ['simulation', 'simulator'],
    keywords: ['simulator', 'sim', 'clicker', 'hatching', 'hatch', 'incremental', 'dig', 'mining', 'fishing', 'fisch', 'garden', 'farm'],
  },
  {
    slug: 'roleplay',
    name: 'Roleplay & Life Sim',
    shortLabel: 'Roleplay',
    description:
      'Open-world towns, social life simulations, jobs, and avatar roleplay experiences across Roblox.',
    officialGenres: ['roleplay', 'town and city', 'roleplay & avatar sim'],
    keywords: ['rp', 'roleplay', 'brookhaven', 'bloxburg', 'berry avenue', 'livetopia', 'adopt', 'life', 'high school', 'family', 'city', 'hospital', 'daycare'],
  },
  {
    slug: 'rpg',
    name: 'RPG & Adventure',
    shortLabel: 'RPG',
    description:
      'Leveling quests, boss raids, open-world exploration, and loot-driven Roblox RPG experiences.',
    officialGenres: ['rpg', 'adventure', 'fantasy'],
    keywords: ['rpg', 'quest', 'dungeon', 'world', 'odyssey', 'legacy', 'chronicles', 'realm', 'adventure', 'frontier', 'souls', 'magic', 'wizard', 'blade'],
  },
  {
    slug: 'anime',
    name: 'Anime Games',
    shortLabel: 'Anime',
    description:
      'Top anime-inspired Roblox action, tower defense, and fruit-combat games ranked by real-time player activity.',
    officialGenres: [],
    keywords: ['anime', 'blox fruits', 'fruit', 'piece', 'jujutsu', 'shindo', 'shinobi', 'slayer', 'ghoul', 'titan', 'bleach', 'peroxide', 'type soul', 'blue lock', 'volleyball', 'arise', 'clover', 'kaiju', 'saiyan', 'naruto', 'ninja', 'pirate', 'demon'],
  },
  {
    slug: 'battlegrounds',
    name: 'Battlegrounds & Fighting',
    shortLabel: 'Fighting',
    description:
      'Skill-based arena combat, combo fighters, boxing matches, and competitive Roblox battlegrounds.',
    officialGenres: ['fighting', 'action'],
    keywords: ['battlegrounds', 'battleground', 'shenanigans', 'boxing', 'fighting', 'combat', 'brawl', 'arena', 'duel', 'slap', 'warriors', 'smash', 'blade ball', 'pvp'],
  },
  {
    slug: 'tower-defense',
    name: 'Tower Defense',
    shortLabel: 'Tower Defense',
    description:
      'Wave survival, unit summoning, and tactical lane defense games ranked by live player count.',
    officialGenres: ['strategy'],
    keywords: ['tower defense', 'td', 'vanguards', 'last stand', 'defenders', 'reborn', 'rangers', 'toilet tower', 'all star', 'tds'],
  },
  {
    slug: 'shooter',
    name: 'Shooters & FPS',
    shortLabel: 'Shooter',
    description:
      'Competitive first-person and third-person Roblox shooters, tactical combat arenas, and gun-game modes.',
    officialGenres: ['shooter', 'fps'],
    keywords: ['rivals', 'arsenal', 'shooter', 'fps', 'gun', 'war', 'sniper', 'phantom forces', 'bedwars', 'paintball', 'hypershot', 'military', 'combat', 'frontlines', 'flag wars'],
  },
  {
    slug: 'survival',
    name: 'Survival & Horror',
    shortLabel: 'Horror & Survival',
    description:
      'Co-op survival nights, asymmetrical monster chases, escape rooms, and horror experiences on Roblox.',
    officialGenres: ['horror', 'survival'],
    keywords: ['horror', 'survival', 'doors', 'evade', 'dandy', 'forsaken', 'piggy', 'nights', 'forest', 'zombie', 'dead rails', 'apocalypse', 'flee', 'scary', 'monster', 'murder', 'mimic', 'scp', 'backrooms'],
  },
  {
    slug: 'obby-platformer',
    name: 'Obby & Platformer',
    shortLabel: 'Obby',
    description:
      'Obstacle courses, vertical climb towers, speedrun parkour, and precision platforming games on Roblox.',
    officialGenres: ['obby', 'obby & platformer', 'platformer'],
    keywords: ['obby', 'tower', 'parkour', 'escape', 'jump', 'climb', 'run', 'speed', 'platformer', 'stage', 'difficulty', 'troll', 'slap tower'],
  },
  {
    slug: 'tycoon',
    name: 'Tycoon & Business',
    shortLabel: 'Tycoon',
    description:
      'Factory builders, empire management, restaurant chains, and base-building Roblox tycoons.',
    officialGenres: ['tycoon'],
    keywords: ['tycoon', 'restaurant', 'factory', 'empire', 'store', 'shop', 'supermarket', 'theme park', 'build a', 'lumber', 'retail', 'dealership', 'miner'],
  },
  {
    slug: 'sports-racing',
    name: 'Sports & Racing',
    shortLabel: 'Sports & Racing',
    description:
      'Competitive soccer, basketball, volleyball, and open-world car driving and racing games on Roblox.',
    officialGenres: ['sports', 'sports & racing', 'racing'],
    keywords: ['soccer', 'football', 'basketball', 'volleyball', 'racing', 'driving', 'car', 'vehicle', 'drift', 'track', 'league', 'goal', 'hoop', 'tennis', 'baseball', 'f1'],
  },
  {
    slug: 'rng-gacha',
    name: 'RNG & Collection',
    shortLabel: 'RNG & Gacha',
    description:
      'Aura rollers, luck-based collection games, card pack openers, and trading economies on Roblox.',
    officialGenres: [],
    keywords: ['rng', 'aura', 'roll', 'luck', 'gacha', 'pack', 'card', 'crate', 'pets', 'pet', 'creature', 'dragon', 'loomian', 'doodle', 'brainrot', 'steal'],
  },
  {
    slug: 'party-casual',
    name: 'Party & Minigames',
    shortLabel: 'Party & Casual',
    description:
      'Fast-paced social minigames, fashion runways, trivia challenges, and multiplayer party games.',
    officialGenres: ['party & casual', 'casual', 'entertainment', 'comedy', 'social'],
    keywords: ['dress to impress', 'fashion', 'minigame', 'party', 'squid', 'hide and seek', 'disaster', 'ragdoll', 'fling', 'draw', 'quiz', 'social', 'hangout', 'vibe', 'catalog', 'avatar'],
  },
  {
    slug: 'strategy',
    name: 'Strategy & Sandbox',
    shortLabel: 'Strategy',
    description:
      'Tactical base warfare, world-building sandboxes, physics contraptions, and resource strategy games.',
    officialGenres: ['strategy', 'building', 'sandbox'],
    keywords: ['strategy', 'sandbox', 'build', 'craft', 'warfare', 'rts', 'conquest', 'kingdom', 'chess', 'rise of nations', 'block'],
  },
];

export function matchGameToGenres(game: GameRecordData): GenreDefinition[] {
  const officialLower = (game.genre || '').toLowerCase().trim();
  const textLower = `${game.name} ${game.description || ''}`.toLowerCase();
  const matched: GenreDefinition[] = [];

  for (const def of GENRE_DEFINITIONS) {
    const officialHit =
      officialLower &&
      def.officialGenres.some(
        (g) => officialLower === g || officialLower.includes(g)
      );
    const keywordHit = def.keywords.some((kw) => {
      if (kw.length <= 3) {
        return new RegExp(`\\b${kw}\\b`, 'i').test(game.name);
      }
      return textLower.includes(kw);
    });
    if (officialHit || keywordHit) {
      matched.push(def);
    }
  }
  return matched;
}

export function getGenreBySlug(slug: string): GenreDefinition | null {
  const norm = slug.toLowerCase().trim();
  return GENRE_DEFINITIONS.find((g) => g.slug === norm) ?? null;
}

export function getGamesForGenre(
  games: GameRecordData[],
  genre: GenreDefinition
): GameRecordData[] {
  const officialSet = new Set(genre.officialGenres.map((s) => s.toLowerCase()));
  return games.filter((game) => {
    const gLower = (game.genre || '').toLowerCase().trim();
    if (officialSet.has(gLower)) return true;
    for (const og of genre.officialGenres) {
      if (gLower && gLower.includes(og)) return true;
    }
    const nameLower = game.name.toLowerCase();
    return genre.keywords.some((kw) => {
      if (kw.length <= 3) {
        return new RegExp(`\\b${kw}\\b`, 'i').test(nameLower);
      }
      return nameLower.includes(kw);
    });
  });
}

// ============================================================================
// Multi-Signal "Games Like X" Similarity Engine
// ============================================================================
const TITLE_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'your', 'you',
  'are', 'was', 'have', 'has', 'new', 'upd', 'update', 'event', 'beta', 'alpha',
  'free', 'roblox', 'game', 'games', 'part', 'season', 'chapter', 'edition',
  'v2', 'v3', 'x2', '2x', '3x', 'soon', 'out', 'now', 'all', 'pro', 'plus',
  'mega', 'super', 'ultra', 'real', 'official', 'original', 'classic', 'deluxe',
]);

export function tokenizeGameTitle(rawName: string): string[] {
  const clean = cleanSeoGameName(rawName)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
  return clean
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

export interface SimilarGameResult {
  game: GameRecordData;
  score: number;
  reasons: string[];
}

export function findSimilarGames(
  target: GameRecordData,
  allGames: GameRecordData[],
  limit = 16
): SimilarGameResult[] {
  const targetTokens = new Set(tokenizeGameTitle(target.name));
  const targetGenres = new Set(matchGameToGenres(target).map((g) => g.slug));
  const targetOfficial = (target.genre || '').toLowerCase();
  const targetLogCcu = Math.log10(Math.max(10, target.currentCcu));

  const scored: SimilarGameResult[] = [];

  for (const candidate of allGames) {
    if (candidate.universeId === target.universeId) continue;

    let score = 0;
    const reasons: string[] = [];

    // 1. Sub-genre overlap (strongest gameplay match signal)
    const candGenres = matchGameToGenres(candidate);
    const sharedSubGenres = candGenres.filter((g) => targetGenres.has(g.slug));
    if (sharedSubGenres.length > 0) {
      score += Math.min(44, sharedSubGenres.length * 24);
      reasons.push(sharedSubGenres[0].shortLabel);
    } else if (
      targetOfficial &&
      targetOfficial !== 'all genres' &&
      (candidate.genre || '').toLowerCase() === targetOfficial
    ) {
      score += 22;
      reasons.push(candidate.genre);
    }

    // 2. Title keyword overlap (shared franchise / mechanic)
    const candTokens = tokenizeGameTitle(candidate.name);
    let sharedKeywords = 0;
    for (const t of candTokens) {
      if (targetTokens.has(t)) sharedKeywords++;
    }
    if (sharedKeywords > 0) {
      score += Math.min(34, sharedKeywords * 18);
      reasons.push('Matching theme');
    }

    // 3. Same studio bonus
    if (
      target.creatorId &&
      candidate.creatorId === target.creatorId &&
      target.creatorId !== '0'
    ) {
      score += 18;
      reasons.push('Same studio');
    }

    // 4. Audience scale proximity (log CCU similarity)
    const candLogCcu = Math.log10(Math.max(10, candidate.currentCcu));
    const logDiff = Math.abs(targetLogCcu - candLogCcu);
    if (logDiff <= 0.7) {
      score += 14;
      if (reasons.length < 2) reasons.push('Similar player scale');
    } else if (logDiff <= 1.3) {
      score += 7;
    }

    // 5. Community rating quality tie-breaker
    if (typeof candidate.likeRatio === 'number' && candidate.likeRatio >= 85) {
      score += 6;
    }

    if (score >= 22) {
      scored.push({
        game: candidate,
        score: Math.min(99, Math.round(score)),
        reasons: reasons.slice(0, 3),
      });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.game.currentCcu - a.game.currentCcu;
  });

  // Fallback to top same-genre games if fewer than 6 matches
  if (scored.length < 6) {
    const seen = new Set([target.universeId, ...scored.map((s) => s.game.universeId)]);
    for (const g of allGames) {
      if (seen.has(g.universeId)) continue;
      scored.push({
        game: g,
        score: 42,
        reasons: [g.genre || 'Popular on Roblox'],
      });
      seen.add(g.universeId);
      if (scored.length >= limit) break;
    }
  }

  return scored.slice(0, limit);
}

// ============================================================================
// Keyword & Mechanic Trend Radar
// ============================================================================
export interface KeywordTrendSummary {
  keyword: string;
  label: string;
  gameCount: number;
  totalCcu: number;
  avgCcu: number;
  topGameSharePct: number;
  avgGrowth24h: number | null;
  topGames: GameRecordData[];
}

export function extractKeywordTrends(
  games: GameRecordData[],
  minGames = 2,
  limit = 120
): KeywordTrendSummary[] {
  const buckets = new Map<string, GameRecordData[]>();

  for (const game of games) {
    const tokens = new Set(tokenizeGameTitle(game.name));
    for (const token of tokens) {
      if (token.length < 3 || token.length > 22) continue;
      const list = buckets.get(token) ?? [];
      list.push(game);
      buckets.set(token, list);
    }
  }

  const summaries: KeywordTrendSummary[] = [];
  for (const [keyword, list] of buckets.entries()) {
    if (list.length < minGames) continue;
    const sorted = [...list].sort((a, b) => b.currentCcu - a.currentCcu);
    const totalCcu = sorted.reduce((sum, g) => sum + g.currentCcu, 0);
    if (totalCcu < 150) continue;
    const avgCcu = Math.round(totalCcu / sorted.length);
    const topGameSharePct =
      totalCcu > 0
        ? Math.round((sorted[0].currentCcu / totalCcu) * 100)
        : 0;
    const growthValues = sorted
      .map((g) => g.growth24h)
      .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
    const avgGrowth24h =
      growthValues.length > 0
        ? Number(
            (
              growthValues.reduce((s, v) => s + v, 0) / growthValues.length
            ).toFixed(1)
          )
        : null;

    summaries.push({
      keyword,
      label: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      gameCount: sorted.length,
      totalCcu,
      avgCcu,
      topGameSharePct,
      avgGrowth24h,
      topGames: sorted.slice(0, 5),
    });
  }

  summaries.sort((a, b) => b.totalCcu - a.totalCcu);
  return summaries.slice(0, limit);
}

export function getGamesForKeyword(
  games: GameRecordData[],
  keyword: string
): GameRecordData[] {
  const norm = keyword.toLowerCase().trim();
  if (!norm) return [];
  return games
    .filter((g) => tokenizeGameTitle(g.name).includes(norm))
    .sort((a, b) => b.currentCcu - a.currentCcu);
}

// ============================================================================
// Updates & Patch Velocity Helpers
// ============================================================================
export function extractUpdateBadgeText(rawName: string): string | null {
  const bracketMatches = rawName.match(/[\[\(\{]([^\]\)\}]{2,28})[\]\)\}]/g);
  if (!bracketMatches) return null;
  for (const m of bracketMatches) {
    const inner = m
      .slice(1, -1)
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, '')
      .trim();
    if (inner.length >= 2) return inner;
  }
  return null;
}

export function getGamesSortedByRecentUpdate(
  games: GameRecordData[]
): GameRecordData[] {
  return [...games]
    .filter((g) => Boolean(g.robloxUpdatedAt))
    .sort((a, b) => {
      const ta = new Date(a.robloxUpdatedAt!).getTime();
      const tb = new Date(b.robloxUpdatedAt!).getTime();
      return tb - ta;
    });
}

// ============================================================================
// Studios / Developers Aggregation (Server-Side Ready)
// ============================================================================
export function aggregateStudiosServer(
  games: GameRecordData[]
): DeveloperSummary[] {
  const byDev = new Map<string, GameRecordData[]>();
  for (const g of games) {
    const key = `${g.creatorType}_${g.creatorId}`;
    const list = byDev.get(key) ?? [];
    list.push(g);
    byDev.set(key, list);
  }

  const results: DeveloperSummary[] = [];
  for (const list of byDev.values()) {
    const sorted = [...list].sort((a, b) => b.currentCcu - a.currentCcu);
    const primary = sorted[0];
    const combinedCcu = sorted.reduce((sum, g) => sum + g.currentCcu, 0);
    const totalVisits = sorted.reduce((sum, g) => sum + g.totalVisits, 0);
    const totalFavorites = sorted.reduce((sum, g) => sum + g.favorites, 0);
    const ratios = sorted
      .map((g) => g.likeRatio)
      .filter((r): r is number => typeof r === 'number');
    const avgLikeRatio =
      ratios.length > 0
        ? Number((ratios.reduce((s, r) => s + r, 0) / ratios.length).toFixed(1))
        : null;

    results.push({
      creatorId: primary.creatorId,
      creatorName: primary.creatorName,
      creatorType: primary.creatorType,
      creatorVerified: sorted.some((g) => g.creatorVerified),
      gameCount: sorted.length,
      combinedCcu,
      totalVisits,
      totalFavorites,
      avgLikeRatio,
      topGame: primary,
      games: sorted,
    });
  }

  return results.sort((a, b) => b.combinedCcu - a.combinedCcu);
}

// ============================================================================
// Weekly Market Recap Periods (Sunday-anchored UTC dates)
// ============================================================================
export function getRecentWeekDates(count = 12, now: Date = new Date()): string[] {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  // Anchor to most recent Sunday
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);

  const weeks: string[] = [];
  for (let i = 0; i < count; i++) {
    const copy = new Date(d.getTime() - i * 7 * 86_400_000);
    weeks.push(copy.toISOString().slice(0, 10));
  }
  return weeks;
}

export function formatWeekRangeLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return weekStartIso;
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const fmtShort = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${fmtShort.format(start)} – ${fmt.format(end)}`;
}

// ============================================================================
// Market Insights & Revenue Q&A Helpers
// ============================================================================
export interface StaticInsightDefinition {
  slug: string;
  title: string;
  summary: string;
  category: string;
  readMinutes: number;
}

export const STATIC_INSIGHTS: StaticInsightDefinition[] = [
  {
    slug: 'most-played-roblox-games-right-now',
    title: 'What Are the Most Played Roblox Games Right Now?',
    summary:
      'Live player-count breakdown of the top experiences commanding Roblox concurrent traffic, total visits, and genre share.',
    category: 'Live Market',
    readMinutes: 3,
  },
  {
    slug: 'how-roblox-game-revenue-is-estimated',
    title: 'How Much Do Top Roblox Games Make? Revenue & DevEx Methodology',
    summary:
      'Transparent breakdown of concurrent player monetization benchmarks, Robux-to-USD DevEx rates, and genre ARPDAU tiers.',
    category: 'Monetization',
    readMinutes: 4,
  },
  {
    slug: 'fastest-growing-roblox-games-this-week',
    title: 'Which Roblox Games Are Growing the Fastest Right Now?',
    summary:
      'Real-time breakout velocity report highlighting games with the sharpest 24-hour player surges and recent patch momentum.',
    category: 'Breakouts',
    readMinutes: 3,
  },
  {
    slug: 'highest-rated-roblox-games',
    title: 'Highest-Rated Roblox Games by Community Approval Ratio',
    summary:
      'Top-performing Roblox experiences ranked by verified upvote-to-downvote ratio with high active player engagement.',
    category: 'Quality Benchmarks',
    readMinutes: 3,
  },
  {
    slug: 'top-roblox-analytics-alternatives',
    title: 'RoMetric vs Other Roblox Analytics Trackers',
    summary:
      'How RoMetric combines live CCU charts, studio portfolios, update timelines, keyword saturation, and verified promo codes in one open platform.',
    category: 'Platform Guide',
    readMinutes: 4,
  },
];

export function buildGameRevenueInsightSlug(game: GameRecordData): string {
  const clean = slugify(cleanSeoGameName(game.name)) || game.slug || game.universeId;
  return `how-much-does-${clean}-make`;
}

export function findGameByRevenueInsightSlug(
  slug: string,
  games: GameRecordData[]
): GameRecordData | null {
  const m = slug.match(/^how-much-does-(.+)-make$/);
  if (!m) return null;
  const target = m[1].toLowerCase();
  return (
    games.find(
      (g) =>
        slugify(cleanSeoGameName(g.name)) === target ||
        g.slug.toLowerCase() === target ||
        g.universeId === target
    ) ?? null
  );
}

// ============================================================================
// Help & Methodology Guide Topics
// ============================================================================
export interface GuideTopic {
  slug: string;
  title: string;
  category: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    slug: 'how-we-track-player-counts',
    title: 'How RoMetric Tracks Live Player Counts',
    category: 'Data & Accuracy',
    summary:
      'Understand our collection cadence, snapshot aggregation, and peak CCU verification pipeline.',
    sections: [
      {
        heading: 'Direct Official Roblox API Polling',
        body: 'RoMetric collects concurrent player counts (CCU), total visits, favorites, upvotes, downvotes, and game metadata directly from Roblox public game endpoints. Every raw snapshot is timestamped in UTC and stored immutably.',
      },
      {
        heading: 'Hourly and Daily Historical Rollups',
        body: 'Raw 30-minute snapshots power 1-hour and 24-hour charts. Automated retention rollups aggregate raw data into hourly averages (7-day view) and permanent daily stats (30-day, 90-day, and all-time views) so trends stay lossless over time.',
      },
      {
        heading: 'Observed Peak Records',
        body: 'Whenever a game sets a new concurrent player high during a collection cycle, RoMetric records both the exact peak CCU and its UTC timestamp in our peak records ledger.',
      },
    ],
  },
  {
    slug: 'revenue-estimation-model',
    title: 'How Estimated Developer Revenue Works',
    category: 'Monetization',
    summary:
      'How RoMetric calculates directional monthly and annual USD revenue ranges from live player metrics.',
    sections: [
      {
        heading: 'Directional Estimates vs Verified Studio Financials',
        body: 'Roblox does not expose private developer payout data publicly. RoMetric revenue numbers are transparent, genre-adjusted estimates based on concurrent player hours, session engagement proxies, and standard Roblox DevEx exchange rates.',
      },
      {
        heading: 'Genre Monetization Multipliers',
        body: 'Monetization per player hour varies widely across Roblox genres. RPGs, Anime progression titles, and Simulators typically carry higher monetization velocity than casual obbies or social hangouts, which our estimation formula reflects.',
      },
    ],
  },
  {
    slug: 'similar-games-discovery',
    title: 'How "Games Like X" Recommendations Are Calculated',
    category: 'Discovery',
    summary:
      'The multi-signal scoring engine behind RoMetric similarity pages and competitor discovery.',
    sections: [
      {
        heading: 'Multi-Signal Similarity Scoring',
        body: 'RoMetric compares every active game across five measurable signals: shared official genre and inferred sub-genre, normalized title keyword overlap, studio portfolio relationship, logarithmic concurrent audience scale, and community approval ratio.',
      },
      {
        heading: 'Built for Players and Studios',
        body: 'Players use similarity pages to discover active alternatives when a favorite game goes quiet. Roblox developers use them to benchmark peer retention, update frequency, and monetization scale.',
      },
    ],
  },
  {
    slug: 'promo-codes-verification',
    title: 'How Roblox Promo Codes Are Sourced & Classified',
    category: 'Promo Codes',
    summary:
      'Automated syncing from CC-BY-SA community wikis and partner feeds with zero stale clutter.',
    sections: [
      {
        heading: 'Automated Multi-Source Syncing',
        body: 'RoMetric automatically checks public MediaWiki community wikis (CC-BY-SA) and verified partner APIs on a scheduled cadence, categorizing codes directly into Active or Expired based on source status, strikethrough markers, and expiration dates.',
      },
      {
        heading: 'Community Submissions & Attribution',
        body: 'Players and developers can submit newly announced codes directly on any game page. Every wiki-sourced and partner-sourced code preserves a transparent source attribution link.',
      },
    ],
  },
  {
    slug: 'update-velocity-tracking',
    title: 'Tracking Game Updates & Patch Impact',
    category: 'Analytics',
    summary:
      'How to spot major Roblox patches, event spikes, and studio shipping cadence.',
    sections: [
      {
        heading: 'Live Update Timestamps',
        body: 'Each tracked experience stores its official Roblox last-updated timestamp alongside live 24-hour player growth. Games that push fresh content updates appear immediately in the Live Updates feed.',
      },
      {
        heading: 'Measuring Post-Patch Momentum',
        body: 'Compare the update timestamp against the 7-day and 30-day CCU history chart on any game’s Updates page to see whether a patch produced a lasting audience lift or a short-lived spike.',
      },
    ],
  },
  {
    slug: 'keyword-saturation-research',
    title: 'Using Keyword Trends & Niche Saturation Data',
    category: 'Developer Research',
    summary:
      'Identify high-demand, low-competition Roblox mechanics using live title keyword analytics.',
    sections: [
      {
        heading: 'Reading Market Share & Saturation',
        body: 'For every recurring theme or mechanic across tracked Roblox titles, RoMetric calculates total live CCU, number of competing games, average CCU per title, and the top game’s dominance percentage.',
      },
      {
        heading: 'Spotting Underserved Niches',
        body: 'Themes with high average CCU per game and moderate top-game dominance often signal healthy player demand where well-executed new releases can break through.',
      },
    ],
  },
];

export function getGuideBySlug(slug: string): GuideTopic | null {
  return GUIDE_TOPICS.find((t) => t.slug === slug) ?? null;
}
