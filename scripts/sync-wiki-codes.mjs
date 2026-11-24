#!/usr/bin/env node
/**
 * RoMetric — High-Speed Fandom & Wiki.gg MediaWiki Codes Sync (PC Native)
 *
 * Uses official public MediaWiki JSON APIs (CC-BY-SA) with ZERO daily API-key quotas:
 *   - Fandom MediaWiki API (*.fandom.com/api.php)
 *   - Wiki.gg MediaWiki API (*.wiki.gg/api.php)
 *   - Curated independent Roblox MediaWikis (e.g., Miraheze, Fischipedia, Urbanshade)
 *
 * Built for high-end PCs with configurable concurrency (default: 16 workers)
 * to scan 1,000+ Roblox games in ~1–2 minutes and upsert directly into Supabase.
 *
 * Usage:
 *   npm run sync:wiki
 *   npm run sync:wiki -- --concurrency=20
 *   npm run sync:wiki -- --game="Blox Fruits"
 *   npm run sync:wiki -- --limit=200
 *   npm run sync:wiki -- --only-missing
 *   npm run sync:wiki -- --dry-run
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const USER_AGENT =
  'RoMetricWikiSync/2.1 (+https://rometrics.vercel.app; legitimate MediaWiki public API consumer)';

// Curated high-accuracy wiki mappings (Fandom + Wiki.gg + Miraheze)
const KNOWN_WIKIS = [
  { keywords: ['blox fruits'], hosts: ['blox-fruits.fandom.com'] },
  { keywords: ['pet simulator 99', 'pet sim 99'], hosts: ['pet-simulator.fandom.com'] },
  { keywords: ['adopt me'], hosts: ['adoptme.fandom.com'] },
  { keywords: ['brookhaven'], hosts: ['brookhaven-rp.fandom.com'] },
  { keywords: ['blade ball'], hosts: ['blade-ball.fandom.com'] },
  { keywords: ['dress to impress'], hosts: ['dti-dress-to-impress.fandom.com'] },
  { keywords: ['anime defenders'], hosts: ['animedefenders.fandom.com'] },
  { keywords: ['anime vanguards'], hosts: ['animevanguards.fandom.com', 'animevanguards.wiki.gg'] },
  { keywords: ['fisch'], hosts: ['fisch.fandom.com', 'fischipedia.org'] },
  { keywords: ['bee swarm simulator', 'beeswarm'], hosts: ['bee-swarm-simulator.fandom.com'] },
  { keywords: ['shindo life', 'shinobi life'], hosts: ['shindo-life-rell.fandom.com'] },
  { keywords: ['king legacy'], hosts: ['king-legacy.fandom.com'] },
  { keywords: ['all star tower defense'], hosts: ['allstartowerdefense.fandom.com'] },
  { keywords: ['tower defense simulator'], hosts: ['tds.fandom.com'] },
  { keywords: ['jailbreak'], hosts: ['jailbreak.fandom.com'] },
  { keywords: ['murder mystery 2'], hosts: ['murder-mystery-2.fandom.com'] },
  { keywords: ['toilet tower defense'], hosts: ['toilet-tower-defense.fandom.com'] },
  { keywords: ['rivals'], hosts: ['robloxrivals.fandom.com'] },
  { keywords: ['blue lock rivals', 'blue lock: rivals'], hosts: ['bluelockrivals.fandom.com'] },
  { keywords: ["sol's rng", 'sols rng'], hosts: ['sol-rng.fandom.com'] },
  { keywords: ['fruit battlegrounds'], hosts: ['fruitbattlegrounds.fandom.com'] },
  { keywords: ['grand piece online'], hosts: ['grand-piece-online.fandom.com'] },
  { keywords: ['your bizarre adventure'], hosts: ['your-bizarre-adventure.fandom.com'] },
  { keywords: ['a universal time'], hosts: ['a-universal-time-roblox.fandom.com'] },
  { keywords: ['driving empire'], hosts: ['driving-empire.fandom.com'] },
  { keywords: ['da hood'], hosts: ['dahood.fandom.com'] },
  { keywords: ['slap battles'], hosts: ['roblox-slap-battles.fandom.com'] },
  { keywords: ['doors'], hosts: ['doors-game.fandom.com'] },
  { keywords: ['peroxide'], hosts: ['peroxide.fandom.com'] },
  { keywords: ['type soul', 'type://soul'], hosts: ['typesoul.fandom.com'] },
  { keywords: ['jujutsu shenanigans'], hosts: ['jujutsu-shenanigans.fandom.com'] },
  { keywords: ['jujutsu infinite'], hosts: ['jujutsu-infinite.fandom.com'] },
  { keywords: ['anime adventures'], hosts: ['animeadventures.fandom.com'] },
  { keywords: ['grow a garden'], hosts: ['growagarden.fandom.com'] },
  { keywords: ['dead rails'], hosts: ['dead-rails.fandom.com', 'deadrails.wiki.gg'] },
  { keywords: ['basketball zero'], hosts: ['basketball-zero.fandom.com'] },
  { keywords: ['arise crossover'], hosts: ['arise-crossover.fandom.com'] },
  { keywords: ['spongebob tower defense'], hosts: ['spongebob-tower-defense.fandom.com'] },
  { keywords: ['bubble gum simulator infinity'], hosts: ['bgsi.fandom.com'] },
  { keywords: ["dandy's world", 'dandys world'], hosts: ['dandys-world-robloxhorror.fandom.com'] },
  { keywords: ['the strongest battlegrounds'], hosts: ['the-strongest-battlegrounds-rblx.fandom.com'] },
  { keywords: ['anime last stand'], hosts: ['alsroblox.fandom.com', 'animelaststand.fandom.com'] },
  { keywords: ['anime reborn'], hosts: ['anime-reborn.fandom.com'] },
  { keywords: ['haikyuu legends', 'volleyball legends'], hosts: ['volleyball-legends.fandom.com', 'haikyuu-legends.fandom.com'] },
  { keywords: ['flee the facility'], hosts: ['flee-the-facility.fandom.com'] },
  { keywords: ['bedwars'], hosts: ['robloxbedwars.fandom.com'] },
  { keywords: ['arsenal'], hosts: ['roblox-arsenal.fandom.com'] },
  { keywords: ['phantom forces'], hosts: ['roblox-phantom-forces.fandom.com'] },
  { keywords: ['loomian legacy'], hosts: ['loomian-legacy.fandom.com'] },
  { keywords: ['doodle world'], hosts: ['doodle-world.fandom.com'] },
  { keywords: ['dragon adventures'], hosts: ['dragon-adventures.fandom.com'] },
  { keywords: ['creatures of sonaria'], hosts: ['creatures-of-sonaria-official.fandom.com'] },
  { keywords: ['royale high'], hosts: ['royale-high.fandom.com'] },
  { keywords: ['bloxburg', 'welcome to bloxburg'], hosts: ['welcome-to-bloxburg.fandom.com'] },
  { keywords: ['livetopia'], hosts: ['livetopia.fandom.com'] },
  { keywords: ['berry avenue'], hosts: ['berry-avenue.fandom.com'] },
  { keywords: ['evade'], hosts: ['evade-nextbot.fandom.com'] },
  { keywords: ['pressure'], hosts: ['urbanshade.org', 'pressure-roblox.fandom.com'] },
  { keywords: ['regretevator'], hosts: ['regretevator.fandom.com'] },
  { keywords: ['forsaken'], hosts: ['forsaken2024.fandom.com'] },
  { keywords: ['deepwoken'], hosts: ['deepwoken.fandom.com'] },
  { keywords: ['pilgrammed'], hosts: ['pilgrammed-rblx.fandom.com'] },
  { keywords: ['arcane odyssey'], hosts: ['roblox-arcane-odyssey.fandom.com'] },
  { keywords: ['world zero'], hosts: ['world-zero.fandom.com'] },
  { keywords: ['guts & blackpowder', 'guts and blackpowder'], hosts: ['gbp.miraheze.org', 'gutsandblackpowder.fandom.com'] },
  { keywords: ['super league soccer'], hosts: ['super-league-soccer.fandom.com'] },
  { keywords: ['untitled boxing game'], hosts: ['untitled-boxing-game.fandom.com'] },
  { keywords: ['tsb', 'strongest battlegrounds'], hosts: ['the-strongest-battlegrounds-rblx.fandom.com'] },
  { keywords: ['anime rangers x'], hosts: ['anime-rangers-x.fandom.com'] },
  { keywords: ['dead spells'], hosts: ['dead-spells.fandom.com'] },
  { keywords: ['steal a brainrot'], hosts: ['stealabrainrot.fandom.com'] },
  { keywords: ['99 nights in the forest'], hosts: ['99-nights-in-the-forest.fandom.com'] },
  { keywords: ['hunty zombie'], hosts: ['hunty-zombie.fandom.com'] },
  { keywords: ['ink game'], hosts: ['ink-game.fandom.com'] },
  { keywords: ['blue lock'], hosts: ['bluelockrivals.fandom.com'] },
];

const WIKI_CODE_TITLES = [
  'Codes',
  'Promo_Codes',
  'Redeem_Codes',
  'List_of_Codes',
  'Twitter_Codes',
];

const STOP_WORDS = new Set([
  'CODE', 'CODES', 'FREE', 'HERE', 'NEW', 'SOON', 'LIKES', 'LIKE', 'GAME',
  'PLAY', 'ROBLOX', 'UPDATE', 'ACTIVE', 'EXPIRED', 'REWARD', 'REWARDS',
  'DISCORD', 'TWITTER', 'YOUTUBE', 'GROUP', 'JOIN', 'CLICK', 'HTTP', 'HTTPS',
  'NONE', 'TBD', 'TBA', 'N/A', 'NA', 'UNKNOWN', 'WORKING', 'STATUS', 'DATE',
  'ADDED', 'EXPIRE', 'EXPIRES', 'NOTES', 'DESCRIPTION', 'RELEASED', 'REMOVED',
  'REDEEM', 'REDEEMED', 'VALID', 'INVALID', 'YES', 'NO', 'TRUE', 'FALSE',
  'EFFECT', 'BENEFIT', 'ITEM', 'ITEMS', 'CASH', 'GEMS', 'COINS', 'BOOST',
  'BOOSTS', 'SPINS', 'TICKETS', 'TITLE', 'NAME', 'DURATION', 'SOURCE', 'WIKI',
]);

function loadEnv() {
  const cwd = process.cwd();
  const envFiles = ['.env.local', '.env'];
  const envVars = {};
  for (const f of envFiles) {
    const full = path.join(cwd, f);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (!match) continue;
        let val = match[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!envVars[match[1]]) envVars[match[1]] = val;
      }
    }
  }
  return envVars;
}

const fileEnv = loadEnv();

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  if (found) return found.slice(prefix.length).trim();
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1].trim();
  }
  return null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function promptInput(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function normalizePromoCode(raw) {
  return String(raw || '').trim().replace(/\s+/g, '').toUpperCase();
}

function sanitizePlainText(raw, maxLen = 180) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ')
    .replace(/<ref[^>]*\/>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, ' ')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    // Preserve currency/item templates like {{Doorknobs|150}} -> "150 Doorknobs", {{CopyText|3YEARS}} -> "3YEARS"
    .replace(/\{\{\s*CopyText\s*\|([^}|]+)[^}]*\}\}/gi, '$1')
    .replace(/\{\{\s*([A-Za-z][A-Za-z0-9 _-]{1,24})\s*\|\s*([0-9,.]+(?:[kKmMbB])?)\s*\}\}/g, '$2 $1')
    .replace(/\{\{[^}|]+\|([^}|]+)[^}]*\}\}/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .replace(/^[,*•\s]+|[,*•\s]+$/g, '')
    .trim();
  return cleaned ? cleaned.slice(0, maxLen) : null;
}

function isValidPromoCodeFormat(raw) {
  const trimmed = String(raw || '').trim();
  if (trimmed.length < 3 || trimmed.length > 48) return false;
  if (!/^[A-Za-z0-9_!@#$%&*+?-]+(?: [A-Za-z0-9_!@#$%&*+?-]+)*$/.test(trimmed)) {
    return false;
  }
  const words = trimmed.split(/\s+/);
  if (words.length > 5) return false;
  if (words.length > 1 && /\b(gives|grants|unlocks|players|redeem|minutes|seconds|hours)\b/i.test(trimmed)) {
    return false;
  }
  const upper = trimmed.toUpperCase();
  if (STOP_WORDS.has(upper)) return false;
  if (/^[^A-Za-z0-9]+$/.test(trimmed)) return false;
  if (/^\d{1,4}[-/]\d{1,2}(?:[-/]\d{2,4})?$/.test(trimmed)) return false;
  if (/^\d{1,5}$/.test(trimmed)) return false;
  return true;
}

function classifySectionText(rawText) {
  const lower = String(rawText || '').toLowerCase();
  if (/\b(expired|inactive|old|removed|previous|outdated|archived|unusable|invalid|no longer|discontinued|disabled)\b/.test(lower)) {
    return 'expired';
  }
  if (/\b(active|working|current|valid|available|new|limited|live|redeemable)\b/.test(lower)) {
    return 'active';
  }
  return null;
}

function extractPrimaryCodeFromCell(cellHtml) {
  const raw = String(cellHtml || '').trim();
  if (!raw) return null;

  // 1. {{CopyText|CODE}} template (used by DTI and modern Fandom wikis)
  const copyMatch = raw.match(/\{\{\s*CopyText\s*\|\s*([^}|]+?)\s*(?:\|[^}]*)?\}\}/i);
  if (copyMatch?.[1]) {
    const c = sanitizePlainText(copyMatch[1], 48);
    if (c) return c;
  }

  // 2. <code>CODE</code> tag (used by Blox Fruits, DOORS, etc. — preserves multi-word codes like "ACCESS GRANTED")
  const codeTagMatch = raw.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
  if (codeTagMatch?.[1]) {
    const c = sanitizePlainText(codeTagMatch[1], 48);
    if (c) return c;
  }

  // 3. Bold '''CODE'''
  const boldMatch = raw.match(/'''([^']{3,48})'''/);
  if (boldMatch?.[1]) {
    const c = sanitizePlainText(boldMatch[1], 48);
    if (c) {
      return c
        .replace(/\(new!?\)/gi, '')
        .replace(/\[new\]/gi, '')
        .replace(/\(expired\)/gi, '')
        .trim();
    }
  }

  // 4. Plain cell text fallback
  const plain = sanitizePlainText(raw, 64);
  if (!plain) return null;
  const cleaned = plain
    .replace(/\(new!?\)/gi, '')
    .replace(/\[new\]/gi, '')
    .replace(/\(expired\)/gi, '')
    .trim();
  return cleaned.split(/\s+/)[0] || cleaned;
}

function cleanGameNameForSlug(name) {
  return String(name || '')
    .replace(/^(?:\s*[\[\(\{][^\]\)\}]{1,36}[\]\)\}]\s*)+/g, '')
    .replace(/(?:\s*[\[\(\{][^\]\)\}]{1,36}[\]\)\}]\s*)+$/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildWikiCandidateHosts(game) {
  const hosts = [];
  const pushHost = (h) => {
    const clean = String(h || '').toLowerCase().trim();
    if (clean && !hosts.includes(clean)) hosts.push(clean);
  };

  if (game.wiki_subdomain) {
    if (game.wiki_subdomain.includes('.')) {
      pushHost(game.wiki_subdomain);
    } else {
      pushHost(`${game.wiki_subdomain}.fandom.com`);
      pushHost(`${game.wiki_subdomain}.wiki.gg`);
    }
  }

  const lowerName = String(game.name || '').toLowerCase();
  for (const entry of KNOWN_WIKIS) {
    if (entry.keywords.some((kw) => lowerName.includes(kw))) {
      for (const h of entry.hosts) pushHost(h);
    }
  }

  const cleaned = cleanGameNameForSlug(game.name).toLowerCase();
  const hyphenSlug = cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42);
  const compactSlug = cleaned.replace(/[^a-z0-9]+/g, '').slice(0, 36);

  if (hyphenSlug.length >= 3) {
    pushHost(`${hyphenSlug}.fandom.com`);
    if (compactSlug !== hyphenSlug && compactSlug.length >= 4) {
      pushHost(`${compactSlug}.fandom.com`);
    }
    pushHost(`roblox-${hyphenSlug}.fandom.com`);
    pushHost(`${hyphenSlug}-roblox.fandom.com`);
    pushHost(`${hyphenSlug}.wiki.gg`);
  }

  return hosts.slice(0, 5);
}

async function fetchJsonFast(url, timeoutMs = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch {
    clearTimeout(timer);
    return { ok: false, status: 0, data: null };
  }
}

async function fetchMediaWikiCodesPage(host) {
  const titlesParam = WIKI_CODE_TITLES.join('|');
  const apiUrl =
    `https://${host}/api.php?action=query&prop=revisions&rvprop=content&rvslots=main` +
    `&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(titlesParam)}`;

  const res = await fetchJsonFast(apiUrl, 5500);
  if (!res.ok || !res.data?.query?.pages) {
    return { found: false, host };
  }

  const pages = res.data.query.pages;
  for (const p of pages) {
    if (p.missing || !p.revisions?.length) continue;
    const rev = p.revisions[0];
    const wikitext = rev?.slots?.main?.content ?? rev?.content ?? '';
    if (typeof wikitext === 'string' && wikitext.length >= 40) {
      const pageSlug = encodeURIComponent(String(p.title || 'Codes').replace(/ /g, '_'));
      const wikiUrl = `https://${host}/wiki/${pageSlug}`;
      return { found: true, host, title: p.title, wikiUrl, wikitext };
    }
  }

  return { found: false, host };
}

/**
 * High-Accuracy MediaWiki Active vs Expired Codes Parser:
 * - Strictly outputs 'active' or 'expired' (zero manual approval needed)
 * - Handles <tabber> first tabs, inline |-|Tab=, and multi-line |-|\nTab=
 * - Handles == Headings ==, '''Bold Sections''', |+ Table Captions, and mw-collapsible Expired divs
 * - Handles {{CopyText|CODE}}, <code>MULTI WORD CODE</code>, multi-line cells, and Expiration Date columns
 */
