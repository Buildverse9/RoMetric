import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Flame } from 'lucide-react';
import {
  GENRE_DEFINITIONS,
  getGamesForGenre,
  getGenreBySlug,
} from '@/lib/market-intelligence';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import {
  estimateGameRevenue,
  estimatePortfolioMonthlyRevenue,
  formatCurrencyCompact,
} from '@/lib/revenue';
import { SITE_URL, getCurrentMonthYear, safeJsonLd } from '@/lib/seo';
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = getGenreBySlug(slug);
  if (!genre) {
    return { title: 'Genre Not Found' };
  }
  const monthYear = getCurrentMonthYear();
  return {
    title: `Top ${genre.name} Roblox Games — Live Players (${monthYear})`,
    description: `Track the most popular ${genre.name} games on Roblox in ${monthYear}. Live concurrent players, 24h growth, approval ratings, and estimated monthly revenue.`,
    alternates: { canonical: `${SITE_URL}/genres/${genre.slug}` },
    openGraph: {
      title: `Top ${genre.name} Roblox Games (${monthYear}) | RoMetric`,
      description: genre.description,
      url: `${SITE_URL}/genres/${genre.slug}`,
      type: 'website',
    },
  };
}

export default async function GenreDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const genre = getGenreBySlug(slug);
  if (!genre) notFound();

  const monthYear = getCurrentMonthYear();
  let allGames: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      allGames = await fetchSupabaseGamesList();
    } catch {
      allGames = [];
    }
  }

  const matchedGames = getGamesForGenre(allGames, genre);
  const totalPlatformCcu = allGames.reduce((sum, g) => sum + g.currentCcu, 0);
  const sectorCcu = matchedGames.reduce((sum, g) => sum + g.currentCcu, 0);
  const marketSharePct =
    totalPlatformCcu > 0
      ? Number(((sectorCcu / totalPlatformCcu) * 100).toFixed(1))
      : 0;
  const sectorMonthlyRev = estimatePortfolioMonthlyRevenue(matchedGames);

  const risers = [...matchedGames]
    .filter((g) => typeof g.growth24h === 'number' && g.growth24h > 0 && g.currentCcu >= 100)
    .sort((a, b) => (b.growth24h ?? 0) - (a.growth24h ?? 0))
    .slice(0, 6);

  const otherGenres = GENRE_DEFINITIONS.filter((g) => g.slug !== genre.slug);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Genres',
          item: `${SITE_URL}/genres`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: genre.name,
          item: `${SITE_URL}/genres/${genre.slug}`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Top ${genre.name} Roblox Games (${monthYear})`,
      numberOfItems: Math.min(50, matchedGames.length),
      itemListElement: matchedGames.slice(0, 50).map((g, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: g.name,
        url: `${SITE_URL}/games/${g.universeId}`,
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
          href="/genres"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7893A3] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Roblox Genres
        </Link>

        <div className="space-y-2 max-w-3xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
            Top {genre.name} Roblox Games ({monthYear})
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
            {genre.description}
          </p>
        </div>
      </div>

      {/* 4-column KPI summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Live Players
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(sectorCcu)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Tracked Games
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(matchedGames.length)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Roblox Market Share
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {marketSharePct}%
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Est. Sector Revenue / mo
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatCurrencyCompact(sectorMonthlyRev)}
          </p>
        </LiquidGlassCard>
      </div>

      {/* Fastest rising in this genre */}
      {risers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Fastest Rising in {genre.shortLabel}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {risers.map((g) => (
              <Link
                key={g.universeId}
                href={`/games/${g.universeId}`}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <LiquidGlassCard className="rounded-2xl p-4 flex items-center justify-between gap-3 group-hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] truncate group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors">
                        {g.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
                        {formatCompactNumber(g.currentCcu)} CCU · {g.creatorName}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <GrowthValue value={g.growth24h} />
                  </div>
                </LiquidGlassCard>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Main Genre Leaderboard Table */}
      <LiquidGlassCard
        exportTitle={`Top ${genre.name} Roblox Games`}
        className="rounded-3xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                <th className="py-3.5 pl-5 pr-2 w-12">#</th>
                <th className="py-3.5 px-3">Experience</th>
                <th className="py-3.5 px-3 text-right">Live CCU</th>
                <th className="py-3.5 px-3 text-right hidden sm:table-cell">24h</th>
                <th className="py-3.5 px-3 text-right hidden md:table-cell">Rating</th>
                <th className="py-3.5 px-3 text-right hidden md:table-cell">Visits</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Est. Rev / mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
              {matchedGames.slice(0, 120).map((game, idx) => {
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
                        href={`/games/${game.universeId}`}
                        className="flex items-center gap-3 min-w-0"
                      >
                        <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate max-w-[260px] sm:max-w-[360px]">
                            {game.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate">
                            {game.creatorName} ·{' '}
                            <span className="hover:underline">Similar &amp; Updates</span>
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
                      {game.likeRatio !== null ? `${game.likeRatio}%` : '—'}
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
              {matchedGames.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-slate-500 dark:text-[#7893A3]"
                  >
                    No tracked games found in {genre.name} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* Related genres cross-navigation */}
      <section className="space-y-3 pt-2">
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
          Explore Other Roblox Genres
        </h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm">
          {otherGenres.map((other) => (
            <Link
              key={other.slug}
              href={`/genres/${other.slug}`}
              className="inline-flex items-center gap-1 text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
            >
              <span>{other.name}</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
