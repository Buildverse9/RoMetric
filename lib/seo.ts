export const SITE_URL = 'https://rometrics.vercel.app';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Returns a clean, UTC-stable "Month Year" string (e.g. "November 2026")
 * used in SEO titles, headings, and FAQ copy so SSR and client hydration match.
 */
export function getCurrentMonthYear(date: Date = new Date()): string {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Strips decorative emojis, stray symbols, and noisy Roblox event prefixes
 * (e.g. "[💗UPD 21.5⛩️]", "(EVENT)", "【NEW】") from a game name for cleaner,
 * higher-CTR search result titles and H1 headings.
 */
export function cleanSeoGameName(rawName: string): string {
  const original = String(rawName || '').trim();
  if (!original) return 'Roblox Game';

  let cleaned = original
    // Strip leading bracketed/parenthesized update tags including CJK brackets
    .replace(/^(?:\s*[\[\(\{【『][^\]\)\}】』]{1,42}[\]\)\}】』]\s*)+/g, '')
    // Strip trailing bracketed update tags like "[EVENT]" or "(UPD 12)"
    .replace(/(?:\s*[\[\(\{【『][^\]\)\}】』]{1,42}[\]\)\}】』]\s*)+$/g, '')
    // Strip emojis, pictographs, and decorative stars/symbols
    .replace(
      /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D★☆✦✧⚡✨🔥💎👑]/gu,
      ' '
    )
    // Strip leftover leading/trailing separators like "|", "-", ":", "•"
    .replace(/^[\s|\-:•·/]+|[\s|\-:•·/]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 2) {
    cleaned = original
      .replace(
        /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  return cleaned || original;
}

/**
 * Safely extracts the leading numeric Universe ID from either a bare ID
 * ("10563114921") or a slugged param ("10563114921-steal-an-egg", "10778568998-gta-6").
 */
export function extractUniverseIdFromParam(rawParam: string): string {
  const match = String(rawParam || '')
    .trim()
    .match(/^(\d+)(?:-|$)/);
  return match?.[1] ?? '';
}

function slugifyGameTitle(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

/**
 * Builds a clean, evergreen canonical slug for `/codes/[slug]` pages by stripping
 * temporary update/event prefixes such as `upd-21-5-`, `uts-3-0-`, `harvest-event-`,
 * `world-2-`, `part-2-`, etc.
 */
export function buildCanonicalCodeSlug(game: {
  name?: string | null;
  slug?: string | null;
  universeId?: string | number;
}): string {
  const cleanNameSlug = game.name
    ? slugifyGameTitle(cleanSeoGameName(game.name))
    : '';
  const rawSlug = slugifyGameTitle(game.slug || '');

  const stripEventPrefix = (s: string): string =>
    s
      .replace(
        /^(?:upd(?:ate)?|uts|ep|part|world|season|s|v|act|chapter|phase|event|x2|2x|new|beta|alpha|revamp|release|christmas|xmas|halloween|summer|winter|spring|easter|harvest|valentine)[-_]?[0-9a-z.]*[-_]+/i,
        ''
      )
      .replace(
        /^(?:upd(?:ate)?|uts|world|part|event|harvest)[-_]?[0-9.]*[-_]+/i,
        ''
      )
      .replace(/^-+|-+$/g, '');

  const candidate =
    stripEventPrefix(cleanNameSlug) ||
    cleanNameSlug ||
    stripEventPrefix(rawSlug) ||
    rawSlug ||
    String(game.universeId || '').replace(/[^0-9]/g, '');

  return candidate.length >= 2 ? candidate : rawSlug || cleanNameSlug;
}

// ============================================================================
// High-Volume Roblox Game Acronym & Rebrand Alias Registry
// Captures search traffic for shorthand acronyms (JJS, BLR, VBL, MM2, TTD, TSB)
// and renamed Roblox hits (Haikyuu Legends -> Volleyball Legends, Huzz RNG -> Aura RNG).
// ============================================================================
export interface GameAliasEntry {
  canonicalMatchers: string[];
  shortAcronym: string;
  aliases: string[];
  formerlyKnownAs?: string;
}

export const GAME_ALIAS_ENTRIES: GameAliasEntry[] = [
  {
    canonicalMatchers: ['jujutsu shenanigans'],
    shortAcronym: 'JJS',
    aliases: ['jjs', 'jujutsu shenanigans'],
  },
  {
    canonicalMatchers: ['volleyball legends', 'haikyuu legends'],
    shortAcronym: 'VBL',
    aliases: ['vbl', 'haikyuu legends', 'volleyball legends'],
    formerlyKnownAs: 'Haikyuu Legends',
  },
  {
    canonicalMatchers: ['blue lock rivals', 'blue lock: rivals'],
    shortAcronym: 'BLR',
    aliases: ['blr', 'blue lock rivals', 'blue lock'],
  },
  {
    canonicalMatchers: ['basketball zero', 'basketball: zero'],
    shortAcronym: 'BBZ',
    aliases: ['bbz', 'basketball zero', 'basketball rivals'],
    formerlyKnownAs: 'Basketball Rivals',
  },
  {
    canonicalMatchers: ['untitled boxing game'],
    shortAcronym: 'UBG',
    aliases: ['ubg', 'untitled boxing game'],
  },
  {
    canonicalMatchers: ['attack on titan revolution'],
    shortAcronym: 'AOTR',
    aliases: ['aotr', 'aot revolution', 'attack on titan revolution'],
  },
  {
    canonicalMatchers: ['all star tower defense'],
    shortAcronym: 'ASTD',
    aliases: ['astd', 'all star tower defense'],
  },
  {
    canonicalMatchers: ['murder mystery 2'],
    shortAcronym: 'MM2',
    aliases: ['mm2', 'murder mystery 2'],
  },
  {
    canonicalMatchers: ['toilet tower defense'],
    shortAcronym: 'TTD',
    aliases: ['ttd', 'toilet tower defense', 'uts 3.0 toilet tower defense'],
  },
  {
    canonicalMatchers: ['the strongest battlegrounds'],
    shortAcronym: 'TSB',
    aliases: ['tsb', 'tsbg', 'the strongest battlegrounds', 'strongest battlegrounds'],
  },
  {
    canonicalMatchers: ['bee swarm simulator'],
    shortAcronym: 'BSS',
    aliases: ['bss', 'bee swarm', 'bee swarm simulator'],
  },
  {
    canonicalMatchers: ['your bizarre adventure'],
    shortAcronym: 'YBA',
    aliases: ['yba', 'your bizarre adventure'],
  },
  {
    canonicalMatchers: ['blox fruits'],
    shortAcronym: 'BF',
    aliases: ['bf', 'blox fruits', 'blox fruit'],
  },
  {
    canonicalMatchers: ['pet simulator 99'],
    shortAcronym: 'PS99',
    aliases: ['ps99', 'pet sim 99', 'pet simulator 99'],
  },
  {
    canonicalMatchers: ['dress to impress'],
    shortAcronym: 'DTI',
    aliases: ['dti', 'dress to impress'],
  },
  {
    canonicalMatchers: ['aura rng', 'huzz rng'],
    shortAcronym: 'AGR',
    aliases: ['agr', 'huzz rng', 'aura rng'],
    formerlyKnownAs: 'Huzz RNG',
  },
  {
    canonicalMatchers: ['anime vanguards'],
    shortAcronym: 'AV',
    aliases: ['av', 'anime vanguards'],
  },
  {
    canonicalMatchers: ['anime adventures'],
    shortAcronym: 'AA',
    aliases: ['aa', 'anime adventures', 'aventuras de anime'],
  },
  {
    canonicalMatchers: ['run a christmas tree lot'],
    shortAcronym: 'Xmas Tree Lot',
    aliases: ['run a xmas tree lot', 'christmas tree lot', 'xmas tree lot'],
  },
  {
    canonicalMatchers: ['summon a pet army'],
    shortAcronym: 'Pet Army',
    aliases: ['harvest event summon a pet army', 'summon a pet army'],
  },
  {
    canonicalMatchers: ['azure latch', 'delay latch'],
    shortAcronym: 'Azure Latch',
    aliases: ['delay latch', 'azure latch'],
    formerlyKnownAs: 'Delay Latch',
  },
  {
    canonicalMatchers: ['grow a garden'],
    shortAcronym: 'GAG',
    aliases: ['gag', 'grow a garden'],
  },
];

export function findGameAliasEntry(rawNameOrSlug: string): GameAliasEntry | null {
  const normalized = cleanSeoGameName(rawNameOrSlug)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!normalized) return null;

  for (const entry of GAME_ALIAS_ENTRIES) {
    if (
      entry.canonicalMatchers.some(
        (m) => normalized === m || normalized.includes(m)
      ) ||
      entry.aliases.some((a) => normalized === a)
    ) {
      return entry;
    }
  }
  return null;
}

export function resolveAliasSlugQuery(rawQuery: string): string[] {
  const q = rawQuery
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!q) return [];
  const results = new Set<string>();
  for (const entry of GAME_ALIAS_ENTRIES) {
    const hits =
      entry.shortAcronym.toLowerCase() === q ||
      entry.aliases.some((a) => a === q || a.includes(q) || q.includes(a)) ||
      entry.canonicalMatchers.some((m) => m === q || m.includes(q));
    if (hits) {
      for (const m of entry.canonicalMatchers) {
        results.add(m);
        results.add(slugifyGameTitle(m));
      }
    }
  }
  return Array.from(results);
}

