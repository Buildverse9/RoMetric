import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Layers } from 'lucide-react';
import {
  GENRE_DEFINITIONS,
  getGamesForGenre,
} from '@/lib/market-intelligence';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { estimatePortfolioMonthlyRevenue, formatCurrencyCompact } from '@/lib/revenue';
import { SITE_URL, getCurrentMonthYear, safeJsonLd } from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { GameArtwork } from '@/components/GameArtwork';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 1800;

export function generateMetadata(): Metadata {
  const monthYear = getCurrentMonthYear();
  return {
    title: `Roblox Game Genres & Categories — Live Players (${monthYear})`,
    description: `Compare live player counts, market share, and estimated revenue across all major Roblox genres including Anime, Simulation, Roleplay, RPG, Tower Defense, and Horror.`,
    alternates: { canonical: `${SITE_URL}/genres` },
    openGraph: {
      title: `Roblox Game Genres — Live Market Share (${monthYear}) | RoMetric`,
      description:
        'Explore live Roblox genre market share, concurrent players, and top experiences by category.',
      url: `${SITE_URL}/genres`,
      type: 'website',
    },
  };
}

export default async function GenresPage() {
  const monthYear = getCurrentMonthYear();
  let games: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      games = await fetchSupabaseGamesList();
    } catch {
      games = [];
    }
  }

  const totalPlatformCcu = games.reduce((sum, g) => sum + g.currentCcu, 0);

  const genreStats = GENRE_DEFINITIONS.map((def) => {
    const matched = getGamesForGenre(games, def);
    const ccu = matched.reduce((sum, g) => sum + g.currentCcu, 0);
    const sharePct =
      totalPlatformCcu > 0
        ? Number(((ccu / totalPlatformCcu) * 100).toFixed(1))
        : 0;
    const revMonthly = estimatePortfolioMonthlyRevenue(matched);
    const ratios = matched
      .map((g) => g.likeRatio)
      .filter((r): r is number => r !== null);
    const avgRating =
      ratios.length > 0
        ? Number((ratios.reduce((s, v) => s + v, 0) / ratios.length).toFixed(1))
        : null;
    return {
      def,
      games: matched,
      ccu,
      sharePct,
      revMonthly,
      avgRating,
      topGames: matched.slice(0, 3),
    };
  }).sort((a, b) => b.ccu - a.ccu);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Roblox Game Genres (${monthYear})`,
    url: `${SITE_URL}/genres`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: genreStats.length,
      itemListElement: genreStats.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.def.name,
        url: `${SITE_URL}/genres/${g.def.slug}`,
      })),
    },
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <header className="space-y-2 max-w-3xl">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#7893A3]">
          <Link
            href="/"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-700 dark:text-[#C5D8E2]">Genres</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Roblox Genres &amp; Market Share
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Live concurrent players, active game counts, and directional monthly
          revenue across {GENRE_DEFINITIONS.length} core Roblox categories for{' '}
          {monthYear}.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {genreStats.map((item) => (
          <Link
            key={item.def.slug}
            href={`/genres/${item.def.slug}`}
            className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-3xl"
          >
            <LiquidGlassCard className="rounded-3xl p-5 h-full flex flex-col justify-between gap-5 transition-transform duration-200 group-hover:-translate-y-0.5">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors">
                      {item.def.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
                      {item.games.length} tracked games · {item.sharePct}% share
                      {item.avgRating !== null ? ` · ${item.avgRating}% rating` : ''}
                    </p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors shrink-0 mt-1" />
                </div>

                <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed line-clamp-2">
                  {item.def.description}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900/8 dark:border-white/8">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                      Live Players
                    </p>
                    <p className="text-lg font-bold text-slate-950 dark:text-white tabular-nums">
                      {formatExactNumber(item.ccu)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                      Est. Sector Rev / mo
                    </p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                      {formatCurrencyCompact(item.revMonthly)}
                    </p>
                  </div>
                </div>
              </div>

              {item.topGames.length > 0 ? (
                <div className="space-y-2 pt-2 border-t border-slate-900/8 dark:border-white/8">
                  <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                    Leading experiences
                  </p>
                  <div className="space-y-1.5">
                    {item.topGames.map((g) => (
                      <div
                        key={g.universeId}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                          <span className="font-medium text-slate-800 dark:text-[#E2EDF3] truncate">
                            {g.name}
                          </span>
                        </div>
                        <span className="text-slate-500 dark:text-[#9CB3C0] tabular-nums shrink-0">
                          {formatCompactNumber(g.currentCcu)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-900/8 dark:border-white/8 flex items-center gap-2 text-xs text-slate-500 dark:text-[#7893A3]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Explore {item.def.shortLabel} rankings</span>
                </div>
              )}
            </LiquidGlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
