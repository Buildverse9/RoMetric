#!/usr/bin/env node
/**
 * RoMetric — High-Speed Fandom MediaWiki Codes Sync (PC Native)
 *
 * Uses official public MediaWiki JSON APIs (CC-BY-SA) with ZERO daily API-key quotas.
 * Automatically classifies every code directly into `active` or `expired` (no manual approval).
 *
 * Usage:
 *   npm run sync:wiki
 *   npm run sync:wiki -- --concurrency=24
 *   npm run sync:wiki -- --game="Blox Fruits"
 *   npm run sync:wiki -- --limit=500
 *   npm run sync:wiki -- --only-missing
 *   npm run sync:wiki -- --dry-run
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const USER_AGENT =
  'RoMetricWikiSync/2.2 (+https://rometrics.vercel.app; legitimate MediaWiki public API consumer)';

const CODE_SOURCE_ID = 'fandom_mediawiki_api';

// Curated verified Fandom MediaWiki mappings (exact/near-exact cleaned name matching to prevent clone mismatches)
const KNOWN_WIKIS = [
  { names: ['blox fruits'], hosts: ['blox-fruits.fandom.com'] },
  { names: ['pet simulator 99', 'pet sim 99', 'pet simulator x'], hosts: ['pet-simulator.fandom.com'] },
  { names: ['adopt me'], hosts: ['adoptme.fandom.com'] },
  { names: ['brookhaven rp', 'brookhaven'], hosts: ['brookhaven-rp.fandom.com'] },
  { names: ['blade ball'], hosts: ['bladeball.fandom.com', 'blade-ball.fandom.com'] },
  { names: ['dress to impress'], hosts: ['dti-dress-to-impress.fandom.com'] },
  { names: ['anime defenders'], hosts: ['animedefenders.fandom.com', 'anime-defenders.fandom.com'] },
  { names: ['anime vanguards'], hosts: ['animevanguards.fandom.com', 'anime-vanguards.fandom.com'] },
  { names: ['fisch'], hosts: ['fisch.fandom.com'] },
  { names: ['bee swarm simulator', 'beeswarm'], hosts: ['bee-swarm-simulator.fandom.com'] },
  { names: ['shindo life', 'shinobi life 2'], hosts: ['shindo-life-rell.fandom.com'] },
  { names: ['king legacy'], hosts: ['king-legacy.fandom.com'] },
  { names: ['all star tower defense', 'all star tower defense x'], hosts: ['all-star-tower-defense.fandom.com'] },
  { names: ['tower defense simulator'], hosts: ['tds.fandom.com'] },
  { names: ['jailbreak'], hosts: ['jailbreak.fandom.com'] },
  { names: ['murder mystery 2'], hosts: ['murder-mystery-2.fandom.com'] },
  { names: ['toilet tower defense'], hosts: ['toilet-tower-defense.fandom.com'] },
  { names: ['rivals'], hosts: ['robloxrivals.fandom.com'] },
  { names: ['blue lock rivals', 'blue lock: rivals'], hosts: ['blue-lock-rivals.fandom.com', 'bluelockrivals.fandom.com'] },
  { names: ["sol's rng", 'sols rng'], hosts: ['sol-rng.fandom.com'] },
  { names: ['fruit battlegrounds'], hosts: ['fruit-battlegrounds.fandom.com'] },
  { names: ['grand piece online'], hosts: ['grand-piece-online.fandom.com'] },
  { names: ['your bizarre adventure'], hosts: ['your-bizarre-adventure.fandom.com'] },
  { names: ['a universal time'], hosts: ['a-universal-time-roblox.fandom.com'] },
  { names: ['driving empire'], hosts: ['drivingempire.fandom.com', 'driving-empire.fandom.com'] },
  { names: ['da hood'], hosts: ['dahood.fandom.com', 'da-hood.fandom.com'] },
  { names: ['slap battles'], hosts: ['roblox-slap-battles.fandom.com'] },
  { names: ['doors'], hosts: ['doors-game.fandom.com'] },
  { names: ['peroxide'], hosts: ['peroxide.fandom.com'] },
  { names: ['type soul', 'type://soul'], hosts: ['type-soul.fandom.com'] },
  { names: ['jujutsu shenanigans'], hosts: ['jujutsu-shenanigans.fandom.com'] },
  { names: ['jujutsu infinite'], hosts: ['jujutsuinfinite.fandom.com'] },
  { names: ['anime adventures'], hosts: ['animeadventures.fandom.com'] },
  { names: ['grow a garden'], hosts: ['growagarden.fandom.com'] },
  { names: ['dead rails'], hosts: ['dead-rails.fandom.com'] },
  { names: ['spongebob tower defense'], hosts: ['spongebob-tower-defense.fandom.com'] },
  { names: ["dandy's world", 'dandys world'], hosts: ['dandys-world-robloxhorror.fandom.com'] },
  { names: ['the strongest battlegrounds'], hosts: ['the-strongest-battlegrounds-rblx.fandom.com'] },
  { names: ['anime last stand'], hosts: ['anime-last-stand.fandom.com', 'alsroblox.fandom.com'] },
  { names: ['anime reborn'], hosts: ['animereborn.fandom.com', 'anime-reborn.fandom.com'] },
  { names: ['volleyball legends', 'haikyuu legends'], hosts: ['volleyball-legends.fandom.com'] },
  { names: ['flee the facility'], hosts: ['flee-the-facility.fandom.com'] },
  { names: ['bedwars'], hosts: ['robloxbedwars.fandom.com'] },
  { names: ['arsenal'], hosts: ['roblox-arsenal.fandom.com'] },
  { names: ['phantom forces'], hosts: ['roblox-phantom-forces.fandom.com'] },
  { names: ['loomian legacy'], hosts: ['loomian-legacy.fandom.com'] },
  { names: ['doodle world'], hosts: ['doodle-world.fandom.com'] },
  { names: ['dragon adventures'], hosts: ['dragon-adventures.fandom.com'] },
  { names: ['creatures of sonaria'], hosts: ['creatures-of-sonaria-official.fandom.com'] },
  { names: ['royale high'], hosts: ['royale-high.fandom.com'] },
  { names: ['welcome to bloxburg', 'bloxburg'], hosts: ['welcome-to-bloxburg.fandom.com'] },
  { names: ['evade'], hosts: ['evade-nextbot.fandom.com', 'evade.fandom.com'] },
  { names: ['regretevator'], hosts: ['regretevator.fandom.com'] },
  { names: ['forsaken'], hosts: ['forsaken2024.fandom.com'] },
  { names: ['deepwoken'], hosts: ['deepwoken.fandom.com'] },
  { names: ['pilgrammed'], hosts: ['pilgrammed-rblx.fandom.com'] },
  { names: ['arcane odyssey'], hosts: ['roblox-arcane-odyssey.fandom.com'] },
  { names: ['world zero'], hosts: ['world-zero.fandom.com'] },
  { names: ['super league soccer'], hosts: ['super-league-soccer.fandom.com'] },
  { names: ['steal a brainrot'], hosts: ['stealabrainrot.fandom.com'] },
  { names: ['99 nights in the forest'], hosts: ['99-nights-in-the-forest.fandom.com'] },
  { names: ['attack on titan revolution'], hosts: ['attack-on-titan-revolution.fandom.com'] },
  { names: ['squid game x'], hosts: ['squid-game-x.fandom.com'] },
  { names: ['gym league'], hosts: ['gym-league.fandom.com'] },
  { names: ['pull a sword'], hosts: ['pull-a-sword.fandom.com'] },
  { names: ['flag wars'], hosts: ['flag-wars.fandom.com'] },
  { names: ['portal tower defense'], hosts: ['portaltowerdefense.fandom.com'] },
  { names: ['anime fighters simulator'], hosts: ['anime-fighters-simulator.fandom.com'] },
  { names: ['anime champions simulator'], hosts: ['anime-champions-simulator.fandom.com'] },
  { names: ['shinobi life 2'], hosts: ['shindo-life-rell.fandom.com'] },
  { names: ['project slayers'], hosts: ['project-slayers.fandom.com'] },
  { names: ['demonfall'], hosts: ['demonfall.fandom.com'] },
  { names: ['haze piece'], hosts: ['haze-piece.fandom.com'] },
  { names: ['kaizen'], hosts: ['kaizen-roblox.fandom.com'] },
  { names: ['clover retribution'], hosts: ['clover-retribution.fandom.com'] },
  { names: ['elemental dungeons'], hosts: ['elemental-dungeons.fandom.com'] },
  { names: ['death ball'], hosts: ['death-ball.fandom.com'] },
  { names: ['arm wrestle simulator'], hosts: ['arm-wrestle-simulator.fandom.com'] },
  { names: ['strongman simulator'], hosts: ['strongman-simulator.fandom.com'] },
  { names: ['car dealership tycoon'], hosts: ['car-dealership-tycoon.fandom.com'] },
  { names: ['vehicle legends'], hosts: ['vehicle-legends.fandom.com'] },
  { names: ['southwest florida'], hosts: ['southwest-florida-beta.fandom.com'] },
  { names: ['greenville'], hosts: ['greenville-wisconsin.fandom.com'] },
  { names: ['emergency response: liberty county'], hosts: ['police-roleplay-community.fandom.com'] },
  { names: ['build a boat for treasure'], hosts: ['build-a-boat-for-treasure.fandom.com'] },
  { names: ['natural disaster survival'], hosts: ['natural-disaster-survival.fandom.com'] },
  { names: ['piggy'], hosts: ['piggy.fandom.com'] },
  { names: ['epic minigames'], hosts: ['epic-minigames.fandom.com'] },
  { names: ['my restaurant'], hosts: ['my-restaurant.fandom.com'] },
  { names: ['restaurant tycoon 2'], hosts: ['restaurant-tycoon-2.fandom.com'] },
  { names: ['sonic speed simulator'], hosts: ['sonic-speed-simulator.fandom.com'] },
  { names: ['combat warriors'], hosts: ['combat-warriors.fandom.com'] },
  { names: ['heroes battlegrounds'], hosts: ['heroes-battlegrounds.fandom.com'] },
  { names: ['realm rampage'], hosts: ['realm-rampage.fandom.com'] },
  { names: ['meme sea'], hosts: ['meme-sea.fandom.com'] },
  { names: ['pets go'], hosts: ['pets-go.fandom.com'] },
  { names: ['sponge bob tower defense'], hosts: ['spongebob-tower-defense.fandom.com'] },
  { names: ['anime royale'], hosts: ['anime-royale.fandom.com'] },
  { names: ['anime shadow'], hosts: ['anime-shadow.fandom.com'] },
];

const WIKI_CODE_TITLES = [
  'Codes',
  'Promo_Codes',
  'Redeem_Codes',
  'List_of_Codes',
  'Twitter_Codes',
  'ATMs_&_Codes',
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

  const copyMatch = raw.match(/\{\{\s*CopyText\s*\|\s*([^}|]+?)\s*(?:\|[^}]*)?\}\}/i);
  if (copyMatch?.[1]) {
    const c = sanitizePlainText(copyMatch[1], 48);
    if (c) return c;
  }

  const codeTagMatch = raw.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
  if (codeTagMatch?.[1]) {
    const c = sanitizePlainText(codeTagMatch[1], 48);
    if (c) return c;
  }

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

  const plain = sanitizePlainText(raw, 64);
  if (!plain) return null;
  const cleaned = plain
    .replace(/\(new!?\)/gi, '')
    .replace(/\[new\]/gi, '')
    .replace(/\(expired\)/gi, '')
    .trim();
  return cleaned.split(/\s+/)[0] || cleaned;
}

function cleanGameNameForMatching(name) {
  return String(name || '')
    .replace(/^(?:\s*[\[\(\{][^\]\)\}]{1,40}[\]\)\}]\s*)+/g, '')
    .replace(/(?:\s*[\[\(\{][^\]\)\}]{1,40}[\]\)\}]\s*)+$/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ')
    .replace(/[|•·–—]+.*$/g, '')
    .replace(/[^a-zA-Z0-9\s:'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKnownGameName(cleanedLower, knownName) {
  if (cleanedLower === knownName) return true;
  // Allow trailing subtitle like "creatures of sonaria survive kaiju animals"
  // but reject numbered clones like "grow a garden 2" or prefix clones like "aura edit slap battles"
  if (cleanedLower.startsWith(`${knownName} `)) {
    const rest = cleanedLower.slice(knownName.length).trim();
    if (/^\d+$/.test(rest)) return false; // Reject "Game 2"
    if (/^(modded|remake|fan|test|testing|copy|edit|fake|rp|tycoon|obby)\b/.test(rest)) return false;
    return true;
  }
  return false;
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
    }
  }

  const cleaned = cleanGameNameForMatching(game.name).toLowerCase();

  for (const entry of KNOWN_WIKIS) {
    if (entry.names.some((kw) => matchesKnownGameName(cleaned, kw))) {
      for (const h of entry.hosts) pushHost(h);
    }
  }

  const slugBase = cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42);
  const compactSlug = cleaned.replace(/[^a-z0-9]+/g, '').slice(0, 36);

  if (slugBase.length >= 3) {
    pushHost(`${slugBase}.fandom.com`);
    if (compactSlug !== slugBase && compactSlug.length >= 4) {
      pushHost(`${compactSlug}.fandom.com`);
    }
    pushHost(`roblox-${slugBase}.fandom.com`);
    pushHost(`${slugBase}-roblox.fandom.com`);
  }

  return hosts.slice(0, 4);
}

async function fetchJsonFast(url, timeoutMs = 4000) {
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

  const res = await fetchJsonFast(apiUrl, 4000);
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

function parseMediaWikiCodes(wikitext, wikiPageUrl) {
  if (!wikitext || wikitext.length < 25) return [];

  const results = new Map();
  const lines = wikitext.split(/\r?\n/);

  let sectionState = 'active';
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

    if (/mw-collapsible/i.test(line) && !inTable) {
      const cls = classifySectionText(line);
      if (cls) sectionState = cls;
    }

    const headingMatch = line.match(/={2,5}\s*([^=]+?)\s*={2,5}/);
    if (headingMatch && !inTable) {
      flushTableRow();
      const cls = classifySectionText(headingMatch[1]);
      if (cls) sectionState = cls;
      continue;
    }

    const boldHeadingMatch = line.match(/^'''([^']{4,50})'''$/);
    if (boldHeadingMatch && !inTable) {
      const cls = classifySectionText(boldHeadingMatch[1]);
      if (cls) {
        flushTableRow();
        sectionState = cls;
        continue;
      }
    }

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
      if (currentRowCells.length > 0) {
        currentRowCells[currentRowCells.length - 1] += ` ${line}`;
      }
      continue;
    }

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
RoMetric — High-Speed Fandom MediaWiki Codes Sync (PC Native)

Usage:
  npm run sync:wiki [options]

Options:
  --concurrency=<n>     Parallel game workers (default: 20 on PC, 8 in CI; max: 30)
  --limit=<n|all>       Max games to scan from Supabase (default: all)
  --game="<name>"       Scan only games matching this name
  --only-missing        Only scan games that currently have 0 codes
  --dry-run             Discover codes without writing to Supabase
  --ci                  Non-interactive CI mode
`);
    process.exit(0);
  }

  console.log('\n================================================================');
  console.log('   RoMetric — High-Speed Fandom MediaWiki Codes Sync (v2.2)     ');
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

  // Save credentials into local .env.local so you don't have to paste them every time
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (!isCiMode && !fs.existsSync(envLocalPath)) {
    const saveAns = await promptInput('Save Supabase credentials to .env.local for future runs? (Y/n): ');
    if (!saveAns || saveAns.toLowerCase().startsWith('y')) {
      fs.writeFileSync(
        envLocalPath,
        `SUPABASE_URL="${supabaseUrl}"\nSUPABASE_SERVICE_ROLE_KEY="${serviceRoleKey}"\n`,
        'utf8'
      );
      console.log('✓ Saved credentials to .env.local (ignored by git)\n');
    }
  }

  const dryRun = hasFlag('dry-run');
  const onlyMissing = hasFlag('only-missing');
  const gameFilter = getArg('game');
  const limitArg = getArg('limit');
  const maxGames = limitArg && limitArg !== 'all' ? parseInt(limitArg, 10) || 200 : Infinity;
  const defaultWorkers = isCiMode ? 8 : 20;
  const concurrency = Math.min(30, Math.max(1, parseInt(getArg('concurrency') || String(defaultWorkers), 10)));

  console.log(`Supabase host:   ${new URL(supabaseUrl).host}`);
  console.log(`Source ID:       ${CODE_SOURCE_ID}`);
  console.log(`Workers:         ${concurrency} parallel workers`);
  console.log(`Mode:            ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE UPSERT'}${onlyMissing ? ' (only 0-code games)' : ''}\n`);

  const sbHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  // Verify / register fandom_mediawiki_api in code_sources with schema-valid provider_type='mediawiki'
  if (!dryRun) {
    const srcRes = await fetch(`${supabaseUrl}/rest/v1/code_sources?on_conflict=id`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        {
          id: CODE_SOURCE_ID,
          name: 'Community Wiki MediaWiki Action API',
          provider_type: 'mediawiki',
          enabled: true,
          requires_api_key: false,
          attribution_label: 'Fandom Community Wiki',
          attribution_url: 'https://www.fandom.com',
          license_notice: 'Community wiki text licensed under CC BY-SA (attribution & source link required)',
          rate_limit_rpm: 120,
          last_status: 'healthy',
          updated_at: new Date().toISOString(),
        },
      ]),
    });
    if (!srcRes.ok) {
      console.error(`✖ Failed verifying code_sources (${srcRes.status}):`, await srcRes.text());
      process.exit(1);
    }
    console.log(`✓ Verified "${CODE_SOURCE_ID}" in code_sources table`);
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
  let gamesSaved = 0;
  let dbErrors = 0;
  let totalCodesSaved = 0;
  let totalActiveSaved = 0;
  let totalExpiredSaved = 0;

  async function scanGame(game) {
    const uid = String(game.universe_id);
    const candidateHosts = buildWikiCandidateHosts(game);
    if (candidateHosts.length === 0) {
      return { name: game.name, total: 0, active: 0, expired: 0, wikiHost: null };
    }

    let matchedPage = null;

    if (game.wiki_subdomain) {
      const primary = await fetchMediaWikiCodesPage(candidateHosts[0]);
      if (primary.found) {
        matchedPage = primary;
      }
    }

    if (!matchedPage) {
      const probeHosts = game.wiki_subdomain ? candidateHosts.slice(1) : candidateHosts;
      const results = await Promise.all(probeHosts.map((h) => fetchMediaWikiCodesPage(h)));
      matchedPage = results.find((r) => r.found) || null;
    }

    if (!matchedPage) {
      return { name: game.name, total: 0, active: 0, expired: 0, wikiHost: null };
    }

    const parsed = parseMediaWikiCodes(matchedPage.wikitext, matchedPage.wikiUrl);
    if (parsed.length === 0) {
      return { name: game.name, total: 0, active: 0, expired: 0, wikiHost: null };
    }

    const nowIso = new Date().toISOString();
    const rows = parsed.map((c) => ({
      universe_id: Number(uid),
      code: c.code.slice(0, 48),
      normalized_code: c.normalized_code.slice(0, 48),
      reward_description: c.reward_description || null,
      status: c.status === 'expired' ? 'expired' : 'active',
      source_id: CODE_SOURCE_ID,
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

      if (!upRes.ok) {
        const errTxt = await upRes.text();
        return {
          name: game.name,
          total: 0,
          active: 0,
          expired: 0,
          wikiHost: matchedPage.host,
          dbError: `HTTP ${upRes.status}: ${errTxt.slice(0, 160)}`,
        };
      }

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

      const patchRes = await fetch(`${supabaseUrl}/rest/v1/games?universe_id=eq.${uid}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(patchBody),
      });
      if (!patchRes.ok) {
        const errTxt = await patchRes.text();
        console.warn(`  ⚠ Games count PATCH failed for ${game.name} (${patchRes.status}): ${errTxt.slice(0, 120)}`);
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

  async function worker() {
    while (idx < games.length) {
      const current = games[idx++];
      try {
        const result = await scanGame(current);
        processed++;
        if (result.dbError) {
          dbErrors++;
          console.error(`[${processed}/${games.length}] ✖ DB WRITE FAILED for ${result.name}: ${result.dbError}`);
        } else if (result.total > 0) {
          gamesSaved++;
          totalCodesSaved += result.total;
          totalActiveSaved += result.active;
          totalExpiredSaved += result.expired;
          console.log(
            `[${processed}/${games.length}] ✓ SAVED ${result.name}: ` +
            `${result.active} active, ${result.expired} expired (${result.wikiHost})`
          );
        } else if (processed % 40 === 0 || processed === games.length) {
          process.stdout.write(`  Progress: ${processed}/${games.length} scanned (${gamesSaved} saved, ${totalCodesSaved} codes)...\r`);
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
  console.log('✓ Fandom MediaWiki Codes Sync Complete!');
  console.log('================================================================');
  console.log(`  Games Scanned:         ${processed}`);
  console.log(`  Games Saved to DB:     ${gamesSaved}`);
  console.log(`  Active Codes Saved:    ${totalActiveSaved}`);
  console.log(`  Expired Codes Saved:   ${totalExpiredSaved}`);
  console.log(`  Total Codes Saved:     ${totalCodesSaved}`);
  console.log(`  DB Write Errors:       ${dbErrors}`);
  console.log(`  Elapsed Time:          ${elapsedSec} seconds`);
  console.log('================================================================\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [
      '### RoMetric Wiki Codes Sync Summary',
      '',
      '| Metric | Value |',
      '| --- | ---: |',
      `| Games Scanned | ${processed} |`,
      `| Games Saved to DB | ${gamesSaved} |`,
      `| Active Codes Saved | ${totalActiveSaved} |`,
      `| Expired Codes Saved | ${totalExpiredSaved} |`,
      `| Total Codes Saved | ${totalCodesSaved} |`,
      `| DB Write Errors | ${dbErrors} |`,
      `| Elapsed Time | ${elapsedSec}s |`,
      '',
    ].join('\n');
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
    } catch {}
  }

  if (dbErrors > 0 && gamesSaved === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
