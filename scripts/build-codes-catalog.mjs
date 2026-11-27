#!/usr/bin/env node
/**
 * Parses and cleans public/assets/aistudio/all_codes_9fd464fd.csv into a compact
 * production catalog at data/codes-seed-catalog.json.
 *
 * Usage:
 *   node scripts/build-codes-catalog.mjs [inputCsvPath] [outputJsonPath]
 */

import fs from "node:fs";
import path from "node:path";

const INPUT_PATH = path.resolve(
  process.cwd(),
  process.argv[2] || "public/assets/aistudio/all_codes_9fd464fd.csv"
);
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  process.argv[3] || "data/codes-seed-catalog.json"
);

/** RFC-4180 CSV parser supporting quoted fields, embedded newlines, and "" escapes. */
function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // Ignore CR; LF will close the row
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function slugifyGameName(name, universeId) {
  const base = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base ? `${base}-${universeId}` : `game-${universeId}`;
}

function cleanText(raw, maxLen = 140) {
  return String(raw || "")
    .replace(/\uFFFD/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

const JUNK_CODES = new Set([
  "SEC-TEST-B2",
  "#NAME?",
  "#VALUE!",
  "#REF!",
  "#N/A",
  "N/A",
  "NONE",
  "NULL",
  "UNDEFINED",
  "TEST",
  "CODE",
  "CODES",
  "REDEEM",
]);

function isValidCode(code) {
  if (!code || code.length < 2 || code.length > 48) return false;
  const upper = code.toUpperCase();
  if (JUNK_CODES.has(upper)) return false;
  // Filter Excel scientific notation corruption (e.g., 1.32148E+14, 6.7129E+18)
  if (/^\d+(?:\.\d+)?E[+-]\d+$/i.test(code)) return false;
  // Filter Excel errors
  if (/^#[A-Z0-9/!?]+$/i.test(code)) return false;
  // Filter emails or URLs
  if (/@/.test(code) && /\.[a-z]{2,}$/i.test(code)) return false;
  if (/^https?:\/\//i.test(code)) return false;
  // Filter placeholder strings of only punctuation / question marks
  if (/^[?\-_.!*\s]+$/.test(code)) return false;
  // Must contain at least 2 alphanumeric characters
  if ((code.match(/[a-z0-9]/gi) || []).length < 2) return false;
  return true;
}

function cleanReward(raw) {
  const r = cleanText(raw, 160);
  if (!r || /^[-?.]+$/.test(r)) return "In-game reward";
  if (/^#[A-Z0-9/!?]+$/i.test(r)) return "In-game reward";
  return r;
}

function normalizeLastChanged(raw) {
  const s = cleanText(raw, 40);
  if (!s) return new Date().toISOString();
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

const rawBuf = fs.readFileSync(INPUT_PATH);
const utf8Text = rawBuf.toString("utf8");
const rawCsv = (utf8Text.includes("\uFFFD") ? rawBuf.toString("latin1") : utf8Text).replace(/^\uFEFF/, "");
const rows = parseCsv(rawCsv);
if (rows.length < 2) {
  throw new Error(`CSV at ${INPUT_PATH} has no data rows.`);
}

const header = rows[0].map((h) => cleanText(h, 60).toLowerCase());
const col = (name) => header.indexOf(name);

const idxUid = col("universe_id");
const idxName = col("game_name");
const idxGenre = col("genre");
const idxCcu = col("ccu");
const idxActive = col("active_codes_count");
const idxChanged = col("last_changed");
const idxCode1 = col("code_1");
const idxReward1 = col("reward_1");
const idxCode2 = col("code_2");
const idxReward2 = col("reward_2");
const idxCode3 = col("code_3");
const idxReward3 = col("reward_3");

if (idxUid < 0 || idxName < 0) {
  throw new Error(`Missing required columns in CSV header: ${header.join(", ")}`);
}

const byUniverse = new Map();
let skippedDeletedOrEmpty = 0;
let skippedInvalidCodes = 0;
let duplicateRowsMerged = 0;

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length < 3) continue;

  const uidRaw = cleanText(r[idxUid], 32);
  if (!/^\d+$/.test(uidRaw)) continue;
  const uid = Number(uidRaw);
  if (!Number.isSafeInteger(uid) || uid <= 0) continue;

  const gameName = cleanText(r[idxName], 120);
  if (
    !gameName ||
    gameName.length < 2 ||
    /^\[?\s*content deleted\s*\]?$/i.test(gameName) ||
    /^[-_.?\s]+$/.test(gameName)
  ) {
    skippedDeletedOrEmpty++;
    continue;
  }

  const genre = cleanText(r[idxGenre] || "All", 48) || "All";
  const ccu = Math.max(0, Math.round(Number(r[idxCcu]) || 0));
  const reportedActive = Math.max(0, Math.round(Number(r[idxActive]) || 0));
  const lastChanged = normalizeLastChanged(r[idxChanged]);

  const pairs = [
    [r[idxCode1], r[idxReward1]],
    [r[idxCode2], r[idxReward2]],
    [r[idxCode3], r[idxReward3]],
  ];

  const extractedCodes = [];
  for (const [rawCode, rawReward] of pairs) {
    const code = cleanText(rawCode, 60);
    if (!code) continue;
    if (!isValidCode(code)) {
      skippedInvalidCodes++;
      continue;
    }
    extractedCodes.push([code, cleanReward(rawReward)]);
  }

  if (extractedCodes.length === 0) continue;

  const existing = byUniverse.get(uid);
  if (existing) {
    duplicateRowsMerged++;
    if (ccu > existing.c) existing.c = ccu;
    if (reportedActive > existing.a) existing.a = reportedActive;
    if (lastChanged > existing.t) existing.t = lastChanged;
    const seen = new Set(existing.k.map(([c]) => c.toUpperCase()));
    for (const pair of extractedCodes) {
      const norm = pair[0].toUpperCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        existing.k.push(pair);
      }
    }
  } else {
    const seen = new Set();
    const deduped = [];
    for (const pair of extractedCodes) {
      const norm = pair[0].toUpperCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        deduped.push(pair);
      }
    }
    byUniverse.set(uid, {
      u: uid,
      n: gameName,
      s: slugifyGameName(gameName, uid),
      g: genre,
      c: ccu,
      t: lastChanged,
      a: Math.max(reportedActive, deduped.length),
      k: deduped,
    });
  }
}

const entries = Array.from(byUniverse.values()).sort((a, b) => {
  if (b.c !== a.c) return b.c - a.c;
  return b.k.length - a.k.length;
});

let totalCodes = 0;
for (const entry of entries) totalCodes += entry.k.length;

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(entries), "utf8");

const sizeKb = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
console.log(
  JSON.stringify(
    {
      inputRows: rows.length - 1,
      uniqueGames: entries.length,
      totalActiveCodes: totalCodes,
      duplicateRowsMerged,
      skippedDeletedOrEmpty,
      skippedInvalidCodes,
      outputFile: path.relative(process.cwd(), OUTPUT_PATH),
      sizeKb: Number(sizeKb),
    },
    null,
    2
  )
);
