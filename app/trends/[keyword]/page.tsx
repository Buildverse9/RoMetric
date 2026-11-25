import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  extractKeywordTrends,
  getGamesForKeyword,
} from '@/lib/market-intelligence';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  SITE_URL,
  buildGameUrlPath,
  getCurrentMonthYear,
  safeJsonLd,
} from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ keyword: string }>;
}): Promise<Metadata> {
  const { keyword } = await params;
  const decoded = decodeURIComponent(keyword).toLowerCase().trim();
  if (!decoded || decoded.length < 2) {
    return { title: 'Keyword Trend Not Found' };
  }
  const label = decoded.charAt(0).toUpperCase() + decoded.slice(1);
  const monthYear = getCurrentMonthYear();
  return {
    title: `"${label}" Roblox Games — Live Players & Niche Data (${monthYear})`,
    description: `Explore every live "${label}" game on Roblox in ${monthYear}. Compare concurrent players, average CCU per game, leader share, and revenue benchmarks.`,
    alternates: { canonical: `${SITE_URL}/trends/${encodeURIComponent(decoded)}` },
  };
}

export default async function KeywordTrendDetailPage({
  params,
}: {
  params: Promise<{ keyword: string }>;
}) {
  const { keyword } = await params;
  const decoded = decodeURIComponent(keyword).toLowerCase().trim();
  if (!decoded || decoded.length < 2 || !/^[a-z0-9-]+$/.test(decoded)) {
    notFound();
  }

  let allGames: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      allGames = await fetchSupabaseGamesList();
    } catch {
      allGames = [];
    }
  }

  const matched = getGamesForKeyword(allGames, decoded);
  if (matched.length === 0) notFound();

  const label = decoded.charAt(0).toUpperCase() + decoded.slice(1);
  const monthYear = getCurrentMonthYear();
  const totalCcu = matched.reduce((sum, g) => sum + g.currentCcu, 0);
  const avgCcu = Math.round(totalCcu / matched.length);
  const leaderSharePct =
    totalCcu > 0 ? Math.round((matched[0].currentCcu / totalCcu) * 100) : 0;

  const relatedTrends = extractKeywordTrends(allGames, 3, 24).filter(
    (t) => t.keyword !== decoded
  );

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Keyword Trends',
          item: `${SITE_URL}/trends`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: label,
          item: `${SITE_URL}/trends/${encodeURIComponent(decoded)}`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Top "${label}" Roblox Games (${monthYear})`,
      numberOfItems: Math.min(50, matched.length),
      itemListElement: matched.slice(0, 50).map((g, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: g.name,
        url: `${SITE_URL}${buildGameUrlPath(g)}`,
      })),
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="space-y-3">
        <Link
          href="/trends"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7893A3] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Keyword Trends
        </Link>
        <div className="space-y-2 max-w-3xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
            &ldquo;{label}&rdquo; Roblox Games ({monthYear})
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
            {matched.length} tracked Roblox experiences currently match the{' '}
            <strong className="font-semibold text-slate-900 dark:text-white">
              {label}
            </strong>{' '}
            theme with {formatExactNumber(totalCcu)} combined live players.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Combined Live CCU
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(totalCcu)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Competing Games
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(matched.length)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Average CCU / Game
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatExactNumber(avgCcu)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Top Game Share
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {leaderSharePct}%
          </p>
        </LiquidGlassCard>
      </div>

      <LiquidGlassCard className="rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                <th className="py-3.5 pl-5 pr-2 w-12">#</th>
                <th className="py-3.5 px-3">Experience</th>
                <th className="py-3.5 px-3 text-right">Live CCU</th>
                <th className="py-3.5 px-3 text-right hidden sm:table-cell">24h</th>
                <th className="py-3.5 px-3 text-right hidden md:table-cell">Visits</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Est. Rev / mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
              {matched.slice(0, 100).map((game, idx) => {
                const rev = estimateGameRevenue(game);
                return (
                  <tr
                    key={game.universeId}
                    className="hover:bg-black/[0.025] dark:hover:bg-white/[0.035] transition-colors group"
                  >
                    <td className="py-3 pl-5 pr-2 text-sm text-slate-400 dark:text-[#6F8796] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={buildGameUrlPath(game)}
                        className="flex items-center gap-3 min-w-0"
                      >
                        <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate max-w-[260px] sm:max-w-[380px]">
                            {game.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate">
                            {game.creatorName} · {game.genre}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-right text-sm font-semibold text-slate-950 dark:text-white tabular-nums">
                      {formatExactNumber(game.currentCcu)}
                    </td>
                    <td className="py-3 px-3 text-right hidden sm:table-cell">
                      <GrowthValue value={game.growth24h} />
                    </td>
                    <td className="py-3 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden md:table-cell">
                      {formatCompactNumber(game.totalVisits)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums whitespace-nowrap">
                      {formatCurrencyCompact(rev.monthlyUsd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {relatedTrends.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            More Trending Roblox Themes
          </h2>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {relatedTrends.slice(0, 18).map((t) => (
              <Link
                key={t.keyword}
                href={`/trends/${encodeURIComponent(t.keyword)}`}
                className="text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
              >
                {t.label}{' '}
                <span className="text-xs text-slate-400 dark:text-[#6F8796] tabular-nums">
                  ({formatCompactNumber(t.totalCcu)})
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
