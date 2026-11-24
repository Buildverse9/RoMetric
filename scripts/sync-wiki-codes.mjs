#!/usr/bin/env node
/**
 * RoMetric — High-Speed Fandom MediaWiki Codes Sync (v3.0 — Zero Rate-Limit Drops)
 *
 * Uses official public MediaWiki JSON APIs (CC-BY-SA) with ZERO API-key quotas.
 * Features:
 *  - Polite global rate limiter + automatic HTTP 429/403/503 cooldown & retries (no silent drops!)
 *  - Batch wiki pre-discovery from roblox.fandom.com (50 games per request) + 150+ verified wikis
 *  - Dual-Engine Parser: Wikitext (tables, tabbers, templates, *, #, plain lines) + Rendered HTML fallback (action=parse)
 *  - Wiki search fallback (finds "Code", "Game Codes", "Secret Codes", subpages like "Codes/Expired")
 *  - Direct active/expired classification (zero manual approval) with up to 1,000 codes per game
 *
 * Usage:
 *   npm run sync:wiki
 *   npm run sync:wiki -- --concurrency=8 --rps=12
 *   npm run sync:wiki -- --game="Blox Fruits"
 *   npm run sync:wiki -- --only-missing
 *   npm run sync:wiki -- --dry-run
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const USER_AGENT =
  'RoMetricWikiSync/3.0 (+https://rometrics.vercel.app; legitimate MediaWiki public API consumer)';

const CODE_SOURCE_ID = 'fandom_mediawiki_api';

// Curated verified Fandom MediaWiki mappings (exact/subtitle matching prevents clone mismatches)
const KNOWN_WIKIS = [
  { names: ['blox fruits'], hosts: ['blox-fruits.fandom.com'] },
  { names: ['pet simulator 99', 'pet sim 99'], hosts: ['pet-simulator.fandom.com'], extraPages: ['Codes_(Pet_Simulator_99)'] },
  { names: ['pet simulator x', 'pet sim x'], hosts: ['pet-simulator.fandom.com'], extraPages: ['Codes_(Pet_Simulator_X)'] },
  { names: ['pets go'], hosts: ['pets-go.fandom.com', 'pet-simulator.fandom.com'] },
  { names: ['adopt me'], hosts: ['adoptme.fandom.com'] },
  { names: ['brookhaven rp', 'brookhaven'], hosts: ['brookhaven-rp.fandom.com'] },
  { names: ['blade ball'], hosts: ['bladeball.fandom.com', 'blade-ball.fandom.com'] },
  { names: ['dress to impress'], hosts: ['dti-dress-to-impress.fandom.com'] },
  { names: ['anime defenders'], hosts: ['anime-defenders.fandom.com', 'animedefenders.fandom.com'] },
  { names: ['anime vanguards'], hosts: ['animevanguards.fandom.com', 'anime-vanguards.fandom.com'] },
  { names: ['anime last stand'], hosts: ['anime-last-stand.fandom.com'] },
  { names: ['anime reborn'], hosts: ['animereborn.fandom.com', 'anime-reborn.fandom.com'] },
  { names: ['anime adventures'], hosts: ['animeadventures.fandom.com'] },
  { names: ['anime fighters simulator'], hosts: ['anime-fighters-simulator.fandom.com'] },
  { names: ['anime champions simulator'], hosts: ['anime-champions-simulator.fandom.com'] },
  { names: ['anime royale'], hosts: ['anime-royale.fandom.com'] },
  { names: ['anime shadow'], hosts: ['anime-shadow.fandom.com'] },
  { names: ['anime rangers x'], hosts: ['anime-rangers-x.fandom.com'] },
  { names: ['all star tower defense x', 'astdx'], hosts: ['astdx.fandom.com'] },
  { names: ['all star tower defense', 'astd'], hosts: ['all-star-tower-defense.fandom.com', 'astd.fandom.com'] },
  { names: ['fisch'], hosts: ['fisch.fandom.com'] },
  { names: ['bee swarm simulator', 'beeswarm'], hosts: ['bee-swarm-simulator.fandom.com'] },
  { names: ['shindo life', 'shinobi life 2'], hosts: ['shindo-life-rell.fandom.com'] },
  { names: ['king legacy', 'king piece'], hosts: ['king-legacy.fandom.com'] },
  { names: ['tower defense simulator'], hosts: ['tds.fandom.com'] },
  { names: ['jailbreak'], hosts: ['jailbreak.fandom.com'] },
  { names: ['murder mystery 2'], hosts: ['murder-mystery-2.fandom.com'] },
  { names: ['toilet tower defense'], hosts: ['toilet-tower-defense.fandom.com'] },
  { names: ['rivals'], hosts: ['robloxrivals.fandom.com'] },
  { names: ['blue lock rivals', 'blue lock: rivals'], hosts: ['blue-lock-rivals.fandom.com'] },
  { names: ['basketball zero', 'basketball: zero'], hosts: ['basketball-zero.fandom.com', 'basketballzero.fandom.com'] },
  { names: ['volleyball legends', 'haikyuu legends'], hosts: ['volleyball-legends.fandom.com'] },
  { names: ['azure latch'], hosts: ['azure-latch.fandom.com'] },
  { names: ['arise crossover'], hosts: ['arise-crossover.fandom.com'] },
  { names: ['bubble gum simulator infinity'], hosts: ['bubble-gum-simulator-infinity.fandom.com', 'bgsi.fandom.com'] },
  { names: ['bubble gum simulator'], hosts: ['bubble-gum-simulator.fandom.com'] },
  { names: ["sol's rng", 'sols rng'], hosts: ['sol-rng.fandom.com'] },
  { names: ['fruit battlegrounds'], hosts: ['fruit-battlegrounds.fandom.com'] },
  { names: ['grand piece online'], hosts: ['grand-piece-online.fandom.com'] },
  { names: ['your bizarre adventure'], hosts: ['your-bizarre-adventure.fandom.com'] },
  { names: ['a universal time'], hosts: ['a-universal-time-roblox.fandom.com'] },
  { names: ['driving empire'], hosts: ['drivingempire.fandom.com'] },
  { names: ['da hood'], hosts: ['dahood.fandom.com', 'da-hood.fandom.com'] },
  { names: ['slap battles'], hosts: ['roblox-slap-battles.fandom.com'] },
  { names: ['doors'], hosts: ['doors-game.fandom.com'] },
  { names: ['peroxide'], hosts: ['peroxide.fandom.com'] },
  { names: ['type soul', 'type://soul'], hosts: ['type-soul.fandom.com'] },
  { names: ['jujutsu shenanigans'], hosts: ['jujutsu-shenanigans.fandom.com'] },
  { names: ['jujutsu infinite'], hosts: ['jujutsuinfinite.fandom.com'] },
  { names: ['grow a garden'], hosts: ['growagarden.fandom.com'] },
  { names: ['dead rails'], hosts: ['dead-rails.fandom.com'] },
  { names: ['spongebob tower defense', 'sponge bob tower defense'], hosts: ['spongebob-tower-defense.fandom.com'] },
  { names: ["dandy's world", 'dandys world'], hosts: ['dandys-world-robloxhorror.fandom.com'] },
  { names: ['the strongest battlegrounds'], hosts: ['the-strongest-battlegrounds-rblx.fandom.com'] },
  { names: ['heroes battlegrounds'], hosts: ['heroes-battlegrounds.fandom.com'] },
  { names: ['realm rampage'], hosts: ['realm-rampage.fandom.com'] },
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
  { names: ['evade'], hosts: ['evade.fandom.com', 'evade-nextbot.fandom.com'] },
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
  { names: ['war tycoon'], hosts: ['war-tycoon-roblox.fandom.com'] },
  { names: ['mini war'], hosts: ['mini-war-roblox.fandom.com'] },
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
  { names: ['emergency response: liberty county', 'emergency response liberty county'], hosts: ['police-roleplay-community.fandom.com'] },
  { names: ['build a boat for treasure'], hosts: ['build-a-boat-for-treasure.fandom.com'] },
  { names: ['natural disaster survival'], hosts: ['natural-disaster-survival.fandom.com'] },
  { names: ['piggy'], hosts: ['piggy.fandom.com'] },
  { names: ['epic minigames'], hosts: ['epic-minigames.fandom.com'] },
  { names: ['my restaurant'], hosts: ['my-restaurant.fandom.com'] },
  { names: ['restaurant tycoon 2'], hosts: ['restaurant-tycoon-2.fandom.com'] },
  { names: ['sonic speed simulator'], hosts: ['sonic-speed-simulator.fandom.com'] },
  { names: ['combat warriors'], hosts: ['combat-warriors.fandom.com'] },
  { names: ['meme sea'], hosts: ['meme-sea.fandom.com'] },
  { names: ['untitled boxing game'], hosts: ['untitled-boxing-game.fandom.com', 'roblox-untitled-boxing-game.fandom.com'] },
  { names: ['muscle legends'], hosts: ['muscle-legends.fandom.com'] },
  { names: ['ninja legends'], hosts: ['ninja-legends.fandom.com'] },
  { names: ['legends of speed'], hosts: ['legends-of-speed.fandom.com'] },
  { names: ['mining simulator 2'], hosts: ['mining-simulator-2.fandom.com'] },
  { names: ['clicker simulator'], hosts: ['clicker-simulator-info.fandom.com'] },
  { names: ['big paintball', 'big paintball 2'], hosts: ['big-paintball.fandom.com'] },
  { names: ['tower heroes'], hosts: ['towerheroes.fandom.com'] },
  { names: ['allusions'], hosts: ['allusions-roblox.fandom.com'] },
  { names: ['funky friday'], hosts: ['funky-friday.fandom.com'] },
  { names: ['ro-ghoul', 'roghoul'], hosts: ['roghoul-rblx.fandom.com'] },
  { names: ['ghoul://re', 'ghoul re'], hosts: ['ghoul-re.fandom.com'] },
  { names: ['anime dimensions', 'anime dimensions simulator'], hosts: ['anime-dimensions.fandom.com'] },
  { names: ['anime punch simulator'], hosts: ['anime-punch-simulator.fandom.com'] },
  { names: ['a one piece game'], hosts: ['a-one-piece-game.fandom.com'] },
  { names: ['bloxburg'], hosts: ['welcome-to-bloxburg.fandom.com'] },
  { names: ['mad city'], hosts: ['mad-city.fandom.com'] },
  { names: ['bad business'], hosts: ['bad-business.fandom.com'] },
  { names: ['island royale'], hosts: ['island-royale.fandom.com'] },
  { names: ['islands'], hosts: ['robloxislands.fandom.com'] },
  { names: ['mining simulator'], hosts: ['mining-simulator.fandom.com'] },
  { names: ['super power fighting simulator'], hosts: ['super-power-fighting-simulator.fandom.com'] },
  { names: ['strongest punch simulator'], hosts: ['strongest-punch-simulator.fandom.com'] },
  { names: ['tapping simulator'], hosts: ['tapping-simulator.fandom.com'] },
  { names: ['weight lifting simulator 3'], hosts: ['weight-lifting-simulator-3.fandom.com'] },
  { names: ['dungeon quest'], hosts: ['dungeonquestroblox.fandom.com'] },
  { names: ['tower battles'], hosts: ['tower-battles.fandom.com'] },
  { names: ['monster islands'], hosts: ['monster-islands.fandom.com'] },
  { names: ['dragon ball online generations'], hosts: ['dbog.fandom.com'] },
  { names: ['blackhawk rescue mission 5'], hosts: ['roblox-blackhawk-rescue-mission-5.fandom.com'] },
  { names: ['booga booga'], hosts: ['booga-booga-roblox.fandom.com'] },
  { names: ['sharkbite', 'sharkbite 2'], hosts: ['sharkbite-roblox.fandom.com'] },
  { names: ['zombie attack'], hosts: ['zombie-attack-roblox.fandom.com'] },
  { names: ['vehicle simulator'], hosts: ['vehicle-simulator.fandom.com'] },
  { names: ['ultimate driving'], hosts: ['ultimate-driving.fandom.com'] },
  { names: ['theme park tycoon 2'], hosts: ['theme-park-tycoon-2.fandom.com'] },
  { names: ['lumber tycoon 2'], hosts: ['lumber-tycoon-2.fandom.com'] },
  { names: ['retail tycoon 2'], hosts: ['retail-tycoon-2.fandom.com'] },
  { names: ['clone tycoon 2'], hosts: ['clone-tycoon-2.fandom.com'] },
  { names: ['super hero tycoon'], hosts: ['super-hero-tycoon.fandom.com'] },
  { names: ['miner\'s haven', 'miners haven'], hosts: ['minershaven.fandom.com'] },
  { names: ['vampire hunters 3'], hosts: ['vampire-hunters-3.fandom.com'] },
  { names: ['westbound'], hosts: ['westbound-roblox.fandom.com'] },
  { names: ['the wild west'], hosts: ['thewildwest.fandom.com'] },
  { names: ['military tycoon'], hosts: ['military-tycoon.fandom.com'] },
  { names: ['weapon fighting simulator'], hosts: ['weapon-fighting-simulator.fandom.com'] },
  { names: ['swordburst 2', 'swordburst 3'], hosts: ['swordburst2.fandom.com'] },
  { names: ['bloxston mystery'], hosts: ['bloxston-mystery.fandom.com'] },
  { names: ['tower of hell'], hosts: ['tower-of-hell.fandom.com'] },
  { names: ['parkour', 'parkour reborn'], hosts: ['roblox-parkour.fandom.com'] },
  { names: ['mm2'], hosts: ['murder-mystery-2.fandom.com'] },
  { names: ['hunty zombie'], hosts: ['hunty-zombie.fandom.com'] },
  { names: ['ball vs ball'], hosts: ['ball-vs-ball.fandom.com'] },
];

const WIKI_CODE_TITLES = [
  'Codes',
  'Code',
  'Promo_Codes',
  'Redeem_Codes',
  'List_of_Codes',
  'Twitter_Codes',
  'Game_Codes',
  'Active_Codes',
  'ATMs_&_Codes',
  'Codes/Active',
  'Codes/Expired',
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
  'CURRENT', 'PREVIOUS', 'OLD', 'ALL', 'LIST', 'TABLE', 'SECTION', 'INFO',
  'INFORMATION', 'NOTE', 'WARNING', 'TIP', 'TIPS', 'HELP', 'GUIDE', 'HOW',
  'VERSION', 'PATCH', 'EVENT', 'EVENTS', 'SEASON', 'LIMITED', 'SPECIAL',
  'PROMO', 'CREATOR', 'DEVELOPER', 'OFFICIAL', 'COMMUNITY', 'SERVER',
]);

// ============================================================================
// Global Polite Rate Limiter + Cooldown Manager (Eliminates Fastly 429 Bans!)
// ============================================================================
let rateLimitCooldownUntil = 0;
let totalRateLimitHits = 0;
let totalHttpRetries = 0;
let lastTokenTime = 0;
let minIntervalMs = 80; // default ~12.5 req/s

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireRateToken() {
  while (true) {
    const now = Date.now();
    if (now < rateLimitCooldownUntil) {
      await sleep(rateLimitCooldownUntil - now + Math.floor(Math.random() * 250));
      continue;
    }
    const nextSlot = Math.max(now, lastTokenTime + minIntervalMs);
    lastTokenTime = nextSlot;
    const waitMs = nextSlot - now;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    if (Date.now() >= rateLimitCooldownUntil) {
      return;
    }
  }
}

function triggerGlobalCooldown(ms, reason) {
  const target = Date.now() + ms;
  if (target > rateLimitCooldownUntil) {
    rateLimitCooldownUntil = target;
    console.warn(`\n  ⏸ Fandom rate limit (${reason}) — pausing all workers for ${(ms / 1000).toFixed(1)}s to prevent dropped games...`);
  }
}

// ============================================================================
// CLI & Environment Helpers
// ============================================================================
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

// ============================================================================
// Text Cleaning & Code Validation
// ============================================================================
function normalizePromoCode(raw) {
  return String(raw || '').trim().replace(/\s+/g, '').toUpperCase();
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function sanitizePlainText(raw, maxLen = 180) {
  if (!raw) return null;
  const cleaned = decodeHtmlEntities(
    String(raw)
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
  )
    .replace(/\s+/g, ' ')
    .replace(/^[,*•\s]+|[,*•\s]+$/g, '')
    .trim();
  return cleaned ? cleaned.slice(0, maxLen) : null;
}

function isValidPromoCodeFormat(raw) {
  const trimmed = String(raw || '').trim();
  if (trimmed.length < 3 || trimmed.length > 48) return false;
  if (!/^[A-Za-z0-9_!@#$%&*+?<>/-]+(?: [A-Za-z0-9_!@#$%&*+?<>/-]+)*$/.test(trimmed)) {
    return false;
  }
  const words = trimmed.split(/\s+/);
  if (words.length > 4) return false;
  if (
    words.length > 1 &&
    /\b(gives|grants|unlocks|players|redeem|minutes|seconds|hours|released|expired|active|working|added|removed|update|codes|reward|rewards|twitter|discord)\b/i.test(trimmed)
  ) {
    return false;
  }
  // Reject obvious date strings like "Jan 2024" or "2024-05-01" or "12/25/2024"
  if (/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,4}/i.test(trimmed)) {
    return false;
  }
  if (/^\d{1,4}[-/]\d{1,2}(?:[-/]\d{2,4})?$/.test(trimmed)) return false;
  if (/^\d{1,5}$/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  const upper = trimmed.toUpperCase();
  if (STOP_WORDS.has(upper)) return false;
  if (/^[^A-Za-z0-9]+$/.test(trimmed)) return false;
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

function cleanGameNameForMatching(name) {
  return String(name || '')
    // 1. Strip emojis & decorative symbols FIRST so leading emojis don't block bracket stripping!
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D★☆✦✧✨⚡🔥❄️🎄🎃🌸💎⚔️🛡️]+/gu, ' ')
    // 2. Strip ALL [bracketed] and {braced} update/event tags anywhere in the title
    .replace(/\[[^\]]{0,60}\]/g, ' ')
    .replace(/\{[^}]{0,60}\}/g, ' ')
    // 3. Strip trailing/leading parenthetical tags like (UPD 5), (Beta), (NEW)
    .replace(/\(\s*(?:upd|update|new|beta|alpha|event|part|season|v\d|2x|x2|free|limited|revamp|rework|early|test)[^)]{0,45}\)/gi, ' ')
    // 4. Cut trailing subtitles after pipe/bullet/dash dividers
    .replace(/[|•·–—~]+.*$/g, '')
    // 5. Strip remaining special characters except letters, digits, spaces, apostrophe, colon, hyphen
    .replace(/[^a-zA-Z0-9\s:'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKnownGameName(cleanedLower, knownName) {
  const normA = cleanedLower.replace(/[:'-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normB = knownName.replace(/[:'-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleanedLower === knownName || normA === normB) return true;
  if (normA.startsWith(`${normB} `)) {
    const rest = normA.slice(normB.length).trim();
    if (/^\d+$/.test(rest)) return false; // Reject numbered clones like "grow a garden 2"
    if (/^(modded|remake|fan|test|testing|copy|edit|fake|rp|tycoon|obby|rng|simulator|sandbox|but|with)\b/.test(rest)) {
      return false;
    }
    return true;
  }
  return false;
}

function findKnownWikiEntry(gameName) {
  const cleaned = cleanGameNameForMatching(gameName).toLowerCase();
  for (const entry of KNOWN_WIKIS) {
    if (entry.names.some((kw) => matchesKnownGameName(cleaned, kw))) {
      return entry;
    }
  }
  return null;
}

function buildWikiCandidateHosts(game, robloxWikiDiscoveredHost = null) {
  const hosts = [];
  const pushHost = (h) => {
    const clean = String(h || '').toLowerCase().trim();
    if (clean && !hosts.includes(clean)) hosts.push(clean);
  };

  let isVerifiedKnown = false;

  if (game.wiki_subdomain) {
    pushHost(game.wiki_subdomain.includes('.') ? game.wiki_subdomain : `${game.wiki_subdomain}.fandom.com`);
    isVerifiedKnown = true;
  }

  if (robloxWikiDiscoveredHost) {
    pushHost(robloxWikiDiscoveredHost);
    isVerifiedKnown = true;
  }

  const known = findKnownWikiEntry(game.name);
  if (known) {
    for (const h of known.hosts) pushHost(h);
    isVerifiedKnown = true;
  }

  const cleaned = cleanGameNameForMatching(game.name).toLowerCase();
  const slugBase = cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42);
  const compactSlug = cleaned.replace(/[^a-z0-9]+/g, '').slice(0, 36);

  if (slugBase.length >= 3) {
    pushHost(`${slugBase}.fandom.com`);
    if (compactSlug !== slugBase && compactSlug.length >= 4) {
      pushHost(`${compactSlug}.fandom.com`);
    }
    if (!isVerifiedKnown) {
      pushHost(`roblox-${slugBase}.fandom.com`);
      pushHost(`${slugBase}-roblox.fandom.com`);
    }
  }

  return {
    hosts: hosts.slice(0, isVerifiedKnown ? 3 : 4),
    extraPages: known?.extraPages || [],
  };
}

// ============================================================================
// Polite MediaWiki HTTP Client (Automatic 429/403/503 Backoff & Retry!)
// ============================================================================
async function fetchMediaWikiJson(url, timeoutMs = 5000, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await acquireRateToken();
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

      if (res.status === 429 || res.status === 403 || res.status === 503) {
        totalRateLimitHits++;
        totalHttpRetries++;
        const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
        const backoffMs = retryAfter > 0
          ? Math.min(retryAfter * 1000, 20000)
          : Math.min(4000 * attempt, 15000);
        triggerGlobalCooldown(backoffMs, `HTTP ${res.status}`);
        if (attempt < maxRetries) {
          continue;
        }
        return { ok: false, status: res.status, data: null };
      }

      if (res.status === 404 || res.status === 410) {
        return { ok: false, status: res.status, data: null };
      }

      if (!res.ok) {
        if (attempt < maxRetries && res.status >= 500) {
          totalHttpRetries++;
          await sleep(1000 * attempt);
          continue;
        }
        return { ok: false, status: res.status, data: null };
      }

      const data = await res.json();
      return { ok: true, status: res.status, data };
    } catch {
      clearTimeout(timer);
      if (attempt < maxRetries) {
        totalHttpRetries++;
        await sleep(600 * attempt);
        continue;
      }
      return { ok: false, status: 0, data: null };
    }
  }
  return { ok: false, status: 0, data: null };
}

// ============================================================================
// Batch Pre-Discovery from roblox.fandom.com (50 games per single HTTP call!)
// ============================================================================
async function prediscoverWikisFromRobloxFandom(games) {
  const discovered = new Map(); // universe_id -> host
  const BATCH_SIZE = 45;

  // Map cleaned title -> list of games
  const titleToGames = new Map();
  for (const g of games) {
    if (g.wiki_subdomain || findKnownWikiEntry(g.name)) continue;
    const cleaned = cleanGameNameForMatching(g.name);
    if (cleaned.length < 3 || cleaned.length > 60) continue;
    const key = cleaned.toLowerCase();
    if (!titleToGames.has(key)) titleToGames.set(key, { title: cleaned, games: [] });
    titleToGames.get(key).games.push(g);
  }

  const uniqueEntries = Array.from(titleToGames.values());
  if (uniqueEntries.length === 0) return discovered;

  console.log(`Pre-discovering official Fandom wikis via roblox.fandom.com (${uniqueEntries.length} titles in ${Math.ceil(uniqueEntries.length / BATCH_SIZE)} fast batches)...`);

  const IGNORED_SUBDOMAINS = new Set([
    'community', 'roblox', 'www', 'fandom', 'help', 'dev', 'templates',
    'wikipedia', 'minecraft', 'onepiece', 'naruto', 'dragonball', 'bleach',
    'jujutsu-kaisen', 'jojo', 'spongebob', 'pokemon', 'sonic', 'starwars',
  ]);

  for (let i = 0; i < uniqueEntries.length; i += BATCH_SIZE) {
    const batch = uniqueEntries.slice(i, i + BATCH_SIZE);
    const titlesParam = batch.map((b) => b.title).join('|');
    const url =
      `https://roblox.fandom.com/api.php?action=query&prop=iwlinks&iwprefix=w&iwlimit=500` +
      `&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(titlesParam)}`;

    const res = await fetchMediaWikiJson(url, 6000, 2);
    if (!res.ok || !res.data?.query) continue;

    // Build redirect/normalization chains back to original queried title
    const normMap = new Map();
    for (const n of res.data.query.normalized || []) {
      normMap.set(n.to, n.from);
    }
    const redirMap = new Map();
    for (const r of res.data.query.redirects || []) {
      redirMap.set(r.to, normMap.get(r.from) || r.from);
    }

    for (const p of res.data.query.pages || []) {
      if (p.missing || !Array.isArray(p.iwlinks)) continue;
      const origTitle = redirMap.get(p.title) || normMap.get(p.title) || p.title;
      const entry = titleToGames.get(String(origTitle || '').toLowerCase());
      if (!entry) continue;

      for (const iw of p.iwlinks) {
        const m = String(iw.title || '').match(/^c:([a-z0-9-]{3,50})(?::|$)/i);
        if (!m) continue;
        const sub = m[1].toLowerCase();
        if (IGNORED_SUBDOMAINS.has(sub)) continue;
        const host = `${sub}.fandom.com`;
        for (const g of entry.games) {
          if (!discovered.has(String(g.universe_id))) {
            discovered.set(String(g.universe_id), host);
          }
        }
        break;
      }
    }
  }

  console.log(`✓ Pre-discovered ${discovered.size} verified game wikis directly from roblox.fandom.com\n`);
  return discovered;
}

// ============================================================================
// Fetch Codes Page(s) + Search Fallback + Rendered HTML Fallback
// ============================================================================
async function fetchMediaWikiCodesPages(host, extraPages = []) {
  const titleList = [...new Set([...extraPages, ...WIKI_CODE_TITLES])];
  const titlesParam = titleList.join('|');
  const apiUrl =
    `https://${host}/api.php?action=query&prop=revisions&rvprop=content&rvslots=main` +
    `&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(titlesParam)}`;

  const res = await fetchMediaWikiJson(apiUrl, 5000, 3);
  if (!res.ok || !res.data?.query?.pages) {
    return { found: false, host, pages: [] };
  }

  const foundPages = [];
  for (const p of res.data.query.pages) {
    if (p.missing || !p.revisions?.length) continue;
    const rev = p.revisions[0];
    const wikitext = rev?.slots?.main?.content ?? rev?.content ?? '';
    if (typeof wikitext === 'string' && wikitext.length >= 25) {
      const pageSlug = encodeURIComponent(String(p.title || 'Codes').replace(/ /g, '_'));
      foundPages.push({
        host,
        title: p.title,
        wikiUrl: `https://${host}/wiki/${pageSlug}`,
        wikitext,
      });
    }
  }

  // Wiki exists (HTTP 200 JSON) but none of the default page titles existed -> try 1 quick wiki search!
  if (foundPages.length === 0) {
    const searchUrl =
      `https://${host}/api.php?action=query&list=search&srsearch=Codes&srlimit=3&format=json&formatversion=2`;
    const sRes = await fetchMediaWikiJson(searchUrl, 4500, 2);
    const hits = (sRes.data?.query?.search || [])
      .map((x) => x.title)
      .filter((t) => /\bcode/i.test(String(t || '')) && !/private server|music|song|audio|id\b/i.test(String(t || '')));

    if (hits.length > 0) {
      const fetchUrl =
        `https://${host}/api.php?action=query&prop=revisions&rvprop=content&rvslots=main` +
        `&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(hits.slice(0, 2).join('|'))}`;
      const fRes = await fetchMediaWikiJson(fetchUrl, 5000, 2);
      for (const p of fRes.data?.query?.pages || []) {
        if (p.missing || !p.revisions?.length) continue;
        const rev = p.revisions[0];
        const wikitext = rev?.slots?.main?.content ?? rev?.content ?? '';
        if (typeof wikitext === 'string' && wikitext.length >= 25) {
          const pageSlug = encodeURIComponent(String(p.title || 'Codes').replace(/ /g, '_'));
          foundPages.push({
            host,
            title: p.title,
            wikiUrl: `https://${host}/wiki/${pageSlug}`,
            wikitext,
          });
        }
      }
    }
  }

  if (foundPages.length === 0) {
    return { found: false, host, pages: [] };
  }

  // Follow linked subpages like [[Codes/Expired]] or [[Expired Codes]] if present
  const existingTitlesLower = new Set(foundPages.map((p) => p.title.toLowerCase()));
  const subpageTargets = [];
  for (const fp of foundPages) {
    const linkMatches = fp.wikitext.matchAll(/\[\[([^\]]{3,70})\]\]/g);
    for (const m of linkMatches) {
      const target = m[1].split('|')[0].split('#')[0].trim();
      if (
        /^(?:codes\/(?:expired|active|old|working)|expired[_ ]codes|active[_ ]codes|old[_ ]codes)$/i.test(target) &&
        !existingTitlesLower.has(target.toLowerCase()) &&
        !subpageTargets.includes(target)
      ) {
        subpageTargets.push(target);
      }
    }
  }

  if (subpageTargets.length > 0) {
    const subUrl =
      `https://${host}/api.php?action=query&prop=revisions&rvprop=content&rvslots=main` +
      `&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(subpageTargets.slice(0, 2).join('|'))}`;
    const subRes = await fetchMediaWikiJson(subUrl, 5000, 2);
    for (const p of subRes.data?.query?.pages || []) {
      if (p.missing || !p.revisions?.length) continue;
      const rev = p.revisions[0];
      const wikitext = rev?.slots?.main?.content ?? rev?.content ?? '';
      if (typeof wikitext === 'string' && wikitext.length >= 25) {
        const pageSlug = encodeURIComponent(String(p.title).replace(/ /g, '_'));
        foundPages.push({
          host,
          title: p.title,
          wikiUrl: `https://${host}/wiki/${pageSlug}`,
          wikitext,
        });
      }
    }
  }

  return { found: true, host, pages: foundPages };
}

async function fetchRenderedHtml(host, title) {
  const url =
    `https://${host}/api.php?action=parse&page=${encodeURIComponent(title)}` +
    `&prop=text&redirects=1&format=json&formatversion=2`;
  const res = await fetchMediaWikiJson(url, 6000, 2);
  if (!res.ok || typeof res.data?.parse?.text !== 'string') return null;
  return res.data.parse.text;
}

// ============================================================================
// Dual-Engine Code Parsers (Wikitext + Rendered MediaWiki HTML)
// ============================================================================
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

  const boldHtmlMatch = raw.match(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/i);
  if (boldHtmlMatch?.[1]) {
    const c = sanitizePlainText(boldHtmlMatch[1], 48);
    if (c) {
      return c
        .replace(/\(new!?\)/gi, '')
        .replace(/\[new\]/gi, '')
        .replace(/\(expired\)/gi, '')
        .trim();
    }
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

function createCodeCollector(wikiPageUrl) {
  const results = new Map();

  const upsert = (rawCode, reward, status, expiresAt = null) => {
    const cleanedCode = String(rawCode || '')
      .replace(/\(new!?\)/gi, '')
      .replace(/\[new\]/gi, '')
      .replace(/\(expired\)/gi, '')
      .replace(/^["'`•*#]+|["'`,.:;]+$/g, '')
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

  return { results, upsert };
}

function parseMediaWikiCodes(wikitext, wikiPageUrl, pageTitle = '') {
  if (!wikitext || wikitext.length < 20) return [];

  const { results, upsert: upsertCode } = createCodeCollector(wikiPageUrl);
  const lines = wikitext.split(/\r?\n/);

  // Infer initial section from page title (e.g. "Codes/Expired" starts expired!)
  let sectionState = classifySectionText(pageTitle) || 'active';
  let inTabber = false;
  let inTable = false;
  let currentRowCells = [];
  let currentRowStyle = '';
  let tableHeaders = [];

  const flushTableRow = () => {
    if (currentRowCells.length === 0) return;

    let codeCol = 0;
    let rewardCol = 1;
    let statusCol = -1;
    let expiryCol = -1;

    if (tableHeaders.length > 0) {
      const idxCode = tableHeaders.findIndex((h) => /\bcode/i.test(h));
      const idxReward = tableHeaders.findIndex((h) => /\b(reward|effect|benefit|prize|gift|item|gives|what)\b/i.test(h));
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
          if (parsedTs < Date.now()) status = 'expired';
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

    // Tabber blocks
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

    // Section headings (== Active Codes ==, === Expired ===)
    const headingMatch = line.match(/={2,5}\s*([^=]+?)\s*={2,5}/);
    if (headingMatch && !inTable) {
      flushTableRow();
      const cls = classifySectionText(headingMatch[1]);
      if (cls) sectionState = cls;
      continue;
    }

    // Plain or bold section headers like "Active Codes:" or "'''Expired Codes'''"
    const boldHeadingMatch = line.match(/^(?:''')?([A-Za-z ]{4,42}(?:codes|code))(?::)?(?:''')?:?$/i);
    if (boldHeadingMatch && !inTable) {
      const cls = classifySectionText(boldHeadingMatch[1]);
      if (cls) {
        flushTableRow();
        sectionState = cls;
        continue;
      }
    }

    // Template rows: {{Code|CODE|Reward|Active}}
    const tplMatch = line.match(/^\{\{\s*(?:Code|CodesRow|CodeRow|PromoCode|CodeTableRow)\s*\|(.+?)\}\}$/i);
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
      if (cVal) upsertCode(cVal, rVal, status);
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
      if (currentRowCells.length > 0) {
        currentRowCells[currentRowCells.length - 1] += ` ${line}`;
      }
      continue;
    }

    // Bullet lists (*) AND Numbered lists (#) — fixes Blue Lock: Rivals, etc.!
    if (line.startsWith('*') || line.startsWith('#')) {
      const isStrike = /<(?:s|del|strike)\b/i.test(line);
      const listMatch = line.match(
        /^[*#]+\s*(?:<(?:s|del|strike)[^>]*>)?(?:'''|<code>|<b>|["'`])?([A-Za-z0-9_!@#$%&*+?<>/-]{3,42})(?:'''|<\/code>|<\/b>|["'`])?(?:<\/(?:s|del|strike)>)?\s*(?:[-–—:|]\s*(.+))?$/i
      );
      if (listMatch) {
        const codeToken = listMatch[1].trim();
        const reward = sanitizePlainText(listMatch[2], 180);
        const status =
          isStrike || /\b(expired|inactive|invalid)\b/i.test(line) || sectionState === 'expired'
            ? 'expired'
            : 'active';
        upsertCode(codeToken, reward, status);
      }
      continue;
    }

    // Plain lines: "DinoxLive - +100,000 $" or "'''CODE''' - Reward" — fixes King Legacy, etc.!
    if (!line.startsWith('{{') && !line.startsWith('[[') && !line.startsWith('<')) {
      const plainMatch = line.match(
        /^(?:'''|<code>|<b>|["'`])?([A-Za-z0-9_!@#$%&*+?<>/-]{3,36})(?:'''|<\/code>|<\/b>|["'`])?\s*[-–—:]\s+(.{3,160})$/
      );
      if (plainMatch) {
        const token = plainMatch[1].trim();
        const reward = sanitizePlainText(plainMatch[2], 180);
        // Require reward to look like a game reward or code note so prose sentences don't leak in
        if (
          reward &&
          /(\d|free|cash|gem|coin|spin|reset|stat|beli|yen|exp|xp|boost|key|crate|chest|fruit|item|title|skin|reward|redeem|money|gold|beli|\$)/i.test(reward)
        ) {
          const status = /\(expired\)|\bexpired\b/i.test(line) || sectionState === 'expired' ? 'expired' : 'active';
          upsertCode(token, reward, status);
        }
      }
    }
  }

  flushTableRow();
  return Array.from(results.values()).slice(0, 1000);
}

// Rendered MediaWiki HTML parser (executes all Fandom Templates & Lua Modules!)
function parseRenderedHtmlCodes(html, wikiPageUrl, pageTitle = '') {
  if (!html || html.length < 40) return [];
  const { results, upsert: upsertCode } = createCodeCollector(wikiPageUrl);

  // Strip navboxes, toc, script, style so unrelated links don't pollute
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<div[^>]*class="[^"]*(?:navbox|toc|mbox|notice|ambox)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, ' ');

  let sectionState = classifySectionText(pageTitle) || 'active';

  // Extract ordered tokens: headings, tabber markers, tables, and list items
  const blockRegex =
    /(<h[2-5][^>]*>[\s\S]*?<\/h[2-5]>|<div[^>]*class="[^"]*wds-tab__content[^"]*"[^>]*>|<table[\s\S]*?<\/table>|<li[^>]*>[\s\S]*?<\/li>)/gi;

  // Also map tabber labels from <ul class="wds-tabs"> if present
  const tabLabels = [];
  const tabLabelMatches = cleanHtml.matchAll(/<div[^>]*class="[^"]*wds-tabs__tab-label[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
  for (const m of tabLabelMatches) {
    tabLabels.push(sanitizePlainText(m[1], 60) || '');
  }
  let tabIndex = 0;

  let match;
  while ((match = blockRegex.exec(cleanHtml)) !== null) {
    const block = match[1];

    if (/^<h[2-5]\b/i.test(block)) {
      const headingText = sanitizePlainText(block, 80);
      const cls = classifySectionText(headingText);
      if (cls) sectionState = cls;
      continue;
    }

    if (/^<div[^>]*wds-tab__content/i.test(block)) {
      const label = tabLabels[tabIndex++] || '';
      const cls = classifySectionText(label);
      if (cls) sectionState = cls;
      continue;
    }

    if (/^<table\b/i.test(block)) {
      let headers = [];
      const captionMatch = block.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
      if (captionMatch) {
        const cls = classifySectionText(sanitizePlainText(captionMatch[1], 80));
        if (cls) sectionState = cls;
      }

      const rowMatches = block.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi);
      for (const rm of rowMatches) {
        const trAttrs = rm[1] || '';
        const trInner = rm[2] || '';

        // Header row?
        const thCells = [...trInner.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((x) =>
          (sanitizePlainText(x[1], 40) || '').toLowerCase()
        );
        const tdCells = [...trInner.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];

        if (thCells.length > 0 && tdCells.length === 0) {
          headers = thCells;
          continue;
        }
        if (tdCells.length === 0) continue;

        let codeCol = 0;
        let rewardCol = 1;
        let statusCol = -1;
        let expiryCol = -1;

        if (headers.length > 0) {
          const iCode = headers.findIndex((h) => /\bcode/i.test(h));
          const iReward = headers.findIndex((h) => /\b(reward|effect|benefit|prize|gift|item|gives|what)\b/i.test(h));
          const iStatus = headers.findIndex((h) => /\b(status|state|working|active)\b/i.test(h));
          const iExpiry = headers.findIndex((h) => /\b(expir|removed|end date)\b/i.test(h));
          if (iCode !== -1) codeCol = iCode;
          if (iReward !== -1) rewardCol = iReward;
          if (iStatus !== -1) statusCol = iStatus;
          if (iExpiry !== -1) expiryCol = iExpiry;
        }

        const codeTd = tdCells[codeCol];
        if (!codeTd) continue;

        const rawCellHtml = codeTd[2];
        const cellAttrs = `${trAttrs} ${codeTd[1]}`;
        const isStrike = /<(?:s|del|strike)\b/i.test(rawCellHtml);
        const isRed = /(?:background(?:-color)?\s*:\s*(?:#(?:f[0-9a-f]{2}|e[0-9a-f]{2}|ff[0-7]|d95|c03|b22)|red|indianred|lightcoral|mistyrose|salmon)|expired)/i.test(
          cellAttrs
        );

        const codeToken = extractPrimaryCodeFromCell(rawCellHtml);
        if (!codeToken) continue;

        const rewardRaw =
          rewardCol >= 0 && tdCells[rewardCol]
            ? sanitizePlainText(tdCells[rewardCol][2], 180)
            : null;
        const statusRaw =
          statusCol >= 0 && tdCells[statusCol]
            ? sanitizePlainText(tdCells[statusCol][2], 60)
            : null;
        const expiryRaw =
          expiryCol >= 0 && tdCells[expiryCol]
            ? sanitizePlainText(tdCells[expiryCol][2], 60)
            : null;

        let status = isStrike || isRed || sectionState === 'expired' ? 'expired' : 'active';
        if (statusRaw) {
          if (/\b(expired|inactive|invalid|disabled|outdated|removed|no)\b|✗|✘|×/i.test(statusRaw)) {
            status = 'expired';
          } else if (/\b(active|working|valid|live|yes)\b|✓|✔/i.test(statusRaw)) {
            status = 'active';
          }
        }

        let validExpiryIso = null;
        if (expiryRaw && !/^(-|—|–|n\/a|none|tbd|tba|active|present|current|ongoing|unknown)$/i.test(expiryRaw)) {
          const ts = Date.parse(expiryRaw);
          if (!Number.isNaN(ts)) {
            validExpiryIso = new Date(ts).toISOString();
            if (ts < Date.now()) status = 'expired';
          }
        }

        const cleanReward =
          rewardRaw && !/^(active|working|expired|yes|no|-|—|n\/a|unknown)$/i.test(rewardRaw)
            ? rewardRaw
            : null;

        upsertCode(codeToken, cleanReward, status, validExpiryIso);
      }
      continue;
    }

    if (/^<li\b/i.test(block)) {
      const isStrike = /<(?:s|del|strike)\b/i.test(block);
      const plain = sanitizePlainText(block, 220);
      if (!plain) continue;
      const m = plain.match(/^([A-Za-z0-9_!@#$%&*+?<>/-]{3,42})\s*[-–—:|]\s*(.+)$/);
      if (m) {
        const status =
          isStrike || /\b(expired|inactive|invalid)\b/i.test(plain) || sectionState === 'expired'
            ? 'expired'
            : 'active';
        upsertCode(m[1], m[2].slice(0, 180), status);
      }
    }
  }

  return Array.from(results.values()).slice(0, 1000);
}

async function parseWikiPagesWithFallback(host, pages) {
  const merged = new Map();

  const mergeItems = (items) => {
    for (const c of items) {
      const existing = merged.get(c.normalized_code);
      if (existing) {
        if (!existing.reward_description && c.reward_description) {
          existing.reward_description = c.reward_description;
        }
        if (c.status === 'expired' && existing.status !== 'expired') {
          existing.status = 'expired';
          existing.source_reported_status = 'wiki_expired';
        }
      } else {
        merged.set(c.normalized_code, c);
      }
    }
  };

  for (const p of pages) {
    const rawCodes = parseMediaWikiCodes(p.wikitext, p.wikiUrl, p.title);
    mergeItems(rawCodes);

    const hasDynamicTemplates = /\{\{(?::|#|Code|Active|Expired|Tabber|Table|List)/i.test(p.wikitext);
    if (rawCodes.length < 3 || hasDynamicTemplates) {
      const html = await fetchRenderedHtml(host, p.title);
      if (html) {
        const htmlCodes = parseRenderedHtmlCodes(html, p.wikiUrl, p.title);
        mergeItems(htmlCodes);
      }
    }
  }

  return Array.from(merged.values()).slice(0, 1000);
}

// ============================================================================
// Main Runner
// ============================================================================
async function main() {
  if (hasFlag('help') || hasFlag('h')) {
    console.log(`
RoMetric — High-Speed Fandom MediaWiki Codes Sync (v3.0)

Usage:
  npm run sync:wiki [options]

Options:
  --concurrency=<n>     Parallel game workers (default: 8 on PC, 6 in CI; max: 16)
  --rps=<n>             Max Fandom requests per second (default: 12; safe range: 8-18)
  --limit=<n|all>       Max games to scan from Supabase (default: all)
  --game="<name>"       Scan only games matching this name
  --only-missing        Only scan games that currently have 0 codes
  --skip-prediscovery   Skip roblox.fandom.com batch wiki pre-discovery
  --dry-run             Discover codes without writing to Supabase
  --ci                  Non-interactive CI mode
`);
    process.exit(0);
  }

  console.log('\n================================================================');
  console.log('  RoMetric — Fandom MediaWiki Codes Sync (v3.0 Anti-429)       ');
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
  const skipPrediscovery = hasFlag('skip-prediscovery');
  const gameFilter = getArg('game');
  const limitArg = getArg('limit');
  const maxGames = limitArg && limitArg !== 'all' ? parseInt(limitArg, 10) || 200 : Infinity;

  const defaultWorkers = isCiMode ? 6 : 8;
  const concurrency = Math.min(16, Math.max(1, parseInt(getArg('concurrency') || String(defaultWorkers), 10)));
  const rps = Math.min(25, Math.max(4, parseInt(getArg('rps') || (isCiMode ? '10' : '12'), 10)));
  minIntervalMs = Math.ceil(1000 / rps);

  console.log(`Supabase host:   ${new URL(supabaseUrl).host}`);
  console.log(`Source ID:       ${CODE_SOURCE_ID}`);
  console.log(`Workers / Rate:  ${concurrency} workers, max ${rps} req/s (auto-backoff on 429/403)`);
  console.log(`Mode:            ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE UPSERT'}${onlyMissing ? ' (only 0-code games)' : ''}\n`);

  const sbHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

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

  console.log(`✓ Loaded ${games.length} Roblox games from Supabase\n`);
  if (games.length === 0) {
    console.log('Nothing to scan. Exiting.');
    process.exit(0);
  }

  // Fast batched pre-discovery from roblox.fandom.com
  const prediscoveredHosts = skipPrediscovery || gameFilter
    ? new Map()
    : await prediscoverWikisFromRobloxFandom(games);

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
    const preHost = prediscoveredHosts.get(uid) || null;
    const { hosts: candidateHosts, extraPages } = buildWikiCandidateHosts(game, preHost);
    if (candidateHosts.length === 0) {
      return { name: game.name, total: 0, active: 0, expired: 0, wikiHost: null };
    }

    // Sequential host probing per game — stops on first match, avoiding 4x burst spikes!
    let matched = null;
    for (const host of candidateHosts) {
      const attempt = await fetchMediaWikiCodesPages(host, extraPages);
      if (attempt.found) {
        matched = attempt;
        break;
      }
    }

    if (!matched) {
      return { name: game.name, total: 0, active: 0, expired: 0, wikiHost: null };
    }

    const parsed = await parseWikiPagesWithFallback(matched.host, matched.pages);
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
      // Batch in chunks of 250 for very large code lists (e.g. 500+ codes)
      for (let i = 0; i < rows.length; i += 250) {
        const chunk = rows.slice(i, i + 250);
        const upRes = await fetch(
          `${supabaseUrl}/rest/v1/game_codes?on_conflict=universe_id,normalized_code`,
          {
            method: 'POST',
            headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(chunk),
          }
        );

        if (!upRes.ok) {
          const errTxt = await upRes.text();
          return {
            name: game.name,
            total: 0,
            active: 0,
            expired: 0,
            wikiHost: matched.host,
            dbError: `HTTP ${upRes.status}: ${errTxt.slice(0, 160)}`,
          };
        }
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
      if (matched.host && !game.wiki_subdomain) {
        patchBody.wiki_subdomain = matched.host.replace(/\.fandom\.com$/, '');
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
      wikiHost: matched.host,
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
        } else if (processed % 25 === 0 || processed === games.length) {
          process.stdout.write(
            `  Progress: ${processed}/${games.length} scanned (${gamesSaved} saved, ${totalCodesSaved} codes, ${totalRateLimitHits} rate-limits)...\r`
          );
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
  console.log('✓ Fandom MediaWiki Codes Sync Complete! (v3.0)');
  console.log('================================================================');
  console.log(`  Games Scanned:         ${processed}`);
  console.log(`  Games Saved to DB:     ${gamesSaved}`);
  console.log(`  Active Codes Saved:    ${totalActiveSaved}`);
  console.log(`  Expired Codes Saved:   ${totalExpiredSaved}`);
  console.log(`  Total Codes Saved:     ${totalCodesSaved}`);
  console.log(`  Rate-Limit Backoffs:   ${totalRateLimitHits} (${totalHttpRetries} retries)`);
  console.log(`  DB Write Errors:       ${dbErrors}`);
  console.log(`  Elapsed Time:          ${elapsedSec} seconds`);
  console.log('================================================================\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [
      '### RoMetric Wiki Codes Sync Summary (v3.0)',
      '',
      '| Metric | Value |',
      '| --- | ---: |',
      `| Games Scanned | ${processed} |`,
      `| Games Saved to DB | ${gamesSaved} |`,
      `| Active Codes Saved | ${totalActiveSaved} |`,
      `| Expired Codes Saved | ${totalExpiredSaved} |`,
      `| Total Codes Saved | ${totalCodesSaved} |`,
      `| Rate-Limit Backoffs | ${totalRateLimitHits} |`,
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
