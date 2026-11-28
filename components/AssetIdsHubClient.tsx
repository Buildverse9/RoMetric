'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  Eye,
  Heart,
  Image as ImageIcon,
  Layers,
  Music,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Smile,
  Sparkles,
  Swords,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import { formatCompactNumber } from '@/lib/format';
import {
  ASSET_HUB_META,
  ASSET_HUB_ORDER,
  type AssetIdCategorySlug,
  type CuratedAssetHubType,
  type CuratedAssetIdRecord,
  type LiveCatalogAssetItem,
  type LiveCatalogHubType,
} from '@/lib/asset-ids-data';

interface AssetIdsHubClientProps {
  category: AssetIdCategorySlug;
  initialCuratedItems: CuratedAssetIdRecord[];
  initialCatalogItems: LiveCatalogAssetItem[];
  initialCatalogCursor: string | null;
}

type BackdropMode = 'dark-map' | 'bright-sky' | 'da-hood' | 'tactical-grid';

const BACKDROP_OPTIONS: Array<{
  id: BackdropMode;
  label: string;
  className: string;
}> = [
  {
    id: 'dark-map',
    label: 'Dark Map',
    className: 'bg-gradient-to-br from-[#081016] via-[#101c24] to-[#050a0e]',
  },
  {
    id: 'bright-sky',
    label: 'Bright Sky',
    className: 'bg-gradient-to-b from-[#7dd3fc] via-[#bae6fd] to-[#e2e8f0]',
  },
  {
    id: 'da-hood',
    label: 'Street Night',
    className:
      'bg-[radial-gradient(circle_at_70%_25%,rgba(251,146,60,0.28),transparent_45%),linear-gradient(135deg,#18181b_0%,#27272a_55%,#0f172a_100%)]',
  },
  {
    id: 'tactical-grid',
    label: 'Tactical Grid',
    className:
      'bg-[#1e293b] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:20px_20px]',
  },
];

function HubCategoryIcon({
  slug,
  className = 'w-4 h-4',
}: {
  slug: AssetIdCategorySlug;
  className?: string;
}) {
  switch (slug) {
    case 'crosshairs':
      return <Crosshair className={className} />;
    case 'decals':
      return <ImageIcon className={className} />;
    case 'hair':
      return <Scissors className={className} />;
    case 'faces':
      return <Smile className={className} />;
    case 'gears':
      return <Swords className={className} />;
    case 'music':
      return <Music className={className} />;
  }
}

async function copyTextReliable(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function CrosshairReticleGraphic({
  style = 'dot',
  color = '#10e89a',
  scale = 1,
}: {
  style?: CuratedAssetIdRecord['crosshairStyle'];
  color?: string;
  scale?: number;
}) {
  const size = Math.round(52 * scale);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="drop-shadow-[0_0_2px_rgba(0,0,0,0.85)]"
    >
      {style === 'dot' && (
        <>
          <circle cx="32" cy="32" r="5.5" fill="rgba(0,0,0,0.55)" />
          <circle cx="32" cy="32" r="4" fill={color} />
        </>
      )}
      {style === 'plus' && (
        <>
          <line x1="32" y1="10" x2="32" y2="25" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="32" y1="39" x2="32" y2="54" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="10" y1="32" x2="25" y2="32" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="39" y1="32" x2="54" y2="32" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="32" r="2" fill={color} />
        </>
      )}
      {style === 'circle-dot' && (
        <>
          <circle cx="32" cy="32" r="16" stroke={color} strokeWidth="2.5" />
          <circle cx="32" cy="32" r="3" fill={color} />
        </>
      )}
      {style === 't-cross' && (
        <>
          <line x1="12" y1="32" x2="26" y2="32" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="38" y1="32" x2="52" y2="32" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="32" y1="38" x2="32" y2="54" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="32" r="2.2" fill={color} />
        </>
      )}
      {style === 'diamond' && (
        <>
          <polygon points="32,12 52,32 32,52 12,32" stroke={color} strokeWidth="2.5" fill="none" />
          <circle cx="32" cy="32" r="2.5" fill={color} />
        </>
      )}
      {style === 'box' && (
        <>
          <rect
            x="14"
            y="14"
            width="36"
            height="36"
            rx="4"
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray="10 6"
          />
          <circle cx="32" cy="32" r="2.5" fill={color} />
        </>
      )}
    </svg>
  );
}

