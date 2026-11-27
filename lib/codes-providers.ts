import type {
  CodeProviderAdapter,
  ProviderDiscoveredCode,
  ProviderFetchResult,
  ProviderGameTarget,
} from './codes-types';
import { cleanSeoGameName } from './seo';

const USER_AGENT =
  'RoMetricCodesBot/2.0 (+https://rometrics.vercel.app; legitimate public API consumer)';

// Curated verified MediaWiki (Fandom & Wiki.gg) subdomains for major & trending Roblox experiences.
// New games not in this map still attempt safe wiki discovery via MediaWiki API + opensearch.
const KNOWN_WIKI_SUBDOMAINS: Array<{
  keywords: string[];
  subdomain: string;
  host?: 'fandom.com' | 'wiki.gg';
  pageTitles?: string[];
}> = [
  { keywords: ['blox fruits'], subdomain: 'blox-fruits', pageTitles: ['Codes'] },
  { keywords: ['pet simulator 99', 'pet sim 99'], subdomain: 'pet-simulator', pageTitles: ['Codes'] },
  { keywords: ['adopt me'], subdomain: 'adoptme', pageTitles: ['Codes'] },
  { keywords: ['brookhaven'], subdomain: 'brookhaven-rp', pageTitles: ['Codes'] },
  { keywords: ['blade ball'], subdomain: 'blade-ball', pageTitles: ['Codes'] },
  { keywords: ['dress to impress'], subdomain: 'dti-dress-to-impress', pageTitles: ['Codes'] },
  { keywords: ['anime defenders'], subdomain: 'animedefenders', pageTitles: ['Codes'] },
  { keywords: ['anime vanguards'], subdomain: 'animevanguards', pageTitles: ['Codes'] },
  { keywords: ['anime last stand'], subdomain: 'animelaststand', pageTitles: ['Codes'] },
  { keywords: ['anime reborn'], subdomain: 'animereborn', pageTitles: ['Codes'] },
  { keywords: ['anime royale'], subdomain: 'animeroyale', pageTitles: ['Codes'] },
  { keywords: ['anime rangers x', 'anime rangers'], subdomain: 'animerangersx', pageTitles: ['Codes'] },
  { keywords: ['fisch'], subdomain: 'fisch', host: 'wiki.gg', pageTitles: ['Codes'] },
  { keywords: ['fisch'], subdomain: 'fisch', pageTitles: ['Codes'] },
  { keywords: ['beeswarm', 'bee swarm simulator'], subdomain: 'bee-swarm-simulator', pageTitles: ['Codes'] },
  { keywords: ['shindo life', 'shinobi life'], subdomain: 'shindo-life-rell', pageTitles: ['Codes'] },
  { keywords: ['king legacy'], subdomain: 'king-legacy', pageTitles: ['Codes'] },
  { keywords: ['all star tower defense'], subdomain: 'allstartowerdefense', pageTitles: ['Codes'] },
  { keywords: ['tower defense simulator'], subdomain: 'tds', pageTitles: ['Codes'] },
  { keywords: ['tower defense x'], subdomain: 'tdx', pageTitles: ['Codes'] },
  { keywords: ['jailbreak'], subdomain: 'jailbreak', pageTitles: ['Codes'] },
  { keywords: ['murder mystery 2'], subdomain: 'murder-mystery-2', pageTitles: ['Codes'] },
  { keywords: ['toilet tower defense'], subdomain: 'toilet-tower-defense', pageTitles: ['Codes'] },
  { keywords: ['five nights td'], subdomain: 'five-nights-td', pageTitles: ['Codes'] },
  { keywords: ['rivals'], subdomain: 'robloxrivals', pageTitles: ['Codes'] },
  { keywords: ['blue lock rivals', 'blue lock: rivals'], subdomain: 'bluelockrivals', pageTitles: ['Codes'] },
  { keywords: ['sol\'s rng', 'sols rng'], subdomain: 'sol-rng', pageTitles: ['Codes'] },
  { keywords: ['fruit battlegrounds'], subdomain: 'fruitbattlegrounds', pageTitles: ['Codes'] },
  { keywords: ['grand piece online'], subdomain: 'grand-piece-online', pageTitles: ['Codes'] },
  { keywords: ['your bizarre adventure'], subdomain: 'your-bizarre-adventure', pageTitles: ['Codes'] },
  { keywords: ['a universal time'], subdomain: 'a-universal-time-roblox', pageTitles: ['Codes'] },
  { keywords: ['driving empire'], subdomain: 'driving-empire', pageTitles: ['Codes'] },
  { keywords: ['car dealership tycoon'], subdomain: 'car-dealership-tycoon', pageTitles: ['Codes'] },
  { keywords: ['da hood'], subdomain: 'dahood', pageTitles: ['Codes'] },
  { keywords: ['slap battles'], subdomain: 'roblox-slap-battles', pageTitles: ['Codes'] },
  { keywords: ['doors'], subdomain: 'doors-game', pageTitles: ['Codes'] },
  { keywords: ['pressure'], subdomain: 'urbanshade', host: 'wiki.gg', pageTitles: ['Codes'] },
  { keywords: ['peroxide'], subdomain: 'peroxide', pageTitles: ['Codes'] },
  { keywords: ['type soul', 'type://soul'], subdomain: 'typesoul', pageTitles: ['Codes'] },
  { keywords: ['jujutsu shenanigans'], subdomain: 'jujutsu-shenanigans', pageTitles: ['Codes'] },
  { keywords: ['jujutsu infinite'], subdomain: 'jujutsu-infinite', pageTitles: ['Codes'] },
  { keywords: ['the strongest battlegrounds'], subdomain: 'the-strongest-battlegrounds-rblx', pageTitles: ['Codes'] },
  { keywords: ['heroes battlegrounds'], subdomain: 'heroes-battlegrounds', pageTitles: ['Codes'] },
  { keywords: ['untitled boxing game'], subdomain: 'untitled-boxing-game', pageTitles: ['Codes'] },
  { keywords: ['anime adventures'], subdomain: 'animeadventures', pageTitles: ['Codes'] },
  { keywords: ['grow a garden'], subdomain: 'growagarden', pageTitles: ['Codes'] },
  { keywords: ['dead rails'], subdomain: 'dead-rails', pageTitles: ['Codes'] },
  { keywords: ['basketball zero'], subdomain: 'basketball-zero', pageTitles: ['Codes'] },
  { keywords: ['volleyball legends', 'haikyuu legends'], subdomain: 'volleyball-legends', pageTitles: ['Codes'] },
  { keywords: ['arise crossover'], subdomain: 'arise-crossover', pageTitles: ['Codes'] },
  { keywords: ['sponge bob tower defense', 'spongebob tower defense'], subdomain: 'spongebob-tower-defense', pageTitles: ['Codes'] },
  { keywords: ['bubble gum simulator infinity'], subdomain: 'bgsi', pageTitles: ['Codes'] },
  { keywords: ['dandy\'s world', 'dandys world'], subdomain: 'dandys-world-robloxhorror', pageTitles: ['Codes'] },
  { keywords: ['attack on titan revolution'], subdomain: 'aotrevolution', pageTitles: ['Codes'] },
  { keywords: ['bedwars'], subdomain: 'robloxbedwars', pageTitles: ['Codes'] },
  { keywords: ['arsenal'], subdomain: 'roblox-arsenal', pageTitles: ['Codes'] },
  { keywords: ['build a boat'], subdomain: 'build-a-boat-for-treasure', pageTitles: ['Codes'] },
  { keywords: ['loomian legacy'], subdomain: 'loomian-legacy', pageTitles: ['Codes'] },
  { keywords: ['doodle world'], subdomain: 'doodle-world', pageTitles: ['Codes'] },
  { keywords: ['creatures of sonaria'], subdomain: 'creatures-of-sonaria-official', pageTitles: ['Codes'] },
  { keywords: ['dragon adventures'], subdomain: 'dragon-adventures', pageTitles: ['Codes'] },
  { keywords: ['regretevator'], subdomain: 'regretevator', pageTitles: ['Codes'] },
  { keywords: ['forsaken'], subdomain: 'forsaken2024', pageTitles: ['Codes'] },
  { keywords: ['99 nights in the forest'], subdomain: '99-nights-in-the-forest', pageTitles: ['Codes'] },
  { keywords: ['steal an egg'], subdomain: 'steal-an-egg', pageTitles: ['Codes'] },
  { keywords: ['steal a brainrot'], subdomain: 'steal-a-brainrot', pageTitles: ['Codes'] },
  { keywords: ['grow and build giants'], subdomain: 'grow-and-build-giants', pageTitles: ['Codes'] },
  { keywords: ['project slayers'], subdomain: 'project-slayers', pageTitles: ['Codes'] },
  { keywords: ['demonfall'], subdomain: 'demonfall', pageTitles: ['Codes'] },
  { keywords: ['deepwoken'], subdomain: 'deepwoken', pageTitles: ['Codes'] },
  { keywords: ['guts & blackpowder', 'guts and blackpowder'], subdomain: 'gbp', pageTitles: ['Codes'] },
  { keywords: ['restaurant tycoon'], subdomain: 'restaurant-tycoon-2', pageTitles: ['Codes'] },
  { keywords: ['muscle legends'], subdomain: 'muscle-legends', pageTitles: ['Codes'] },
  { keywords: ['ninja legends'], subdomain: 'ninja-legends', pageTitles: ['Codes'] },
  { keywords: ['legends of speed'], subdomain: 'legends-of-speed', pageTitles: ['Codes'] },
  { keywords: ['strongman simulator'], subdomain: 'strongman-simulator', pageTitles: ['Codes'] },
  { keywords: ['arm wrestle simulator'], subdomain: 'arm-wrestle-simulator', pageTitles: ['Codes'] },
  { keywords: ['anime fighters'], subdomain: 'anime-fighters-simulator', pageTitles: ['Codes'] },
  { keywords: ['anime champions'], subdomain: 'anime-champions-simulator', pageTitles: ['Codes'] },
  { keywords: ['combat warriors'], subdomain: 'combat-warriors', pageTitles: ['Codes'] },
  { keywords: ['phantom forces'], subdomain: 'roblox-phantom-forces', pageTitles: ['Codes'] },
  { keywords: ['bad business'], subdomain: 'bad-business', pageTitles: ['Codes'] },
  { keywords: ['my hero mania'], subdomain: 'my-hero-mania', pageTitles: ['Codes'] },
  { keywords: ['haze piece'], subdomain: 'haze-piece', pageTitles: ['Codes'] },
  { keywords: ['bloxburg'], subdomain: 'welcome-to-bloxburg', pageTitles: ['Codes'] },
  { keywords: ['royale high'], subdomain: 'royale-high', pageTitles: ['Codes'] },
];

