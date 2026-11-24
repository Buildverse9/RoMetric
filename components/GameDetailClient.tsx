'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Clock,
  DollarSign,
  ExternalLink,
  GitCompare,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Ticket,
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useApp } from '@/components/AppProvider';
import {
  fetchGameHistory,
  fetchStoredGameById,
  livePayloadToGameRecord,
} from '@/lib/analytics-store';
import {
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
  formatUtcTimestamp,
} from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import type {
  GamePeakRecord,
  GameRecordData,
  RobloxFetchResponse,
  TimeRange,
} from '@/lib/types';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { EChartWrapper } from '@/components/EChartWrapper';
import {
  GamePublicInsights,
  type HistoryPoint,
} from '@/components/GamePublicInsights';
import {
  APPLE_EASE,
  APPLE_SPRING,
  AnimatedNumber,
  FadeInSection,
  LiquidGlassCard,
  RollingCcuNumber,
} from '@/components/MotionPrimitives';

const TIME_RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: '1h', label: '1H' },
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All' },
];

export function GameDetailClient({
  initialGame = null,
  initialTracked = false,
}: {
  initialGame?: GameRecordData | null;
  initialTracked?: boolean;
}) {
  const params = useParams<{ universeId: string }>();
  const universeId = String(
    params?.universeId ?? initialGame?.universeId ?? ''
  ).replace(/[^0-9]/g, '');
  const { theme, games } = useApp();
  const isDark = theme === 'dark';

  const hasMatchingInitial =
    Boolean(initialGame) && initialGame?.universeId === universeId;

  const [game, setGame] = useState<GameRecordData | null>(
    hasMatchingInitial ? initialGame : null
  );
  const [isTracked, setIsTracked] = useState(
    hasMatchingInitial ? initialTracked : false
  );
  const [loading, setLoading] = useState(!hasMatchingInitial);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<TimeRange>('24h');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [peakRecord, setPeakRecord] = useState<GamePeakRecord | null>(null);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [history30d, setHistory30d] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadGame() {
      if (!universeId) {
        setError('Invalid game ID.');
        setLoading(false);
        return;
      }

      // If SSR already provided this game, skip blocking skeleton fetch
      if (initialGame && initialGame.universeId === universeId) {
        setGame(initialGame);
        setIsTracked(initialTracked);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const stored = await fetchStoredGameById(universeId);
        if (stored && !cancelled) {
          setGame(stored);
          setIsTracked(true);
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/roblox/fetch?ids=${encodeURIComponent(universeId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          throw new Error('Unable to load game details.');
        }
        const data = (await res.json()) as RobloxFetchResponse;
        if (!data.games.length) {
          throw new Error('Game not found.');
        }
        if (!cancelled) {
          setGame(
            livePayloadToGameRecord(data.games[0], data.capturedAt, 'tier_3')
          );
          setIsTracked(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load game.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGame();
    return () => {
      cancelled = true;
    };
  }, [universeId, initialGame, initialTracked]);

  // Subtle 60-second live CCU poll so RollingCcuNumber animates real-time player increases
  useEffect(() => {
    if (!universeId) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(
          `/api/roblox/fetch?ids=${encodeURIComponent(universeId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = (await res.json()) as RobloxFetchResponse;
        const latest = data.games?.[0];
        if (!latest || cancelled) return;
        setGame((prev) =>
          prev
            ? {
                ...prev,
                currentCcu: latest.currentCcu,
                totalVisits: latest.totalVisits || prev.totalVisits,
                favorites: latest.favorites || prev.favorites,
                lastCollectedAt: data.capturedAt,
              }
            : prev
        );
      } catch {
        // Ignore transient poll errors
      }
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [universeId]);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      if (!universeId || !isTracked) {
        setHistoryPoints([]);
        return;
      }
      setHistoryLoading(true);
      try {
        const res = await fetchGameHistory(universeId, range);
        if (!cancelled) {
          setHistoryPoints(res.points);
          setPeakRecord(res.peakRecord);
        }
      } catch (err) {
        console.error('History load error:', err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [universeId, isTracked, range]);

  useEffect(() => {
    let cancelled = false;
    async function load30dHistory() {
      if (!universeId || !isTracked) {
        setHistory30d([]);
        return;
      }
      try {
        const res = await fetchGameHistory(universeId, '30d');
        if (!cancelled) {
          setHistory30d(res.points);
        }
      } catch {
        // Non-fatal fallback
      }
    }
    void load30dHistory();
    return () => {
      cancelled = true;
    };
  }, [universeId, isTracked]);

  const ccuChartOption = useMemo<EChartsOption>(() => {
    const accent = isDark ? '#10E89A' : '#059669';
    const textMuted = isDark ? '#7893A3' : '#64748B';
    const textLegend = isDark ? '#9CB3C0' : '#475569';
    const gridLine = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
    const tooltipBg = isDark
      ? 'rgba(9, 19, 25, 0.92)'
      : 'rgba(255, 255, 255, 0.96)';
    const tooltipBorder = isDark
      ? 'rgba(255,255,255,0.14)'
      : 'rgba(15,23,42,0.1)';
    const tooltipText = isDark ? '#F1F7FA' : '#0B141A';

    const labels = historyPoints.map((p) => {
      const d = new Date(p.timestampMs);
      if (range === '1h' || range === '24h') {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    const hasPeakBands = historyPoints.some(
      (p) => p.maxCcu !== undefined && p.maxCcu !== p.ccu
    );

    const values = historyPoints.map((p) => p.ccu);

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
      legend: hasPeakBands
        ? {
            top: 0,
            right: 8,
            textStyle: { color: textLegend, fontSize: 11 },
          }
        : undefined,
      grid: {
        left: 10,
        right: 16,
        top: hasPeakBands ? 34 : 18,
        bottom: 16,
        containLabel: true,
      },
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
          name: hasPeakBands ? 'Average CCU' : 'Players',
          type: 'line',
          smooth: 0.35,
          symbol: 'circle',
          showSymbol: historyPoints.length <= 12,
          symbolSize: 6,
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
            shadowBlur: isDark ? 12 : 4,
            shadowColor: isDark
              ? 'rgba(16, 232, 154, 0.45)'
              : 'rgba(5, 150, 105, 0.2)',
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
                    ? 'rgba(16, 232, 154, 0.3)'
                    : 'rgba(5, 150, 105, 0.2)',
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
        ...(hasPeakBands
          ? [
              {
                name: 'Peak',
                type: 'line' as const,
                smooth: true,
                symbol: 'none',
                data: historyPoints.map((p) => p.maxCcu ?? p.ccu),
                lineStyle: {
                  color: textLegend,
                  width: 1.5,
                  type: 'dashed' as const,
                },
              },
            ]
          : []),
      ],
    };
  }, [historyPoints, range, isDark]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-6 space-y-6 animate-pulse">
        <div className="h-5 w-32 bg-slate-900/10 dark:bg-white/10 rounded-full" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 aspect-video liquid-glass rounded-3xl" />
          <div className="lg:col-span-7 space-y-4">
            <div className="h-9 w-2/3 bg-slate-900/10 dark:bg-white/10 rounded-xl" />
            <div className="h-4 w-1/2 bg-slate-900/8 dark:bg-white/8 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 liquid-glass rounded-3xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
        <LiquidGlassCard className="max-w-md mx-auto rounded-3xl p-8 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA]">
            Game Unavailable
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9CB3C0]">
            {error || 'Could not load this game.'}
          </p>
          <Link
            href="/rankings"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Rankings
          </Link>
        </LiquidGlassCard>
      </div>
    );
  }

  const highestPeak =
    peakRecord?.highestObservedCcu ?? game.peakCcuObserved ?? game.currentCcu;
  const highestPeakAt = peakRecord?.highestObservedAt ?? game.peakCcuAt;
  const estRev = estimateGameRevenue(game);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-[#6F8796]">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/rankings"
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Rankings
          </Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-[#9CB3C0] truncate">
            {game.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums shrink-0">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
          <span>{formatRelativeTime(game.lastCollectedAt)}</span>
        </div>
      </div>

      {/* Header Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.36, ease: APPLE_EASE }}
          className="lg:col-span-5"
        >
          <GameArtwork
            src={game.thumbnailUrl || game.iconUrl}
            alt={game.name}
            variant="banner"
          />
        </motion.div>

        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <GameArtwork src={game.iconUrl} alt={game.name} size="lg" />
              <div className="min-w-0 space-y-1">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white leading-tight">
                  {game.name}
                </h1>
                <p className="text-sm text-slate-600 dark:text-[#9CB3C0] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/developers/${game.creatorId}`}
                    className="text-slate-900 dark:text-[#F1F7FA] hover:text-emerald-600 dark:hover:text-[#10E89A] font-medium transition-colors"
                  >
                    {game.creatorName}
                  </Link>
                  {game.creatorVerified && (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{game.genre}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={APPLE_SPRING}
              >
                <Link
                  href={`/codes/${encodeURIComponent(game.slug || game.universeId)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold liquid-glass-pill text-emerald-700 dark:text-[#10E89A] border-emerald-500/35 hover:border-emerald-500/60 rounded-full transition-all whitespace-nowrap"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  Codes
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={APPLE_SPRING}
              >
                <Link
                  href={`/compare?ids=${game.universeId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Compare
                </Link>
              </motion.div>
              <motion.a
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={APPLE_SPRING}
                href={`https://www.roblox.com/games/${game.rootPlaceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold liquid-glass-pill text-slate-700 dark:text-[#F1F7FA] hover:border-emerald-500/50 rounded-full transition-all whitespace-nowrap"
              >
                Play
                <ExternalLink className="w-3.5 h-3.5" />
              </motion.a>
            </div>
          </div>

          {/* Primary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <LiquidGlassCard
              interactive
              exportTitle={`${game.name} — Live CCU`}
              className="rounded-3xl p-4"
            >
              <div className="flex items-center gap-1.5 pr-7">
                <span className="live-beacon" aria-hidden="true" />
                <p className="text-xs text-slate-500 dark:text-[#6F8796]">
                  Live CCU
                </p>
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                <RollingCcuNumber value={game.currentCcu} showDelta />
              </p>
            </LiquidGlassCard>
            <LiquidGlassCard
              interactive
              exportTitle={`${game.name} — Visits`}
              className="rounded-3xl p-4"
            >
              <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
                Visits
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                {formatCompactNumber(game.totalVisits)}
              </p>
            </LiquidGlassCard>
            <LiquidGlassCard
              interactive
              exportTitle={`${game.name} — Favorites`}
              className="rounded-3xl p-4"
            >
              <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
                Favorites
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                {formatCompactNumber(game.favorites)}
              </p>
            </LiquidGlassCard>
            <LiquidGlassCard
              interactive
              exportTitle={`${game.name} — Rating`}
              className="rounded-3xl p-4"
            >
              <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
                Rating
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                {game.likeRatio !== null && game.likeRatio !== undefined
                  ? `${game.likeRatio.toFixed(1)}%`
                  : '—'}
              </p>
            </LiquidGlassCard>
          </div>

          {/* Votes & Peak */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <LiquidGlassCard
              exportTitle={`${game.name} — Votes`}
              className="rounded-3xl p-4 flex items-center justify-between pr-11"
            >
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-[#6F8796]">
                  Votes
                </p>
                <div className="flex items-center gap-4 text-sm tabular-nums">
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-[#10E89A] font-semibold">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    {formatCompactNumber(game.upVotes)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-[#9CB3C0]">
                    <ThumbsDown className="w-3.5 h-3.5" />
                    {formatCompactNumber(game.downVotes)}
                  </span>
                </div>
              </div>
            </LiquidGlassCard>

            <LiquidGlassCard
              exportTitle={`${game.name} — Peak CCU`}
              className="rounded-3xl p-4 flex items-center justify-between gap-2 pr-11"
            >
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-[#6F8796]">
                  Peak CCU
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                  {formatExactNumber(highestPeak)}
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-[#6F8796] text-right tabular-nums">
                {highestPeakAt ? formatUtcTimestamp(highestPeakAt) : '—'}
              </span>
            </LiquidGlassCard>
          </div>
        </div>
      </section>

      {/* Estimated Revenue Card */}
      <FadeInSection>
        <LiquidGlassCard
          exportTitle={`${game.name} — Estimated Revenue`}
          className="rounded-[28px] p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pr-9">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
                Estimated Revenue
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#6F8796] tabular-nums">
              Range: {formatCurrencyCompact(estRev.monthlyLowUsd)} –{' '}
              {formatCurrencyCompact(estRev.monthlyHighUsd)} / mo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="p-4 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
              <p className="text-xs text-slate-500 dark:text-[#6F8796]">
                Est. Daily
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                <AnimatedNumber
                  value={estRev.dailyUsd}
                  formatter={(v) => formatCurrencyCompact(v)}
                />
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/[0.08] dark:bg-[#10E89A]/[0.08] border border-emerald-500/20 dark:border-[#10E89A]/25">
              <p className="text-xs text-emerald-700 dark:text-[#10E89A] font-medium">
                Est. Monthly
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                <AnimatedNumber
                  value={estRev.monthlyUsd}
                  formatter={(v) => formatCurrencyCompact(v)}
                />
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
              <p className="text-xs text-slate-500 dark:text-[#6F8796]">
                Est. Annual
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                <AnimatedNumber
                  value={estRev.yearlyUsd}
                  formatter={(v) => formatCurrencyCompact(v)}
                />
              </p>
            </div>
          </div>
        </LiquidGlassCard>
      </FadeInSection>

      {/* Growth Windows */}
      <FadeInSection className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: '1h', value: game.growth1h },
          { label: '24h', value: game.growth24h },
          { label: '7d', value: game.growth7d },
          { label: '30d', value: game.growth30d },
        ].map((item) => (
          <LiquidGlassCard
            key={item.label}
            interactive
            exportTitle={`${game.name} — ${item.label} Growth`}
            className="rounded-3xl px-5 py-4 pr-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
              {item.label}
            </span>
            <GrowthValue value={item.value} />
          </LiquidGlassCard>
        ))}
      </FadeInSection>

      {/* Player History Chart */}
      <FadeInSection>
        <LiquidGlassCard
          variant="hero"
          exportTitle={`${game.name} — Player History`}
          className="rounded-[28px] p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-9">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
              Player History
            </h2>

            <div className="flex items-center gap-1 p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/8 dark:border-white/10 w-fit">
              {TIME_RANGES.map((t) => {
                const active = range === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRange(t.id)}
                    className={`relative px-3 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                      active
                        ? 'text-white dark:text-[#04130D]'
                        : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="game-detail-range-pill"
                        transition={APPLE_SPRING}
                        className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-[#10E89A] -z-10"
                      />
                    )}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {historyLoading ? (
            <div className="h-[320px] flex items-center justify-center text-sm text-slate-500 dark:text-[#6F8796]">
              Loading chart...
            </div>
          ) : historyPoints.length >= 2 ? (
            <EChartWrapper option={ccuChartOption} height={320} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-900/15 dark:border-white/15 p-10 text-center space-y-1.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA]">
                Not enough history for this range yet
              </p>
              <p className="text-xs text-slate-500 dark:text-[#9CB3C0]">
                Live players right now: {formatExactNumber(game.currentCcu)}
              </p>
            </div>
          )}
        </LiquidGlassCard>
      </FadeInSection>

      {/* Complete Public Roblox Analytics, Benchmarks, Store, Badges, Media & Socials */}
      <GamePublicInsights
        game={game}
        allGames={games}
        history30d={history30d.length > 0 ? history30d : historyPoints}
        isDark={isDark}
      />

      {/* About */}
      {game.description?.trim() && (
        <FadeInSection>
          <LiquidGlassCard
            exportTitle={`${game.name} — About`}
            className="rounded-[28px] p-6 space-y-3"
          >
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA] pr-9">
              About
            </h2>
            <p className="text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed whitespace-pre-line">
              {game.description}
            </p>
            {game.robloxUpdatedAt && (
              <p className="text-xs text-slate-500 dark:text-[#6F8796] pt-2 border-t border-slate-900/6 dark:border-white/8 tabular-nums">
                Updated {formatUtcTimestamp(game.robloxUpdatedAt)}
              </p>
            )}
          </LiquidGlassCard>
        </FadeInSection>
      )}
    </div>
  );
}
