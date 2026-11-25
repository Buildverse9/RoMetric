'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  Command,
  DollarSign,
  Flame,
  RefreshCw,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useApp } from './AppProvider';
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
import { buildGameUrlPath } from '@/lib/seo';
import type { GameRecordData, TimeRange } from '@/lib/types';
import { GameArtwork } from './GameArtwork';
import { GrowthValue } from './GameTable';
import { EChartWrapper } from './EChartWrapper';
import { HomeChartsCard } from './HomeChartsCard';
import {
  APPLE_EASE,
  APPLE_SPRING,
  AnimatedNumber,
  FadeInSection,
  LiquidGlassCard,
  RollingCcuNumber,
} from './MotionPrimitives';

const HERO_RANGES: Array<{
  id: TimeRange;
  label: string;
  icon: 'clock' | 'calendar';
}> = [
  { id: '24h', label: '1D', icon: 'clock' },
  { id: '7d', label: '7D', icon: 'calendar' },
  { id: '30d', label: '1M', icon: 'calendar' },
  { id: '90d', label: '3M', icon: 'calendar' },
];

interface PlatformHistoryPoint {
  ts: number;
  ccu: number;
  gamesCount: number;
}

interface PlatformHistoryPayload {
  configured: boolean;
  points: PlatformHistoryPoint[];
  trackedGames: number;
  liveTotalCcu: number;
  sourceTable: string;
}

