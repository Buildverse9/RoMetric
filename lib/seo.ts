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
 * Strips decorative emojis and noisy Roblox event prefixes (e.g. "[UPD 24]", "(EVENT)")
 * from a game name for cleaner, higher-CTR search result titles.
 */
export function cleanSeoGameName(rawName: string): string {
  const original = String(rawName || '').trim();
  if (!original) return 'Roblox Game';

  let cleaned = original
    // Strip leading bracketed/parenthesized update tags like "[UPD 12]" or "(Halloween)"
    .replace(/^(?:\s*[\[\(\{][^\]\)\}]{1,36}[\]\)\}]\s*)+/g, '')
    // Strip trailing bracketed update tags like "[EVENT]"
    .replace(/(?:\s*[\[\(\{][^\]\)\}]{1,36}[\]\)\}]\s*)+$/g, '')
    // Strip emojis & pictographs while keeping alphanumeric + standard punctuation
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ')
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