export function formatAliasPhrase(entry: GameAliasEntry | null): string {
  if (!entry) return '';
  if (entry.formerlyKnownAs) {
    return `${entry.shortAcronym}, formerly ${entry.formerlyKnownAs}`;
  }
  return entry.shortAcronym;
}

/**
 * Builds the canonical "{universeId}-{clean-slug}" URL segment
 * e.g. "10563114921-steal-an-egg" or "994732206-blox-fruits".
 */
export function buildGameSlugParam(game: {
  universeId: string | number;
  name?: string | null;
  slug?: string | null;
}): string {
  const id = String(game.universeId || '').replace(/[^0-9]/g, '');
  if (!id) return '';
  const cleanedName = game.name ? cleanSeoGameName(game.name) : '';
  const titleSlug =
    slugifyGameTitle(cleanedName) || slugifyGameTitle(game.slug || '');
  return titleSlug ? `${id}-${titleSlug}` : id;
}

/**
 * Builds the canonical game page path: "/g/{universeId}-{clean-slug}".
 */
export function buildGameUrlPath(game: {
  universeId: string | number;
  name?: string | null;
  slug?: string | null;
}): string {
  const segment = buildGameSlugParam(game);
  return `/g/${segment}`;
}

/**
 * Builds the canonical game updates path: "/g/{universeId}-{clean-slug}/updates".
 */