export function AssetIdsHubClient({
  category,
  initialCuratedItems,
  initialCatalogItems,
  initialCatalogCursor,
}: AssetIdsHubClientProps) {
  const { user, isAdmin } = useApp();
  const meta = ASSET_HUB_META[category];
  const isCatalogMode = meta.mode === 'catalog';

  const [searchInput, setSearchInput] = useState('');
  const [selectedSub, setSelectedSub] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [curatedItems, setCuratedItems] =
    useState<CuratedAssetIdRecord[]>(initialCuratedItems);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adminBanner, setAdminBanner] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newAssetId, setNewAssetId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSubCategory, setNewSubCategory] = useState(
    meta.subCategories[1] || 'General'
  );
  const [newCreator, setNewCreator] = useState('RoMetric Curated');
  const [newTags, setNewTags] = useState('');
  const [newCrosshairStyle, setNewCrosshairStyle] =
    useState<NonNullable<CuratedAssetIdRecord['crosshairStyle']>>('dot');
  const [newCrosshairColor, setNewCrosshairColor] = useState('#10e89a');
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [previewCrosshair, setPreviewCrosshair] =
    useState<CuratedAssetIdRecord | null>(null);
  const [backdrop, setBackdrop] = useState<BackdropMode>('dark-map');
  const [previewScale, setPreviewScale] = useState<number>(1.3);

  const [catalogItems, setCatalogItems] =
    useState<LiveCatalogAssetItem[]>(initialCatalogItems);
  const [catalogCursor, setCatalogCursor] = useState<string | null>(
    initialCatalogCursor
  );
  const [catalogSort, setCatalogSort] = useState<
    'favorites' | 'updated' | 'bestselling' | 'relevance'
  >('favorites');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const handleCopy = useCallback(async (assetId: string) => {
    const ok = await copyTextReliable(assetId);
    if (ok) {
      setCopiedId(assetId);
      setTimeout(() => {
        setCopiedId((prev) => (prev === assetId ? null : prev));
      }, 1500);
    }
  }, []);

  const fetchCatalog = useCallback(
    async (opts: {
      keyword: string;
      sort: string;
      cursor?: string | null;
      append?: boolean;
    }) => {
      if (!isCatalogMode) return;
      if (opts.append) {
        setCatalogLoadingMore(true);
      } else {
        setCatalogLoading(true);
      }
      setCatalogError(null);

      try {
        const params = new URLSearchParams({
          category: category as LiveCatalogHubType,
          sort: opts.sort,
        });
        if (opts.keyword.trim()) params.set('q', opts.keyword.trim());
        if (opts.cursor) params.set('cursor', opts.cursor);

        const res = await fetch(`/api/ids/catalog?${params.toString()}`);
        const json = (await res.json()) as {
          items?: LiveCatalogAssetItem[];
          nextPageCursor?: string | null;
          error?: string;
        };

        if (json.error && (!json.items || json.items.length === 0)) {
          setCatalogError(json.error);
        }
        const incoming = json.items || [];
        setCatalogItems((prev) => {
          if (!opts.append) return incoming;
          const seen = new Set(prev.map((x) => x.assetId));
          const merged = [...prev];
          for (const item of incoming) {
            if (!seen.has(item.assetId)) {
              seen.add(item.assetId);
              merged.push(item);
            }
          }
          return merged;
        });
        setCatalogCursor(json.nextPageCursor || null);
      } catch {
        setCatalogError('Unable to reach Roblox Catalog right now.');
      } finally {
        setCatalogLoading(false);
        setCatalogLoadingMore(false);
      }
    },
    [category, isCatalogMode]
  );

  useEffect(() => {
    if (!isCatalogMode) return;
    const effectiveKeyword =
      searchInput.trim() || (selectedSub !== 'All' ? selectedSub : '');
    if (
      !effectiveKeyword &&
      catalogSort === 'favorites' &&
      initialCatalogItems.length > 0 &&
      catalogItems === initialCatalogItems
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchCatalog({
        keyword: effectiveKeyword,
        sort: catalogSort,
        append: false,
      });
    }, 320);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, selectedSub, catalogSort, isCatalogMode, category]);

  const filteredCurated = useMemo(() => {
    if (isCatalogMode) return [];
    const q = searchInput.trim().toLowerCase();
    return curatedItems.filter((item) => {
      if (
        selectedSub !== 'All' &&
        item.subCategory.toLowerCase() !== selectedSub.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.assetId.includes(q) ||
        item.subCategory.toLowerCase().includes(q) ||
        item.creatorOrArtist.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [curatedItems, isCatalogMode, searchInput, selectedSub]);

  const handleAdminAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin || isCatalogMode || submittingAdd) return;
    setSubmittingAdd(true);
    setAddError(null);

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
          hubType: category as CuratedAssetHubType,
          assetId: newAssetId.trim(),
          title: newTitle.trim(),
          subCategory: newSubCategory.trim(),
          creatorOrArtist: newCreator.trim(),
          tags: newTags,
          crosshairStyle:
            category === 'crosshairs' ? newCrosshairStyle : undefined,
          crosshairColor:
            category === 'crosshairs' ? newCrosshairColor : undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        item?: CuratedAssetIdRecord;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.item) {
        throw new Error(json.error || 'Failed to publish Asset ID.');
      }

      setCuratedItems((prev) => [
        json.item!,
        ...prev.filter((x) => x.assetId !== json.item!.assetId),
      ]);
      setNewAssetId('');
      setNewTitle('');
      setNewTags('');
      setShowAddModal(false);
      setAdminBanner(json.message || 'Asset ID added.');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to save ID.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleAdminDelete = async (item: CuratedAssetIdRecord) => {
    if (!user || !isAdmin || isCatalogMode) return;
    setDeletingId(item.id);
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
        throw new Error(json.error || 'Failed to delete Asset ID.');
      }
      setCuratedItems((prev) =>
        prev.filter((x) => x.id !== item.id && x.assetId !== item.assetId)
      );
      setConfirmDeleteId(null);
      setAdminBanner(json.message || 'Asset ID removed.');
    } catch (err) {
      setAdminBanner(
        err instanceof Error ? err.message : 'Unable to delete Asset ID.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6">
      {/* Breadcrumb + Admin Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#86A1B0]"
        >
          <Link
            href="/"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Home
          </Link>
          <span>/</span>
          <Link
            href="/ids"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Roblox Asset IDs
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-[#F1F7FA] font-medium">
            {meta.shortTitle}
          </span>
        </nav>

        {!isCatalogMode && user && isAdmin && (
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Add {meta.shortTitle.replace(/s$/, '')} ID
          </button>
        )}
      </div>

      {/* Category Switcher Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {ASSET_HUB_ORDER.map((slug) => {
          const item = ASSET_HUB_META[slug];
          const active = slug === category;
          return (
            <Link
              key={slug}
              href={`/ids/${slug}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                  : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <HubCategoryIcon slug={slug} className="w-3.5 h-3.5" />
              {item.shortTitle}
            </Link>
          );
        })}
      </div>

      {/* Hero Header */}
      <LiquidGlassCard className="rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
              <HubCategoryIcon slug={category} className="w-4 h-4" />
              <span>
                {isCatalogMode
                  ? 'Live Roblox Catalog API Directory'
                  : 'Curated & Verified Working IDs'}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              {meta.heroHeadline}
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
              {meta.heroSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-[#86A1B0] tabular-nums shrink-0">
            <div>
              <p className="text-[11px] uppercase tracking-wider">Showing</p>
              <p className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
                {isCatalogMode ? catalogItems.length : filteredCurated.length}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-900/10 dark:bg-white/10" />
            <div>
              <p className="text-[11px] uppercase tracking-wider">Source</p>
              <p className="font-semibold text-emerald-600 dark:text-[#10E89A]">
                {isCatalogMode ? 'Live Catalog' : 'Verified DB'}
              </p>
            </div>
          </div>
        </div>

        {/* Search + Filter Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2 border-t border-slate-900/8 dark:border-white/10">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#6F8796] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                isCatalogMode
                  ? `Search Roblox ${meta.shortTitle} (e.g. ${meta.subCategories[1]}, ${meta.subCategories[2]})...`
                  : `Filter ${meta.shortTitle.toLowerCase()} by name, game, tag, or numeric ID...`
              }
              className="w-full pl-10 pr-9 py-2.5 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isCatalogMode && (
            <select
              aria-label="Sort catalog results"
              value={catalogSort}
              onChange={(e) =>
                setCatalogSort(
                  e.target.value as
                    | 'favorites'
                    | 'updated'
                    | 'bestselling'
                    | 'relevance'
                )
              }
              className="px-4 py-2.5 text-xs font-medium liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] focus:outline-none cursor-pointer"
            >
              <option value="favorites" className="bg-white dark:bg-[#0D1A22]">
                Most Favorited
              </option>
              <option value="bestselling" className="bg-white dark:bg-[#0D1A22]">
                Bestselling
              </option>
              <option value="updated" className="bg-white dark:bg-[#0D1A22]">
                Recently Updated
              </option>
              <option value="relevance" className="bg-white dark:bg-[#0D1A22]">
                Relevance
              </option>
            </select>
          )}
        </div>

        {/* Subcategory Quick Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {meta.subCategories.map((sub) => {
            const active = selectedSub === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSub(sub)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-600/15 dark:bg-[#10E89A]/20 text-emerald-700 dark:text-[#10E89A] border border-emerald-500/40'
                    : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-[#9CB3C0] border border-transparent hover:border-slate-900/10 dark:hover:border-white/15'
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      </LiquidGlassCard>

      {adminBanner && (
        <div className="liquid-glass rounded-2xl px-4 py-3 text-xs text-slate-900 dark:text-[#F1F7FA] border border-emerald-500/35 flex items-center justify-between gap-3">
          <span>{adminBanner}</span>
          <button
            type="button"
            onClick={() => setAdminBanner(null)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      {isCatalogMode ? (
        <section className="space-y-5">
          {catalogError && (
            <div className="liquid-glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <span>{catalogError}</span>
              <button
                type="button"
                onClick={() =>
                  void fetchCatalog({
                    keyword:
                      searchInput.trim() ||
                      (selectedSub !== 'All' ? selectedSub : ''),
                    sort: catalogSort,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 font-semibold cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Catalog Sync
              </button>
            </div>
          )}

          {catalogLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div
                  key={idx}
                  className="liquid-glass rounded-3xl p-4 h-36 animate-pulse"
                />
              ))}
            </div>
          ) : catalogItems.length === 0 ? (
            <LiquidGlassCard className="rounded-3xl p-10 text-center space-y-2">
              <p className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
                No matching {meta.shortTitle} found
              </p>
              <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
                Try a broader keyword or switch back to &ldquo;All&rdquo; to browse trending Roblox Catalog items.
              </p>
            </LiquidGlassCard>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalogItems.map((item) => {
                  const isCopied = copiedId === item.assetId;
                  return (
                    <article
                      key={item.assetId}
                      className="liquid-glass rounded-3xl p-4 flex flex-col justify-between gap-4 border border-slate-900/8 dark:border-white/10 hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-900/5 dark:bg-white/[0.06] border border-slate-900/8 dark:border-white/10 shrink-0 flex items-center justify-center">
                          {item.thumbnailUrl ? (
                            <Image
                              src={item.thumbnailUrl}
                              alt={item.name}
                              fill
                              sizes="64px"
                              referrerPolicy="no-referrer"
                              className="object-cover"
                            />
                          ) : (
                            <HubIcon className="w-6 h-6 text-slate-400 dark:text-[#6F8796]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#F1F7FA] line-clamp-2 leading-snug">
                            {item.name}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-[#86A1B0] truncate">
                            By {item.creatorName}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-[#86A1B0] tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Heart className="w-3 h-3 text-rose-500" />
                              {formatCompactNumber(item.favoriteCount)}
                            </span>
                            <span>
                              {item.priceRobux === null
                                ? 'Off-sale'
                                : item.priceRobux === 0
                                  ? 'Free'
                                  : `${item.priceRobux} R$`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-900/6 dark:border-white/8">
                        <code className="font-mono text-xs font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1.5 rounded-xl">
                          {item.assetId}
                        </code>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`https://www.roblox.com/catalog/${item.assetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${item.name} on Roblox`}
                            className="p-2 rounded-full text-slate-500 dark:text-[#86A1B0] hover:text-emerald-600 dark:hover:text-[#10E89A] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleCopy(item.assetId)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                                : 'bg-emerald-600/12 dark:bg-[#10E89A]/15 text-emerald-700 dark:text-[#10E89A] hover:bg-emerald-600 hover:text-white dark:hover:bg-[#10E89A] dark:hover:text-[#04130D]'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy ID
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {catalogCursor && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    disabled={catalogLoadingMore}
                    onClick={() =>
                      void fetchCatalog({
                        keyword:
                          searchInput.trim() ||
                          (selectedSub !== 'All' ? selectedSub : ''),
                        sort: catalogSort,
                        cursor: catalogCursor,
                        append: true,
                      })
                    }
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] hover:border-emerald-500/50 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${catalogLoadingMore ? 'animate-spin' : ''}`}
                    />
                    {catalogLoadingMore ? 'Loading more...' : 'Load More Catalog IDs'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          {filteredCurated.length === 0 ? (
            <LiquidGlassCard className="rounded-3xl p-10 text-center space-y-2">
              <p className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
                No matching {meta.shortTitle} found
              </p>
              <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
                Try clearing your filter or searching by a different keyword.
              </p>
            </LiquidGlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCurated.map((item) => {
                const isCopied = copiedId === item.assetId;
                const isConfirming = confirmDeleteId === item.id;
                return (
                  <article
                    key={item.id}
                    className="liquid-glass rounded-3xl p-4 flex flex-col justify-between gap-4 border border-slate-900/8 dark:border-white/10 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      {category === 'crosshairs' ? (
                        <button
                          type="button"
                          onClick={() => setPreviewCrosshair(item)}
                          title="Open interactive backdrop previewer"
                          className="w-16 h-16 rounded-2xl bg-[#0a131a] border border-emerald-500/25 shrink-0 flex items-center justify-center hover:border-emerald-400 transition-colors cursor-pointer"
                        >
                          <CrosshairReticleGraphic
                            style={item.crosshairStyle}
                            color={item.crosshairColor || '#10e89a'}
                            scale={0.78}
                          />
                        </button>
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-[#10E89A]/12 border border-emerald-500/20 shrink-0 flex items-center justify-center text-emerald-600 dark:text-[#10E89A]">
                          <HubIcon className="w-6 h-6" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#F1F7FA] leading-snug">
                          {item.title}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
                          {item.subCategory} · {item.creatorOrArtist}
                        </p>
                        {item.tags.length > 0 && (
                          <p className="text-[11px] text-slate-400 dark:text-[#6F8796] truncate">
                            {item.tags.slice(0, 4).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-3 border-t border-slate-900/6 dark:border-white/8">
                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono text-xs font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1.5 rounded-xl">
                          {item.assetId}
                        </code>

                        <div className="flex items-center gap-1.5">
                          {category === 'crosshairs' && (
                            <button
                              type="button"
                              onClick={() => setPreviewCrosshair(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium liquid-glass-pill rounded-full text-slate-700 dark:text-[#C5D8E2] hover:border-emerald-500/50 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Test
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleCopy(item.assetId)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                                : 'bg-emerald-600/12 dark:bg-[#10E89A]/15 text-emerald-700 dark:text-[#10E89A] hover:bg-emerald-600 hover:text-white dark:hover:bg-[#10E89A] dark:hover:text-[#04130D]'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy ID
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {user && isAdmin && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          {isConfirming ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === item.id}
                                onClick={() => void handleAdminDelete(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                {deletingId === item.id
                                  ? 'Removing...'
                                  : 'Confirm Delete'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove (Admin)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Cross-Link */}
      <LiquidGlassCard className="rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            More RoMetric Directories
          </p>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
            Looking for free in-game rewards or live player charts?
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
            Explore verified Roblox promo codes and live concurrent player trackers updated continuously.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/codes"
            className="px-4 py-2 text-xs font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity"
          >
            Browse Game Codes
          </Link>
          <Link
            href="/rankings"
            className="px-4 py-2 text-xs font-semibold rounded-full liquid-glass-pill text-slate-900 dark:text-[#F1F7FA] hover:border-emerald-500/50 transition-colors"
          >
            Live Rankings
          </Link>
        </div>
      </LiquidGlassCard>

      {/* SEO FAQ Section */}
      {meta.faqs.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meta.faqs.map((faq) => (
              <LiquidGlassCard key={faq.question} className="rounded-3xl p-5 space-y-2">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F1F7FA]">
                  {faq.question}
                </h3>
                <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                  {faq.answer}
                </p>
              </LiquidGlassCard>
            ))}
          </div>
        </section>
      )}

      {/* Interactive Crosshair Contrast Preview Modal */}
      {previewCrosshair && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewCrosshair(null)}
        >
          <div
            className="w-full max-w-lg liquid-glass-strong rounded-3xl p-6 space-y-5 border border-slate-900/12 dark:border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
                  Live Crosshair Previewer
                </p>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
                  {previewCrosshair.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setPreviewCrosshair(null)}
                className="p-1.5 rounded-full text-slate-500 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`relative h-56 rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center ${
                BACKDROP_OPTIONS.find((b) => b.id === backdrop)?.className ||
                BACKDROP_OPTIONS[0].className
              }`}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
                <div className="w-16 h-16 rounded-full border border-dashed border-white/50" />
              </div>
              <CrosshairReticleGraphic
                style={previewCrosshair.crosshairStyle}
                color={previewCrosshair.crosshairColor || '#10e89a'}
                scale={previewScale}
              />
              <span className="absolute bottom-2.5 right-3 font-mono text-[11px] text-white/80 bg-black/45 px-2 py-0.5 rounded-lg tabular-nums">
                Scale {previewScale.toFixed(1)}x
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
                Test Backdrop Contrast
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BACKDROP_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBackdrop(opt.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                      backdrop === opt.id
                        ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                        : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="crosshair-scale-slider"
                  className="font-medium text-slate-600 dark:text-[#9CB3C0]"
                >
                  Reticle Scale
                </label>
                <span className="font-mono font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                  {previewScale.toFixed(1)}x
                </span>
              </div>
              <input
                id="crosshair-scale-slider"
                type="range"
                min={0.5}
                max={2.4}
                step={0.1}
                value={previewScale}
                onChange={(e) => setPreviewScale(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-900/8 dark:border-white/10">
              <code className="font-mono text-sm font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                {previewCrosshair.assetId}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy(previewCrosshair.assetId)}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity cursor-pointer"
              >
                {copiedId === previewCrosshair.assetId ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied ID
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Crosshair ID
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin-Only Add Asset ID Modal */}
      {showAddModal && !isCatalogMode && user && isAdmin && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-md liquid-glass-strong rounded-3xl p-6 space-y-4 border border-slate-900/12 dark:border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
                  Add {meta.shortTitle} Entry
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full text-slate-500 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminAdd} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
                  Numeric Roblox Asset ID *
                </label>
                <input
                  type="text"
                  required
                  value={newAssetId}
                  onChange={(e) => setNewAssetId(e.target.value)}
                  placeholder="e.g. 5998624778"
                  className="w-full px-3.5 py-2 text-sm font-mono liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Neon Cyan Headshot Dot"
                  className="w-full px-3.5 py-2 text-sm liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
                    Sub-Category
                  </label>
                  <select
                    value={newSubCategory}
                    onChange={(e) => setNewSubCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
                  >
                    {meta.subCategories
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
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
                    Creator / Artist
                  </label>
                  <input
                    type="text"
                    value={newCreator}
                    onChange={(e) => setNewCreator(e.target.value)}
                    className="w-full px-3 py-2 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
                  />
                </div>
              </div>

              {category === 'crosshairs' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
                      Reticle Shape
                    </label>
                    <select
                      value={newCrosshairStyle}
                      onChange={(e) =>
                        setNewCrosshairStyle(
                          e.target.value as NonNullable<
                            CuratedAssetIdRecord['crosshairStyle']
                          >
                        )
                      }
                      className="w-full px-3 py-2 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
                    >
                      <option value="dot" className="bg-white dark:bg-[#0D1A22]">
                        Center Dot
                      </option>
                      <option value="plus" className="bg-white dark:bg-[#0D1A22]">
                        Plus Cross
                      </option>
                      <option
                        value="circle-dot"
                        className="bg-white dark:bg-[#0D1A22]"
                      >
                        Circle + Dot
                      </option>
                      <option
                        value="t-cross"
                        className="bg-white dark:bg-[#0D1A22]"
                      >
                        T-Cross
                      </option>
                      <option
                        value="diamond"
                        className="bg-white dark:bg-[#0D1A22]"
                      >
                        Diamond
                      </option>
                      <option value="box" className="bg-white dark:bg-[#0D1A22]">
                        Shotgun Box
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
                      Reticle Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newCrosshairColor}
                        onChange={(e) => setNewCrosshairColor(e.target.value)}
                        className="h-9 w-10 rounded-xl border border-slate-900/10 dark:border-white/15 bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-xs text-slate-600 dark:text-[#9CB3C0]">
                        {newCrosshairColor}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="da hood, fps, clean, headshot"
                  className="w-full px-3.5 py-2 text-xs liquid-glass-pill rounded-2xl text-slate-900 dark:text-[#F1F7FA]"
                />
              </div>

              {addError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {addError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium liquid-glass-pill rounded-full text-slate-600 dark:text-[#9CB3C0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 text-xs font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {submittingAdd ? 'Publishing...' : 'Publish Asset ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