// Simple short-lived server cache to avoid unnecessary repeated external API calls
const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
const RESPONSE_CACHE_TTL_MS = 10 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizePromoCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

export function sanitizePlainText(
  raw: string | null | undefined,
  maxLen = 240
): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

/**
 * Validates that an external URL is strictly HTTPS and does not target
 * private, loopback, or cloud metadata addresses (SSRF protection).
 */
export function validatePublicHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return null;
    }
    return parsed.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export function isValidPromoCodeFormat(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > 42) return false;
  if (!/^[A-Za-z0-9_!@#$%&*+?-]+(?: [A-Za-z0-9_!@#$%&*+?-]+)*$/.test(trimmed)) return false;
  // Reject obvious common non-code English words or pure punctuation
  const upper = trimmed.toUpperCase();
  const stopWords = new Set([
    'CODE',
    'CODES',
    'FREE',
    'HERE',
    'NEW',
    'SOON',
    'LIKES',
    'LIKE',
    'GAME',
    'PLAY',
    'ROBLOX',
    'UPDATE',
    'ACTIVE',
    'EXPIRED',
    'REWARD',
    'REWARDS',
    'DISCORD',
    'TWITTER',
    'YOUTUBE',
    'GROUP',
    'JOIN',
    'CLICK',
    'HTTP',
    'HTTPS',
    'NONE',
    'TBD',
    'TBA',
    'N/A',
    'UNKNOWN',
    'WORKING',
    'STATUS',
    'DATE',
    'ADDED',
    'EXPIRE',
    'NOTES',
    'DESCRIPTION',
  ]);
  if (stopWords.has(upper)) return false;
  if (/^[^A-Za-z0-9]+$/.test(trimmed)) return false;
  return true;
}

async function fetchJsonWithBackoff<T>(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRetries?: number;
  } = {}
): Promise<{ data: T | null; apiRequests: number; http429Count: number; status: number }> {
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      data: cached.data as T,
      apiRequests: 0,
      http429Count: 0,
      status: 200,
    };
  }

  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 9_000;
  let apiRequests = 0;
  let http429Count = 0;
  let lastStatus = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    apiRequests += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          ...(options.headers ?? {}),
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      lastStatus = res.status;

      if (res.status === 429) {
        http429Count += 1;
        if (attempt < maxRetries) {
          const retryAfterSec = Number(res.headers.get('retry-after') || '0');
          const backoffMs =
            retryAfterSec > 0
              ? Math.min(retryAfterSec * 1000, 6000)
              : 750 * Math.pow(2, attempt);
          await sleep(backoffMs);
          continue;
        }
        return { data: null, apiRequests, http429Count, status: 429 };
      }

      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }

      if (!res.ok) {
        return { data: null, apiRequests, http429Count, status: res.status };
      }

      const json = (await res.json()) as T;
      responseCache.set(url, {
        data: json,
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
      });
      return { data: json, apiRequests, http429Count, status: res.status };
    } catch {
      clearTimeout(timer);
      if (attempt < maxRetries) {
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
      return { data: null, apiRequests, http429Count, status: 0 };
    }
  }

  return { data: null, apiRequests, http429Count, status: lastStatus };
}

