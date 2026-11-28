import {
  CURATED_ASSET_IDS_SEED,
  type CuratedAssetHubType,
  type CuratedAssetIdRecord,
} from './asset-ids-data';
import {
  isSupabaseConfigured,
  isSupabaseWriteConfigured,
  supabaseRest,
} from './supabase-server';

const ASSET_IDS_CONFIG_KEY = 'curated_asset_ids_v1';

interface StoredAssetIdsOverlay {
  added: CuratedAssetIdRecord[];
  deletedIds: string[];
}

const EMPTY_OVERLAY: StoredAssetIdsOverlay = {
  added: [],
  deletedIds: [],
};

async function readAssetOverlay(): Promise<StoredAssetIdsOverlay> {
  if (!isSupabaseConfigured()) return EMPTY_OVERLAY;
  try {
    const res = await supabaseRest(
      `system_config?select=value&key=eq.${encodeURIComponent(ASSET_IDS_CONFIG_KEY)}&limit=1`
    );
    if (!res.ok) return EMPTY_OVERLAY;
    const rows = (await res.json()) as Array<{ value?: unknown }>;
    const raw = rows[0]?.value as Partial<StoredAssetIdsOverlay> | undefined;
    if (!raw || typeof raw !== 'object') return EMPTY_OVERLAY;
    return {
      added: Array.isArray(raw.added)
        ? (raw.added as CuratedAssetIdRecord[])
        : [],
      deletedIds: Array.isArray(raw.deletedIds)
        ? raw.deletedIds.map((x) => String(x))
        : [],
    };
  } catch {
    return EMPTY_OVERLAY;
  }
}

async function writeAssetOverlay(
  overlay: StoredAssetIdsOverlay
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseWriteConfigured()) {
    return {
      ok: false,
      error: 'Supabase write credentials are not configured on the server.',
    };
  }

  try {
    const res = await supabaseRest('system_config?on_conflict=key', {
      method: 'POST',
      requireAdminKey: true,
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: [
        {
          key: ASSET_IDS_CONFIG_KEY,
          value: overlay,
          updated_at: new Date().toISOString(),
        },
      ],
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        error: `Failed to persist asset IDs (${res.status}): ${text}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save asset IDs.',
    };
  }
}

export async function fetchCuratedAssetIds(params?: {
  hubType?: CuratedAssetHubType;
  subCategory?: string;
  query?: string;
}): Promise<CuratedAssetIdRecord[]> {
  const overlay = await readAssetOverlay();
  const deletedSet = new Set(overlay.deletedIds);

  const seenAssetKeys = new Set<string>();
  const combined: CuratedAssetIdRecord[] = [];

  for (const item of overlay.added) {
    if (
      deletedSet.has(item.id) ||
      deletedSet.has(`${item.hubType}:${item.assetId}`)
    ) {
      continue;
    }
    const dedupe = `${item.hubType}:${item.assetId}`;
    if (seenAssetKeys.has(dedupe)) continue;
    seenAssetKeys.add(dedupe);
    combined.push({ ...item, source: 'admin' });
  }

  for (const item of CURATED_ASSET_IDS_SEED) {
    if (
      deletedSet.has(item.id) ||
      deletedSet.has(`${item.hubType}:${item.assetId}`)
    ) {
      continue;
    }
    const dedupe = `${item.hubType}:${item.assetId}`;
    if (seenAssetKeys.has(dedupe)) continue;
    seenAssetKeys.add(dedupe);
    combined.push(item);
  }

  const hubFilter = params?.hubType;
  const subFilter = params?.subCategory?.trim().toLowerCase();
  const q = params?.query?.trim().toLowerCase();

  return combined.filter((item) => {
    if (hubFilter && item.hubType !== hubFilter) return false;
    if (
      subFilter &&
      subFilter !== 'all' &&
      item.subCategory.toLowerCase() !== subFilter
    ) {
      return false;
    }
    if (q) {
      const hit =
        item.title.toLowerCase().includes(q) ||
        item.assetId.includes(q) ||
        item.subCategory.toLowerCase().includes(q) ||
        item.creatorOrArtist.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
}

export async function adminAddCuratedAssetId(input: {
  assetId: string;
  title: string;
  hubType: CuratedAssetHubType;
  subCategory: string;
  creatorOrArtist?: string;
  tags?: string[];
  crosshairStyle?: CuratedAssetIdRecord['crosshairStyle'];
  crosshairColor?: string;
}): Promise<{ ok: boolean; item?: CuratedAssetIdRecord; error?: string }> {
  const cleanAssetId = String(input.assetId || '').replace(/[^0-9]/g, '');
  if (cleanAssetId.length < 4 || cleanAssetId.length > 20) {
    return {
      ok: false,
      error: 'Please enter a valid numeric Roblox Asset ID (4–20 digits).',
    };
  }
  const cleanTitle = String(input.title || '').trim().slice(0, 80);
  if (cleanTitle.length < 2) {
    return { ok: false, error: 'Title must be at least 2 characters.' };
  }

  const overlay = await readAssetOverlay();
  const dedupeKey = `${input.hubType}:${cleanAssetId}`;

  const newItem: CuratedAssetIdRecord = {
    id: `admin-${input.hubType}-${cleanAssetId}-${Date.now()}`,
    assetId: cleanAssetId,
    title: cleanTitle,
    hubType: input.hubType,
    subCategory: String(input.subCategory || 'General').trim().slice(0, 40),
    creatorOrArtist:
      String(input.creatorOrArtist || 'RoMetric Admin').trim().slice(0, 60) ||
      'RoMetric Admin',
    tags: (input.tags || [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8),
    crosshairStyle: input.crosshairStyle,
    crosshairColor: input.crosshairColor,
    verifiedWorking: true,
    addedAt: new Date().toISOString(),
    source: 'admin',
  };

  const nextAdded = [
    newItem,
    ...overlay.added.filter((x) => `${x.hubType}:${x.assetId}` !== dedupeKey),
  ];
  const nextDeleted = overlay.deletedIds.filter(
    (id) => id !== dedupeKey && !id.endsWith(`-${cleanAssetId}`)
  );

  const saved = await writeAssetOverlay({
    added: nextAdded,
    deletedIds: nextDeleted,
  });
  if (!saved.ok) {
    return { ok: false, error: saved.error };
  }
  return { ok: true, item: newItem };
}

export async function adminDeleteCuratedAssetId(input: {
  id?: string;
  hubType: CuratedAssetHubType;
  assetId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cleanAssetId = String(input.assetId || '').replace(/[^0-9]/g, '');
  if (!cleanAssetId) {
    return { ok: false, error: 'Valid assetId is required.' };
  }
  const dedupeKey = `${input.hubType}:${cleanAssetId}`;
  const overlay = await readAssetOverlay();

  const nextAdded = overlay.added.filter(
    (x) => x.id !== input.id && `${x.hubType}:${x.assetId}` !== dedupeKey
  );
  const nextDeleted = Array.from(
    new Set([
      ...overlay.deletedIds,
      dedupeKey,
      ...(input.id ? [input.id] : []),
    ])
  );

  const saved = await writeAssetOverlay({
    added: nextAdded,
    deletedIds: nextDeleted,
  });
  if (!saved.ok) {
    return { ok: false, error: saved.error };
  }
  return { ok: true };
}
