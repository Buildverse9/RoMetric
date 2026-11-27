import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ArrowLeft, BarChart2, Clock, Sparkles, Ticket } from 'lucide-react';
import { extractUpdateBadgeText } from '@/lib/market-intelligence';
import {
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
  formatUtcTimestamp,
} from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  SITE_URL,
  buildGameSlugParam,
  buildGameUpdatesUrlPath,
  buildGameUrlPath,
  cleanSeoGameName,
  extractUniverseIdFromParam,
  getCurrentMonthYear,
  safeJsonLd,
} from '@/lib/seo';
import {
  fetchSupabaseGameById,
  fetchSupabaseGameHistory,
  isSupabaseConfigured,
  isValidNumericId,
} from '@/lib/supabase-server';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { LiquidGlassCard } from '@/components/MotionPrimitives';

export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cleanId = extractUniverseIdFromParam(slug);
  if (!isValidNumericId(cleanId) || !isSupabaseConfigured()) {
    return { title: 'Roblox Game Updates' };
  }
  const game = await fetchSupabaseGameById(cleanId).catch(() => null);
  if (!game) return { title: 'Game Not Found' };

  const cleanName = cleanSeoGameName(game.name);
  const monthYear = getCurrentMonthYear();
  const canonicalPath = buildGameUpdatesUrlPath(game);

  return {
    title: `${cleanName} Updates, Patch Status & Player Impact (${monthYear})`,
    description: `Check when ${cleanName} was last updated on Roblox, track post-patch player counts, observed peak CCU, and 30-day daily activity trends.`,
    alternates: { canonical: `${SITE_URL}${canonicalPath}` },
    openGraph: {
      title: `${cleanName} Updates & Player Impact (${monthYear}) | RoMetric`,
      description: `Live update timestamp, patch tag detection, and 30-day CCU impact log for ${cleanName}.`,
      url: `${SITE_URL}${canonicalPath}`,
      type: 'website',
    },
  };
}

export default async function CanonicalGameUpdatesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanId = extractUniverseIdFromParam(slug);
  if (!isValidNumericId(cleanId) || !isSupabaseConfigured()) {
    notFound();
  }

  const [game, history30d] = await Promise.all([
    fetchSupabaseGameById(cleanId).catch(() => null),
    fetchSupabaseGameHistory(cleanId, '30d').catch(() => ({
      points: [],
      peakRecord: null,
    })),
  ]);

  if (!game) notFound();

  const canonicalSlug = buildGameSlugParam(game);
  if (canonicalSlug && slug !== canonicalSlug) {
    permanentRedirect(`/g/${canonicalSlug}/updates`);
  }

  const gamePath = buildGameUrlPath(game);
  const updatesPath = buildGameUpdatesUrlPath(game);
  const cleanName = cleanSeoGameName(game.name);
  const monthYear = getCurrentMonthYear();
  const updateTag = extractUpdateBadgeText(game.name);
  const rev = estimateGameRevenue(game);
  const recentDays = [...history30d.points].reverse().slice(0, 30);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        {
          '@type': 'ListItem',
          position: 2,
          name: cleanName,
          item: `${SITE_URL}${gamePath}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Updates',
          item: `${SITE_URL}${updatesPath}`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${cleanName} Updates & Patch Activity (${monthYear})`,
      url: `${SITE_URL}${updatesPath}`,
      dateModified: game.robloxUpdatedAt || game.lastCollectedAt,
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-[#7893A3]">
          <Link
            href={gamePath}
            className="inline-flex items-center gap-1.5 font-medium hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {cleanName} Analytics
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/updates"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            All Live Updates
          </Link>
        </div>

        <LiquidGlassCard className="rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <GameArtwork src={game.iconUrl} alt={game.name} size="lg" />
            <div className="space-y-1.5 min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
                {cleanName} Updates &amp; Patch Impact
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9CB3C0]">
                {game.robloxUpdatedAt
                  ? `Last updated on Roblox ${formatRelativeTime(game.robloxUpdatedAt)} (${formatUtcTimestamp(game.robloxUpdatedAt)})`
                  : 'Monitoring official Roblox update timestamps'}
                {updateTag ? ` · Current tag: ${updateTag}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href={gamePath}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Full Charts
            </Link>
            <Link
              href={`/similar/${game.universeId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full liquid-glass-pill text-slate-700 dark:text-[#C5D8E2] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Similar Games
            </Link>
            <Link
              href={`/codes/${encodeURIComponent(game.slug)}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full liquid-glass-pill text-slate-700 dark:text-[#C5D8E2] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors whitespace-nowrap"
            >
              <Ticket className="w-3.5 h-3.5" />
              Codes
            </Link>
          </div>
        </LiquidGlassCard>
      </div>

      {/* 4-column update telemetry KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Current Live Players
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(game.currentCcu)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            24h Player Delta
          </p>
          <div className="text-2xl font-bold">
            <GrowthValue value={game.growth24h} />
          </div>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Observed Peak CCU
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(game.peakCcuObserved)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Est. Monthly Revenue
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatCurrencyCompact(rev.monthlyUsd)}
          </p>
        </LiquidGlassCard>
      </div>

      {/* Official description / patch notes snippet if available */}
      {game.description && (
        <LiquidGlassCard className="rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Latest Experience Notes &amp; Description
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-[#9CB3C0] whitespace-pre-line leading-relaxed max-w-4xl">
            {game.description}
          </p>
        </LiquidGlassCard>
      )}

      {/* Historical Activity Log */}
      <LiquidGlassCard className="rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-900/8 dark:border-white/10 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Recent Player Activity Ledger
          </h2>
          <span className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
            {recentDays.length} recorded intervals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                <th className="py-3 pl-5 pr-3">Timestamp (UTC)</th>
                <th className="py-3 px-3 text-right">Avg / Observed CCU</th>
                <th className="py-3 px-3 text-right hidden sm:table-cell">Peak CCU</th>
                <th className="py-3 px-3 text-right hidden md:table-cell">Cumulative Visits</th>
                <th className="py-3 pl-3 pr-5 text-right hidden md:table-cell">Favorites</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
              {recentDays.map((pt) => (
                <tr
                  key={pt.timestamp}
                  className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                >
                  <td className="py-3 pl-5 pr-3 text-xs sm:text-sm text-slate-700 dark:text-[#C5D8E2] tabular-nums">
                    {formatUtcTimestamp(pt.timestamp)}
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-semibold text-slate-950 dark:text-white tabular-nums">
                    {formatExactNumber(pt.ccu)}
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-emerald-600 dark:text-[#10E89A] tabular-nums hidden sm:table-cell">
                    {formatExactNumber(pt.maxCcu ?? pt.ccu)}
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden md:table-cell">
                    {formatCompactNumber(pt.visits)}
                  </td>
                  <td className="py-3 pl-3 pr-5 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden md:table-cell">
                    {formatCompactNumber(pt.favorites)}
                  </td>
                </tr>
              ))}
              {recentDays.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-sm text-slate-500 dark:text-[#7893A3]"
                  >
                    Historical daily snapshots are currently accumulating for{' '}
                    {cleanName}.
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