/**
 * Extracts explicit developer-announced promo codes from official Roblox
 * game descriptions or public group shouts using strict high-precision patterns.
 * Never fabricates rewards or expiry dates.
 */
export function extractCodesFromOfficialText(
  text: string | null | undefined,
  sourceUrl: string
): ProviderDiscoveredCode[] {
  if (!text || text.length < 6) return [];

  const found = new Map<string, ProviderDiscoveredCode>();
  const lines = text.split(/\r?\n/);

  const explicitPatterns: RegExp[] = [
    /(?:use|redeem|new|latest|active|free|milestone|current|promo)?\s*codes?\s*[:=\-–—]\s*["'`*]?([A-Za-z0-9_!@#$%&*+?-]{3,36})["'`*]?(?:\s*(?:[-–—:|(]\s*([^\n]{3,90})))?/gi,
    /(?:use|redeem)\s+code\s+["'`]([A-Za-z0-9_!@#$%&*+?-]{3,36})["'`](?:\s*(?:for|to get|[-–—:])\s*([^\n]{3,90}))?/gi,
    /(?:use|redeem)\s+code\s+([A-Z0-9_!]{4,30})(?:\s+(?:for|to get)\s+([^\n.!]{3,80}))?/g,
  ];

  // Also detect comma-separated code lists like "Codes: RELEASE, 50KLIKES, UPD2"
  const multiListRegex = /(?:active|working|new|free|current)?\s*codes\s*[:=]\s*([^\n]{6,220})/gi;
  let inCodesSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length > 340) {
      if (!line) inCodesSection = false;
      continue;
    }

    if (/^(?:🎁|🔥|✨|⭐|👍|💎|🎉|\W)*\s*(?:active|working|new|latest|free)?\s*codes\s*[:!]?\s*$/i.test(line)) {
      inCodesSection = true;
      continue;
    }

    // Skip milestone tease lines like "New code at 100k likes!" unless a code is explicitly given after : or quotes
    if (/new\s+code\s+at\s+\d/i.test(line) && !/[:="'`]/.test(line)) continue;

    // If inside a dedicated "Codes:" bullet block, pick up bulleted tokens like "- RELEASE (Free Cash)"
    if (inCodesSection) {
      const bulletCodeMatch = line.match(
        /^(?:[-•*🔹🔸✅🎁⭐]+|\d+[.)])\s*["'`]?([A-Za-z0-9_!@#$%&*+?-]{3,32})["'`]?(?:\s*(?:[-–—:|(]\s*([^\n]{2,90})))?$/
      );
      if (bulletCodeMatch) {
        const candidate = (bulletCodeMatch[1] || '').replace(/[.,;!?)]+$/, '').trim();
        if (isValidPromoCodeFormat(candidate) && /[A-Z0-9]/.test(candidate)) {
          const norm = normalizePromoCode(candidate);
          if (!found.has(norm)) {
            const isMarkedExpired = /\b(expired|old|inactive|no longer)\b/i.test(line);
            found.set(norm, {
              code: candidate,
              rewardDescription: bulletCodeMatch[2]
                ? sanitizePlainText(bulletCodeMatch[2].replace(/\)+$/, ''), 140)
                : null,
              status: isMarkedExpired ? 'expired' : 'active',
              sourceReportedStatus: isMarkedExpired
                ? 'expired_in_official_text'
                : 'announced_in_official_text',
              sourceUrl,
              expiresAt: null,
            });
          }
        }
      }
    }

    // Comma-separated multi-code lines: "Codes: RELEASE, 10KLIKES, FREESPIN"
    multiListRegex.lastIndex = 0;
    let listMatch: RegExpExecArray | null;
    while ((listMatch = multiListRegex.exec(line)) !== null) {
      const segment = listMatch[1] || '';
      if (segment.includes(',') || segment.includes('/')) {
        const parts = segment.split(/[,/]+/);
        for (const part of parts) {
          const token = part.trim().replace(/^["'`*]+|["'`*.,;!?)]+$/g, '');
          if (
            token.length >= 3 &&
            token.length <= 32 &&
            !token.includes(' ') &&
            isValidPromoCodeFormat(token) &&
            /[A-Z0-9]/.test(token)
          ) {
            const norm = normalizePromoCode(token);
            if (!found.has(norm)) {
              const isMarkedExpired = /\b(expired|old|inactive)\b/i.test(line);
              found.set(norm, {
                code: token,
                rewardDescription: null,
                status: isMarkedExpired ? 'expired' : 'active',
                sourceReportedStatus: isMarkedExpired
                  ? 'expired_in_official_text'
                  : 'announced_in_official_text',
                sourceUrl,
                expiresAt: null,
              });
            }
          }
        }
      }
    }

    for (const regex of explicitPatterns) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const candidate = (match[1] || '').replace(/[.,;!?)]+$/, '').trim();
        if (!isValidPromoCodeFormat(candidate)) continue;
        // Require at least one uppercase letter or digit for official announcement safety
        if (!/[A-Z0-9]/.test(candidate)) continue;

        const norm = normalizePromoCode(candidate);
        if (found.has(norm)) continue;

        const rawReward = match[2]
          ? sanitizePlainText(match[2].replace(/\)+$/, ''), 140)
          : null;

        const isMarkedExpired = /\b(expired|old|inactive|no longer)\b/i.test(line);

        found.set(norm, {
          code: candidate,
          rewardDescription: rawReward,
          status: isMarkedExpired ? 'expired' : 'active',
          sourceReportedStatus: isMarkedExpired
            ? 'expired_in_official_text'
            : 'announced_in_official_text',
          sourceUrl,
          expiresAt: null,
        });
      }
    }
  }

  return Array.from(found.values()).slice(0, 30);
}