export function HomeDashboard({
  initialGames = [],
  initialLastUpdatedAt = null,
}: {
  initialGames?: GameRecordData[];
  initialLastUpdatedAt?: string | null;
}) {
  const router = useRouter();
  const {
    theme,
    games: contextGames,
    developers,
    loadingGames: contextLoadingGames,
    gamesError,
    lastUpdatedAt: contextLastUpdatedAt,
    refreshCatalog,
    setSearchOpen,
  } = useApp();

  const games = contextGames.length > 0 ? contextGames : initialGames;
  const loadingGames = contextLoadingGames && games.length === 0;
  const lastUpdatedAt = contextLastUpdatedAt || initialLastUpdatedAt;

  const isDark = theme === 'dark';
  const [heroRange, setHeroRange] = useState<TimeRange>('24h');
  const [platformSeries, setPlatformSeries] = useState<PlatformHistoryPoint[]>(
    []
  );
  const [platformTrackedCount, setPlatformTrackedCount] = useState<number>(0);
  const [heroLoadingChart, setHeroLoadingChart] = useState(false);
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

  // Quiet 60-second background poll so RollingCcuNumber visibly animates live CCU increases
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshCatalog(false, true);
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshCatalog]);

  // Fetch ALL-GAMES platform CCU history from Supabase
  useEffect(() => {
    let cancelled = false;
    async function loadPlatformTrend() {
      setHeroLoadingChart(true);
      try {
        const res = await fetch(
          `/api/supabase/platform-history?range=${encodeURIComponent(heroRange)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          if (!cancelled) setPlatformSeries([]);
          return;
        }
        const data = (await res.json()) as PlatformHistoryPayload;
        if (!cancelled) {
          setPlatformSeries(Array.isArray(data.points) ? data.points : []);
          if (typeof data.trackedGames === 'number' && data.trackedGames > 0) {
            setPlatformTrackedCount(data.trackedGames);
          }
        }
      } catch {
        if (!cancelled) setPlatformSeries([]);
      } finally {
        if (!cancelled) setHeroLoadingChart(false);
      }
    }
    void loadPlatformTrend();
    return () => {
      cancelled = true;
    };
  }, [heroRange, lastUpdatedAt]);

  const effectiveTrackedGames = Math.max(
    activeGames.length,
    platformTrackedCount
  );

  const trendingList = useMemo(() => {
    const scored: Array<{
      game: GameRecordData;
      score: number;
      change: number | null;
    }> = [];
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

  // Compact Breakout Games list (4 movers tucked right beneath Trending Games)
  const breakoutList = useMemo(
    () => evaluateBreakoutGames(activeGames, 4),
    [activeGames]
  );

  const mostPlayed = useMemo(() => activeGames.slice(0, 8), [activeGames]);
  const topMostPlayedCcu = mostPlayed[0]?.currentCcu || 1;

  const genreStats = useMemo(() => {
    const map = new Map<
      string,
      { genre: string; ccu: number; count: number }
    >();
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
    const accentSecondary = isDark ? '#38BDF8' : '#0EA5E9';
    const textMuted = isDark ? '#7893A3' : '#64748B';
    const gridLine = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const tooltipBg = isDark
      ? 'rgba(9, 19, 25, 0.94)'
      : 'rgba(255, 255, 255, 0.98)';
    const tooltipBorder = isDark
      ? 'rgba(16, 232, 154, 0.28)'
      : 'rgba(5, 150, 105, 0.22)';
    const tooltipText = isDark ? '#F1F7FA' : '#0B141A';

    if (platformSeries.length >= 2) {
      const labels = platformSeries.map((p) => {
        const d = new Date(p.ts);
        if (heroRange === '24h') {
          return d.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      });

      const values = platformSeries.map((p) => p.ccu);

      return {
        backgroundColor: 'transparent',
        animationDuration: 680,
        animationEasing: 'cubicOut',
        tooltip: {
          trigger: 'axis',
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: [10, 14],
          textStyle: { color: tooltipText, fontSize: 12 },
          axisPointer: {
            type: 'line',
            lineStyle: {
              color: isDark
                ? 'rgba(16, 232, 154, 0.45)'
                : 'rgba(5, 150, 105, 0.4)',
              width: 1.5,
              type: 'dashed',
            },
          },
          formatter: (params: unknown) => {
            const arr = Array.isArray(params) ? params : [params];
            const first = arr[0] as
              | { dataIndex?: number; axisValue?: string }
              | undefined;
            const idx = first?.dataIndex ?? 0;
            const pt = platformSeries[idx];
            if (!pt) return '';
            const stamp = new Date(pt.ts).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            });
            const gamesMeta =
              pt.gamesCount > 0
                ? `<div style="margin-top:3px;font-size:11px;opacity:0.7;">${formatExactNumber(pt.gamesCount)} tracked games aggregated</div>`
                : '';
            return `
              <div style="font-variant-numeric:tabular-nums;">
                <div style="font-size:11px;opacity:0.68;margin-bottom:4px;">${stamp}</div>
                <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${accent};"></span>
                  <span>${formatExactNumber(pt.ccu)} CCU</span>
                </div>
                ${gamesMeta}
              </div>
            `;
          },
        },
        grid: { left: 8, right: 16, top: 22, bottom: 10, containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: labels,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: textMuted, fontSize: 11, margin: 12 },
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
            name: 'Roblox Platform CCU',
            type: 'line',
            smooth: 0.36,
            symbol: 'circle',
            showSymbol: false,
            symbolSize: 8,
            data: values.map((v, i) =>
              i === values.length - 1
                ? {
                    value: v,
                    symbol: 'circle',
                    symbolSize: 10,
                    itemStyle: {
                      color: '#FFFFFF',
                      borderColor: accent,
                      borderWidth: 3,
                      shadowBlur: 18,
                      shadowColor: accent,
                    },
                  }
                : v
            ),
            lineStyle: {
              width: 3,
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: accentSecondary },
                  { offset: 0.35, color: accent },
                  { offset: 1, color: accent },
                ],
              },
              shadowBlur: isDark ? 16 : 8,
              shadowColor: isDark
                ? 'rgba(16, 232, 154, 0.5)'
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
                      ? 'rgba(16, 232, 154, 0.30)'
                      : 'rgba(5, 150, 105, 0.22)',
                  },
                  {
                    offset: 0.65,
                    color: isDark
                      ? 'rgba(16, 232, 154, 0.07)'
                      : 'rgba(5, 150, 105, 0.05)',
                  },
                  {
                    offset: 1,
                    color: isDark
                      ? 'rgba(16, 232, 154, 0.00)'
                      : 'rgba(5, 150, 105, 0.00)',
                  },
                ],
              },
            },
          },
        ],
      };
    }

    // Fallback when historical platform buckets are still warming up: show platform live distribution
    const topSlice = activeGames.slice(0, 8);
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
      grid: { left: 8, right: 14, top: 20, bottom: 10, containLabel: true },
      xAxis: {
        type: 'category',
        data: topSlice.map((g) =>
          g.name.length > 11 ? g.name.slice(0, 10) + '…' : g.name
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
          barMaxWidth: 26,
          data: topSlice.map((g) => g.currentCcu),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: accent },
                { offset: 1, color: accentSecondary },
              ],
            },
            borderRadius: [8, 8, 2, 2],
          },
        },
      ],
    };
  }, [platformSeries, heroRange, activeGames, isDark]);

  const genreChartOption = useMemo<EChartsOption>(() => {
    const topGenres = genreStats.slice(0, 6).reverse();
    const accent = isDark ? '#10E89A' : '#059669';
    const accentEnd = isDark ? '#38BDF8' : '#10B981';
    const textPrimary = isDark ? '#E8F2F7' : '#0F172A';
    const textMuted = isDark ? '#7893A3' : '#64748B';
    const gridLine = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const tooltipBg = isDark
      ? 'rgba(9, 19, 25, 0.94)'
      : 'rgba(255, 255, 255, 0.98)';
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
        axisLabel: { color: textPrimary, fontSize: 12, fontWeight: 500 },
      },
      series: [
        {
          name: 'Live CCU',
          type: 'bar',
          barMaxWidth: 16,
          data: topGenres.map((g) => g.ccu),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: accentEnd },
                { offset: 1, color: accent },
              ],
            },
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
      router.push(buildGameUrlPath(heroSuggestions[0]));
      return;
    }
    if (/^[0-9]{4,20}$/.test(trimmed)) {
      router.push(`/g/${trimmed}`);
      return;
    }
    router.push(`/rankings?q=${encodeURIComponent(trimmed)}`);
  };

  const platformPeakInWindow = useMemo(() => {
    if (platformSeries.length === 0) return totalLiveCcu;
    return platformSeries.reduce((max, pt) => Math.max(max, pt.ccu), totalLiveCcu);
  }, [platformSeries, totalLiveCcu]);

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-8 space-y-7">
      {/* Sleek Command Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: APPLE_EASE }}
        className="relative max-w-2xl mx-auto"
      >
        <form onSubmit={handleHeroSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#7B95A5] absolute left-5 pointer-events-none" />
          <input
            type="text"
            value={heroQuery}
            onChange={(e) => setHeroQuery(e.target.value)}
            placeholder="Search any Roblox game, studio, or Universe ID..."
            className="w-full pl-12 pr-36 py-3.5 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#7B95A5] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40 transition-all"
          />
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Open command search"
            className="hidden sm:inline-flex items-center gap-1 absolute right-24 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 dark:text-[#8BA3B2] bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Command className="w-3 h-3" />K
          </button>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            transition={APPLE_SPRING}
            className="absolute right-2 px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
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
                    href={buildGameUrlPath(g)}
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

      {/* Primary Hero Bento: Left = All-Games Platform CCU Graph | Right = Trending + Compact Breakout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Hero Card: All-Games Roblox Platform CCU */}
        <LiquidGlassCard
          variant="hero"
          exportTitle="Roblox Platform Live CCU"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: APPLE_EASE }}
          className="lg:col-span-7 rounded-[28px] p-5 sm:p-7 flex flex-col justify-between gap-6"
        >
          {/* Top Bar: Segmented Range Selector + Live Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3 pr-9">
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

            <div className="flex items-center gap-2.5">
              <span className="hidden sm:inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-[#8BA3B2] tabular-nums">
                <span className="live-beacon" aria-hidden="true" />
                {formatRelativeTime(lastUpdatedAt)}
              </span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.9, rotate: 90 }}
                transition={APPLE_SPRING}
                onClick={() => void refreshCatalog(true)}
                disabled={loadingGames}
                title="Refresh live CCU"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/8 dark:border-white/10 text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingGames ? 'animate-spin' : ''}`}
                />
              </motion.button>
            </div>
          </div>

          {/* Hero Metric Readout with Rolling Odometer CCU Animation */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <h1 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-[#10E89A]">
                <Activity className="w-3.5 h-3.5" />
                <span>Roblox Live Player Counts &amp; Game Analytics</span>
              </h1>
              <p className="mt-2 font-display text-4xl sm:text-[52px] leading-[1.05] font-extrabold text-slate-950 dark:text-white tracking-tight tabular-nums">
                {loadingGames ? (
                  '—'
                ) : (
                  <RollingCcuNumber value={totalLiveCcu} showDelta />
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-[#9CB3C0]">
                {weightedGrowth !== null && (
                  <>
                    <GrowthValue value={weightedGrowth} />
                    <span>vs last hour</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="tabular-nums">
                  All {formatExactNumber(effectiveTrackedGames)} tracked Roblox
                  games
                </span>
              </div>
            </div>

            {/* Clean Hairline-Separated KPI Trio */}
            <div className="grid grid-cols-3 gap-4 sm:gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-900/8 dark:border-white/8 text-left sm:text-right">
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-[#6F8796]">
                  Window Peak
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                  {loadingGames
                    ? '—'
                    : formatCompactNumber(platformPeakInWindow)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-[#6F8796]">
                  Est. Rev / mo
                </p>
                <p className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
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
                <p className="text-[11px] font-medium text-slate-500 dark:text-[#6F8796]">
                  Games
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                  {loadingGames ? (
                    '—'
                  ) : (
                    <AnimatedNumber
                      value={effectiveTrackedGames}
                      formatter={(v) => formatExactNumber(Math.round(v))}
                    />
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* All-Games Platform CCU Area Chart */}
          <div className="flex-1 flex flex-col justify-end pt-1">
            {loadingGames || (heroLoadingChart && platformSeries.length === 0) ? (
              <div className="h-[340px] rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
            ) : (
              <EChartWrapper option={heroChartOption} height={340} />
            )}
            <div className="mt-2 pt-3 border-t border-slate-900/6 dark:border-white/8 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#6F8796]">
              <span>
                Aggregated concurrent players across the tracked Roblox catalog
              </span>
              <Link
                href="/rankings"
                className="font-semibold text-emerald-600 dark:text-[#10E89A] hover:opacity-80 transition-opacity inline-flex items-center gap-1"
              >
                Explore full catalog
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </LiquidGlassCard>

        {/* Right Hero Column: Trending Games + Compact Breakout Games Directly Underneath */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Trending Games Card */}
          <LiquidGlassCard
            exportTitle="Trending Roblox Games"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.06, ease: APPLE_EASE }}
            className="rounded-[28px] p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 pr-9">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
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
                        className="py-2.5 flex items-center justify-between animate-pulse"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                          <div className="w-10 h-10 bg-slate-900/10 dark:bg-white/10 rounded-xl" />
                          <div className="space-y-1.5">
                            <div className="w-28 h-3.5 bg-slate-900/10 dark:bg-white/10 rounded" />
                            <div className="w-20 h-3 bg-slate-900/6 dark:bg-white/6 rounded" />
                          </div>
                        </div>
                        <div className="w-12 h-3.5 bg-slate-900/10 dark:bg-white/10 rounded" />
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
                            duration: 0.28,
                            delay: 0.08 + idx * 0.035,
                            ease: APPLE_EASE,
                          }}
                        >
                          <Link
                            href={buildGameUrlPath(game)}
                            className="py-2.5 -mx-2 px-2 rounded-2xl flex items-center justify-between gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-4 text-xs font-bold tabular-nums text-center ${
                                  idx === 0
                                    ? 'text-emerald-600 dark:text-[#10E89A]'
                                    : 'text-slate-400 dark:text-[#8BA3B2]'
                                }`}
                              >
                                {idx + 1}
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
                                <p className="text-[11px] text-slate-500 dark:text-[#8BA3B2] tabular-nums truncate">
                                  {formatCompactNumber(game.currentCcu)} CCU · ~
                                  {formatCurrencyCompact(rev.monthlyUsd)}/mo
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <GrowthValue value={change} />
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-[#6F8796] group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
              </div>
            </div>
          </LiquidGlassCard>

          {/* Compact Breakout Games Card — Directly Below Trending Games */}
          <LiquidGlassCard
            exportTitle="Breakout Roblox Games"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.12, ease: APPLE_EASE }}
            className="rounded-[28px] p-5 flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 pr-9">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
                    Breakout Games
                  </h2>
                </div>
                <Link
                  href="/trending"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:opacity-80 transition-opacity whitespace-nowrap group"
                >
                  All Movers
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {loadingGames
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] animate-pulse flex items-center gap-2.5"
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-900/10 dark:bg-white/10 shrink-0" />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="h-3 w-4/5 rounded bg-slate-900/10 dark:bg-white/10" />
                          <div className="h-2.5 w-3/5 rounded bg-slate-900/6 dark:bg-white/6" />
                        </div>
                      </div>
                    ))
                  : breakoutList.map(({ game, growthPct, tag }) => (
                      <Link
                        key={game.universeId}
                        href={buildGameUrlPath(game)}
                        className="p-2.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035] hover:bg-emerald-500/[0.08] dark:hover:bg-[#10E89A]/[0.09] border border-slate-900/6 dark:border-white/8 hover:border-emerald-500/30 dark:hover:border-[#10E89A]/35 transition-all flex items-center gap-2.5 group min-w-0"
                      >
                        <div className="group-hover:scale-105 transition-transform duration-200 shrink-0">
                          <GameArtwork
                            src={game.iconUrl}
                            alt={game.name}
                            size="sm"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                            {game.name}
                          </p>
                          <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px] tabular-nums">
                            <span className="text-slate-500 dark:text-[#8BA3B2] truncate">
                              {formatCompactNumber(game.currentCcu)} · {tag}
                            </span>
                            <GrowthValue value={growthPct} />
                          </div>
                        </div>
                      </Link>
                    ))}
              </div>
            </div>
          </LiquidGlassCard>
        </div>
      </section>

      {/* Unified 4-in-1 Official Roblox Charts Card (Top Trending · Up-and-Coming · Top Earning · Fun with Friends) */}
      <HomeChartsCard games={activeGames} loading={loadingGames} />

      {/* Most Played Right Now */}
      <FadeInSection className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
              Most Played Right Now
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#8BA3B2]">
              Ranked by live concurrent players across tracked experiences
            </p>
          </div>
          <Link
            href="/rankings"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:opacity-80 transition-opacity group"
          >
            All Rankings
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <LiquidGlassCard
          exportTitle="Most Played Roblox Games"
          className="rounded-[28px] overflow-hidden divide-y divide-slate-900/6 dark:divide-white/8"
        >
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
                const barWidth = Math.max(
                  6,
                  Math.min(
                    100,
                    Math.round((game.currentCcu / topMostPlayedCcu) * 100)
                  )
                );
                return (
                  <Link
                    key={game.universeId}
                    href={buildGameUrlPath(game)}
                    className={`px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group ${
                      index === 0 ? 'pr-12' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <span
                        className={`w-6 text-xs font-bold tabular-nums ${
                          index < 3
                            ? 'text-emerald-600 dark:text-[#10E89A]'
                            : 'text-slate-400 dark:text-[#6F8796]'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="group-hover:scale-105 transition-transform duration-200 shrink-0">
                        <GameArtwork
                          src={game.iconUrl}
                          alt={game.name}
                          size="sm"
                        />
                      </div>
                      <div className="min-w-0 flex-1 max-w-md">
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
                        <div className="mt-1.5 h-1 w-full max-w-[180px] rounded-full bg-slate-900/[0.06] dark:bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-sky-400/80 dark:from-[#10E89A]/85 dark:to-sky-400/75 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
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
                      <div className="text-right min-w-[78px]">
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
      <FadeInSection className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Genres */}
        <LiquidGlassCard
          exportTitle="Roblox Top Genres"
          className="lg:col-span-7 rounded-[28px] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pr-9">
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
                  href={buildGameUrlPath(game)}
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
                      <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
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
        <LiquidGlassCard
          exportTitle="Top Roblox Developers"
          className="lg:col-span-5 rounded-[28px] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between pr-9">
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
            {developers.slice(0, 6).map((dev, idx) => {
              const portfolioRev = estimatePortfolioMonthlyRevenue(dev.games);
              return (
                <Link
                  key={`${dev.creatorType}_${dev.creatorId}`}
                  href={`/developers/${dev.creatorId}`}
                  className="py-3 -mx-2 px-2 rounded-2xl flex items-center justify-between gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-4 text-xs font-bold tabular-nums text-center shrink-0 ${
                        idx === 0
                          ? 'text-emerald-600 dark:text-[#10E89A]'
                          : 'text-slate-400 dark:text-[#6F8796]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                        {dev.creatorName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate">
                        {dev.topGame.name} · {dev.gameCount}{' '}
                        {dev.gameCount === 1 ? 'game' : 'games'}
                      </p>
                    </div>
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