export function buildGameUpdatesUrlPath(game: {
  universeId: string | number;
  name?: string | null;
  slug?: string | null;
}): string {
  const segment = buildGameSlugParam(game);
  return `/g/${segment}/updates`;
}

/**
 * Serializes JSON-LD safely for inline <script type="application/ld+json">.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export interface CodeFaqItem {
  question: string;
  answer: string;
}

/**
 * Generates visible + Schema.org FAQPage entries for a Roblox game's analytics & revenue page.
 */
export function buildGameFaqItems(params: {
  gameName: string;
  creatorName: string;
  genre: string;
  currentCcu: number;
  peakCcu: number;
  totalVisitsFormatted: string;
  monthlyUsdFormatted: string;
  monthlyLowFormatted: string;
  monthlyHighFormatted: string;
  dailyUsdFormatted: string;
  yearlyUsdFormatted: string;
  monthlyRobuxFormatted: string;
  monthYear: string;
}): CodeFaqItem[] {
  const cleanName = cleanSeoGameName(params.gameName);
  const aliasEntry = findGameAliasEntry(cleanName);
  const aliasNote = aliasEntry
    ? ` (also searched as ${formatAliasPhrase(aliasEntry)})`
    : '';
  const ccuText = Math.round(params.currentCcu).toLocaleString('en-US');
  const peakText = Math.round(params.peakCcu).toLocaleString('en-US');

  return [
    {
      question: `How much money does ${cleanName} make a month?`,
      answer: `As of ${params.monthYear}, RoMetric estimates ${cleanName}${aliasNote} makes roughly ${params.monthlyUsdFormatted} per month (range ${params.monthlyLowFormatted} to ${params.monthlyHighFormatted}/mo, or about ${params.dailyUsdFormatted}/day and ${params.monthlyRobuxFormatted} Robux/month at DevEx rates) based on ${ccuText} live concurrent players and ${params.genre} monetization benchmarks.`,
    },
    {
      question: `How many people are playing ${cleanName} right now?`,
      answer: `${cleanName}${aliasNote} currently has ${ccuText} live concurrent players (CCU) on Roblox, with a tracked peak of ${peakText} concurrent players and ${params.totalVisitsFormatted} lifetime visits.`,
    },
    {
      question: `How much does ${cleanName} make in a year?`,
      answer: `At its current player run-rate, ${cleanName} is estimated to generate approximately ${params.yearlyUsdFormatted} per year in developer DevEx-equivalent revenue before studio expenses and team splits.`,
    },
    {
      question: `Who created ${cleanName} on Roblox?`,
      answer: `${cleanName} is developed and published by ${params.creatorName} in the ${params.genre} category on Roblox.`,
    },
  ];
}