/**
 * Extracts official public Trello board IDs linked inside Roblox game/group descriptions
 * (strictly allowlisted to trello.com/b/{id} to prevent SSRF).
 */
export function extractTrelloBoardIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.matchAll(/https?:\/\/(?:www\.)?trello\.com\/b\/([A-Za-z0-9]{6,24})/gi);
  const out = new Set<string>();
  for (const m of matches) {
    if (m[1]) out.add(m[1]);
  }
  return Array.from(out).slice(0, 2);
}

interface TrelloBoardJson {
  name?: string;
  url?: string;
  lists?: Array<{ id: string; name: string; closed?: boolean }>;
  cards?: Array<{ id: string; idList: string; name: string; desc?: string; closed?: boolean }>;
}

async function fetchCodesFromOfficialTrelloBoard(
  boardId: string
): Promise<{ codes: ProviderDiscoveredCode[]; apiRequests: number; http429Count: number }> {
  if (!/^[A-Za-z0-9]{6,24}$/.test(boardId)) {
    return { codes: [], apiRequests: 0, http429Count: 0 };
  }
  const boardUrl = `https://trello.com/b/${boardId}`;
  const res = await fetchJsonWithBackoff<TrelloBoardJson>(`${boardUrl}.json`, {
    timeoutMs: 5_000,
    maxRetries: 1,
  });
  const data = res.data;
  if (!data || !Array.isArray(data.lists) || !Array.isArray(data.cards)) {
    return { codes: [], apiRequests: res.apiRequests, http429Count: res.http429Count };
  }

  const listStatusById = new Map<string, 'active' | 'expired'>();
  for (const list of data.lists) {
    if (list.closed || !list.name) continue;
    const lower = list.name.toLowerCase();
    if (!/\bcode(s)?\b/.test(lower)) continue;
    if (/\b(expired|old|inactive|disabled|removed)\b/.test(lower)) {
      listStatusById.set(list.id, 'expired');
    } else {
      listStatusById.set(list.id, 'active');
    }
  }

  if (listStatusById.size === 0) {
    return { codes: [], apiRequests: res.apiRequests, http429Count: res.http429Count };
  }

  const found = new Map<string, ProviderDiscoveredCode>();
  for (const card of data.cards) {
    if (card.closed || !listStatusById.has(card.idList)) continue;
    const listStatus = listStatusById.get(card.idList) || 'active';
    const rawName = (card.name || '').trim();
    if (!rawName) continue;

    // Cards can be formatted as "CODE123 - 2x EXP" or just "CODE123" with reward in card.desc
    const splitMatch = rawName.match(
      /^["'`]?([A-Za-z0-9_!@#$%&*+?-]{3,36})["'`]?(?:\s*[-–—:|(]\s*(.+))?$/
    );
    const candidate = splitMatch?.[1]?.replace(/[.,;!?)]+$/, '').trim() || '';
    if (candidate && isValidPromoCodeFormat(candidate)) {
      const norm = normalizePromoCode(candidate);
      if (!found.has(norm)) {
        const inlineReward = splitMatch?.[2]
          ? sanitizePlainText(splitMatch[2].replace(/\)+$/, ''), 160)
          : null;
        const descReward = !inlineReward && card.desc
          ? sanitizePlainText(card.desc.split(/\r?\n/)[0], 160)
          : null;
        const isExpired =
          listStatus === 'expired' || /\b(expired|inactive|invalid)\b/i.test(rawName);
        found.set(norm, {
          code: candidate,
          rewardDescription: inlineReward || descReward,
          status: isExpired ? 'expired' : 'active',
          sourceReportedStatus: isExpired ? 'trello_expired' : 'trello_active',
          sourceUrl: validatePublicHttpsUrl(data.url) || boardUrl,
          expiresAt: null,
        });
      }
    }

    // Also scan card descriptions in case a single "Active Codes" card lists multiple codes
    if (card.desc) {
      for (const extracted of extractCodesFromOfficialText(
        card.desc,
        validatePublicHttpsUrl(data.url) || boardUrl
      )) {
        const norm = normalizePromoCode(extracted.code);
        if (!found.has(norm)) {
          found.set(norm, {
            ...extracted,
            status: listStatus === 'expired' ? 'expired' : extracted.status,
            sourceReportedStatus:
              listStatus === 'expired' ? 'trello_expired' : 'trello_active',
          });
        }
      }
    }
  }

  return {
    codes: Array.from(found.values()).slice(0, 60),
    apiRequests: res.apiRequests,
    http429Count: res.http429Count,
  };
}

/**
 * Parses standard MediaWiki wikitext (tables and bulleted lists) from community
 * wiki `Codes` pages into structured Active and Expired code records.
 */
