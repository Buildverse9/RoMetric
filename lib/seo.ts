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
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D★☆✦✧⚡✨🔥💎👑]/gu, ' ')
    // Strip leftover leading/trailing separators like "|", "-", ":", "•"
    .replace(/^[\s|\-:•·/]+|[\s|\-:•·/]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 2) {
    cleaned = original
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ')
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
  const match = String(rawParam || '').trim().match(/^(\d+)(?:-|$)/);
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
  const ccuText = Math.round(params.currentCcu).toLocaleString('en-US');
  const peakText = Math.round(params.peakCcu).toLocaleString('en-US');

  return [
    {
      question: `How much money does ${cleanName} make a month?`,
      answer: `As of ${params.monthYear}, RoMetric estimates ${cleanName} makes roughly ${params.monthlyUsdFormatted} per month (range ${params.monthlyLowFormatted} to ${params.monthlyHighFormatted}/mo, or about ${params.dailyUsdFormatted}/day and ${params.monthlyRobuxFormatted} Robux/month at DevEx rates) based on ${ccuText} live concurrent players and ${params.genre} monetization benchmarks.`,
    },
    {
      question: `How many people are playing ${cleanName} right now?`,
      answer: `${cleanName} currently has ${ccuText} live concurrent players (CCU) on Roblox, with a tracked peak of ${peakText} concurrent players and ${params.totalVisitsFormatted} lifetime visits.`,
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
  const { activeCount, expiredCount, monthYear, newestCode } = params;

  const workingAnswer =
    activeCount > 0
      ? `Yes — there ${activeCount === 1 ? 'is' : 'are'} currently ${activeCount} active and working ${cleanName} ${activeCount === 1 ? 'code' : 'codes'} verified for ${monthYear}${newestCode ? `, including ${newestCode}` : ''}. Bookmark this page and check back after major game updates or player milestones for new drops.`
      : `There are no active ${cleanName} codes confirmed right now for ${monthYear}. RoMetric automatically monitors ${cleanName} every few hours and adds new promo codes as soon as the developers release them.`;

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
