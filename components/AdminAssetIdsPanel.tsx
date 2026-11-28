'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Crosshair,
  ExternalLink,
  Image as ImageIcon,
  Music,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import {
  ASSET_HUB_META,
  type CuratedAssetHubType,
  type CuratedAssetIdRecord,
} from '@/lib/asset-ids-data';

const CURATED_HUBS: CuratedAssetHubType[] = ['crosshairs', 'decals', 'music'];

export function AdminAssetIdsPanel() {
  const { user, isAdmin } = useApp();
  const [items, setItems] = useState<CuratedAssetIdRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterHub, setFilterHub] = useState<'all' | CuratedAssetHubType>('all');
  const [query, setQuery] = useState('');
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [hubType, setHubType] = useState<CuratedAssetHubType>('crosshairs');
  const [assetId, setAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [subCategory, setSubCategory] = useState('Da Hood');
  const [creatorOrArtist, setCreatorOrArtist] = useState('RoMetric Curated');
  const [tags, setTags] = useState('');
  const [crosshairStyle, setCrosshairStyle] =
    useState<NonNullable<CuratedAssetIdRecord['crosshairStyle']>>('dot');
  const [crosshairColor, setCrosshairColor] = useState('#10e89a');
  const [submitting, setSubmitting] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/ids/admin', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        items?: CuratedAssetIdRecord[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load curated Asset IDs.');
      }
      setItems(json.items || []);
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to load Asset IDs.',
      });
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        setLoading(true);
        const res = await fetch('/api/ids/admin', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = (await res.json()) as {
          items?: CuratedAssetIdRecord[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error || 'Failed to load curated Asset IDs.');
        }
        if (!cancelled) setItems(json.items || []);
      } catch (err) {
        if (!cancelled) {
          setBanner({
            type: 'error',
            text: err instanceof Error ? err.message : 'Unable to load Asset IDs.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

  const handleHubChange = (next: CuratedAssetHubType) => {
    setHubType(next);
    const defaultSub = ASSET_HUB_META[next].subCategories[1] || 'General';
    setSubCategory(defaultSub);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin || submitting) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/ids/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'add_asset_id',
          hubType,
          assetId: assetId.trim(),
          title: title.trim(),
          subCategory: subCategory.trim(),
          creatorOrArtist: creatorOrArtist.trim(),
          tags,
          crosshairStyle: hubType === 'crosshairs' ? crosshairStyle : undefined,
          crosshairColor: hubType === 'crosshairs' ? crosshairColor : undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        item?: CuratedAssetIdRecord;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.item) {
        throw new Error(json.error || 'Failed to add Asset ID.');
      }
      setItems((prev) => [
        json.item!,
        ...prev.filter(
          (x) =>
            !(
              x.hubType === json.item!.hubType &&
              x.assetId === json.item!.assetId
            )
        ),
      ]);
      setAssetId('');
      setTitle('');
      setTags('');
      setBanner({
        type: 'success',
        text: json.message || 'Asset ID published.',
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to publish ID.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: CuratedAssetIdRecord) => {
    if (!user || !isAdmin) return;
    setDeletingId(item.id);
    setBanner(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/ids/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'delete_asset_id',
          id: item.id,
          hubType: item.hubType,
          assetId: item.assetId,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to remove Asset ID.');
      }
      setItems((prev) =>
        prev.filter(
          (x) =>
            x.id !== item.id &&
            !(x.hubType === item.hubType && x.assetId === item.assetId)
        )
      );
      setConfirmId(null);
      setBanner({
        type: 'success',
        text: json.message || 'Asset ID removed.',
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete ID.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filterHub !== 'all' && item.hubType !== filterHub) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.assetId.includes(q) ||
        item.subCategory.toLowerCase().includes(q) ||
        item.creatorOrArtist.toLowerCase().includes(q)
      );
    });
  }, [items, filterHub, query]);

  const counts = useMemo(
    () => ({
      crosshairs: items.filter((i) => i.hubType === 'crosshairs').length,
      decals: items.filter((i) => i.hubType === 'decals').length,
      music: items.filter((i) => i.hubType === 'music').length,
    }),
    [items]
  );

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`liquid-glass rounded-2xl px-4 py-3 text-xs flex items-center justify-between gap-3 ${
            banner.type === 'success'
              ? 'border border-emerald-500/40 text-slate-900 dark:text-[#F1F7FA]'
              : 'border border-rose-500/40 text-rose-700 dark:text-rose-200'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
            {banner.text}
          </span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hub Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <LiquidGlassCard className="rounded-3xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
              Crosshair IDs
            </p>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
              {counts.crosshairs}
            </p>
          </div>
          <Link
            href="/ids/crosshairs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline"
          >
            <Crosshair className="w-4 h-4" />
            View
          </Link>
        </LiquidGlassCard>

        <LiquidGlassCard className="rounded-3xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
              Decal & Image IDs
            </p>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
              {counts.decals}
            </p>
          </div>
          <Link
            href="/ids/decals"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline"
          >
            <ImageIcon className="w-4 h-4" />
            View
          </Link>
        </LiquidGlassCard>

        <LiquidGlassCard className="rounded-3xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
              Music & Song IDs
            </p>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
              {counts.music}
            </p>
          </div>
          <Link
            href="/ids/music"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline"
          >
            <Music className="w-4 h-4" />
            View
          </Link>
        </LiquidGlassCard>
      </div>

      {/* Add New Curated Asset ID Form */}
      <LiquidGlassCard className="rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
              Publish Curated Asset ID
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
              Hair, Face, and Gear IDs sync automatically from the live Roblox Catalog API. Manage curated Crosshairs, Decals, and Music IDs below.
            </p>
          </div>
          <Link
            href="/ids"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline"
          >
            Open /ids Hub
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <select
            aria-label="Asset hub"
            value={hubType}
            onChange={(e) =>
              handleHubChange(e.target.value as CuratedAssetHubType)
            }
            className="md:col-span-2 px-3.5 py-2.5 text-xs font-medium liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
          >
            <option value="crosshairs" className="bg-white dark:bg-[#0D1A22]">
              Crosshairs
            </option>
            <option value="decals" className="bg-white dark:bg-[#0D1A22]">
              Decals
            </option>
            <option value="music" className="bg-white dark:bg-[#0D1A22]">
              Music IDs
            </option>
          </select>

          <input
            type="text"
            required
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            placeholder="Numeric ID (e.g. 5998624778)"
            className="md:col-span-3 px-3.5 py-2.5 text-xs font-mono liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
          />

          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Neon Cyan Precision Dot)"
            className="md:col-span-4 px-3.5 py-2.5 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
          />

          <select
            aria-label="Sub-category"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            className="md:col-span-3 px-3.5 py-2.5 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
          >
            {ASSET_HUB_META[hubType].subCategories
              .filter((s) => s !== 'All')
              .map((sub) => (
                <option
                  key={sub}
                  value={sub}
                  className="bg-white dark:bg-[#0D1A22]"
                >
                  {sub}
                </option>
              ))}
          </select>

          <input
            type="text"
            value={creatorOrArtist}
            onChange={(e) => setCreatorOrArtist(e.target.value)}
            placeholder="Creator / Artist"
            className="md:col-span-3 px-3.5 py-2.5 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
          />

          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma-separated)"
            className={`${
              hubType === 'crosshairs' ? 'md:col-span-4' : 'md:col-span-6'
            } px-3.5 py-2.5 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]`}
          />

          {hubType === 'crosshairs' && (
            <>
              <select
                aria-label="Reticle shape"
                value={crosshairStyle}
                onChange={(e) =>
                  setCrosshairStyle(
                    e.target.value as NonNullable<
                      CuratedAssetIdRecord['crosshairStyle']
                    >
                  )
                }
                className="md:col-span-2 px-3 py-2.5 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
              >
                <option value="dot" className="bg-white dark:bg-[#0D1A22]">
                  Dot
                </option>
                <option value="plus" className="bg-white dark:bg-[#0D1A22]">
                  Plus
                </option>
                <option
                  value="circle-dot"
                  className="bg-white dark:bg-[#0D1A22]"
                >
                  Circle Dot
                </option>
                <option value="t-cross" className="bg-white dark:bg-[#0D1A22]">
                  T-Cross
                </option>
                <option value="diamond" className="bg-white dark:bg-[#0D1A22]">
                  Diamond
                </option>
                <option value="box" className="bg-white dark:bg-[#0D1A22]">
                  Box
                </option>
              </select>

              <div className="md:col-span-1 flex items-center justify-center">
                <input
                  type="color"
                  aria-label="Crosshair color"
                  value={crosshairColor}
                  onChange={(e) => setCrosshairColor(e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-transparent cursor-pointer"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting || !assetId.trim() || !title.trim()}
            className="md:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-2xl bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {submitting ? 'Saving...' : 'Publish'}
          </button>
        </form>
      </LiquidGlassCard>

      {/* Curated Directory Table */}
      <LiquidGlassCard className="rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-slate-900/8 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', ...CURATED_HUBS] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterHub(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                  filterHub === tab
                    ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                    : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0]'
                }`}
              >
                {tab === 'all' ? 'All Hubs' : ASSET_HUB_META[tab].shortTitle}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ID or title..."
                className="pl-8 pr-3 py-1.5 text-xs liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] w-48"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadItems()}
              className="p-2 rounded-full liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] cursor-pointer"
              aria-label="Refresh Asset IDs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/90 dark:bg-[#0E1A22]/95 backdrop-blur-md border-b border-slate-900/8 dark:border-white/10 text-xs text-slate-500 dark:text-[#9CB3C0]">
              <tr>
                <th className="py-3 px-5">Hub</th>
                <th className="py-3 px-3">Asset ID</th>
                <th className="py-3 px-3">Title</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8 text-xs">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-black/[0.025] dark:hover:bg-white/[0.03]"
                >
                  <td className="py-3 px-5 font-semibold text-emerald-600 dark:text-[#10E89A] capitalize">
                    {item.hubType}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                    {item.assetId}
                  </td>
                  <td className="py-3 px-3 text-slate-900 dark:text-[#F1F7FA] font-medium">
                    {item.title}
                  </td>
                  <td className="py-3 px-3 text-slate-500 dark:text-[#86A1B0]">
                    {item.subCategory}
                  </td>
                  <td className="py-3 px-3 text-slate-500 dark:text-[#86A1B0] capitalize">
                    {item.source || 'seed'}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    {confirmId === item.id ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => void handleDelete(item)}
                          className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                        >
                          {deletingId === item.id ? 'Deleting...' : 'Confirm'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(item.id)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-500 dark:text-[#86A1B0]"
                  >
                    No curated Asset IDs match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
