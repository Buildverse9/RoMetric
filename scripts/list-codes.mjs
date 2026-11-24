#!/usr/bin/env node
/**
 * RoMetric — Codes Catalog Viewer & Inspector
 *
 * Lists all Roblox games and codes stored in your Supabase database.
 *
 * Usage:
 *   npm run list:codes
 *   npm run list:codes -- --game="Blox Fruits"
 *   npm run list:codes -- --universe=994732206
 *   npm run list:codes -- --status=active
 *   npm run list:codes -- --limit=50
 */

import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  const envVars = {};
  for (const f of envFiles) {
    const full = path.join(process.cwd(), f);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (!match) continue;
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!envVars[match[1]]) envVars[match[1]] = val;
      }
    }
  }
  return envVars;
}

const env = loadEnv();
const supabaseUrl = (process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Error: Supabase URL and service role key required in .env.local');
  process.exit(1);
}

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

const targetGame = getArg('game');
const targetUniverse = getArg('universe');
const statusFilter = getArg('status'); // 'active' | 'expired' | 'all'
const limitArg = parseInt(getArg('limit') || '50', 10);

const sbHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function main() {
  console.log('\n========================================================');
  console.log('   RoMetric — Roblox Game Codes Database Inspector       ');
  console.log('========================================================\n');

  // If a specific game was requested by name or universeId, show detailed code list
  if (targetGame || targetUniverse) {
    let query = `${supabaseUrl}/rest/v1/games?select=universe_id,root_place_id,name,slug,active_code_count,total_code_count&limit=5`;
    if (targetUniverse) {
      query += `&universe_id=eq.${targetUniverse}`;
    } else {
      query += `&name=ilike.*${encodeURIComponent(targetGame)}*`;
    }

    const gRes = await fetch(query, { headers: sbHeaders });
    const matchedGames = gRes.ok ? await gRes.json() : [];

    if (matchedGames.length === 0) {
      console.log(`✖ No games matching "${targetGame || targetUniverse}" found in database.`);
      return;
    }

    for (const g of matchedGames) {
      console.log(`\n🎮 ${g.name} (Universe ID: ${g.universe_id}, Root Place: ${g.root_place_id})`);
      console.log(`   Slug: /codes/${g.slug} | Active: ${g.active_code_count} | Total: ${g.total_code_count}\n`);

      let codeQuery = `${supabaseUrl}/rest/v1/game_codes?select=code,status,reward_description,expires_at,last_verified_at,source_id&universe_id=eq.${g.universe_id}&order=status.asc,discovered_at.desc`;
      if (statusFilter && statusFilter !== 'all') {
        codeQuery += `&status=eq.${encodeURIComponent(statusFilter)}`;
      }

      const cRes = await fetch(codeQuery, { headers: sbHeaders });
      const codes = cRes.ok ? await cRes.json() : [];

      if (codes.length === 0) {
        console.log('   (No codes found matching filter)');
        continue;
      }

      console.log('   Status   | Promo Code           | Reward Description');
      console.log('   ---------+----------------------+----------------------------------------------------');
      for (const c of codes) {
        const badge = c.status === 'active' ? '✓ ACTIVE ' : '✖ EXPIRED';
        const codeText = c.code.padEnd(20);
        const reward = (c.reward_description || 'In-game reward / boost').slice(0, 50);
        console.log(`   ${badge} | ${codeText} | ${reward}`);
      }
      console.log(`   Total codes listed: ${codes.length}\n`);
    }
    return;
  }

  // Summary Overview of all games
  console.log('Fetching code summary from Supabase...');
  const [statsRes, gamesRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/game_codes?select=status`, { headers: sbHeaders }),
    fetch(
      `${supabaseUrl}/rest/v1/games?select=name,universe_id,slug,active_code_count,total_code_count,codes_last_checked_at&total_code_count=gt.0&order=active_code_count.desc,total_code_count.desc&limit=${limitArg}`,
      { headers: sbHeaders }
    ),
  ]);

  if (!statsRes.ok || !gamesRes.ok) {
    console.error('Failed to load summary from Supabase');
    return;
  }

  const allCodes = await statsRes.json();
  const topGames = await gamesRes.json();

  let activeCount = 0;
  let expiredCount = 0;
  let pendingCount = 0;
  for (const c of allCodes) {
    if (c.status === 'active') activeCount++;
    else if (c.status === 'expired') expiredCount++;
    else pendingCount++;
  }

  console.log('\n📊 Database Code Statistics:');
  console.log(`   Total Games with Codes:  ${topGames.length >= limitArg ? `${limitArg}+` : topGames.length}`);
  console.log(`   Active / Working Codes:  ${activeCount}`);
  console.log(`   Expired Codes:           ${expiredCount}`);
  console.log(`   Pending Verification:    ${pendingCount}`);
  console.log(`   Total Codes in Database: ${allCodes.length}\n`);

  console.log(`Top ${topGames.length} Games with Codes in Database:`);
  console.log(' #   | Game Name                                 | Universe ID  | Active | Total | Last Synced');
  console.log('-----+-------------------------------------------+--------------+--------+-------+------------');

  topGames.forEach((g, idx) => {
    const num = String(idx + 1).padStart(3);
    const name = g.name.slice(0, 41).padEnd(41);
    const uid = String(g.universe_id).padEnd(12);
    const act = String(g.active_code_count || 0).padStart(6);
    const tot = String(g.total_code_count || 0).padStart(5);
    const checked = g.codes_last_checked_at
      ? new Date(g.codes_last_checked_at).toISOString().slice(0, 10)
      : 'Never';
    console.log(`${num}  | ${name} | ${uid} | ${act} | ${tot} | ${checked}`);
  });

  console.log('\nTip: To view individual codes for any game, run:');
  console.log('  npm run list:codes -- --game="Blox Fruits"');
  console.log('  npm run list:codes -- --universe=994732206\n');
}

main().catch(console.error);
