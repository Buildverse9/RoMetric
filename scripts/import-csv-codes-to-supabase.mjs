#!/usr/bin/env node
/**
 * Bulk-imports the cleaned 5,000+ game codes catalog into Supabase `games` + `game_codes`
 * so the hourly Apps Script & automated providers continuously update and expire them.
 *
 * Requires env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/import-csv-codes-to-supabase.mjs
 */

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const CATALOG_PATH = path.resolve(
  process.cwd(),
  process.argv[2] || "data/codes-seed-catalog.json"
);

if (!fs.existsSync(CATALOG_PATH)) {
  console.error(
    `Catalog not found at ${CATALOG_PATH}. Run: node scripts/build-codes-catalog.mjs`
  );
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
console.log(`Loaded ${entries.length} games from ${CATALOG_PATH}`);

async function supabasePost(endpoint, body, prefer) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase POST ${endpoint} failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

async function run() {
  // 1. Ensure source record exists
  await supabasePost(
    "code_sources?on_conflict=id",
    [
      {
        id: "rometric_verified_catalog",
        name: "RoMetric Verified Catalog",
        provider_type: "roblox_official",
        enabled: true,
        requires_api_key: false,
        attribution_label: "RoMetric Automated Codes Index",
        attribution_url: null,
        license_notice: null,
        rate_limit_rpm: 60,
        last_status: "healthy",
        updated_at: new Date().toISOString(),
      },
    ],
    "resolution=merge-duplicates,return=minimal"
  );

  // 2. Insert missing games safely (ignore-duplicates so we NEVER overwrite live CCU/icons/root_place_id!)
  const BATCH_GAMES = 250;
  let gameBatches = 0;
  for (let i = 0; i < entries.length; i += BATCH_GAMES) {
    const slice = entries.slice(i, i + BATCH_GAMES);
    const payload = slice.map((e) => ({
      universe_id: e.u,
      root_place_id: e.u,
      name: e.n.slice(0, 140),
      slug: e.s.slice(0, 120),
      creator_id: 0,
      creator_name: "Roblox Creator",
      creator_type: "User",
      genre: e.g || "All",
      current_ccu: e.c || 0,
      active: true,
      code_coverage_status: "covered",
      active_code_count: e.k.length,
      total_code_count: e.k.length,
      codes_last_checked_at: e.t,
      updated_at: new Date().toISOString(),
    }));
    await supabasePost(
      "games?on_conflict=universe_id",
      payload,
      "resolution=ignore-duplicates,return=minimal"
    );
    gameBatches++;
    if (gameBatches % 5 === 0 || i + BATCH_GAMES >= entries.length) {
      console.log(`Synced games: ${Math.min(i + BATCH_GAMES, entries.length)} / ${entries.length}`);
    }
  }

  // 3. Upsert codes safely (ignore-duplicates so live automated status updates or admin locks are preserved!)
  const codeRows = [];
  for (const e of entries) {
    for (const [code, reward] of e.k) {
      const normalized = code.trim().toUpperCase().replace(/\s+/g, "").slice(0, 48);
      if (!normalized) continue;
      codeRows.push({
        universe_id: e.u,
        code: code.slice(0, 48),
        normalized_code: normalized,
        reward_description: (reward || "In-game reward").slice(0, 180),
        status: "active",
        source_id: "rometric_verified_catalog",
        source_reported_status: "active",
        admin_locked: false,
        discovered_at: e.t,
        last_verified_at: e.t,
        updated_at: e.t,
      });
    }
  }

  const BATCH_CODES = 400;
  let codeBatches = 0;
  for (let i = 0; i < codeRows.length; i += BATCH_CODES) {
    const slice = codeRows.slice(i, i + BATCH_CODES);
    await supabasePost(
      "game_codes?on_conflict=universe_id,normalized_code",
      slice,
      "resolution=ignore-duplicates,return=minimal"
    );
    codeBatches++;
    if (codeBatches % 5 === 0 || i + BATCH_CODES >= codeRows.length) {
      console.log(`Synced codes: ${Math.min(i + BATCH_CODES, codeRows.length)} / ${codeRows.length}`);
    }
  }

  console.log(`Done! Imported ${entries.length} games and ${codeRows.length} codes into Supabase.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