export function parseMediaWikiCodesWikitext(
  wikitext: string,
  wikiPageUrl: string
): ProviderDiscoveredCode[] {
  if (!wikitext || wikitext.length < 20) return [];

  const results = new Map<string, ProviderDiscoveredCode>();
  const lines = wikitext.split(/\r?\n/);

  let sectionState: 'active' | 'expired' | 'unknown' = 'unknown';
  let inTable = false;
  let currentRowCells: string[] = [];

  const flushTableRow = () => {
    if (currentRowCells.length === 0) return;
    const rawCodeCell = sanitizePlainText(currentRowCells[0], 64);
    if (!rawCodeCell) {
      currentRowCells = [];
      return;
    }

    // Grab first token if cell contains extra parenthetical notes like "CODE123 (NEW!)"
    const codeToken = rawCodeCell
      .replace(/\(new!?\)/gi, '')
      .replace(/\[new\]/gi, '')
      .trim()
      .split(/\s+/)[0]
      ?.replace(/^["'`]+|["'`,.:;]+$/g, '');

    if (codeToken && isValidPromoCodeFormat(codeToken)) {
      const norm = normalizePromoCode(codeToken);
      const rewardCell = currentRowCells[1]
        ? sanitizePlainText(currentRowCells[1], 180)
        : null;
      const statusCell = currentRowCells[2]
        ? sanitizePlainText(currentRowCells[2], 60)
        : null;

      let status: 'active' | 'expired' =
        sectionState === 'expired' ? 'expired' : 'active';

      if (statusCell) {
        if (/\b(expired|inactive|invalid|disabled|no)\b/i.test(statusCell)) {
          status = 'expired';
        } else if (/\b(active|working|valid|yes)\b/i.test(statusCell)) {
          status = 'active';
        }
      }

      if (!results.has(norm)) {
        results.set(norm, {
          code: codeToken,
          rewardDescription:
            rewardCell && !/^(active|working|expired|yes|no|-|n\/a)$/i.test(rewardCell)
              ? rewardCell
              : null,
          status,
          sourceReportedStatus:
            status === 'active'
              ? 'wiki_active'
              : status === 'expired'
                ? 'wiki_expired'
                : 'wiki_listed',
          sourceUrl: wikiPageUrl,
          expiresAt: null,
        });
      }
    }
    currentRowCells = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Detect section headings == Active Codes == / == Expired Codes ==
    const headingMatch = line.match(/^={2,4}\s*([^=]+?)\s*={2,4}$/);
    if (headingMatch) {
      flushTableRow();
      const heading = headingMatch[1].toLowerCase();
      if (
        /\b(expired|inactive|old|removed|previous|outdated|archived)\b/.test(
          heading
        )
      ) {
        sectionState = 'expired';
      } else if (
        /\b(active|working|current|valid|available|new|all)\b/.test(heading)
      ) {
        sectionState = 'active';
      }
      continue;
    }

    // Wiki table parsing
    if (line.startsWith('{|')) {
      inTable = true;
      currentRowCells = [];
      continue;
    }
    if (line.startsWith('|}')) {
      flushTableRow();
      inTable = false;
      continue;
    }
    if (inTable) {
      if (line.startsWith('|-')) {
        flushTableRow();
        continue;
      }
      if (line.startsWith('!')) {
        // Table header row
        continue;
      }
      if (line.startsWith('|')) {
        const content = line.slice(1);
        const splitCells = content.split('||');
        for (const c of splitCells) {
          // Strip MediaWiki cell attributes like `style="..." | Actual Text`
          const pipeIdx = c.indexOf('|');
          const cellVal =
            pipeIdx !== -1 && /(=|style|align|class|colspan|rowspan)/i.test(c.slice(0, pipeIdx))
              ? c.slice(pipeIdx + 1)
              : c;
          currentRowCells.push(cellVal.trim());
        }
        continue;
      }
    }

    // Template row parsing: {{Code|CODE123|Reward|Active}} or {{CodeRow|code=...|reward=...}}
    const tplMatch = line.match(
      /^\{\{\s*(?:Code|CodesRow|CodeRow|PromoCode|CodeTableRow)\s*\|([^}]+)\}\}/i
    );
    if (tplMatch) {
      const parts = tplMatch[1].split('|').map((p) => p.trim());
      let rawCode = '';
      let rawReward: string | null = null;
      let rawStatus = '';
      for (const p of parts) {
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1) {
          const k = p.slice(0, eqIdx).trim().toLowerCase();
          const v = p.slice(eqIdx + 1).trim();
          if (k === 'code' || k === '1' || k === 'name') rawCode = v;
          else if (k === 'reward' || k === 'rewards' || k === '2' || k === 'effect') rawReward = v;
          else if (k === 'status' || k === '3' || k === 'state') rawStatus = v;
        } else if (!rawCode) {
          rawCode = p;
        } else if (!rawReward) {
          rawReward = p;
        } else if (!rawStatus) {
          rawStatus = p;
        }
      }
      const cleanToken = sanitizePlainText(rawCode, 48)?.split(/\s+/)[0] || '';
      if (cleanToken && isValidPromoCodeFormat(cleanToken)) {
        const norm = normalizePromoCode(cleanToken);
        if (!results.has(norm)) {
          let status: 'active' | 'expired' =
            sectionState === 'expired' ? 'expired' : 'active';
          if (/\b(expired|inactive|invalid|no)\b/i.test(rawStatus)) status = 'expired';
          else if (/\b(active|working|valid|yes)\b/i.test(rawStatus)) status = 'active';
          results.set(norm, {
            code: cleanToken,
            rewardDescription: sanitizePlainText(rawReward, 180),
            status,
            sourceReportedStatus: status === 'active' ? 'wiki_active' : 'wiki_expired',
            sourceUrl: wikiPageUrl,
            expiresAt: null,
          });
        }
      }
      continue;
    }

    // Bulleted list parsing: * '''CODE123''' - 2x XP for 20 minutes
    if (line.startsWith('*')) {
      const bulletMatch = line.match(
        /^\*+\s*(?:'''|<code>|<b>|`|\*\*|")?([A-Za-z0-9_!@#$%&*+?-]{3,36})(?:'''|<\/code>|<\/b>|`|\*\*|")?\s*(?:[-–—:]\s*(.+))?$/i
      );
      if (bulletMatch) {
        const codeToken = bulletMatch[1].trim();
        if (isValidPromoCodeFormat(codeToken)) {
          const norm = normalizePromoCode(codeToken);
          if (!results.has(norm)) {
            const reward = sanitizePlainText(bulletMatch[2], 180);
            const status: 'active' | 'expired' =
              sectionState === 'expired' ? 'expired' : 'active';
            results.set(norm, {
              code: codeToken,
              rewardDescription: reward,
              status,
              sourceReportedStatus:
                status === 'active'
                  ? 'wiki_active'
                  : status === 'expired'
                    ? 'wiki_expired'
                    : 'wiki_listed',
              sourceUrl: wikiPageUrl,
              expiresAt: null,
            });
          }
        }
      }
    }
  }

  flushTableRow();
  return Array.from(results.values()).slice(0, 100);
}

interface WikiCandidateTarget {
  subdomain: string;
  host: 'fandom.com' | 'wiki.gg';
  pageTitles: string[];
}

function resolveWikiCandidateTargets(target: ProviderGameTarget): WikiCandidateTarget[] {
  const candidates: WikiCandidateTarget[] = [];
  const seen = new Set<string>();
  const pushCandidate = (
    subdomain: string,
    host: 'fandom.com' | 'wiki.gg' = 'fandom.com',
    pageTitles: string[] = ['Codes', 'Promo_Codes']
  ) => {
    const cleanSub = subdomain.toLowerCase().trim();
    if (!/^[a-z0-9-]{2,48}$/.test(cleanSub)) return;
    const key = `${host}:${cleanSub}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ subdomain: cleanSub, host, pageTitles });
  };

  if (target.wikiSubdomain) {
    pushCandidate(target.wikiSubdomain, 'fandom.com');
  }

  const cleanName = cleanSeoGameName(target.name);
  const lowerClean = cleanName.toLowerCase();
  const lowerRaw = target.name.toLowerCase();

  for (const entry of KNOWN_WIKI_SUBDOMAINS) {
    if (
      entry.keywords.some(
        (kw) => lowerClean.includes(kw) || lowerRaw.includes(kw)
      )
    ) {
      pushCandidate(
        entry.subdomain,
        entry.host || 'fandom.com',
        entry.pageTitles || ['Codes']
      );
    }
  }

  // Generate clean hyphenated & compacted wiki slug candidates from cleaned game name
  const cleanSlug = cleanName
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  const compactSlug = cleanSlug.replace(/-/g, '');

  if (cleanSlug.length >= 4) {
    pushCandidate(cleanSlug, 'fandom.com');
    pushCandidate(cleanSlug, 'wiki.gg', ['Codes']);
  }
  if (compactSlug.length >= 4 && compactSlug !== cleanSlug) {
    pushCandidate(compactSlug, 'fandom.com', ['Codes']);
  }

  return candidates.slice(0, 4);
}

/**
 * Provider 1: Official Roblox Public Signals + Linked Developer Trello Boards
 * Reads developer-written game descriptions, public group shouts & group descriptions,
 * plus any official public Trello board linked inside those descriptions.
 */
export const robloxOfficialSignalsProvider: CodeProviderAdapter = {
  id: 'roblox_official_signals',
  name: 'Roblox Official Descriptions, Group Shouts & Trello Boards',
  providerType: 'roblox_official',
  requiresApiKey: false,
  isConfigured: () => true,

  async fetchForGame(target: ProviderGameTarget): Promise<ProviderFetchResult> {
    let apiRequests = 0;
    let http429Count = 0;
    const discovered = new Map<string, ProviderDiscoveredCode>();
    let description = target.description;

    // Refresh live description if missing
    if (!description) {
      const gameRes = await fetchJsonWithBackoff<{
        data?: Array<{ description?: string | null }>;
      }>(
        `https://games.roblox.com/v1/games?universeIds=${encodeURIComponent(target.universeId)}`
      );
      apiRequests += gameRes.apiRequests;
      http429Count += gameRes.http429Count;
      description = gameRes.data?.data?.[0]?.description ?? null;
    }

    const gameUrl = `https://www.roblox.com/games/${target.rootPlaceId}`;
    for (const c of extractCodesFromOfficialText(description, gameUrl)) {
      discovered.set(normalizePromoCode(c.code), c);
    }

    const trelloTextParts: string[] = [];
    if (description) trelloTextParts.push(description);

    // If creator is a Group, inspect BOTH public group shout AND group description
    if (target.creatorType === 'Group' && /^[0-9]+$/.test(target.creatorId)) {
      const groupRes = await fetchJsonWithBackoff<{
        description?: string | null;
        shout?: { body?: string | null } | null;
      }>(`https://groups.roblox.com/v1/groups/${target.creatorId}`);
      apiRequests += groupRes.apiRequests;
      http429Count += groupRes.http429Count;

      const groupUrl = `https://www.roblox.com/groups/${target.creatorId}`;
      const shoutBody = groupRes.data?.shout?.body;
      const groupDesc = groupRes.data?.description;
      if (shoutBody) {
        trelloTextParts.push(shoutBody);
        for (const c of extractCodesFromOfficialText(shoutBody, groupUrl)) {
          const norm = normalizePromoCode(c.code);
          if (!discovered.has(norm)) {
            discovered.set(norm, c);
          }
        }
      }
      if (groupDesc) {
        trelloTextParts.push(groupDesc);
        for (const c of extractCodesFromOfficialText(groupDesc, groupUrl)) {
          const norm = normalizePromoCode(c.code);
          if (!discovered.has(norm)) {
            discovered.set(norm, c);
          }
        }
      }
    }

    // Check any official developer Trello board linked in the game or group description
    const trelloIds = extractTrelloBoardIds(trelloTextParts.join('\n'));
    for (const boardId of trelloIds) {
      const trelloRes = await fetchCodesFromOfficialTrelloBoard(boardId);
      apiRequests += trelloRes.apiRequests;
      http429Count += trelloRes.http429Count;
      for (const c of trelloRes.codes) {
        const norm = normalizePromoCode(c.code);
        if (!discovered.has(norm)) {
          discovered.set(norm, c);
        }
      }
    }

    const codes = Array.from(discovered.values());
    return {
      hasProviderData: codes.length > 0,
      codes,
      apiRequests,
      http429Count,
    };
  },
};

/**
 * Provider 2: Community Wiki MediaWiki Action API (Fandom + Wiki.gg, CC BY-SA)
 * Uses official documented MediaWiki `api.php?action=parse` JSON endpoints
 * across Fandom and Wiki.gg with opensearch fallback and mandatory CC BY-SA attribution.
 */
export const fandomMediaWikiProvider: CodeProviderAdapter = {
  id: 'fandom_mediawiki_api',
  name: 'Community Wikis (Fandom & Wiki.gg MediaWiki API)',
  providerType: 'mediawiki',
  requiresApiKey: false,
  isConfigured: () => true,

  async fetchForGame(target: ProviderGameTarget): Promise<ProviderFetchResult> {
    const candidates = resolveWikiCandidateTargets(target);
    let apiRequests = 0;
    let http429Count = 0;

    for (const candidate of candidates) {
      for (const title of candidate.pageTitles) {
        const endpoint = `https://${candidate.subdomain}.${candidate.host}/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&redirects=1&format=json&formatversion=2`;
        const res = await fetchJsonWithBackoff<{
          parse?: { title?: string; wikitext?: string };
          error?: { code?: string };
        }>(endpoint, { timeoutMs: 4_500, maxRetries: 1 });

        apiRequests += res.apiRequests;
        http429Count += res.http429Count;

        const wikitext = res.data?.parse?.wikitext;
        if (!wikitext) {
          // If wiki host itself didn't respond (404/network), skip remaining pageTitles for this host
          if (res.status === 0 || res.status === 404 || res.status === 410) break;
          continue;
        }

        const pageTitle = encodeURIComponent(
          (res.data?.parse?.title || title).replace(/ /g, '_')
        );
        const wikiUrl = `https://${candidate.subdomain}.${candidate.host}/wiki/${pageTitle}`;
        const codes = parseMediaWikiCodesWikitext(wikitext, wikiUrl);

        if (codes.length > 0) {
          return {
            hasProviderData: true,
            codes,
            resolvedWikiSubdomain:
              candidate.host === 'fandom.com' ? candidate.subdomain : null,
            apiRequests,
            http429Count,
          };
        }
      }
    }

    return {
      hasProviderData: false,
      codes: [],
      apiRequests,
      http429Count,
    };
  },
};

const DEFAULT_BLOXARCHIVE_BASE_URL = 'https://bloxarchive.com/api/partner/v1';

interface BloxArchiveCodeItem {
  code?: string;
  value?: string;
  reward?: string | null;
  rewards?: string | null;
  description?: string | null;
  status?: string;
  verified?: boolean;
  expired?: boolean;
  first_seen_at?: string | null;
  expired_at?: string | null;
  expiresAt?: string | null;
  expires_at?: string | null;
}

interface BloxArchiveGamePayload {
  locale?: string;
  url?: string;
  pageUrl?: string;
  slug?: string;
  game?: {
    slug?: string;
    name?: string;
    title?: string;
    code_kind?: string;
    icon_url?: string;
    thumb_url?: string;
    root_place_id?: number;
    playing?: number;
    codes_checked_at?: string;
    url?: string;
  };
  codes?:
    | BloxArchiveCodeItem[]
    | {
        active?: BloxArchiveCodeItem[];
        pending?: BloxArchiveCodeItem[];
        expired?: BloxArchiveCodeItem[];
      };
  active?: BloxArchiveCodeItem[];
  active_codes?: BloxArchiveCodeItem[];
  confirmed?: BloxArchiveCodeItem[];
  pending?: BloxArchiveCodeItem[];
  pending_codes?: BloxArchiveCodeItem[];
  expired?: BloxArchiveCodeItem[];
  expired_codes?: BloxArchiveCodeItem[];
  attribution?: {
    required?: boolean;
    url?: string;
    html?: string;
  };
  notice?: string | null;
  data?: {
    url?: string;
    pageUrl?: string;
    codes?:
      | BloxArchiveCodeItem[]
      | {
          active?: BloxArchiveCodeItem[];
          pending?: BloxArchiveCodeItem[];
          expired?: BloxArchiveCodeItem[];
        };
    active_codes?: BloxArchiveCodeItem[];
    expired_codes?: BloxArchiveCodeItem[];
  };
}

/**
 * Provider 3: BloxArchive Partner JSON API v1 (Server-Side Key Required)
 * Uses official https://bloxarchive.com/api/partner/v1 endpoints with X-API-Key.
 * Disabled unless BLOXARCHIVE_API_KEY is configured in server env vars.
 * Always preserves mandatory visible backlink attribution to bloxarchive.com.
 */
export const bloxArchiveProvider: CodeProviderAdapter = {
  id: 'bloxarchive_api',
  name: 'BloxArchive JSON API',
  providerType: 'bloxarchive',
  requiresApiKey: true,

  isConfigured: () => {
    const key = process.env.BLOXARCHIVE_API_KEY?.trim();
    const customBase = process.env.BLOXARCHIVE_API_BASE_URL?.trim();
    if (!key) return false;
    if (customBase && !validatePublicHttpsUrl(customBase)) return false;
    return true;
  },

  async fetchForGame(target: ProviderGameTarget): Promise<ProviderFetchResult> {
    const apiKey = process.env.BLOXARCHIVE_API_KEY?.trim();
    const baseUrl =
      validatePublicHttpsUrl(process.env.BLOXARCHIVE_API_BASE_URL) ||
      DEFAULT_BLOXARCHIVE_BASE_URL;

    if (!apiKey) {
      return {
        hasProviderData: false,
        codes: [],
        apiRequests: 0,
        http429Count: 0,
        error:
          'BloxArchive API key not configured in server environment variables.',
      };
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const candidateSlugs = new Set<string>();

    const addCandidate = (str: string | null | undefined) => {
      if (!str) return;
      const clean = str
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!clean) return;
      if (!clean.endsWith('-codes')) {
        candidateSlugs.add(`${clean}-codes`);
      }
      candidateSlugs.add(clean);
    };

    // 1. From cleaned game name (strips "[💗UPD 21.5⛩️]" event prefixes so BloxArchive matches!)
    if (target.name) {
      const cleanedName = cleanSeoGameName(target.name);
      addCandidate(cleanedName.replace(/['’]/g, ''));
      addCandidate(cleanedName);
    }

    // 2. From target slug (e.g. "blox-fruits" -> "blox-fruits-codes")
    addCandidate(target.slug);

    // 3. Fallback raw name
    if (target.name) {
      addCandidate(target.name.replace(/['’]/g, ''));
    }

    const candidateUrls = Array.from(candidateSlugs)
      .slice(0, 6)
      .map((slug) => `${cleanBase}/games/${encodeURIComponent(slug)}?locale=en`);

    let apiRequests = 0;
    let http429Count = 0;
    let payload: BloxArchiveGamePayload | null = null;
    let matchedUrl = candidateUrls[0] || `${cleanBase}/games/${encodeURIComponent(target.slug)}?locale=en`;
    let lastError: string | undefined;

    for (const url of candidateUrls) {
      const res = await fetchJsonWithBackoff<BloxArchiveGamePayload>(url, {
        headers: {
          'X-API-Key': apiKey,
        },
        timeoutMs: 4_500,
        maxRetries: 1,
      });
      apiRequests += res.apiRequests;
      http429Count += res.http429Count;

      if (res.status >= 200 && res.status < 300 && res.data) {
        payload = res.data;
        matchedUrl = url;
        break;
      }
      if (res.status !== 404 && res.status !== 0) {
        lastError = `BloxArchive API returned HTTP ${res.status}`;
        break;
      }
    }

    if (!payload) {
      return {
        hasProviderData: false,
        codes: [],
        apiRequests,
        http429Count,
        error: lastError,
      };
    }

    const nested = payload.data;
    const rawEntries: Array<{
      item: BloxArchiveCodeItem;
      hintedStatus?: 'active' | 'expired' | 'unverified';
    }> = [];

    const pushList = (
      list: BloxArchiveCodeItem[] | undefined,
      hintedStatus?: 'active' | 'expired' | 'unverified'
    ) => {
      if (!Array.isArray(list)) return;
      for (const item of list) {
        rawEntries.push({ item, hintedStatus });
      }
    };

    // Official BloxArchive API v1 format: payload.codes as { active: [], pending: [], expired: [] }
    const codesObj = payload.codes || nested?.codes;
    if (codesObj && !Array.isArray(codesObj) && typeof codesObj === 'object') {
      pushList(codesObj.active, 'active');
      pushList(codesObj.pending, 'active');
      pushList(codesObj.expired, 'expired');
    } else if (Array.isArray(codesObj)) {
      pushList(codesObj);
    }

    // Direct root arrays (compatibility fallback)
    pushList(payload.active, 'active');
    pushList(payload.active_codes, 'active');
    pushList(payload.confirmed, 'active');
    pushList(payload.pending, 'active');
    pushList(payload.pending_codes, 'active');
    pushList(payload.expired, 'expired');
    pushList(payload.expired_codes, 'expired');

    // Nested data arrays (compatibility fallback)
    pushList(nested?.active_codes, 'active');
    pushList(nested?.expired_codes, 'expired');

    const cleanSlug = target.slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slugWithCodes = cleanSlug.endsWith('-codes')
      ? cleanSlug
      : `${cleanSlug}-codes`;

    const attributionUrl =
      validatePublicHttpsUrl(
        payload.attribution?.url ||
        payload.game?.url ||
        payload.url ||
        payload.pageUrl ||
        nested?.url ||
        nested?.pageUrl
      ) || `https://bloxarchive.com/${encodeURIComponent(payload.game?.slug || slugWithCodes)}`;

    const parsed: ProviderDiscoveredCode[] = [];
    const seen = new Set<string>();

    for (const { item, hintedStatus } of rawEntries) {
      const rawCode = String(item.code ?? item.value ?? '').trim();
      if (!isValidPromoCodeFormat(rawCode)) continue;
      const norm = normalizePromoCode(rawCode);
      if (seen.has(norm)) continue;
      seen.add(norm);

      const isItemExpired = Boolean(item.expired || item.expired_at);
      const rawStatus = String(
        item.status ??
          (isItemExpired
            ? 'expired'
            : item.verified || hintedStatus === 'active'
              ? 'active'
              : hintedStatus ?? 'unverified')
      ).toLowerCase();

      const mappedStatus: 'active' | 'expired' | 'unverified' =
        rawStatus === 'expired' || rawStatus === 'inactive' || isItemExpired
          ? 'expired'
          : 'active'; // Directly approve BloxArchive codes as active without manual verification

      const expiryRaw =
        item.expired_at ?? item.expiresAt ?? item.expires_at ?? null;

      parsed.push({
        code: rawCode,
        rewardDescription: sanitizePlainText(
          item.reward ?? item.rewards ?? item.description,
          180
        ),
        status: mappedStatus,
        sourceReportedStatus: rawStatus,
        sourceUrl: attributionUrl,
        expiresAt:
          expiryRaw && !Number.isNaN(Date.parse(expiryRaw))
            ? new Date(expiryRaw).toISOString()
            : null,
      });
    }

    return {
      hasProviderData: parsed.length > 0,
      codes: parsed,
      apiRequests,
      http429Count,
    };
  },
};

export const CODE_PROVIDERS: CodeProviderAdapter[] = [
  robloxOfficialSignalsProvider,
  fandomMediaWikiProvider,
  bloxArchiveProvider,
];

export function getCodeProvider(id: string): CodeProviderAdapter | undefined {
  return CODE_PROVIDERS.find((p) => p.id === id);
}