function parseMediaWikiCodes(wikitext, wikiPageUrl) {
  if (!wikitext || wikitext.length < 25) return [];

  const results = new Map();
  const lines = wikitext.split(/\r?\n/);

  let sectionState = 'active'; // Always resolves to 'active' or 'expired'
  let inTabber = false;
  let inTable = false;
  let currentRowCells = [];
  let currentRowStyle = '';
  let tableHeaders = [];

  const upsertCode = (rawCode, reward, status, expiresAt = null) => {
    const cleanedCode = String(rawCode || '')
      .replace(/\(new!?\)/gi, '')
      .replace(/\[new\]/gi, '')
      .replace(/^["'`]+|["'`,.:;]+$/g, '')
      .trim();

    if (!isValidPromoCodeFormat(cleanedCode)) return;
    const norm = normalizePromoCode(cleanedCode);
    const finalStatus = status === 'expired' ? 'expired' : 'active';

    const existing = results.get(norm);
    if (existing) {
      if (!existing.reward_description && reward) {
        existing.reward_description = reward;
      }
      // If later explicitly marked expired (e.g. Expired section), update to expired
      if (finalStatus === 'expired' && existing.status !== 'expired') {
        existing.status = 'expired';
        existing.source_reported_status = 'wiki_expired';
      }
      return;
    }

    results.set(norm, {
      code: cleanedCode,
      normalized_code: norm,
      reward_description: reward,
      status: finalStatus,
      source_reported_status: finalStatus === 'expired' ? 'wiki_expired' : 'wiki_active',
      source_url: wikiPageUrl,
      expires_at: expiresAt,
    });
  };

  const flushTableRow = () => {
    if (currentRowCells.length === 0) return;

    let codeCol = 0;
    let rewardCol = 1;
    let statusCol = -1;
    let expiryCol = -1;

    if (tableHeaders.length > 0) {
      const idxCode = tableHeaders.findIndex((h) => /\bcode/i.test(h));
      const idxReward = tableHeaders.findIndex((h) => /\b(reward|effect|benefit|prize|gift|item|gives)\b/i.test(h));
      const idxStatus = tableHeaders.findIndex((h) => /\b(status|state|working|active)\b/i.test(h));
      const idxExpiry = tableHeaders.findIndex((h) => /\b(expir|removed|end date)\b/i.test(h));
      if (idxCode !== -1) codeCol = idxCode;
      if (idxReward !== -1) rewardCol = idxReward;
      if (idxStatus !== -1) statusCol = idxStatus;
      if (idxExpiry !== -1) expiryCol = idxExpiry;
    }

    const rawCodeCellHtml = currentRowCells[codeCol] ?? '';
    const isStrikethrough = /<(?:s|del|strike)\b/i.test(rawCodeCellHtml);
    const isRedExpiredStyle = /(?:background(?:-color)?\s*:\s*(?:#(?:f[0-9a-f]{2}|e[0-9a-f]{2}|ff[0-7]|d95|c03|b22)|red|indianred|lightcoral|mistyrose|salmon)|class\s*=\s*["'][^"']*expired)/i.test(
      `${currentRowStyle} ${rawCodeCellHtml}`
    );

    const codeToken = extractPrimaryCodeFromCell(rawCodeCellHtml);
    if (codeToken) {
      const rewardRaw =
        rewardCol >= 0 && currentRowCells[rewardCol]
          ? sanitizePlainText(currentRowCells[rewardCol], 180)
          : null;
      const statusRaw =
        statusCol >= 0 && currentRowCells[statusCol]
          ? sanitizePlainText(currentRowCells[statusCol], 60)
          : null;
      const expiryRaw =
        expiryCol >= 0 && currentRowCells[expiryCol]
          ? sanitizePlainText(currentRowCells[expiryCol], 60)
          : null;

      let status =
        isStrikethrough || isRedExpiredStyle || sectionState === 'expired'
          ? 'expired'
          : 'active';

      if (statusRaw) {
        if (/\b(expired|inactive|invalid|disabled|outdated|removed|no)\b|✗|✘|×/i.test(statusRaw)) {
          status = 'expired';
        } else if (/\b(active|working|valid|live|yes)\b|✓|✔/i.test(statusRaw)) {
          status = 'active';
        }
      } else if (/\(expired\)/i.test(rawCodeCellHtml)) {
        status = 'expired';
      }

      let validExpiryIso = null;
      if (expiryRaw && !/^(-|—|–|n\/a|none|tbd|tba|active|present|current|ongoing|unknown)$/i.test(expiryRaw)) {
        const parsedTs = Date.parse(expiryRaw);
        if (!Number.isNaN(parsedTs)) {
          validExpiryIso = new Date(parsedTs).toISOString();
          if (parsedTs < Date.now()) {
            status = 'expired';
          }
        } else if (sectionState === 'active' && /\b(202[0-5]|expired)\b/i.test(expiryRaw)) {
          status = 'expired';
        }
      }

      const cleanReward =
        rewardRaw && !/^(active|working|expired|yes|no|-|—|n\/a|unknown)$/i.test(rewardRaw)
          ? rewardRaw
          : null;

      upsertCode(codeToken, cleanReward, status, validExpiryIso);
    }

    currentRowCells = [];
    currentRowStyle = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect <tabber> open/close (used by Blox Fruits, DOORS, etc.)
    if (/<tabber\b/i.test(line)) {
      flushTableRow();
      inTabber = true;
      const afterTag = line.replace(/.*<tabber[^>]*>/i, '').trim();
      const firstTab = afterTag.match(/^([^=<>|{}]{2,45})=/);
      if (firstTab) {
        const cls = classifySectionText(firstTab[1]);
        if (cls) sectionState = cls;
      }
      continue;
    }
    if (/<\/tabber>/i.test(line)) {
      flushTableRow();
      inTabber = false;
      continue;
    }

    // Detect tabber separators: "|-|Expired Codes=" OR standalone "|-|" followed by "Expired Codes="
    const inlineTabber = line.match(/^\|-\|\s*([^=<>|{}]{2,45})=/);
    if (inlineTabber) {
      flushTableRow();
      inTable = false;
      const cls = classifySectionText(inlineTabber[1]);
      if (cls) sectionState = cls;
      continue;
    }
    if (inTabber && line === '|-|') {
      flushTableRow();
      inTable = false;
      continue;
    }
    if (inTabber && !inTable) {
      const nextTab = line.match(/^([^=<>|{}]{2,45})=/);
      if (nextTab) {
        flushTableRow();
        const cls = classifySectionText(nextTab[1]);
        if (cls) sectionState = cls;
        continue;
      }
    }

    // Detect collapsible expired divs/sections
    if (/mw-collapsible/i.test(line) && !inTable) {
      const cls = classifySectionText(line);
      if (cls) sectionState = cls;
    }

    // Detect section headings == Active Codes == / == Expired Codes == (including wrapped in {{Mobile|===...===}})
    const headingMatch = line.match(/={2,5}\s*([^=]+?)\s*={2,5}/);
    if (headingMatch && !inTable) {
      flushTableRow();
      const cls = classifySectionText(headingMatch[1]);
      if (cls) sectionState = cls;
      continue;
    }

    // Detect standalone bold headings like '''Expired Codes'''
    const boldHeadingMatch = line.match(/^'''([^']{4,50})'''$/);
    if (boldHeadingMatch && !inTable) {
      const cls = classifySectionText(boldHeadingMatch[1]);
      if (cls) {
        flushTableRow();
        sectionState = cls;
        continue;
      }
    }

    // Template-based rows: {{Code|CODE123|2x XP|Active}}
    const tplMatch = line.match(/^\{\{\s*(?:Code|CodesRow|CodeRow|PromoCode)\s*\|(.+?)\}\}$/i);
    if (tplMatch) {
      const parts = tplMatch[1].split('|').map((p) => p.trim());
      const named = {};
      const positional = [];
      for (const p of parts) {
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1 && /^[a-z0-9_ -]{1,20}$/i.test(p.slice(0, eqIdx).trim())) {
          named[p.slice(0, eqIdx).trim().toLowerCase()] = p.slice(eqIdx + 1).trim();
        } else {
          positional.push(p);
        }
      }
      const cVal = named.code || named.name || positional[0];
      const rVal = sanitizePlainText(named.reward || named.rewards || named.effect || positional[1], 180);
      const sVal = (named.status || named.state || positional[2] || '').toLowerCase();
      let status = sectionState === 'expired' ? 'expired' : 'active';
      if (/\b(expired|inactive|invalid|no)\b/.test(sVal)) status = 'expired';
      else if (/\b(active|working|valid|yes)\b/.test(sVal)) status = 'active';
      if (cVal) {
        upsertCode(cVal, rVal, status);
      }
      continue;
    }

    // Wiki tables
    if (line.startsWith('{|')) {
      inTable = true;
      currentRowCells = [];
      currentRowStyle = '';
      tableHeaders = [];
      const tableClass = classifySectionText(line);
      if (tableClass) sectionState = tableClass;
      continue;
    }
    if (line.startsWith('|}')) {
      flushTableRow();
      inTable = false;
      tableHeaders = [];
      continue;
    }
    if (inTable) {
      if (line.startsWith('|+')) {
        const captionCls = classifySectionText(line.slice(2));
        if (captionCls) sectionState = captionCls;
        continue;
      }
      if (line.startsWith('|-')) {
        flushTableRow();
        currentRowStyle = line.slice(2).trim();
        continue;
      }
      if (line.startsWith('!')) {
        const headerLine = line.slice(1);
        for (const h of headerLine.split('!!')) {
          const pipeIdx = h.indexOf('|');
          const cleanH = pipeIdx !== -1 ? h.slice(pipeIdx + 1) : h;
          tableHeaders.push((sanitizePlainText(cleanH, 40) || '').toLowerCase());
        }
        continue;
      }
      if (line.startsWith('|')) {
        const content = line.slice(1);
        for (const c of content.split('||')) {
          const pipeIdx = c.indexOf('|');
          const cellVal =
            pipeIdx !== -1 && /(=|style|align|class|colspan|rowspan|data-)/i.test(c.slice(0, pipeIdx))
              ? c.slice(pipeIdx + 1)
              : c;
          currentRowCells.push(cellVal.trim());
        }
        continue;
      }
      // Multi-line cell continuation (e.g. "* [[Classic DTI Doll]]" inside reward cell)
      if (currentRowCells.length > 0) {
        currentRowCells[currentRowCells.length - 1] += ` ${line}`;
      }
      continue;
    }

    // Bulleted list parsing outside tables: * '''CODE123''' - 2x XP for 20 minutes
    if (line.startsWith('*')) {
      const isStrike = /<(?:s|del|strike)\b/i.test(line);
      const bulletMatch = line.match(
        /^\*+\s*(?:<(?:s|del|strike)[^>]*>)?(?:'''|<code>|<b>|["'`])?([A-Za-z0-9_!@#$%&*+?-]{3,36})(?:'''|<\/code>|<\/b>|["'`])?(?:<\/(?:s|del|strike)>)?\s*(?:[-–—:]\s*(.+))?$/i
      );
      if (bulletMatch) {
        const codeToken = bulletMatch[1].trim();
        const reward = sanitizePlainText(bulletMatch[2], 180);
        const status = isStrike || sectionState === 'expired' ? 'expired' : 'active';
        upsertCode(codeToken, reward, status);
      }
    }
  }

  flushTableRow();
  return Array.from(results.values()).slice(0, 150);
}

async function main() {
  if (hasFlag('help') || hasFlag('h')) {
    console.log(`
RoMetric — High-Speed Fandom & Wiki.gg MediaWiki Codes Sync (PC Native)

Usage:
  npm run sync:wiki [options]

Options:
  --concurrency=<n>     Parallel game workers (default: 16 on PC, 8 in CI; max: 24)
  --limit=<n|all>       Max games to scan from Supabase (default: all)
  --game="<name>"       Scan only games matching this name
  --only-missing        Only scan games that currently have 0 codes
  --dry-run             Discover codes without writing to Supabase
  --ci                  Non-interactive CI mode
`);
    process.exit(0);
  }

  console.log('\n================================================================');
  console.log('   RoMetric — High-Speed Fandom & Wiki.gg MediaWiki Sync        ');
  console.log('================================================================\n');

  const isCiMode = Boolean(process.env.CI) || hasFlag('ci') || !process.stdin.isTTY;

  let supabaseUrl =
    getArg('supabase-url') ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    fileEnv.SUPABASE_URL ||
    fileEnv.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  let serviceRoleKey =
    getArg('supabase-key') ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  if (!isCiMode) {
    if (!supabaseUrl) {
      supabaseUrl = await promptInput('Enter your Supabase URL (e.g. https://xxx.supabase.co): ');
    }
    if (!serviceRoleKey) {
      serviceRoleKey = await promptInput('Enter your Supabase service_role key: ');
    }
  }
  supabaseUrl = supabaseUrl.replace(/\/+$/, '');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
  }

  const dryRun = hasFlag('dry-run');
  const onlyMissing = hasFlag('only-missing');
  const gameFilter = getArg('game');
  const limitArg = getArg('limit');
  const maxGames = limitArg && limitArg !== 'all' ? parseInt(limitArg, 10) || 100 : Infinity;
  const defaultWorkers = isCiMode ? 8 : 16;
  const concurrency = Math.min(24, Math.max(1, parseInt(getArg('concurrency') || String(defaultWorkers), 10)));

  console.log(`Supabase host:   ${new URL(supabaseUrl).host}`);
  console.log(`Workers:         ${concurrency} parallel workers`);
  console.log(`Sources:         Fandom + Wiki.gg MediaWiki APIs (CC-BY-SA)`);
  console.log(`Mode:            ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE UPSERT'}${onlyMissing ? ' (only 0-code games)' : ''}\n`);

  const sbHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  if (!dryRun) {
    await fetch(`${supabaseUrl}/rest/v1/code_sources?on_conflict=id`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        {
          id: 'fandom_mediawiki',
          name: 'Fandom & Wiki.gg MediaWiki API',
          provider_type: 'fandom_mediawiki',
          enabled: true,
          requires_api_key: false,
          attribution_label: 'Community Wikis (CC-BY-SA)',
          attribution_url: 'https://www.fandom.com/licensing',
          license_notice: 'Community wiki code tables retrieved via public MediaWiki APIs under CC-BY-SA.',
          rate_limit_rpm: 180,
          last_status: 'healthy',
          updated_at: new Date().toISOString(),
        },
      ]),
    }).catch(() => {});
  }

  console.log('Loading tracked Roblox games from Supabase...');
  let games = [];
  let page = 0;
  while (true) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/games?select=universe_id,root_place_id,name,slug,wiki_subdomain,current_ccu,active_code_count,total_code_count&active=eq.true&order=current_ccu.desc&limit=1000&offset=${page * 1000}`,
      { headers: sbHeaders }
    );
    if (!res.ok) {
      console.error(`Failed loading games (HTTP ${res.status}):`, await res.text());
      process.exit(1);
    }
    const batch = await res.json();
    if (!batch || batch.length === 0) break;
    games = games.concat(batch);
    if (batch.length < 1000) break;
    page++;
  }

  if (gameFilter) {
    const q = gameFilter.toLowerCase();
    games = games.filter((g) => String(g.name || '').toLowerCase().includes(q));
  }
  if (onlyMissing) {
    games = games.filter((g) => Number(g.total_code_count || 0) === 0);
  }
  if (games.length > maxGames) {
    games = games.slice(0, maxGames);
  }

  console.log(`✓ Ready to scan ${games.length} Roblox games with ${concurrency} workers...\n`);
  if (games.length === 0) {
    console.log('Nothing to scan. Exiting.');
    process.exit(0);
  }

  const startTime = Date.now();
  let idx = 0;
  let processed = 0;
  let gamesWithHits = 0;
  let totalCodesDiscovered = 0;
  let totalActiveDiscovered = 0;

  async function scanGame(game) {
    const uid = String(game.universe_id);
    const candidateHosts = buildWikiCandidateHosts(game);
    if (candidateHosts.length === 0) {
      return { name: game.name, total: 0, active: 0, wikiHost: null };
    }

    let matchedPage = null;

    // Fast path: if wiki_subdomain is already cached, check primary host first
    if (game.wiki_subdomain) {
      const primary = await fetchMediaWikiCodesPage(candidateHosts[0]);
      if (primary.found) {
        matchedPage = primary;
      }
    }

    // Otherwise probe all candidate hosts for this game in parallel for maximum speed
    if (!matchedPage) {
      const probeHosts = game.wiki_subdomain ? candidateHosts.slice(1) : candidateHosts;
      const results = await Promise.all(probeHosts.map((h) => fetchMediaWikiCodesPage(h)));
      matchedPage = results.find((r) => r.found) || null;
    }

    if (!matchedPage) {
      return { name: game.name, total: 0, active: 0, wikiHost: null };
    }

    const parsed = parseMediaWikiCodes(matchedPage.wikitext, matchedPage.wikiUrl);
    if (parsed.length === 0) {
      return { name: game.name, total: 0, active: 0, wikiHost: null };
    }

    const nowIso = new Date().toISOString();
    const rows = parsed.map((c) => ({
      universe_id: Number(uid),
      code: c.code.slice(0, 48),
      normalized_code: c.normalized_code.slice(0, 48),
      reward_description: c.reward_description || null,
      status: c.status === 'expired' ? 'expired' : 'active',
      source_id: 'fandom_mediawiki',
      source_url: c.source_url,
      source_reported_status: c.source_reported_status,
      admin_locked: false,
      discovered_at: nowIso,
      last_verified_at: nowIso,
      expires_at: c.expires_at || null,
      updated_at: nowIso,
    }));

    const activeHere = rows.filter((r) => r.status === 'active').length;
    const expiredHere = rows.length - activeHere;

    if (!dryRun) {
      const upRes = await fetch(
        `${supabaseUrl}/rest/v1/game_codes?on_conflict=universe_id,normalized_code`,
        {
          method: 'POST',
          headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(rows),
        }
      );

      if (upRes.ok) {
        const countRes = await fetch(
          `${supabaseUrl}/rest/v1/game_codes?select=status&universe_id=eq.${uid}`,
          { headers: sbHeaders }
        );
        let dbActive = activeHere;
        let dbTotal = rows.length;
        if (countRes.ok) {
          const allDb = await countRes.json();
          dbTotal = allDb.length;
          dbActive = allDb.filter((x) => x.status === 'active').length;
        }

        const patchBody = {
          active_code_count: dbActive,
          total_code_count: dbTotal,
          code_coverage_status: dbTotal > 0 ? 'covered' : 'no_provider_data',
          codes_last_checked_at: nowIso,
          updated_at: nowIso,
        };
        if (matchedPage.host && !game.wiki_subdomain) {
          patchBody.wiki_subdomain = matchedPage.host.replace(/\.fandom\.com$/, '');
        }

        await fetch(`${supabaseUrl}/rest/v1/games?universe_id=eq.${uid}`, {
          method: 'PATCH',
          headers: { ...sbHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify(patchBody),
        });
      }
    }

    return {
      name: game.name,
      total: rows.length,
      active: activeHere,
      expired: expiredHere,
      wikiHost: matchedPage.host,
    };
  }

  let totalExpiredDiscovered = 0;

  async function worker() {
    while (idx < games.length) {
      const current = games[idx++];
      try {
        const result = await scanGame(current);
        processed++;
        if (result.total > 0) {
          gamesWithHits++;
          totalCodesDiscovered += result.total;
          totalActiveDiscovered += result.active;
          totalExpiredDiscovered += result.expired || 0;
          console.log(
            `[${processed}/${games.length}] ✓ ${result.name}: ` +
            `${result.active} active, ${result.expired || 0} expired (${result.wikiHost})`
          );
        } else if (processed % 25 === 0 || processed === games.length) {
          process.stdout.write(`  Progress: ${processed}/${games.length} scanned (${gamesWithHits} wikis matched, ${totalCodesDiscovered} codes)...\r`);
        }
      } catch (err) {
        processed++;
        console.warn(`[${processed}/${games.length}] ⚠ ${current.name}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n\n================================================================');
  console.log('✓ Fandom & Wiki.gg MediaWiki Codes Sync Complete!');
  console.log('================================================================');
  console.log(`  Games Scanned:         ${processed}`);
  console.log(`  Wikis Matched:         ${gamesWithHits}`);
  console.log(`  Active Codes Synced:   ${totalActiveDiscovered}`);
  console.log(`  Expired Codes Synced:  ${totalExpiredDiscovered}`);
  console.log(`  Total Codes Synced:    ${totalCodesDiscovered}`);
  console.log(`  Elapsed Time:          ${elapsedSec} seconds`);
  console.log('================================================================\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [
      '### RoMetric Wiki Codes Sync Summary',
      '',
      '| Metric | Value |',
      '| --- | ---: |',
      `| Games Scanned | ${processed} |`,
      `| Wikis Matched | ${gamesWithHits} |`,
      `| Active Codes Synced | ${totalActiveDiscovered} |`,
      `| Expired Codes Synced | ${totalExpiredDiscovered} |`,
      `| Total Codes Synced | ${totalCodesDiscovered} |`,
      `| Elapsed Time | ${elapsedSec}s |`,
      '',
    ].join('\n');
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
    } catch {}
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
