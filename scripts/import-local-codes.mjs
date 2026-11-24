#!/usr/bin/env node
/**
 * RoMetric — Local Datastore Importer (100% Offline / Zero API Calls)
 *
 * Imports game promo codes directly from your local exported JSON files
 * (e.g., "D:\Users Profiles\Yesh\Downloads\datbase") into your Supabase database.
 * Uses 0 BloxArchive API requests — zero rate limits, zero quotas.
 *
 * Usage:
 *   npm run import:codes
 *   npm run import:codes -- --datastore="D:\custom\path"
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
  console.error('Error: Supabase URL and service_role key are required in .env.local');
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

const datastoreDir = getArg('datastore') || 'D:\\Users Profiles\\Yesh\\Downloads\\datbase';

const sbHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function main() {
  console.log('\n========================================================');
  console.log('   RoMetric — Local Datastore Importer (Offline)        ');
  console.log('========================================================\n');

  if (!fs.existsSync(datastoreDir)) {
    console.error(`Error: Directory not found: "${datastoreDir}"`);
    process.exit(1);
  }

  const files = fs.readdirSync(datastoreDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error(`No JSON files found in "${datastoreDir}".`);
    process.exit(1);
  }

  console.log(`Reading JSON files from: ${datastoreDir}`);
  const allRows = [];
  const universes = new Set();

  for (const f of files) {
    const fullPath = path.join(datastoreDir, f);
    const rows = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    allRows.push(...rows);
    for (const r of rows) universes.add(Number(r.universe_id));
    console.log(`  ✓ ${f}: ${rows.length} codes`);
  }

  console.log(`\nTotal Codes to import: ${allRows.length} across ${universes.size} unique games.`);
  console.log('Connecting to Supabase and upserting in batches...\n');

  // Upsert in batches of 200
  const BATCH_SIZE = 200;
  let importedCount = 0;

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE).map((r) => ({
      universe_id: Number(r.universe_id),
      code: r.code,
      normalized_code: (r.normalized_code || r.code).trim().replace(/\s+/g, '').toUpperCase(),
      reward_description: r.reward_description || null,
      status: r.status === 'active' ? 'active' : 'expired',
      source_id: r.source_id || 'bloxarchive_api',
      source_url: r.source_url || null,
      source_reported_status: r.source_reported_status || r.status,
      admin_locked: Boolean(r.admin_locked),
      discovered_at: r.discovered_at || new Date().toISOString(),
      last_verified_at: r.last_verified_at || new Date().toISOString(),
      expires_at: r.expires_at || null,
      updated_at: new Date().toISOString(),
    }));

    const res = await fetch(`${supabaseUrl}/rest/v1/game_codes?on_conflict=universe_id,normalized_code`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, await res.text());
    } else {
      importedCount += batch.length;
      process.stdout.write(`  Upserted ${importedCount}/${allRows.length} codes...\r`);
    }
  }

  console.log(`\n✓ Upserted ${importedCount} codes into Supabase!`);

  // Recompute counts for all affected games
  console.log(`\nRecomputing code counts for ${universes.size} games...`);
  const uids = Array.from(universes);
  let updatedGames = 0;

  for (const uid of uids) {
    const cRes = await fetch(`${supabaseUrl}/rest/v1/game_codes?select=status&universe_id=eq.${uid}`, {
      headers: sbHeaders,
    });
    if (cRes.ok) {
      const cList = await cRes.json();
      const active = cList.filter((c) => c.status === 'active').length;
      const total = cList.length;

      await fetch(`${supabaseUrl}/rest/v1/games?universe_id=eq.${uid}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({
          active_code_count: active,
          total_code_count: total,
          code_coverage_status: total > 0 ? 'covered' : 'no_provider_data',
          codes_last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      updatedGames++;
      if (updatedGames % 20 === 0 || updatedGames === uids.length) {
        process.stdout.write(`  Updated game statistics ${updatedGames}/${uids.length}...\r`);
      }
    }
  }

  console.log(`\n\n========================================================`);
  console.log('✓ Offline Datastore Import Complete!');
  console.log(`  Imported Codes: ${importedCount}`);
  console.log(`  Games Updated:  ${updatedGames}`);
  console.log('  BloxArchive API Calls Used: 0 (Offline Import)');
  console.log('========================================================\n');
}

main().catch(console.error);
