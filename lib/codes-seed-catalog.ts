import fs from 'node:fs';
import path from 'node:path';
import type { GameCodeRecord } from './codes-types';

export interface SeedCatalogGame {
  /** Universe ID */
  u: number;
  /** Cleaned game name */
  n: string;
  /** SEO slug (`{name}-{universeId}`) */
  s: string;
  /** Genre */
  g: string;
  /** Peak/snapshot CCU */
  c: number;
  /** Last changed ISO timestamp */
  t: string;
  /** Reported active codes count */
  a: number;
  /** Array of [code, rewardDescription] tuples */
  k: Array<[string, string]>;
}

interface CatalogIndex {
  entries: SeedCatalogGame[];
  byUniverseId: Map<string, SeedCatalogGame>;
  bySlug: Map<string, SeedCatalogGame>;
  byBaseSlug: Map<string, SeedCatalogGame>;
}

let cachedIndex: CatalogIndex | null = null;

function stripTrailingUniverseId(slug: string): string {
  return slug.replace(/-[0-9]{5,20}$/, '');
}

function loadCatalogIndex(): CatalogIndex {
  if (cachedIndex) return cachedIndex;

  const entries: SeedCatalogGame[] = [];
  const byUniverseId = new Map<string, SeedCatalogGame>();
  const bySlug = new Map<string, SeedCatalogGame>();
  const byBaseSlug = new Map<string, SeedCatalogGame>();

  try {
    const filePath = path.join(process.cwd(), 'data', 'codes-seed-catalog.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as SeedCatalogGame[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item.u !== 'number' || !Array.isArray(item.k) || item.k.length === 0) {
            continue;
          }
          entries.push(item);
          const uid = String(item.u);
          byUniverseId.set(uid, item);
          const slugLower = item.s.toLowerCase();
          bySlug.set(slugLower, item);
          const baseSlug = stripTrailingUniverseId(slugLower);
          // Highest-CCU game wins bare slug (entries are pre-sorted by CCU desc)
          if (baseSlug && !byBaseSlug.has(baseSlug)) {
            byBaseSlug.set(baseSlug, item);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[codes-seed-catalog] Failed to load bundled catalog:', err);
  }

  cachedIndex = { entries, byUniverseId, bySlug, byBaseSlug };
  return cachedIndex;
}

export function getSeedCodesCatalog(): SeedCatalogGame[] {
  return loadCatalogIndex().entries;
}

export function getSeedCatalogByUniverseId(universeId: string): SeedCatalogGame | null {
  return loadCatalogIndex().byUniverseId.get(universeId) ?? null;
}

export function findSeedCatalogGame(slugOrId: string): SeedCatalogGame | null {
  const idx = loadCatalogIndex();
  const clean = slugOrId.trim().toLowerCase();
  if (!clean) return null;

  if (/^[0-9]{1,20}$/.test(clean)) {
    return idx.byUniverseId.get(clean) ?? null;
  }

  const direct = idx.bySlug.get(clean);
  if (direct) return direct;

  const withoutCodes = clean.endsWith('-codes') ? clean.replace(/-codes$/, '') : clean;
  const directTrimmed = idx.bySlug.get(withoutCodes);
  if (directTrimmed) return directTrimmed;

  const trailingId = withoutCodes.match(/-?([0-9]{5,20})$/)?.[1];
  if (trailingId) {
    const byId = idx.byUniverseId.get(trailingId);
    if (byId) return byId;
  }

  return idx.byBaseSlug.get(withoutCodes) ?? null;
}

export function normalizeSeedCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** Deterministic positive synthetic numeric ID for bundled seed codes (avoids colliding with DB serial IDs). */
export function makeSeedCodeId(universeId: number, codeIndex: number): number {
  return 900_000_000 + ((universeId % 99_999_999) * 10) + (codeIndex % 10);
}

export function mapSeedEntryToCodeRecords(
  entry: SeedCatalogGame,
  overrideGame?: { name?: string; slug?: string }
): GameCodeRecord[] {
  const uid = String(entry.u);
  const gameName = overrideGame?.name || entry.n;
  const gameSlug = overrideGame?.slug || entry.s;
  return entry.k.map(([code, reward], idx) => ({
    id: makeSeedCodeId(entry.u, idx),
    universeId: uid,
    gameName,
    gameSlug,
    code,
    normalizedCode: normalizeSeedCode(code),
    rewardDescription: reward || 'In-game reward',
    status: 'active',
    sourceId: 'rometric_verified_catalog',
    sourceName: 'RoMetric Verified Catalog',
    sourceAttributionLabel: 'RoMetric Automated Codes Index',
    sourceLicenseNotice: null,
    sourceUrl: null,
    sourceReportedStatus: 'active',
    adminLocked: false,
    submittedByNote: null,
    discoveredAt: entry.t,
    lastVerifiedAt: entry.t,
    expiresAt: null,
    updatedAt: entry.t,
  }));
}
