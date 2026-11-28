import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  Crosshair,
  Image as ImageIcon,
  Layers,
  Music,
  Scissors,
  Smile,
  Sparkles,
  Swords,
  Ticket,
} from 'lucide-react';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import {
  ASSET_HUB_META,
  ASSET_HUB_ORDER,
  type AssetIdCategorySlug,
} from '@/lib/asset-ids-data';
import { fetchCuratedAssetIds } from '@/lib/asset-ids-server';
import { SITE_NAME, SITE_URL, safeJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Roblox Asset IDs (2026) — Crosshairs, Decals, Hair, Faces, Gears & Music | ${SITE_NAME}`,
  description:
    'Search and copy working Roblox Asset IDs with 1-click Copy ID: Da Hood Crosshair IDs, Image & Decal codes, live Roblox Catalog Hair, Face & Gear IDs, and Boombox Music Song IDs.',
  alternates: {
    canonical: `${SITE_URL}/ids`,
  },
  openGraph: {
    title: `Roblox Asset IDs Directory — Crosshairs, Decals, Hair & Music | ${SITE_NAME}`,
    description:
      'Copy verified Roblox Crosshair IDs, Decal codes, Music Song IDs, and live Catalog Hair, Face & Gear IDs in one click.',
    url: `${SITE_URL}/ids`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

function getHubIcon(slug: AssetIdCategorySlug) {
  switch (slug) {
    case 'crosshairs':
      return Crosshair;
    case 'decals':
      return ImageIcon;
    case 'hair':
      return Scissors;
    case 'faces':
      return Smile;
    case 'gears':
      return Swords;
    case 'music':
      return Music;
  }
}

export default async function AssetIdsDirectoryPage() {
  const allCurated = await fetchCuratedAssetIds().catch(() => []);
  const curatedCounts = {
    crosshairs: allCurated.filter((i) => i.hubType === 'crosshairs').length,
    decals: allCurated.filter((i) => i.hubType === 'decals').length,
    music: allCurated.filter((i) => i.hubType === 'music').length,
  };

  const featuredCrosshairs = allCurated
    .filter((i) => i.hubType === 'crosshairs')
    .slice(0, 6);
  const featuredMusic = allCurated
    .filter((i) => i.hubType === 'music')
    .slice(0, 6);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Roblox Asset IDs',
            item: `${SITE_URL}/ids`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Roblox Asset ID Categories',
        itemListElement: ASSET_HUB_ORDER.map((slug, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: ASSET_HUB_META[slug].label,
          url: `${SITE_URL}/ids/${slug}`,
        })),
      },
    ],
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#7893A3]"
      >
        <Link
          href="/"
          className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
        >
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">
          Roblox Asset IDs
        </span>
      </nav>

      {/* Hero */}
      <LiquidGlassCard className="rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-[#10E89A]">
          <Layers className="w-4 h-4" />
          <span>Evergreen Roblox ID Hubs · Live Catalog + Curated Vault</span>
        </div>

        <div className="space-y-2 max-w-3xl">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Roblox Asset IDs Directory (2026)
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
            Instantly search and copy working numeric Roblox IDs for Da Hood
            crosshairs, Bloxburg decals, Boombox music codes, and live Roblox
            Catalog avatar hair, faces, and gears—built for zero-friction 1-tap
            copying.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Link
            href="/ids/crosshairs"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Launch Crosshair Tester
          </Link>
          <Link
            href="/ids/hair"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold liquid-glass-pill text-slate-900 dark:text-white hover:border-emerald-500/45 rounded-full transition-colors"
          >
            <Scissors className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
            Search Live Hair Catalog
          </Link>
          <Link
            href="/codes"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium liquid-glass-pill text-slate-700 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] rounded-full transition-colors"
          >
            <Ticket className="w-3.5 h-3.5" />
            Active Game Promo Codes
          </Link>
        </div>
      </LiquidGlassCard>

      {/* 6 Hub Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Browse All 6 Roblox ID Hubs
          </h2>
          <span className="text-xs text-slate-500 dark:text-[#7893A3]">
            Updated continuously
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ASSET_HUB_ORDER.map((slug) => {
            const meta = ASSET_HUB_META[slug];
            const Icon = getHubIcon(slug);
            const badgeText =
              meta.mode === 'catalog'
                ? 'Live Roblox Catalog'
                : `${curatedCounts[slug as keyof typeof curatedCounts]} Verified IDs`;

            return (
              <Link
                key={slug}
                href={`/ids/${slug}`}
                className="group block focus-visible:outline-none"
              >
                <LiquidGlassCard className="h-full rounded-3xl p-6 flex flex-col justify-between gap-4 border border-slate-900/8 dark:border-white/10 group-hover:border-emerald-500/45 transition-colors">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="w-11 h-11 rounded-2xl bg-emerald-500/12 dark:bg-[#10E89A]/14 text-emerald-600 dark:text-[#10E89A] flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-[#10E89A] bg-emerald-500/10 dark:bg-[#10E89A]/12 px-2.5 py-1 rounded-full">
                        {badgeText}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors">
                        {meta.label}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed line-clamp-2">
                        {meta.heroSubtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900/6 dark:border-white/8 text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
                    <span>Open {meta.shortTitle}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </LiquidGlassCard>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured Quick-Reference Tables for Crosshairs & Music */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiquidGlassCard className="rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Popular Crosshair IDs
              </h2>
            </div>
            <Link
              href="/ids/crosshairs"
              className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline"
            >
              Test all ({curatedCounts.crosshairs}) →
            </Link>
          </div>

          <div className="divide-y divide-slate-900/6 dark:divide-white/8 text-sm">
            {featuredCrosshairs.map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                    {item.subCategory}
                  </p>
                </div>
                <code className="font-mono text-xs font-semibold text-emerald-700 dark:text-[#10E89A] bg-emerald-500/10 dark:bg-[#10E89A]/12 px-2.5 py-1 rounded-lg tabular-nums shrink-0">
                  {item.assetId}
                </code>
              </div>
            ))}
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard className="rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Working Music & Song IDs
              </h2>
            </div>
            <Link
              href="/ids/music"
              className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline"
            >
              Browse all ({curatedCounts.music}) →
            </Link>
          </div>

          <div className="divide-y divide-slate-900/6 dark:divide-white/8 text-sm">
            {featuredMusic.map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate">
                    {item.creatorOrArtist} · {item.subCategory}
                  </p>
                </div>
                <code className="font-mono text-xs font-semibold text-emerald-700 dark:text-[#10E89A] bg-emerald-500/10 dark:bg-[#10E89A]/12 px-2.5 py-1 rounded-lg tabular-nums shrink-0">
                  {item.assetId}
                </code>
              </div>
            ))}
          </div>
        </LiquidGlassCard>
      </section>

      {/* Related Internal Links */}
      <LiquidGlassCard className="rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explore Live Roblox Analytics</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-[#9CB3C0]">
            Track live concurrent players, breakout games, and active promo codes across Roblox.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/rankings"
            className="px-3.5 py-2 text-xs font-semibold liquid-glass-pill rounded-full text-slate-900 dark:text-white hover:border-emerald-500/45"
          >
            Live Rankings
          </Link>
          <Link
            href="/trending"
            className="px-3.5 py-2 text-xs font-semibold liquid-glass-pill rounded-full text-slate-900 dark:text-white hover:border-emerald-500/45"
          >
            Trending Breakouts
          </Link>
          <Link
            href="/codes"
            className="px-3.5 py-2 text-xs font-semibold liquid-glass-pill rounded-full text-slate-900 dark:text-white hover:border-emerald-500/45"
          >
            Promo Codes
          </Link>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
