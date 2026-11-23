'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock,
  GitCompare,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useApp } from './AppProvider';
import {
  evaluateTrending,
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
  formatUtcTimestamp,
} from '@/lib/format';
import { GameArtwork } from './GameArtwork';
import { GrowthValue } from './GameTable';
import { EChartWrapper } from './EChartWrapper';

export function HomeDashboard() {
  const router = useRouter();
  const {
    games,
    developers,
    loadingGames,
    gamesError,
    dataMode,
    lastUpdatedAt,
    refreshCatalog,
    setSearchOpen,
  } = useApp();

  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [heroQuery, setHeroQuery] = useState('');

  const activeGames = useMemo(
    () => games.filter((g) => g.active),
    [games]
  );

  const totalLiveCcu = useMemo(
    () => activeGames.reduce((sum, g) => sum + g.currentCcu, 0),
    [activeGames]
  );

  const totalVisitsTracked = useMemo(
    () => activeGames.reduce((sum, g) => sum + g.totalVisits, 0),
    [activeGames]
  );

  const topLiveGame = activeGames[0] ?? null;

  const mostPlayed = useMemo(() => activeGames.slice(0, 10), [activeGames]);

  const trendingCandidates = useMemo(() => {
    const scored = activeGames
      .map((game) => ({ game, eval: evaluateTrending(game) }))
      .filter((item) => item.eval.eligible && item.eval.score !== null)
      .sort((a, b) => (b.eval.score ?? 0) - (a.eval.score ?? 0));
    return scored.slice(0, 6);
  }, [activeGames]);

  const fastestGrowing = useMemo(() => {
    return activeGames
      .filter((g) => {
        const val = g.growth24h ?? g.growth1h;
        return val !== null && val !== undefined && g.currentCcu >= 50;
      })
      .sort(
        (a, b) =>
          (b.growth24h ?? b.growth1h ?? -999) -
          (a.growth24h ?? a.growth1h ?? -999)
      )
      .slice(0, 6);
  }, [activeGames]);

  const recentlyUpdated = useMemo(() => {
    return activeGames
      .filter((g) => Boolean(g.robloxUpdatedAt))
      .sort((a, b) =>
        String(b.robloxUpdatedAt).localeCompare(String(a.robloxUpdatedAt))
      )
      .slice(0, 6);
  }, [activeGames]);

  const genreStats = useMemo(() => {
    const map = new Map<string, { genre: string; ccu: number; count: number }>();
    for (const g of activeGames) {
      const key = g.genre || 'All Genres';
      const entry = map.get(key) ?? { genre: key, ccu: 0, count: 0 };
      entry.ccu += g.currentCcu;
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.ccu - a.ccu);
  }, [activeGames]);

  const genreGames = useMemo(() => {
    if (selectedGenre === 'All') return activeGames.slice(0, 6);
    return activeGames
      .filter((g) => g.genre === selectedGenre)
      .slice(0, 6);
  }, [activeGames, selectedGenre]);

  const genreChartOption = useMemo<EChartsOption>(() => {
    const topGenres = genreStats.slice(0, 7).reverse();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#101820',
        borderColor: '#263844',
        textStyle: { color: '#E8EEF2', fontSize: 12 },
      },
      grid: { left: 10, right: 24, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#6E8492',
          fontSize: 11,
          formatter: (val: number) => formatCompactNumber(val),
        },
        splitLine: { lineStyle: { color: '#263844', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: topGenres.map((g) => g.genre),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#E8EEF2', fontSize: 12 },
      },
      series: [
        {
          name: 'Live CCU',
          type: 'bar',
          barMaxWidth: 18,
          data: topGenres.map((g) => g.ccu),
          itemStyle: {
            color: '#48D597',
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  }, [genreStats]);

  // Real computed market insights strictly from observed dataset
  const marketInsights = useMemo(() => {
    if (activeGames.length === 0) return [];
    const top5Ccu = activeGames
      .slice(0, 5)
      .reduce((sum, g) => sum + g.currentCcu, 0);
    const top5Share =
      totalLiveCcu > 0 ? ((top5Ccu / totalLiveCcu) * 100).toFixed(1) : '0.0';

    const topGenre = genreStats[0];
    const topGenreShare =
      topGenre && totalLiveCcu > 0
        ? ((topGenre.ccu / totalLiveCcu) * 100).toFixed(1)
        : '0.0';

    const ratios = activeGames
      .map((g) => g.likeRatio)
      .filter((r): r is number => r !== null && r !== undefined);
    const avgRatio =
      ratios.length > 0
        ? (ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(1)
        : null;

    const groupGames = activeGames.filter((g) => g.creatorType === 'Group').length;
    const groupPct = ((groupGames / activeGames.length) * 100).toFixed(0);

    return [
      {
        title: 'Top-5 Experience Concentration',
        metric: `${top5Share}%`,
        detail: `The top 5 tracked Roblox experiences currently account for ${formatCompactNumber(top5Ccu)} of ${formatCompactNumber(totalLiveCcu)} total observed concurrent players.`,
      },
      {
        title: `Leading Genre: ${topGenre?.genre ?? 'N/A'}`,
        metric: `${topGenreShare}%`,
        detail: topGenre
          ? `${topGenre.genre} leads active concurrency with ${formatCompactNumber(topGenre.ccu)} live players across ${topGenre.count} tracked experiences.`
          : 'Awaiting genre breakdown observations.',
      },
      {
        title: 'Studio Group Dominance & Sentiment',
        metric: avgRatio ? `${avgRatio}% avg like ratio` : `${groupPct}% studio groups`,
        detail: `${groupPct}% of tracked experiences are published under Roblox Groups rather than individual accounts, with an average observed like ratio of ${avgRatio ? `${avgRatio}%` : 'N/A'}.`,
      },
    ];
  }, [activeGames, genreStats, totalLiveCcu]);

  const heroSuggestions = useMemo(() => {
    const q = heroQuery.trim().toLowerCase();
    if (!q) return [];
    return activeGames
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.creatorName.toLowerCase().includes(q) ||
          g.universeId.includes(q)
      )
      .slice(0, 5);
  }, [activeGames, heroQuery]);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroQuery.trim();
    if (!trimmed) {
      setSearchOpen(true);
      return;
    }
    if (heroSuggestions.length > 0) {
      router.push(`/games/${heroSuggestions[0].universeId}`);
      return;
    }
    if (/^[0-9]{4,20}$/.test(trimmed)) {
      router.push(`/games/${trimmed}`);
      return;
    }
    router.push(`/rankings?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-medium text-[#48D597] tracking-wide">
              Discover. Analyze. Grow.
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#E8EEF2] leading-[1.1] text-balance">
              Real-time Roblox analytics built on verified observations.
            </h1>
            <p className="text-base text-[#9BB0BD] max-w-2xl leading-relaxed">
              Track concurrent player counts, monitor historical trends, compare
              competing experiences, and explore developer portfolios with zero
              fabricated metrics.
            </p>
          </div>

          {/* Interactive Search Bar with Live Suggestions */}
          <div className="relative max-w-xl">
            <form onSubmit={handleHeroSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#6E8492] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="Search a Roblox game, creator, or Universe ID..."
                  className="w-full pl-10 pr-4 py-3 text-sm bg-[#1C2A32] border border-[#263844] rounded-lg text-[#E8EEF2] placeholder:text-[#6E8492] focus:outline-none focus:border-[#48D597] transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 text-sm font-semibold bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Analyze
              </button>
            </form>

            {heroSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-[#1C2A32] border border-[#263844] rounded-lg shadow-xl z-20 overflow-hidden divide-y divide-[#263844]/70">
                {heroSuggestions.map((g) => (
                  <Link
                    key={g.universeId}
                    href={`/games/${g.universeId}`}
                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#22333D] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#E8EEF2] truncate">
                          {g.name}
                        </p>
                        <p className="text-xs text-[#6E8492] truncate">
                          {g.creatorName} · {g.genre}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#48D597] tabular-nums shrink-0">
                      {formatCompactNumber(g.currentCcu)} CCU
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#9BB0BD]">
            <Link
              href="/rankings"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E8EEF2] hover:text-[#48D597] transition-colors"
            >
              Explore Full Rankings
              <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-[#263844]">|</span>
            <Link
              href="/compare"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#9BB0BD] hover:text-[#E8EEF2] transition-colors"
            >
              <GitCompare className="w-4 h-4" />
              Compare Games
            </Link>
          </div>
        </div>

        {/* Right Live Market Overview Card */}
        <div className="lg:col-span-5 bg-[#1C2A32] border border-[#263844] rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#9BB0BD]">
                Observed Concurrent Players (Tracked Catalog)
              </p>
              <p className="mt-1 font-display text-4xl font-bold text-[#E8EEF2] tabular-nums">
                {loadingGames ? '—' : formatExactNumber(totalLiveCcu)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshCatalog(true)}
              disabled={loadingGames}
              title="Refresh live Roblox observations"
              className="p-2 rounded-lg border border-[#263844] text-[#9BB0BD] hover:text-[#48D597] hover:border-[#48D597]/50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingGames ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#263844]">
            <div>
              <p className="text-xs text-[#6E8492]">Tracked Experiences</p>
              <p className="mt-1 text-lg font-semibold text-[#E8EEF2] tabular-nums">
                {loadingGames ? '—' : formatExactNumber(activeGames.length)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6E8492]">Combined Total Visits</p>
              <p className="mt-1 text-lg font-semibold text-[#E8EEF2] tabular-nums">
                {loadingGames ? '—' : formatCompactNumber(totalVisitsTracked)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6E8492]">Top Experience Right Now</p>
              {topLiveGame ? (
                <Link
                  href={`/games/${topLiveGame.universeId}`}
                  className="mt-1 block text-sm font-semibold text-[#48D597] hover:underline truncate"
                >
                  {topLiveGame.name}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-[#6E8492]">N/A</p>
              )}
            </div>
            <div>
              <p className="text-xs text-[#6E8492]">Data Mode</p>
              <p className="mt-1 text-sm font-medium text-[#E8EEF2]">
                {dataMode === 'persisted'
                  ? 'Historical Database'
                  : 'Live Public Feed'}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#263844] flex items-center justify-between text-xs text-[#6E8492]">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#48D597]" />
              Updated {formatRelativeTime(lastUpdatedAt)} ({formatUtcTimestamp(lastUpdatedAt)})
            </span>
          </div>
        </div>
      </section>

      {gamesError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-rose-300">{gamesError}</p>
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            className="px-3 py-1.5 text-xs font-medium bg-[#1C2A32] border border-[#263844] rounded-md text-[#E8EEF2] hover:border-[#48D597] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Most Played & Trending Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Most Played Live */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
                Most-Played Right Now
              </h2>
              <p className="text-xs text-[#6E8492]">
                Ranked by directly observed concurrent players via games.roblox.com
              </p>
            </div>
            <Link
              href="/rankings"
              className="text-xs font-medium text-[#48D597] hover:underline whitespace-nowrap"
            >
              View all rankings
            </Link>
          </div>

          <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden divide-y divide-[#263844]/60">
            {loadingGames
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-3.5 flex items-center justify-between animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-4 bg-[#263844] rounded" />
                      <div className="w-10 h-10 bg-[#263844] rounded-lg" />
                      <div className="space-y-1.5">
                        <div className="w-36 h-4 bg-[#263844] rounded" />
                        <div className="w-24 h-3 bg-[#263844]/70 rounded" />
                      </div>
                    </div>
                    <div className="w-16 h-4 bg-[#263844] rounded" />
                  </div>
                ))
              : mostPlayed.map((game, index) => (
                  <Link
                    key={game.universeId}
                    href={`/games/${game.universeId}`}
                    className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-[#22333D] transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-6 text-xs font-semibold text-[#6E8492] tabular-nums">
                        {index + 1}
                      </span>
                      <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#E8EEF2] truncate">
                          {game.name}
                        </p>
                        <p className="text-xs text-[#6E8492] truncate">
                          {game.creatorName} · {game.genre} ·{' '}
                          {game.likeRatio !== null && game.likeRatio !== undefined
                            ? `${game.likeRatio}% likes`
                            : 'Votes N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-[#E8EEF2] tabular-nums">
                        {formatCompactNumber(game.currentCcu)}
                      </p>
                      <div className="mt-0.5">
                        <GrowthValue value={game.growth24h ?? game.growth1h} />
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </div>

        {/* Trending & Fastest Growing */}
        <div className="lg:col-span-5 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
                  Trending & Fastest-Growing
                </h2>
                <p className="text-xs text-[#6E8492]">
                  Requires &ge;50 CCU and &ge;2 stored snapshots to prevent false spikes
                </p>
              </div>
              <Link
                href="/trending"
                className="text-xs font-medium text-[#48D597] hover:underline whitespace-nowrap"
              >
                Trending hub
              </Link>
            </div>

            <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden">
              {trendingCandidates.length > 0 ? (
                <div className="divide-y divide-[#263844]/60">
                  {trendingCandidates.map(({ game, eval: ev }) => (
                    <Link
                      key={game.universeId}
                      href={`/games/${game.universeId}`}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#22333D] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#E8EEF2] truncate">
                            {game.name}
                          </p>
                          <p className="text-xs text-[#6E8492] truncate">
                            {formatCompactNumber(game.currentCcu)} CCU · Score{' '}
                            {ev.score}
                          </p>
                        </div>
                      </div>
                      <GrowthValue value={ev.percentGain} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-[#48D597]">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-semibold text-[#E8EEF2]">
                      Collecting Baseline Snapshots
                    </span>
                  </div>
                  <p className="text-xs text-[#9BB0BD] leading-relaxed">
                    RoMetric never fabricates growth percentages. Trending velocity
                    activates automatically once at least two timed collection cycles
                    have been recorded in the database.
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    <Link
                      href="/admin"
                      className="text-xs font-medium text-[#48D597] hover:underline"
                    >
                      Run collection in Admin Console
                    </Link>
                    <span className="text-[#263844]">·</span>
                    <Link
                      href="/methodology"
                      className="text-xs text-[#9BB0BD] hover:text-[#E8EEF2]"
                    >
                      How growth is measured
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recently Updated Experiences */}
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
                Recently Updated Experiences
              </h2>
              <p className="text-xs text-[#6E8492]">
                Verified from official Roblox last-updated timestamps
              </p>
            </div>
            <div className="bg-[#1C2A32] border border-[#263844] rounded-xl divide-y divide-[#263844]/60">
              {recentlyUpdated.slice(0, 5).map((game) => (
                <Link
                  key={game.universeId}
                  href={`/games/${game.universeId}`}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#22333D] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#E8EEF2] truncate">
                        {game.name}
                      </p>
                      <p className="text-xs text-[#6E8492]">
                        Updated {formatRelativeTime(game.robloxUpdatedAt)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#9BB0BD] tabular-nums shrink-0">
                    {formatCompactNumber(game.currentCcu)} CCU
                  </span>
                </Link>
              ))}
              {!loadingGames && recentlyUpdated.length === 0 && (
                <p className="p-4 text-xs text-[#6E8492]">
                  No verified update timestamps available yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Top Games by Genre + ECharts Breakdown */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
              Top Games by Genre
            </h2>
            <p className="text-xs text-[#6E8492]">
              Live concurrency distribution across official Roblox experience categories
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {['All', ...genreStats.slice(0, 5).map((g) => g.genre)].map(
              (genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    selectedGenre === genre
                      ? 'bg-[#48D597] text-[#101820]'
                      : 'bg-[#1C2A32] border border-[#263844] text-[#9BB0BD] hover:text-[#E8EEF2]'
                  }`}
                >
                  {genre}
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#1C2A32] border border-[#263844] rounded-xl p-5">
            <p className="text-xs font-medium text-[#9BB0BD] mb-2">
              Live CCU Share by Genre
            </p>
            {genreStats.length > 0 ? (
              <EChartWrapper option={genreChartOption} height={260} />
            ) : (
              <div className="h-[260px] flex items-center justify-center text-xs text-[#6E8492]">
                Loading genre distribution...
              </div>
            )}
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {genreGames.map((game) => (
              <Link
                key={game.universeId}
                href={`/games/${game.universeId}`}
                className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 hover:border-[#48D597]/50 transition-colors flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <GameArtwork src={game.iconUrl} alt={game.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#E8EEF2] truncate">
                      {game.name}
                    </p>
                    <p className="text-xs text-[#6E8492] truncate">
                      {game.creatorName} · {game.genre}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#263844]/70 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#48D597] tabular-nums">
                    {formatCompactNumber(game.currentCcu)} CCU
                  </span>
                  <span className="text-[#9BB0BD] tabular-nums">
                    {formatCompactNumber(game.totalVisits)} visits
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Developer Profiles + Computed Market Insights */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
                Popular Developer Profiles
              </h2>
              <p className="text-xs text-[#6E8492]">
                Studios and creators ranked by combined live concurrency
              </p>
            </div>
            <Link
              href="/developers"
              className="text-xs font-medium text-[#48D597] hover:underline"
            >
              All developers
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {developers.slice(0, 6).map((dev) => (
              <Link
                key={`${dev.creatorType}_${dev.creatorId}`}
                href={`/developers/${dev.creatorId}`}
                className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 hover:border-[#48D597]/50 transition-colors space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 text-[#48D597] shrink-0" />
                    <p className="text-sm font-semibold text-[#E8EEF2] truncate">
                      {dev.creatorName}
                    </p>
                  </div>
                  <span className="text-xs text-[#6E8492] shrink-0">
                    {dev.creatorType}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <div>
                    <p className="text-[#6E8492]">Combined CCU</p>
                    <p className="text-base font-bold text-[#E8EEF2] tabular-nums">
                      {formatCompactNumber(dev.combinedCcu)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#6E8492]">Total Visits</p>
                    <p className="text-sm font-medium text-[#9BB0BD] tabular-nums">
                      {formatCompactNumber(dev.totalVisits)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#6E8492] truncate pt-2 border-t border-[#263844]/70">
                  Top game: {dev.topGame.name}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Latest Roblox Market Insights */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
              Latest Market Insights
            </h2>
            <p className="text-xs text-[#6E8492]">
              Calculated automatically from current observed snapshot data
            </p>
          </div>
          <div className="bg-[#1C2A32] border border-[#263844] rounded-xl divide-y divide-[#263844]">
            {marketInsights.map((insight) => (
              <div key={insight.title} className="p-5 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#E8EEF2]">
                    {insight.title}
                  </h3>
                  <span className="text-sm font-bold text-[#48D597] tabular-nums shrink-0">
                    {insight.metric}
                  </span>
                </div>
                <p className="text-xs text-[#9BB0BD] leading-relaxed">
                  {insight.detail}
                </p>
              </div>
            ))}
            {fastestGrowing.length > 0 && (
              <div className="p-5 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#E8EEF2]">
                    Fastest Measured Mover
                  </h3>
                  <GrowthValue
                    value={
                      fastestGrowing[0].growth24h ?? fastestGrowing[0].growth1h
                    }
                  />
                </div>
                <p className="text-xs text-[#9BB0BD] leading-relaxed">
                  {fastestGrowing[0].name} leads tracked velocity at{' '}
                  {formatCompactNumber(fastestGrowing[0].currentCcu)} live CCU.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
