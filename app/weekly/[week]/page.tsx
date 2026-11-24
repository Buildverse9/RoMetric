import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Flame, Users } from 'lucide-react';
import {
  GENRE_DEFINITIONS,
  aggregateStudiosServer,
  formatWeekRangeLabel,
  getGamesForGenre,
  getRecentWeekDates,
} from '@/lib/market-intelligence';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import { SITE_URL, safeJsonLd } from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 1800;

function isValidIsoDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ week: string }>;
}): Promise<Metadata> {
  const { week } = await params;
  if (!isValidIsoDate(week)) return { title: 'Weekly Recap Not Found' };
  const label = formatWeekRangeLabel(week);
  return {
    title: `Roblox Weekly Market Recap (${label})`,
    description: `Top Roblox games, breakout risers, studio leaderboard, and genre market share for the week of ${label}.`,
    alternates: { canonical: `${SITE_URL}/weekly/${week}` },
  };
}

export default async function WeeklyRecapDetailPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  if (!isValidIsoDate(week)) notFound();

  const rangeLabel = formatWeekRangeLabel(week);
  const recentWeeks = getRecentWeekDates(12);

  let games: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      games = await fetchSupabaseGamesList();
    } catch {
      games = [];
    }
  }

  const totalCcu = games.reduce((sum, g) => sum + g.currentCcu, 0);
  const topGames = games.slice(0, 15);
  const breakouts = [...games]
    .filter((g) => typeof g.growth24h === 'number' && g.growth24h > 0 && g.currentCcu >= 200)
    .sort((a, b) => (b.growth24h ?? 0) - (a.growth24h ?? 0))
    .slice(0, 8);
  const topStudios = aggregateStudiosServer(games).slice(0, 8);

  const genreBreakdown = GENRE_DEFINITIONS.map((def) => {
    const matched = getGamesForGenre(games, def);
    const ccu = matched.reduce((s, g) => s + g.currentCcu, 0);
    const pct = totalCcu > 0 ? Number(((ccu / totalCcu) * 100).toFixed(1)) : 0;
    return { def, ccu, pct, count: matched.length };
  })
    .sort((a, b) => b.ccu - a.ccu)
    .slice(0, 8);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Roblox Weekly Market Recap: ${rangeLabel}`,
    datePublished: `${week}T00:00:00Z`,
    url: `${SITE_URL}/weekly/${week}`,
    publisher: { '@type': 'Organization', name: 'RoMetric', url: SITE_URL },
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="space-y-3">
        <Link
          href="/weekly"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7893A3] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Weekly Recaps
        </Link>
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#7893A3]">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
            <span>Weekly Intelligence Report · {rangeLabel}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
            Roblox Weekly Recap: {rangeLabel}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
            Platform summary covering {formatExactNumber(games.length)} tracked
            experiences and {formatExactNumber(totalCcu)} combined live players.
          </p>
        </div>
      </div>

      {/* Top 15 Leaderboard */}
      <LiquidGlassCard className="rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-900/8 dark:border-white/10">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Top 15 Experiences
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                <th className="py-3 pl-5 pr-2 w-12">#</th>
                <th className="py-3 px-3">Experience</th>
                <th className="py-3 px-3 text-right">Live CCU</th>
                <th className="py-3 px-3 text-right hidden sm:table-cell">24h</th>
                <th className="py-3 pl-3 pr-5 text-right">Est. Rev / mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
              {topGames.map((g, idx) => {
                const rev = estimateGameRevenue(g);
                return (
                  <tr
                    key={g.universeId}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3 pl-5 pr-2 text-sm text-slate-400 dark:text-[#6F8796] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={`/games/${g.universeId}`}
                        className="flex items-center gap-3 min-w-0 group"
                      >
                        <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] truncate max-w-[260px] sm:max-w-[360px]">
                            {g.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                            {g.creatorName} · {g.genre}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-right text-sm font-semibold text-slate-950 dark:text-white tabular-nums">
                      {formatExactNumber(g.currentCcu)}
                    </td>
                    <td className="py-3 px-3 text-right hidden sm:table-cell">
                      <GrowthValue value={g.growth24h} />
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                      {formatCurrencyCompact(rev.monthlyUsd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* Split grid: Breakouts + Top Studios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiquidGlassCard className="rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Breakout Movers
            </h2>
          </div>
          <div className="divide-y divide-slate-900/8 dark:divide-white/8">
            {breakouts.map((g) => (
              <Link
                key={g.universeId}
                href={`/games/${g.universeId}`}
                className="py-2.5 flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] truncate">
                      {g.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
                      {formatCompactNumber(g.currentCcu)} CCU
                    </p>
                  </div>
                </div>
                <GrowthValue value={g.growth24h} />
              </Link>
            ))}
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard className="rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Leading Roblox Studios
            </h2>
          </div>
          <div className="divide-y divide-slate-900/8 dark:divide-white/8">
            {topStudios.map((studio, idx) => (
              <Link
                key={`${studio.creatorType}_${studio.creatorId}`}
                href={`/developers/${studio.creatorId}`}
                className="py-2.5 flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] truncate">
                    {idx + 1}. {studio.creatorName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                    {studio.gameCount} {studio.gameCount === 1 ? 'game' : 'games'} · Top:{' '}
                    {studio.topGame.name}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums shrink-0">
                  {formatCompactNumber(studio.combinedCcu)} CCU
                </span>
              </Link>
            ))}
          </div>
        </LiquidGlassCard>
      </div>

      {/* Genre market share */}
      <LiquidGlassCard className="rounded-3xl p-5 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
          Category Share Snapshot
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {genreBreakdown.map((item) => (
            <Link
              key={item.def.slug}
              href={`/genres/${item.def.slug}`}
              className="p-3.5 rounded-2xl border border-slate-900/8 dark:border-white/8 hover:border-emerald-500/40 transition-colors space-y-1"
            >
              <p className="text-sm font-semibold text-slate-950 dark:text-white">
                {item.def.shortLabel}
              </p>
              <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
                {formatCompactNumber(item.ccu)} CCU · {item.pct}% share
              </p>
            </Link>
          ))}
        </div>
      </LiquidGlassCard>

      {/* Archive links */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
          Other Weekly Archives
        </h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {recentWeeks
            .filter((w) => w !== week)
            .slice(0, 8)
            .map((w) => (
              <Link
                key={w}
                href={`/weekly/${w}`}
                className="text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
              >
                {formatWeekRangeLabel(w)}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
