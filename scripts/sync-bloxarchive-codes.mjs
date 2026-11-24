#!/usr/bin/env node
/**
 * RoMetric — High-Performance Local BloxArchive Codes Sync Tool
 *
 * Runs directly on your PC with zero Vercel timeouts or compute restrictions.
 * Fetches verified Roblox game promo codes from BloxArchive's official API
 * and inserts/upserts them directly into your Supabase database.
 *
 * Usage:
 *   node scripts/sync-bloxarchive-codes.mjs
 *   node scripts/sync-bloxarchive-codes.mjs --limit=50
 *   node scripts/sync-bloxarchive-codes.mjs --limit=all
 *   node scripts/sync-bloxarchive-codes.mjs --universe=994732206
 *   node scripts/sync-bloxarchive-codes.mjs --concurrency=4
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const BLOXARCHIVE_BASE = 'https://bloxarchive.com/api/partner/v1';

// Load .env.local or .env if present
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
  if (index !== -1 && process.argv[index + 1]) {
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

function sanitizePlainText(raw, maxLen = 200) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, maxLen) : null;
}

function isValidPromoCodeFormat(raw) {
  const trimmed = String(raw || '').trim();
  if (trimmed.length < 3 || trimmed.length > 48) return false;
  if (!/^[A-Za-z0-9_!@#$%&*+?-]+(?: [A-Za-z0-9_!@#$%&*+?-]+)*$/.test(trimmed)) {
    return false;
  }
  const stopWords = new Set([
    'CODE', 'CODES', 'FREE', 'NEW', 'ROBLOX', 'UPDATE', 'ACTIVE',
    'EXPIRED', 'REWARD', 'REWARDS', 'DISCORD', 'TWITTER', 'YOUTUBE'
  ]);
  return !stopWords.has(trimmed.toUpperCase());
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (hasFlag('help') || hasFlag('h')) {
    console.log(`
RoMetric — BloxArchive Codes Sync Tool (PC Native)

Usage:
  node scripts/sync-bloxarchive-codes.mjs [options]

Options:
  --limit=<n|all>          Number of games to sync from BloxArchive (default: all)
  --concurrency=<n>        Concurrent requests (default: 4)
  --universe=<id>          Sync codes for a single universe ID
  --supabase-url=<url>     Supabase project URL (e.g. https://xyz.supabase.co)
  --supabase-key=<key>     Supabase service_role secret key
  --bloxarchive-key=<key>  BloxArchive API key (or set BLOXARCHIVE_API_KEY in .env.local)
  --force                  Re-sync games even if already checked recently
  --dry-run                Fetch and parse codes without writing to database
  --help, -h               Show this help message
`);
    process.exit(0);
  }

  console.log('\n========================================================');
  console.log('   RoMetric — BloxArchive Codes Sync Tool (PC Native)   ');
  console.log('========================================================\n');

  let supabaseUrl =
    getArg('supabase-url') ||
    process.env.SUPABASE_URL ||
    fileEnv.SUPABASE_URL ||
    '';
  let serviceRoleKey =
    getArg('supabase-key') ||
    getArg('service-key') ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  let bloxApiKey =
    getArg('bloxarchive-key') ||
    process.env.BLOXARCHIVE_API_KEY ||
    fileEnv.BLOXARCHIVE_API_KEY ||
    '';

  if (!supabaseUrl) {
    supabaseUrl = await promptInput('Enter your Supabase URL (e.g. https://xxx.supabase.co): ');
  }
  supabaseUrl = supabaseUrl.replace(/\/+$/, '');

  if (!serviceRoleKey) {
    serviceRoleKey = await promptInput('Enter your Supabase service_role key: ');
  }

  if (!bloxApiKey) {
    bloxApiKey = await promptInput('Enter your BloxArchive Partner API key: ');
  }

  if (!supabaseUrl || !serviceRoleKey || !bloxApiKey) {
    console.error('Error: Supabase URL, service_role key, and BloxArchive API key are required.');
    process.exit(1);
  }

  // Offer to save credentials to .env.local for future runs if missing
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envLocalPath)) {
    const saveAns = await promptInput('Save credentials into local .env.local for future runs? (Y/n): ');
    if (!saveAns || saveAns.toLowerCase().startsWith('y')) {
      const content = `# RoMetric local environment variables (never committed to git)
SUPABASE_URL="${supabaseUrl}"
SUPABASE_SERVICE_ROLE_KEY="${serviceRoleKey}"
BLOXARCHIVE_API_KEY="${bloxApiKey}"
`;
      fs.writeFileSync(envLocalPath, content, 'utf8');
      console.log('✓ Credentials saved to .env.local (ignored by git)\n');
    }
  }

  const dryRun = hasFlag('dry-run');
  const limitArg = getArg('limit');
  const maxGames = limitArg === 'all' || !limitArg ? Infinity : parseInt(limitArg, 10) || 50;
  const concurrency = parseInt(getArg('concurrency') || '4', 10);
  const targetUniverse = getArg('universe');

  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  console.log(`BloxArchive API Key: ${bloxApiKey.slice(0, 8)}...${bloxApiKey.slice(-4)}`);
  console.log(`Max games to sync: ${maxGames === Infinity ? 'ALL' : maxGames}`);
  console.log(`Concurrency: ${concurrency} workers\n`);

  // Verify Supabase connection & headers
  const sbHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  // 1. Ensure bloxarchive_api source is configured in code_sources
  try {
    const srcRes = await fetch(`${supabaseUrl}/rest/v1/code_sources?on_conflict=id`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        {
          id: 'bloxarchive_api',
          name: 'BloxArchive JSON API',
          provider_type: 'bloxarchive',
          enabled: true,
          requires_api_key: true,
          attribution_label: 'BloxArchive',
          attribution_url: 'https://bloxarchive.com',
          license_notice: 'Verified Roblox promo codes from BloxArchive JSON API',
          rate_limit_rpm: 30,
          last_status: 'healthy',
          updated_at: new Date().toISOString(),
        },
      ]),
    });
    if (!srcRes.ok) {
      const txt = await srcRes.text();
      console.warn(`Note: code_sources check returned HTTP ${srcRes.status}: ${txt.slice(0, 100)}`);
    } else {
      console.log('✓ Verified bloxarchive_api in code_sources table');
    }
  } catch (err) {
    console.warn(`Warning checking code_sources: ${err.message}`);
  }

  // 2. Fetch existing games from Supabase to build fast ID lookup maps
  console.log('Loading existing games catalog from Supabase...');
  const gamesRes = await fetch(
    `${supabaseUrl}/rest/v1/games?select=universe_id,root_place_id,slug,name,codes_last_checked_at,active_code_count,total_code_count&limit=5000`,
    { headers: sbHeaders }
  );
  if (!gamesRes.ok) {
    console.error(`Failed to load games from Supabase (HTTP ${gamesRes.status}):`, await gamesRes.text());
    process.exit(1);
  }
  const existingGames = await gamesRes.json();
  const rootPlaceMap = new Map();
  const universeIdMap = new Map();
  const slugMap = new Map();

  for (const g of existingGames) {
    const uid = String(g.universe_id);
    const rid = String(g.root_place_id);
    rootPlaceMap.set(rid, uid);
    universeIdMap.set(uid, g);
    if (g.slug) slugMap.set(g.slug.toLowerCase(), uid);
  }
  console.log(`✓ Loaded ${existingGames.length} existing games from Supabase.\n`);

  // 3. Fetch directory of games from BloxArchive
  console.log('Fetching games directory from BloxArchive API...');
  const bloxGames = [];
  let offset = 0;
  const pageSize = 100;
  let totalOnBlox = Infinity;

  while (offset < totalOnBlox && bloxGames.length < maxGames) {
    const pageUrl = `${BLOXARCHIVE_BASE}/games?locale=en&limit=${pageSize}&offset=${offset}`;
    const pageRes = await fetch(pageUrl, {
      headers: { 'X-API-Key': bloxApiKey, Accept: 'application/json' },
    });
    if (!pageRes.ok) {
      console.error(`BloxArchive /games returned HTTP ${pageRes.status}:`, await pageRes.text());
      break;
    }
    const pageData = await pageRes.json();
    totalOnBlox = Number(pageData.total || 0);
    const items = pageData.games || [];
    if (items.length === 0) break;
    for (const item of items) {
      bloxGames.push(item);
      if (bloxGames.length >= maxGames) break;
    }
    offset += items.length;
    process.stdout.write(`  Loaded ${bloxGames.length}/${Math.min(totalOnBlox, maxGames)} games from directory...\r`);
  }
  console.log(`\n✓ Ready to sync ${bloxGames.length} games from BloxArchive (Total available: ${totalOnBlox}).\n`);

  // Cache for place -> universe resolutions to avoid duplicate Roblox calls
  const resolvedPlaceToUniverse = new Map();

  async function resolveUniverseForGame(rootPlaceId, gameName) {
    if (!rootPlaceId) return null;
    const sPlaceId = String(rootPlaceId);
    if (rootPlaceMap.has(sPlaceId)) return rootPlaceMap.get(sPlaceId);
    if (resolvedPlaceToUniverse.has(sPlaceId)) return resolvedPlaceToUniverse.get(sPlaceId);

    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(`https://apis.roblox.com/universes/v1/places/${sPlaceId}/universe`);
        if (res.status === 429) {
          const resetHeader = res.headers.get('x-ratelimit-reset') || res.headers.get('retry-after');
          const waitSec = Math.min(Math.max(parseInt(resetHeader, 10) || (2 * attempt), 2), 10);
          await sleep(waitSec * 1000);
          continue;
        }
        if (res.ok) {
          const data = await res.json();
          if (data.universeId) {
            const uId = String(data.universeId);
            resolvedPlaceToUniverse.set(sPlaceId, uId);
            rootPlaceMap.set(sPlaceId, uId);
            return uId;
          }
        }
      } catch {
        await sleep(500);
      }
    }
    return null;
  }

  async function ensureGameExistsInSupabase(universeId, rootPlaceId, gameName, iconUrl, genre) {
    if (universeIdMap.has(universeId)) return true;
    if (dryRun) return true;

    // Fetch live metadata from Roblox if possible
    let currentCcu = 0;
    let totalVisits = 0;
    let favorites = 0;
    let creatorId = '0';
    let creatorName = 'Roblox Creator';
    let creatorType = 'User';

    try {
      const rRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
      if (rRes.ok) {
        const rData = await rRes.json();
        const g = rData.data?.[0];
        if (g) {
          currentCcu = Number(g.playing || 0);
          totalVisits = Number(g.visits || 0);
          favorites = Number(g.favoritedCount || 0);
          if (g.creator) {
            creatorId = String(g.creator.id || '0');
            creatorName = String(g.creator.name || 'Roblox Creator');
            creatorType = g.creator.type === 'Group' ? 'Group' : 'User';
          }
        }
      }
    } catch {
      // Keep defaults
    }

    const cleanSlug = gameName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `game-${universeId}`;

    const newGame = {
      universe_id: Number(universeId),
      root_place_id: Number(rootPlaceId || universeId),
      name: gameName.slice(0, 200),
      slug: cleanSlug.slice(0, 220),
      creator_id: Number(creatorId) || 0,
      creator_name: creatorName.slice(0, 120),
      creator_type: creatorType,
      creator_verified: false,
      genre: genre || 'All Genres',
      icon_url: iconUrl || null,
      current_ccu: currentCcu,
      total_visits: totalVisits,
      favorites: favorites,
      tracking_tier: 'tier_2',
      active: true,
      code_coverage_status: 'covered',
      active_code_count: 0,
      total_code_count: 0,
      first_observed_at: new Date().toISOString(),
      last_collected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/games?on_conflict=universe_id`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([newGame]),
    });

    if (insertRes.ok) {
      universeIdMap.set(universeId, newGame);
      rootPlaceMap.set(String(rootPlaceId), universeId);
      return true;
    }
    return false;
  }

  // 4. Process all games in concurrent chunks
  let processedCount = 0;
  let totalActiveSaved = 0;
  let totalExpiredSaved = 0;
  let totalPendingSaved = 0;
  let skippedCount = 0;
  const startTime = Date.now();

  const gamesToProcess = targetUniverse
    ? bloxGames.filter((g) => String(g.root_place_id) === targetUniverse || g.slug?.includes(targetUniverse))
    : bloxGames;

  async function processGame(bg) {
    const slug = bg.slug;
    const isForce = hasFlag('force');
    const existingEntry = slugMap.has(slug.toLowerCase())
      ? universeIdMap.get(slugMap.get(slug.toLowerCase()))
      : null;

    if (!isForce && existingEntry?.codes_last_checked_at) {
      const checkedMs = Date.parse(existingEntry.codes_last_checked_at);
      if (Date.now() - checkedMs < 12 * 3600 * 1000) {
        return {
          ok: true,
          alreadySynced: true,
          name: existingEntry.name || bg.name,
          active: existingEntry.active_code_count || 0,
          expired: 0,
          pending: 0,
          total: existingEntry.total_code_count || 0,
        };
      }
    }

    const detailUrl = `${BLOXARCHIVE_BASE}/games/${encodeURIComponent(slug)}?locale=en`;

    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch(detailUrl, {
          headers: { 'X-API-Key': bloxApiKey, Accept: 'application/json' },
        });
        if (res.status === 429) {
          await sleep(2000 * attempt);
          continue;
        }
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await sleep(1000);
      }
    }

    if (!res || !res.ok) {
      return { skipped: true, name: bg.name, reason: `HTTP ${res?.status || 0}` };
    }

    const payload = await res.json();
    const gameInfo = payload.game || {};
    const rootPlaceId = gameInfo.root_place_id || bg.root_place_id;
    const gameName = gameInfo.name || bg.name || slug;

    // Resolve Universe ID
    let universeId = await resolveUniverseForGame(rootPlaceId, gameName);
    if (!universeId && targetUniverse) universeId = targetUniverse;

    if (!universeId) {
      return { skipped: true, name: gameName, reason: `Could not resolve Universe ID for place ${rootPlaceId}` };
    }

    // Ensure game is in public.games
    await ensureGameExistsInSupabase(
      universeId,
      rootPlaceId,
      gameName,
      gameInfo.icon_url || bg.icon_url,
      bg.genre
    );

    // Unpack codes
    const rawList = [];
    const pushCodes = (list, hintedStatus) => {
      if (!Array.isArray(list)) return;
      for (const item of list) {
        rawList.push({ item, hintedStatus });
      }
    };

    const codesObj = payload.codes || {};
    if (typeof codesObj === 'object' && !Array.isArray(codesObj)) {
      pushCodes(codesObj.active, 'active');
      pushCodes(codesObj.pending, 'active');
      pushCodes(codesObj.expired, 'expired');
    }

    const attributionUrl =
      payload.attribution?.url ||
      gameInfo.url ||
      bg.url ||
      `https://bloxarchive.com/${encodeURIComponent(slug)}`;

    const codeRows = [];
    const seenNorm = new Set();
    const nowIso = new Date().toISOString();
    let activeInGame = 0;
    let expiredInGame = 0;
    let pendingInGame = 0;

    for (const { item, hintedStatus } of rawList) {
      const rawCode = String(item.code || item.value || '').trim();
      if (!isValidPromoCodeFormat(rawCode)) continue;
      const norm = normalizePromoCode(rawCode);
      if (seenNorm.has(norm)) continue;
      seenNorm.add(norm);

      const isExpired = Boolean(item.expired || item.expired_at || hintedStatus === 'expired');
      const status = isExpired
        ? 'expired'
        : 'active'; // Directly approve BloxArchive codes as active without manual verification

      if (status === 'active') activeInGame++;
      else if (status === 'expired') expiredInGame++;
      else pendingInGame++;

      const expiryRaw = item.expired_at || item.expiresAt || item.expires_at || null;
      const validExpiry = expiryRaw && !Number.isNaN(Date.parse(expiryRaw))
        ? new Date(expiryRaw).toISOString()
        : null;

      codeRows.push({
        universe_id: Number(universeId),
        code: rawCode.slice(0, 48),
        normalized_code: norm.slice(0, 48),
        reward_description: sanitizePlainText(item.reward || item.rewards || item.description, 180),
        status,
        source_id: 'bloxarchive_api',
        source_url: attributionUrl,
        source_reported_status: isExpired ? 'expired' : status,
        admin_locked: false,
        discovered_at: item.first_seen_at || nowIso,
        last_verified_at: nowIso,
        expires_at: validExpiry,
        updated_at: nowIso,
      });
    }

    if (!dryRun) {
      if (codeRows.length > 0) {
        const upsertRes = await fetch(
          `${supabaseUrl}/rest/v1/game_codes?on_conflict=universe_id,normalized_code`,
          {
            method: 'POST',
            headers: {
              ...sbHeaders,
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify(codeRows),
          }
        );

        if (!upsertRes.ok) {
          const errText = await upsertRes.text();
          return {
            skipped: true,
            name: gameName,
            reason: `Supabase upsert failed: ${errText.slice(0, 100)}`,
          };
        }
      }

      // Update game's denormalized code counts & timestamp
      await fetch(`${supabaseUrl}/rest/v1/games?universe_id=eq.${universeId}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({
          active_code_count: activeInGame,
          total_code_count: codeRows.length,
          code_coverage_status: codeRows.length > 0 ? 'covered' : 'no_provider_data',
          codes_last_checked_at: nowIso,
          updated_at: nowIso,
        }),
      });
    }

    return {
      ok: true,
      name: gameName,
      active: activeInGame,
      expired: expiredInGame,
      pending: pendingInGame,
      total: codeRows.length,
    };
  }

  // Workpool runner
  let currentIndex = 0;
  async function worker() {
    while (currentIndex < gamesToProcess.length) {
      const idx = currentIndex++;
      const game = gamesToProcess[idx];
      const startMs = Date.now();

      try {
        const result = await processGame(game);
        processedCount++;
        const elapsedMs = Date.now() - startMs;

        if (result.alreadySynced) {
          totalActiveSaved += result.active;
          if (processedCount % 40 === 0 || processedCount === gamesToProcess.length) {
            process.stdout.write(`  [${processedCount}/${gamesToProcess.length}] Progress: already synced ${result.name}...\r`);
          }
        } else if (result.ok) {
          totalActiveSaved += result.active;
          totalExpiredSaved += result.expired;
          totalPendingSaved += result.pending;
          console.log(
            `[${processedCount}/${gamesToProcess.length}] ${result.name}: ` +
            `${result.active} active, ${result.pending} pending, ${result.expired} expired ` +
            `(${elapsedMs}ms)`
          );
        } else {
          skippedCount++;
          console.warn(`[${processedCount}/${gamesToProcess.length}] ⚠ ${result.name}: skipped (${result.reason})`);
        }
      } catch (err) {
        processedCount++;
        skippedCount++;
        console.error(`[${processedCount}/${gamesToProcess.length}] ✖ ${game.name}: error (${err.message})`);
      }
      await sleep(80);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n========================================================');
  console.log('✓ BloxArchive Sync Complete!');
  console.log('========================================================');
  console.log(`  Games Processed:       ${processedCount}`);
  console.log(`  Active Codes Saved:    ${totalActiveSaved}`);
  console.log(`  Expired Codes Saved:   ${totalExpiredSaved}`);
  console.log(`  Pending Codes Saved:   ${totalPendingSaved}`);
  console.log(`  Skipped / Errors:      ${skippedCount}`);
  console.log(`  Elapsed Time:          ${totalTimeSec} seconds`);
  console.log('========================================================\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
