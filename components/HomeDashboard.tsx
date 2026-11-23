'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  DollarSign,
  Flame,
  RefreshCw,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useApp } from './AppProvider';
import { fetchGameHistory } from '@/lib/analytics-store';
import {
  evaluateBreakoutGames,
  evaluateTrending,
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
} from '@/lib/format';
import {
  estimateGameRevenue,
  estimatePortfolioMonthlyRevenue,
  formatCurrencyCompact,
} from '@/lib/revenue';
import type { GameRecordData, TimeRange } from '@/lib/types';
import { GameArtwork } from './GameArtwork';
import { GrowthValue } from './GameTable';
import { EChartWrapper } from './EChartWrapper';
import {
  APPLE_EASE,
  APPLE_SPRING,
  AnimatedNumber,
  FadeInSection,
  LiquidGlassCard,
} from './MotionPrimitives';

const HERO_RANGES: Array<{
  id: TimeRange;
  label: string;
  icon: 'clock' | 'calendar';
}> = [
  { id: '24h', label: '1D', icon: 'clock' },
  { id: '7d', label: '7D', icon: 'calendar' },
  { id: '30d', label: '1M', icon: 'calendar' },
];

export function HomeDashboard() {
  const router = useRouter();
  const {
    theme,
    games,
    developers,
    loadingGames,
    gamesError,
    lastUpdatedAt,
    refreshCatalog,
    setSearchOpen,
  } = useApp();

  const isDark = theme === 'dark';
  const [heroRange, setHeroRange] = useState<TimeRange>('24h');
  const [heroSeries, setHeroSeries] = useState<
    Array<{ ts: number; ccu: number }>
  >([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [heroQuery, setHeroQuery] = useState('');

  const activeGames = useMemo(() => games.filter((g) => g.active), [games]);

  const totalLiveCcu = useMemo(
    () => activeGames.reduce((sum, g) => sum + g.currentCcu, 0),
    [activeGames]
  );

  const totalMonthlyEstRevenue = useMemo(
    () => estimatePortfolioMonthlyRevenue(activeGames),
    [activeGames]
  );

  const weightedGrowth = useMemo(() => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const g of activeGames) {
      const val = g.growth1h ?? g.growth24h;
      if (val !== null && val !== undefined && g.currentCcu > 0) {
        weightedSum += val * g.currentCcu;
        weightTotal += g.currentCcu;
      }
    }
    if (weightTotal <= 0) return null;
    return Number((weightedSum / weightTotal).toFixed(1));
  }, [activeGames]);

  const top5IdsKey = useMemo(
    () =>
      activeGames
        .slice(0, 5)
        .map((g) => g.universeId)
        .join(','),
    [activeGames]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadAggregateTrend() {
      if (!top5IdsKey) {
        setHeroSeries([]);
        return;
      }
      const ids = top5IdsKey.split(',');
      const bucketMs =
        heroRange === '24h'
          ? 5 * 60_000
          : heroRange === '7d'
            ? 60 * 60_000
            : 24 * 60 * 60_000;
      const buckets = new Map<number, number>();

      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetchGameHistory(id, heroRange);
            for (const pt of res.points) {
              const b = Math.floor(pt.timestampMs / bucketMs) * bucketMs;
              buckets.set(b, (buckets.get(b) ?? 0) + pt.ccu);
            }
          } catch {
            // Skip failed single game fetch
          }
        })
      );

      if (!cancelled) {
        const sorted = Array.from(buckets.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([ts, ccu]) => ({ ts, ccu }));
        setHeroSeries(sorted);
      }
    }
    void loadAggregateTrend();
    return () => {
      cancelled = true;
    };
  }, [top5IdsKey, heroRange]);

  const trendingList = useMemo(() => {
    const scored: Array<{ game: GameRecordData; score: number; change: number | null }> = [];
    for (const game of activeGames) {
      const ev = evaluateTrending(game);
      if (ev.eligible && ev.score !== null) {
        scored.push({ game, score: ev.score, change: ev.percentGain });
      }
    }
    scored.sort((a, b) => b.score - a.score);

    if (scored.length >= 3) {
      return scored.slice(0, 5).map(({ game, change }) => ({ game, change }));
    }

    return activeGames.slice(0, 5).map((game) => ({
      game,
      change: game.growth24h ?? game.growth1h ?? null,
    }));
  }, [activeGames]);

  const breakoutList = useMemo(
    () => evaluateBreakoutGames(activeGames, 6),
    [activeGames]
  );

  const mostPlayed = useMemo(() => activeGames.slice(0, 8), [activeGames]);

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
    return activeGames.filter((g) => g.genre === selectedGenre).slice(0, 6);
  }, [activeGames, selectedGenre]);

  const heroChartOption = useMemo<EChartsOption>(() => {
    const accent = isDark ? '#10E89A' : '#059669';
    const textMuted = isDark ? '#7893A3' : '#64748B';
    const gridLine = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)';
    const tooltipBg = isDark
      ? 'rgba(9, 19, 25, 0.92)'
      : 'rgba(255, 255, 255, 0.96)';
    const tooltipBorder = isDark
      ? 'rgba(255,255,255,0.14)'
      : 'rgba(15,23,42,0.1)';
    const tooltipText = isDark ? '#F1F7FA' : '#0B141A';

    if (heroSeries.length >= 2) {
      const labels = heroSeries.map((p) => {
        const d = new Date(p.ts);
        if (heroRange === '24h') {
          return d.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      });
      const values = heroSeries.map((p) => p.ccu);

      return {
        backgroundColor: 'transparent',
        animationDuration: 650,
        animationEasing: 'cubicOut',
        tooltip: {
          trigger: 'axis',
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          textStyle: { color: tooltipText, fontSize: 12 },
        },
        grid: { left: 6, right: 14, top: 18, bottom: 8, containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: labels,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: textMuted, fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLabel: {
            color: textMuted,
            fontSize: 11,
            formatter: (val: number) => formatCompactNumber(val),
          },
          splitLine: { lineStyle: { color: gridLine } },
        },
        series: [
          {
            name: 'Top 5 CCU',
            type: 'line',
            smooth: 0.35,
            symbol: 'circle',
            showSymbol: false,
            symbolSize: 8,
            data: values.map((v, i) =>
              i === values.length - 1
                ? {
                    value: v,
                    symbol: 'circle',
                    symbolSize: 9,
                    itemStyle: {
                      color: '#FFFFFF',
                      borderColor: accent,
                      borderWidth: 3,
                      shadowBlur: 14,
                      shadowColor: accent,
                    },
                  }
                : v
            ),
            lineStyle: {
              color: accent,
              width: 3,
              shadowBlur: isDark ? 14 : 6,
              shadowColor: isDark
                ? 'rgba(16, 232, 154, 0.55)'
                : 'rgba(5, 150, 105, 0.25)',
            },
            itemStyle: { color: accent },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  {
                    offset: 0,
                    color: isDark
                      ? 'rgba(16, 232, 154, 0.32)'
                      : 'rgba(5, 150, 105, 0.22)',
                  },
                  {
                    offset: 1,
                    color: isDark
                      ? 'rgba(16, 232, 154, 0.01)'
                      : 'rgba(5, 150, 105, 0.01)',
                  },
                ],
              },
            },
          },
        ],
      };
    }

    const topSlice = activeGames.slice(0, 7);
    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12 },
      },
      grid: { left: 6, right: 12, top: 18, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: topSlice.map((g) =>
          g.name.length > 12 ? g.name.slice(0, 11) + '…' : g.name
        ),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: textMuted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: textMuted,
          fontSize: 11,
          formatter: (val: number) => formatCompactNumber(val),
        },
        splitLine: { lineStyle: { color: gridLine } },
      },
      series: [
        {
          name: 'Live CCU',
          type: 'bar',
          barMaxWidth: 28,
          data: topSlice.map((g) => g.currentCcu),
          itemStyle: {
            color: accent,
            borderRadius: [8, 8, 2, 2],
          },
        },
      ],
    };
  }, [heroSeries, heroRange, activeGames, isDark]);

  const genreChartOption = useMemo<EChartsOption>(() => {
    const topGenres = genreStats.slice(0, 6).reverse();
    const accent = isDark ? '#10E89A' : '#059669';
    const textPrimary = isDark ? '#E8F2F7' : '#0F172A';
    const textMuted = isDark ? '#7893A3' : '#64748B';
    const gridLine = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)';
    const tooltipBg = isDark
      ? 'rgba(9, 19, 25, 0.92)'
      : 'rgba(255, 255, 255, 0.96)';
    const tooltipBorder = isDark
      ? 'rgba(255,255,255,0.14)'
      : 'rgba(15,23,42,0.1)';

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: textPrimary, fontSize: 12 },
      },
      grid: { left: 8, right: 20, top: 10, bottom: 6, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: textMuted,
          fontSize: 11,
          formatter: (val: number) => formatCompactNumber(val),
        },
        splitLine: { lineStyle: { color: gridLine } },
      },
      yAxis: {
        type: 'category',
        data: topGenres.map((g) => g.genre),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: textPrimary, fontSize: 12 },
      },
      series: [
        {
          name: 'Live CCU',
          type: 'bar',
          barMaxWidth: 16,
          data: topGenres.map((g) => g.ccu),
          itemStyle: {
            color: accent,
            borderRadius: [0, 8, 8, 0],
          },
        },
      ],
    };
  }, [genreStats, isDark]);

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
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-6 space-y-8">
      {/* Liquid Glass Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: APPLE_EASE }}
        className="relative max-w-2xl mx-auto"
      >
        <form onSubmit={handleHeroSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#7B95A5] absolute left-5 pointer-events-none" />
          <input
            type="text"
            value={heroQuery}
            onChange={(e) => setHeroQuery(e.target.value)}
            placeholder="Search games, developers..."
            className="w-full pl-12 pr-28 py-3.5 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#7B95A5] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40 transition-all"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            transition={APPLE_SPRING}
            className="absolute right-2 px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity cursor-pointer"
          >
            Search
          </motion.button>
        </form>

        <AnimatePresence>
          {heroSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={APPLE_SPRING}
              className="absolute left-0 right-0 mt-2 liquid-glass-strong rounded-3xl z-30 overflow-hidden divide-y divide-slate-900/6 dark:divide-white/8"
            >
              {heroSuggestions.map((g) => {
                const rev = estimateGameRevenue(g);
                return (
                  <Link
                    key={g.universeId}
                    href={`/games/${g.universeId}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="group-hover:scale-105 transition-transform duration-200">
                        <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] truncate">
                          {g.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate">
                          {g.creatorName} · {g.genre}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                        {formatCompactNumber(g.currentCcu)} CCU
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#6F8796] tabular-nums">
                        ~{formatCurrencyCompact(rev.monthlyUsd)}/mo
                      </p>
                    </div>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {gamesError && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="liquid-glass rounded-3xl p-4 border-rose-500/30 flex items-center justify-between gap-4"
        >
          <p className="text-sm text-rose-600 dark:text-rose-300">
            {gamesError}
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => void refreshCatalog()}
            className="px-4 py-1.5 text-xs font-semibold rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
          >
            Retry
          </motion.button>
        </motion.div>
      )}

      {/* Primary Hero Split: Live CCU Chart Card + Trending Games Card */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Live CCU Liquid Glass Hero Card */}
        <LiquidGlassCard
          variant="hero"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: APPLE_EASE }}
          className="lg:col-span-7 rounded-[28px] p-5 sm:p-6 flex flex-col justify-between space-y-5"
        >
          {/* Segmented Range Selector + Refresh */}
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/8 dark:border-white/10">
              {HERO_RANGES.map((r) => {
                const active = heroRange === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setHeroRange(r.id)}
                    className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                      active
                        ? 'text-emerald-700 dark:text-[#10E89A]'
                        : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="hero-range-pill"
                        transition={APPLE_SPRING}
                        className="absolute inset-0 rounded-full bg-emerald-600/15 dark:bg-[#10E89A]/20 border border-emerald-500/35 dark:border-[#10E89A]/45 shadow-sm -z-10"
                      />
                    )}
                    {r.icon === 'clock' ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5" />
                    )}
                    {r.label}
                  </button>
                );
              })}
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.9, rotate: 90 }}
              transition={APPLE_SPRING}
              onClick={() => void refreshCatalog(true)}
              disabled={loadingGames}
              title="Refresh"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/8 dark:border-white/10 text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingGames ? 'animate-spin' : ''}`}
              />
            </motion.button>
          </div>

          {/* Hero Stat Readout */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                Live CCU
              </p>
              <h1 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold text-slate-950 dark:text-white tracking-tight tabular-nums">
                {loadingGames ? (
                  '—'
                ) : (
                  <AnimatedNumber
                    value={totalLiveCcu}
                    formatter={(v) => formatCompactNumber(Math.round(v))}
                  />
                )}
              </h1>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-[#9CB3C0]">
                {weightedGrowth !== null ? (
                  <>
                    <GrowthValue value={weightedGrowth} />
                    <span>vs last hour</span>
                  </>
                ) : (
                  <span className="tabular-nums">
                    {formatExactNumber(activeGames.length)} tracked games
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-5 sm:gap-6 text-right">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                  Est. Rev / mo
                </p>
                <p className="text-sm font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                  {loadingGames ? (
                    '—'
                  ) : (
                    <AnimatedNumber
                      value={totalMonthlyEstRevenue}
                      formatter={(v) => formatCurrencyCompact(v)}
                    />
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                  Games
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                  {loadingGames ? (
                    '—'
                  ) : (
                    <AnimatedNumber
                      value={activeGames.length}
                      formatter={(v) => formatExactNumber(Math.round(v))}
                    />
                  )}
                </p>
              </div>
              <div className="hidden sm:block">
                <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                  Updated
                </p>
                <p className="text-sm font-medium text-slate-700 dark:text-[#9CB3C0] tabular-nums">
                  {formatRelativeTime(lastUpdatedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Live Emerald Area Chart */}
          <div className="pt-1">
            {loadingGames ? (
              <div className="h-[230px] rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
            ) : (
              <EChartWrapper option={heroChartOption} height={230} />
            )}
          </div>
        </LiquidGlassCard>

        {/* Trending Games Liquid Glass Card */}
        <LiquidGlassCard
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.08, ease: APPLE_EASE }}
          className="lg:col-span-5 rounded-[28px] p-5 sm:p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
                  Trending Games
                </h2>
              </div>
              <Link
                href="/trending"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:opacity-80 transition-opacity whitespace-nowrap group"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="divide-y divide-slate-900/6 dark:divide-white/8">
              {loadingGames
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="py-3 flex items-center justify-between animate-pulse"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-4 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                        <div className="w-12 h-12 bg-slate-900/10 dark:bg-white/10 rounded-2xl" />
                        <div className="space-y-1.5">
                          <div className="w-28 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                          <div className="w-20 h-3 bg-slate-900/6 dark:bg-white/6 rounded" />
                        </div>
                      </div>
                      <div className="w-14 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                    </div>
                  ))
                : trendingList.map(({ game, change }, idx) => {
                    const rev = estimateGameRevenue(game);
                    return (
                      <motion.div
                        key={game.universeId}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: 0.1 + idx * 0.04,
                          ease: APPLE_EASE,
                        }}
                      >
                        <Link
                          href={`/games/${game.universeId}`}
                          className="py-3 -mx-2 px-2 rounded-2xl flex items-center justify-between gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className="w-5 text-sm font-bold text-slate-400 dark:text-[#8BA3B2] tabular-nums text-center">
                              {idx + 1}
                            </span>
                            <div className="group-hover:scale-105 transition-transform duration-200">
                              <GameArtwork
                                src={game.iconUrl}
                                alt={game.name}
                                size="md"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                                {game.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-[#8BA3B2] tabular-nums truncate">
                                {formatCompactNumber(game.currentCcu)} CCU · ~
                                {formatCurrencyCompact(rev.monthlyUsd)}/mo
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <GrowthValue value={change} />
                            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-[#6F8796] group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-900/6 dark:border-white/8 flex items-center justify-between text-xs text-slate-500 dark:text-[#6F8796]">
            <span>Top live momentum</span>
            <Link
              href="/compare"
              className="font-medium text-slate-700 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
            >
              Compare games →
            </Link>
          </div>
        </LiquidGlassCard>
      </section>

      {/* Breakout Games Section */}
      <FadeInSection className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
              Breakout Games
            </h2>
          </div>
          <Link
            href="/trending"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:opacity-80 transition-opacity group"
          >
            All Movers
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingGames
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="liquid-glass rounded-[24px] p-4 animate-pulse space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900/10 dark:bg-white/10" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-3/4 bg-slate-900/10 dark:bg-white/10 rounded" />
                      <div className="h-3 w-1/2 bg-slate-900/6 dark:bg-white/6 rounded" />
                    </div>
                  </div>
                  <div className="h-8 rounded-xl bg-slate-900/5 dark:bg-white/5" />
                </div>
              ))
            : breakoutList.map((item, idx) => {
                const { game, growthPct, tag } = item;
                const rev = estimateGameRevenue(game);
                return (
                  <Link
                    key={game.universeId}
                    href={`/games/${game.universeId}`}
                    className="block group"
                  >
                    <LiquidGlassCard
                      interactive
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.1 }}
                      transition={{
                        duration: 0.34,
                        delay: idx * 0.045,
                        ease: APPLE_EASE,
                      }}
                      className="rounded-[24px] p-4 sm:p-5 h-full flex flex-col justify-between gap-4 hover:border-emerald-500/35 dark:hover:border-[#10E89A]/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="group-hover:scale-105 transition-transform duration-200 shrink-0">
                            <GameArtwork
                              src={game.iconUrl}
                              alt={game.name}
                              size="md"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                              {game.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate">
                              {game.genre} · {tag}
                            </p>
                          </div>
                        </div>
                        <GrowthValue value={growthPct} />
                      </div>

                      <div className="pt-3 border-t border-slate-900/6 dark:border-white/8 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                            Live CCU
                          </p>
                          <p className="font-bold text-sm text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                            {formatCompactNumber(game.currentCcu)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                            Est. Rev / mo
                          </p>
                          <p className="font-bold text-sm text-emerald-600 dark:text-[#10E89A] tabular-nums">
                            {formatCurrencyCompact(rev.monthlyUsd)}
                          </p>
                        </div>
                      </div>
                    </LiquidGlassCard>
                  </Link>
                );
              })}
        </div>
      </FadeInSection>

      {/* Most Played Right Now */}
      <FadeInSection className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
            Most Played
          </h2>
          <Link
            href="/rankings"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:opacity-80 transition-opacity group"
          >
            All Rankings
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <LiquidGlassCard className="rounded-[28px] overflow-hidden divide-y divide-slate-900/6 dark:divide-white/8">
          {loadingGames
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="px-5 py-3.5 flex items-center justify-between animate-pulse"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-6 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                    <div className="w-10 h-10 bg-slate-900/10 dark:bg-white/10 rounded-xl" />
                    <div className="space-y-1.5">
                      <div className="w-36 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                      <div className="w-24 h-3 bg-slate-900/6 dark:bg-white/6 rounded" />
                    </div>
                  </div>
                  <div className="w-16 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                </div>
              ))
            : mostPlayed.map((game, index) => {
                const rev = estimateGameRevenue(game);
                return (
                  <Link
                    key={game.universeId}
                    href={`/games/${game.universeId}`}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-6 text-xs font-bold text-slate-400 dark:text-[#6F8796] tabular-nums">
                        {index + 1}
                      </span>
                      <div className="group-hover:scale-105 transition-transform duration-200 shrink-0">
                        <GameArtwork
                          src={game.iconUrl}
                          alt={game.name}
                          size="sm"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                          {game.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate">
                          {game.creatorName} · {game.genre}
                          {game.likeRatio !== null &&
                          game.likeRatio !== undefined
                            ? ` · ${game.likeRatio}% likes`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 sm:gap-7 shrink-0">
                      <div className="text-right hidden md:block">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums inline-flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrencyCompact(rev.monthlyUsd).replace(
                            '$',
                            ''
                          )}
                          /mo
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#6F8796] tabular-nums">
                          {formatCompactNumber(game.totalVisits)} visits
                        </p>
                      </div>
                      <div className="text-right min-w-[74px]">
                        <p className="text-sm font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                          {formatCompactNumber(game.currentCcu)}
                        </p>
                        <GrowthValue value={game.growth24h ?? game.growth1h} />
                      </div>
                    </div>
                  </Link>
                );
              })}
        </LiquidGlassCard>
      </FadeInSection>

      {/* Genres & Top Developers */}
      <FadeInSection className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Genres */}
        <LiquidGlassCard className="lg:col-span-7 rounded-[28px] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
              Genres
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {['All', ...genreStats.slice(0, 4).map((g) => g.genre)].map(
                (genre) => {
                  const active = selectedGenre === genre;
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => setSelectedGenre(genre)}
                      className={`relative px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'text-white dark:text-[#04130D] font-semibold'
                          : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="home-genre-pill"
                          transition={APPLE_SPRING}
                          className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-[#10E89A] -z-10"
                        />
                      )}
                      {genre}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {genreStats.length > 0 && (
            <EChartWrapper option={genreChartOption} height={210} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-900/6 dark:border-white/8">
            {genreGames.slice(0, 4).map((game) => {
              const rev = estimateGameRevenue(game);
              return (
                <Link
                  key={game.universeId}
                  href={`/games/${game.universeId}`}
                  className="p-3 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="group-hover:scale-105 transition-transform duration-200 shrink-0">
                      <GameArtwork
                        src={game.iconUrl}
                        alt={game.name}
                        size="sm"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] truncate">
                        {game.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate tabular-nums">
                        {formatCurrencyCompact(rev.monthlyUsd)}/mo
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums shrink-0">
                    {formatCompactNumber(game.currentCcu)}
                  </span>
                </Link>
              );
            })}
          </div>
        </LiquidGlassCard>

        {/* Top Developers */}
        <LiquidGlassCard className="lg:col-span-5 rounded-[28px] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
                Top Developers
              </h2>
            </div>
            <Link
              href="/developers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:opacity-80 group"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="divide-y divide-slate-900/6 dark:divide-white/8">
            {developers.slice(0, 6).map((dev) => {
              const portfolioRev = estimatePortfolioMonthlyRevenue(dev.games);
              return (
                <Link
                  key={`${dev.creatorType}_${dev.creatorId}`}
                  href={`/developers/${dev.creatorId}`}
                  className="py-3 -mx-2 px-2 rounded-2xl flex items-center justify-between gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                      {dev.creatorName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate">
                      {dev.topGame.name} · {dev.gameCount}{' '}
                      {dev.gameCount === 1 ? 'game' : 'games'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                      {formatCompactNumber(dev.combinedCcu)}
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-[#10E89A] font-medium tabular-nums">
                      ~{formatCurrencyCompact(portfolioRev)}/mo
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </LiquidGlassCard>
      </FadeInSection>
    </div>
  );
}