/**
 * Generates visible + Schema.org FAQPage entries for a Roblox game's codes page.
 */
export function buildCodeFaqItems(params: {
  gameName: string;
  activeCount: number;
  expiredCount: number;
  monthYear: string;
  newestCode?: string | null;
}): CodeFaqItem[] {
  const cleanName = cleanSeoGameName(params.gameName);
  const aliasEntry = findGameAliasEntry(cleanName);
  const aliasNote = aliasEntry
    ? ` (${formatAliasPhrase(aliasEntry)})`
    : '';
  const { activeCount, expiredCount, monthYear, newestCode } = params;

  const workingAnswer =
    activeCount > 0
      ? `Yes — there ${activeCount === 1 ? 'is' : 'are'} currently ${activeCount} active and working ${cleanName}${aliasNote} ${activeCount === 1 ? 'code' : 'codes'} verified for ${monthYear}${newestCode ? `, including ${newestCode}` : ''}. Bookmark this page and check back after major game updates or player milestones for new drops.`
      : `There are no active ${cleanName}${aliasNote} codes confirmed right now for ${monthYear}. RoMetric automatically monitors ${cleanName} every few hours and adds new promo codes as soon as the developers release them.`;

  const redeemAnswer = `Open ${cleanName} in Roblox, look for the Codes button (often a Twitter/X bird icon, gift box, settings gear, or shop menu on the side of the screen), paste one of the active codes from RoMetric exactly as shown, and press Redeem to claim your reward.`;

  const notWorkingAnswer = `Roblox promo codes for ${cleanName} are usually case-sensitive and expire without warning after events or updates${expiredCount > 0 ? ` (${expiredCount} expired codes are archived on this page)` : ''}. Copy the code directly with the one-tap Copy button so there are no extra spaces, and check that it is not listed under Expired Codes.`;

  return [
    {
      question: `Are there any working ${cleanName} codes in ${monthYear}?`,
      answer: workingAnswer,
    },
    {
      question: `How do I redeem ${cleanName} codes on Roblox?`,
      answer: redeemAnswer,
    },
    {
      question: `Why is my ${cleanName} code not working?`,
      answer: notWorkingAnswer,
    },
  ];
}
