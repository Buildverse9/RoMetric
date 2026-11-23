'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import type { EChartsOption } from 'echarts';
import {
  Award,
  BarChart3,
  CalendarClock,
  Camera,
  Clock,
  Coins,
  ExternalLink,
  Globe2,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  PieChart,
  Share2,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Trophy,
  Tv,
  Users,
  Youtube,
} from 'lucide-react';
import type {
  RobloxPublicGameDetailsResponse,
  RobloxSimilarGameItem,
  RobloxSocialLinkItem,
} from '@/app/api/roblox/game-details/route';
import {
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
  formatUtcTimestamp,
} from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import type { GameRecordData } from '@/lib/types';
import { EChartWrapper } from './EChartWrapper';
import { GameArtwork } from './GameArtwork';
import {
  APPLE_SPRING,
  FadeInSection,
  LiquidGlassCard,
} from './MotionPrimitives';

export interface HistoryPoint {
  timestamp: string;
  timestampMs: number;
  ccu: number;
  minCcu?: number;
  maxCcu?: number;
  visits: number;
  favorites: number;
  sourceTable: 'game_snapshots' | 'game_hourly_stats' | 'game_daily_stats';
}

interface DailyBucket {
  label: string;
  dayKey: string;
  peakCcu: number;
  avgCcu: number;
  growthPct: number | null;
  estDau: number;
  estRobux: number;
}

const GENRE_SESSION_MINUTES: Record<string, number> = {
  rpg: 26,
  roleplay: 24,
  'roleplay & avatar sim': 24,
  simulation: 22,
  tycoon: 21,
  strategy: 23,
  survival: 20,
  adventure: 19,
  fighting: 18,
  action: 17,
  shooter: 18,
  horror: 15,
  'sports & racing': 16,
  obby: 12,
  'obby & platformer': 12,
  'party & casual': 13,
  social: 19,
};

function estimateSessionMinutes(game: {
  genre?: string | null;
  likeRatio?: number | null;
  currentCcu: number;
  totalVisits: number;
}): { minutes: number; genreAvg: number; topQuartile: number } {
  const key = (game.genre || '').toLowerCase();
  let genreAvg = 17;
  for (const [pattern, mins] of Object.entries(GENRE_SESSION_MINUTES)) {
    if (key.includes(pattern)) {
      genreAvg = mins;
      break;
    }
  }
  const rating =
    game.likeRatio !== null && game.likeRatio !== undefined
      ? Math.max(40, Math.min(100, game.likeRatio))
      : 80;
  const ratingFactor = 0.8 + ((rating - 40) / 60) * 0.4; // 0.8x to 1.2x
  const scaleBonus =
    game.currentCcu >= 50_000
      ? 1.12
      : game.currentCcu >= 5_000
        ? 1.05
        : game.currentCcu >= 250
          ? 1.0
          : 0.92;
  const minutes = Math.round(genreAvg * ratingFactor * scaleBonus * 10) / 10;
  return {
    minutes,
    genreAvg,
    topQuartile: Math.round(genreAvg * 1.32 * 10) / 10,
  };
}

function computePercentile(value: number, peers: number[]): number {
  if (peers.length === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const p of peers) {
    if (p < value) below += 1;
    else if (p === value) equal += 1;
  }
  const raw = ((below + equal * 0.5) / peers.length) * 100;
  return Math.max(1, Math.min(99, Math.round(raw)));
}

function getSocialIcon(type: RobloxSocialLinkItem['type']) {
  switch (type) {
    case 'Discord':
    case 'Guilded':
      return MessageCircle;
    case 'YouTube':
      return Youtube;
    case 'Instagram':
    case 'TikTok':
      return Camera;
    case 'Twitch':
      return Tv;
    case 'Twitter':
      return Share2;
    case 'RobloxGroup':
      return Users;
    default:
      return Globe2;
  }
}

function getSocialColor(type: RobloxSocialLinkItem['type']): string {
  switch (type) {
    case 'Discord':
      return 'bg-[#5865F2]/14 text-[#4F46E5] dark:text-[#818CF8] border-[#5865F2]/30';
    case 'YouTube':
      return 'bg-[#FF0000]/12 text-[#DC2626] dark:text-[#F87171] border-[#FF0000]/28';
    case 'Twitter':
      return 'bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white border-slate-900/20 dark:border-white/20';
    case 'Instagram':
      return 'bg-[#E1306C]/12 text-[#DB2777] dark:text-[#F472B6] border-[#E1306C]/28';
    case 'TikTok':
      return 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/28';
    case 'Twitch':
      return 'bg-[#9146FF]/12 text-[#7C3AED] dark:text-[#C084FC] border-[#9146FF]/28';
    case 'RobloxGroup':
      return 'bg-emerald-500/12 text-emerald-700 dark:text-[#10E89A] border-emerald-500/28';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-[#9CB3C0] border-slate-500/20';
  }
}

export function GamePublicInsights({
  game,
  allGames,
  history30d,
  isDark,
}: {
  game: GameRecordData;
  allGames: GameRecordData[];
  history30d: HistoryPoint[];
  isDark: boolean;
}) {
  const [details, setDetails] = useState<RobloxPublicGameDetailsResponse | null>(
    null
  );
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [storeTab, setStoreTab] = useState<'passes' | 'products'>('passes');
  const [selectedMediaIdx, setSelectedMediaIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadPublicDetails() {
      setLoadingDetails(true);
      setSelectedMediaIdx(0);
      try {
        const res = await fetch(
          `/api/roblox/game-details?universeId=${encodeURIComponent(game.universeId)}`
        );
        if (res.ok && !cancelled) {
          const json = (await res.json()) as RobloxPublicGameDetailsResponse;
          setDetails(json);
        }
      } catch {
        // Non-fatal: fallback metrics remain intact
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    }
    void loadPublicDetails();
    return () => {
      cancelled = true;
    };
  }, [game.universeId]);

  const estRev = useMemo(() => estimateGameRevenue(game), [game]);
  const session = useMemo(() => estimateSessionMinutes(game), [game]);

  // Aggregate observed 30d history into daily buckets for Peak/Day, Daily Growth %, Daily Players, Robux/Day
  const dailyBuckets = useMemo<DailyBucket[]>(() => {
    const byDay = new Map<
      string,
      { label: string; sum: number; count: number; max: number }
    >();

    for (const pt of history30d) {
      const d = new Date(pt.timestampMs);
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const prev = byDay.get(dayKey) ?? { label, sum: 0, count: 0, max: 0 };
      const ptPeak = pt.maxCcu ?? pt.ccu;
      prev.sum += pt.ccu;
      prev.count += 1;
      if (ptPeak > prev.max) prev.max = ptPeak;
      byDay.set(dayKey, prev);
    }

    const sortedKeys = Array.from(byDay.keys()).sort();
    const sessionHours = Math.max(0.15, session.minutes / 60);
    const robuxPerCcuDay =
      game.currentCcu > 0
        ? estRev.dailyUsd / 0.0035 / Math.max(1, game.currentCcu)
        : 177;

    if (sortedKeys.length === 0) {
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayAvg = Math.max(0, game.currentCcu);
      const todayPeak = Math.max(todayAvg, game.peakCcuObserved || todayAvg);
      return [
        {
          label: 'Today',
          dayKey: todayKey,
          peakCcu: todayPeak,
          avgCcu: todayAvg,
          growthPct: game.growth24h ?? game.growth1h ?? null,
          estDau: Math.round(todayAvg * (24 / sessionHours) * 0.42),
          estRobux: Math.round(estRev.dailyUsd / 0.0035),
        },
      ];
    }

    const rows: DailyBucket[] = [];
    for (let i = 0; i < sortedKeys.length; i++) {
      const k = sortedKeys[i];
      const b = byDay.get(k)!;
      const avgCcu = Math.round(b.sum / Math.max(1, b.count));
      const prevAvg = i > 0 ? rows[i - 1].avgCcu : null;
      const growthPct =
        prevAvg && prevAvg > 0
          ? Number((((avgCcu - prevAvg) / prevAvg) * 100).toFixed(1))
          : i === sortedKeys.length - 1
            ? game.growth24h ?? game.growth1h ?? null
            : null;
      rows.push({
        label: b.label,
        dayKey: k,
        peakCcu: Math.max(b.max, avgCcu),
        avgCcu,
        growthPct,
        estDau: Math.round(avgCcu * (24 / sessionHours) * 0.42),
        estRobux: Math.round(avgCcu * robuxPerCcuDay),
      });
    }
    return rows.slice(-14);
  }, [history30d, game, session.minutes, estRev.dailyUsd]);

  const latestBucket = dailyBuckets[dailyBuckets.length - 1];
  const dailyRobux = Math.round(estRev.dailyUsd / 0.0035);

  // Market share & catalog rankings
  const marketStats = useMemo(() => {
    const active = allGames.filter((g) => g.active !== false);
    const totalPlatformCcu = Math.max(
      game.currentCcu,
      active.reduce((s, g) => s + Math.max(0, g.currentCcu || 0), 0)
    );
    const genrePeers = active.filter(
      (g) => (g.genre || 'All Genres') === (game.genre || 'All Genres')
    );
    const totalGenreCcu = Math.max(
      game.currentCcu,
      genrePeers.reduce((s, g) => s + Math.max(0, g.currentCcu || 0), 0)
    );

    const sortedAll = [...active].sort((a, b) => b.currentCcu - a.currentCcu);
    const globalIdx = sortedAll.findIndex(
      (g) => g.universeId === game.universeId
    );
    const sortedGenre = [...genrePeers].sort(
      (a, b) => b.currentCcu - a.currentCcu
    );
    const genreIdx = sortedGenre.findIndex(
      (g) => g.universeId === game.universeId
    );

    const platformSharePct =
      totalPlatformCcu > 0
        ? Number(((game.currentCcu / totalPlatformCcu) * 100).toFixed(3))
        : 0;
    const genreSharePct =
      totalGenreCcu > 0
        ? Number(((game.currentCcu / totalGenreCcu) * 100).toFixed(2))
        : 0;

    return {
      totalPlatformCcu,
      totalGenreCcu,
      platformSharePct,
      genreSharePct,
      catalogGlobalRank: globalIdx >= 0 ? globalIdx + 1 : null,
      catalogGenreRank: genreIdx >= 0 ? genreIdx + 1 : null,
      catalogTotal: active.length,
      genreTotal: genrePeers.length,
    };
  }, [allGames, game]);

  // Competition / Similar games list (Roblox official recommendations with tracked genre fallback)
  const competitors = useMemo<RobloxSimilarGameItem[]>(() => {
    if (details?.similarGames && details.similarGames.length > 0) {
      return details.similarGames;
    }
    return allGames
      .filter(
        (g) =>
          g.universeId !== game.universeId &&
          (g.genre || 'All Genres') === (game.genre || 'All Genres')
      )
      .sort((a, b) => b.currentCcu - a.currentCcu)
      .slice(0, 8)
      .map((g) => ({
        universeId: g.universeId,
        rootPlaceId: g.rootPlaceId,
        name: g.name,
        creatorName: g.creatorName,
        genre: g.genre,
        currentCcu: g.currentCcu,
        totalVisits: g.totalVisits,
        favorites: g.favorites,
        likeRatio: g.likeRatio ?? null,
        iconUrl: g.iconUrl ?? null,
      }));
  }, [details, allGames, game]);

  // Creator Benchmarks & Percentiles vs. Similar Games Cohort
  const benchmarks = useMemo(() => {
    const cohort = competitors.length >= 3
      ? competitors
      : allGames
          .filter((g) => g.universeId !== game.universeId)
          .slice(0, 25)
          .map((g) => ({
            universeId: g.universeId,
            rootPlaceId: g.rootPlaceId,
            name: g.name,
            creatorName: g.creatorName,
            genre: g.genre,
            currentCcu: g.currentCcu,
            totalVisits: g.totalVisits,
            favorites: g.favorites,
            likeRatio: g.likeRatio,
            iconUrl: g.iconUrl,
          }));

    const ccuPeers = cohort.map((c) => c.currentCcu);
    const ratingPeers = cohort
      .map((c) => c.likeRatio)
      .filter((r): r is number => r !== null && r !== undefined);
    const sessionPeers = cohort.map((c) => estimateSessionMinutes(c).minutes);
    const visitsPeers = cohort.map((c) => c.totalVisits);

    const ccuPct = computePercentile(game.currentCcu, ccuPeers);
    const ratingPct = computePercentile(game.likeRatio ?? 80, ratingPeers);
    const sessionPct = computePercentile(session.minutes, sessionPeers);
    const visitsPct = computePercentile(game.totalVisits, visitsPeers);
    const overallPct = Math.round(
      ccuPct * 0.4 + ratingPct * 0.25 + sessionPct * 0.2 + visitsPct * 0.15
    );

    return {
      cohortSize: cohort.length,
      overallPct,
      items: [
        {
          label: 'Concurrent Players',
          valueLabel: formatCompactNumber(game.currentCcu),
          percentile: ccuPct,
        },
        {
          label: 'Player Rating',
          valueLabel:
            game.likeRatio !== null && game.likeRatio !== undefined
              ? `${game.likeRatio.toFixed(1)}%`
              : '—',
          percentile: ratingPct,
        },
        {
          label: 'Est. Session Length',
          valueLabel: `${session.minutes}m`,
          percentile: sessionPct,
        },
        {
          label: 'Lifetime Reach',
          valueLabel: formatCompactNumber(game.totalVisits),
          percentile: visitsPct,
        },
      ],
    };
  }, [competitors, allGames, game, session.minutes]);

  // Shared chart theme tokens
  const themeColors = useMemo(
    () => ({
      accent: isDark ? '#10E89A' : '#059669',
      cyan: isDark ? '#38BDF8' : '#0284C7',
      amber: isDark ? '#FBBF24' : '#D97706',
      rose: isDark ? '#FB7185' : '#E11D48',
      muted: isDark ? '#7893A3' : '#64748B',
      grid: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)',
      tooltipBg: isDark ? 'rgba(9,19,25,0.94)' : 'rgba(255,255,255,0.96)',
      tooltipText: isDark ? '#F1F7FA' : '#0B141A',
    }),
    [isDark]
  );

  // 1. Peak Players / Day Chart
  const peakPerDayOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 8, right: 8, top: 14, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: dailyBuckets.map((b) => b.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => formatCompactNumber(v),
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      series: [
        {
          name: 'Peak CCU',
          type: 'bar',
          barMaxWidth: 22,
          data: dailyBuckets.map((b) => b.peakCcu),
          itemStyle: {
            color: themeColors.accent,
            borderRadius: [6, 6, 2, 2],
          },
        },
      ],
    }),
    [dailyBuckets, themeColors]
  );

  // 2. Daily Growth % Chart
  const growthPerDayOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 8, right: 8, top: 14, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: dailyBuckets.map((b) => b.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => `${v > 0 ? '+' : ''}${v}%`,
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      series: [
        {
          name: 'Growth %',
          type: 'bar',
          barMaxWidth: 20,
          data: dailyBuckets.map((b) => {
            const val = b.growthPct ?? 0;
            return {
              value: val,
              itemStyle: {
                color: val >= 0 ? themeColors.accent : themeColors.rose,
                borderRadius: val >= 0 ? [5, 5, 0, 0] : [0, 0, 5, 5],
              },
            };
          }),
        },
      ],
    }),
    [dailyBuckets, themeColors]
  );

  // 3. Daily Players (Est. DAU) Chart
  const dailyPlayersOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 8, right: 8, top: 14, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dailyBuckets.map((b) => b.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => formatCompactNumber(v),
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      series: [
        {
          name: 'Est. Daily Players',
          type: 'line',
          smooth: 0.35,
          symbol: 'circle',
          symbolSize: 5,
          data: dailyBuckets.map((b) => b.estDau),
          lineStyle: { color: themeColors.cyan, width: 2.5 },
          itemStyle: { color: themeColors.cyan },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(56,189,248,0.28)' },
                { offset: 1, color: 'rgba(56,189,248,0.01)' },
              ],
            },
          },
        },
      ],
    }),
    [dailyBuckets, themeColors]
  );

  // 4. Robux / Day Chart
  const robuxPerDayOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 8, right: 8, top: 14, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: dailyBuckets.map((b) => b.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => `R$${formatCompactNumber(v)}`,
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      series: [
        {
          name: 'Est. Robux / Day',
          type: 'bar',
          barMaxWidth: 22,
          data: dailyBuckets.map((b) => b.estRobux),
          itemStyle: {
            color: themeColors.amber,
            borderRadius: [6, 6, 2, 2],
          },
        },
      ],
    }),
    [dailyBuckets, themeColors]
  );

  // 5. Session Length Comparison Graph
  const sessionLengthOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 6, right: 24, top: 12, bottom: 16, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => `${v}m`,
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      yAxis: {
        type: 'category',
        data: ['Genre Avg', 'This Game', 'Top 25%'],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 16,
          data: [
            { value: session.genreAvg, itemStyle: { color: themeColors.muted, borderRadius: [0, 6, 6, 0] } },
            { value: session.minutes, itemStyle: { color: themeColors.accent, borderRadius: [0, 6, 6, 0] } },
            { value: session.topQuartile, itemStyle: { color: themeColors.cyan, borderRadius: [0, 6, 6, 0] } },
          ],
        },
      ],
    }),
    [session, themeColors]
  );

  // 6. Share of Roblox Traffic Donut Graph
  const marketShareOption = useMemo<EChartsOption>(() => {
    const share = Math.max(0.01, Math.min(100, marketStats.genreSharePct));
    const rest = Math.max(0, Number((100 - share).toFixed(2)));
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      series: [
        {
          name: 'Genre CCU Share',
          type: 'pie',
          radius: ['56%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          data: [
            {
              value: share,
              name: game.name,
              itemStyle: { color: themeColors.accent, borderRadius: 6 },
            },
            {
              value: rest,
              name: `Rest of ${game.genre || 'Genre'}`,
              itemStyle: {
                color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
              },
            },
          ],
        },
      ],
    };
  }, [marketStats.genreSharePct, game.name, game.genre, themeColors, isDark]);

  // 7. Regional Charts Bar Graph
  const regionalChartOption = useMemo<EChartsOption>(() => {
    const ranked = (details?.regionalRanks || []).filter((r) => r.rank !== null);
    if (ranked.length === 0) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { name?: string; dataIndex?: number };
          const item = ranked[first.dataIndex ?? 0];
          return item
            ? `${item.regionLabel}: #${item.rank} (${item.sortTitle || 'Explore'})`
            : '';
        },
      },
      grid: { left: 8, right: 16, top: 12, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: ranked.map((r) => r.regionCode),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        inverse: true,
        min: 1,
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => `#${v}`,
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 22,
          data: ranked.map((r) => ({
            value: r.rank ?? 50,
            itemStyle: {
              color:
                r.regionCode === 'ALL' ? themeColors.accent : themeColors.cyan,
              borderRadius: [0, 0, 6, 6],
            },
          })),
        },
      ],
    };
  }, [details?.regionalRanks, themeColors]);

  // 8. Creator Benchmarks Percentile Chart
  const benchmarkChartOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 8, right: 24, top: 10, bottom: 18, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => `${v}th`,
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      yAxis: {
        type: 'category',
        data: benchmarks.items.map((i) => i.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 11 },
      },
      series: [
        {
          name: 'Percentile',
          type: 'bar',
          barMaxWidth: 16,
          showBackground: true,
          backgroundStyle: {
            color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
            borderRadius: 8,
          },
          data: benchmarks.items.map((item) => ({
            value: item.percentile,
            itemStyle: {
              color:
                item.percentile >= 75
                  ? themeColors.accent
                  : item.percentile >= 45
                    ? themeColors.cyan
                    : themeColors.amber,
              borderRadius: 8,
            },
          })),
        },
      ],
    }),
    [benchmarks.items, themeColors, isDark]
  );

  // 9. Competition Horizontal CCU Bar Chart
  const competitionChartOption = useMemo<EChartsOption>(() => {
    const rows = [
      { name: game.name, ccu: game.currentCcu, isCurrent: true },
      ...competitors.slice(0, 6).map((c) => ({
        name: c.name,
        ccu: c.currentCcu,
        isCurrent: false,
      })),
    ].sort((a, b) => a.ccu - b.ccu);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 8, right: 20, top: 8, bottom: 16, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => formatCompactNumber(v),
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) =>
          r.name.length > 20 ? `${r.name.slice(0, 19)}…` : r.name
        ),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 11 },
      },
      series: [
        {
          name: 'Live CCU',
          type: 'bar',
          barMaxWidth: 16,
          data: rows.map((r) => ({
            value: r.ccu,
            itemStyle: {
              color: r.isCurrent ? themeColors.accent : themeColors.cyan,
              borderRadius: [0, 6, 6, 0],
            },
          })),
        },
      ],
    };
  }, [game.name, game.currentCcu, competitors, themeColors]);

  // 10. Store Price Distribution Chart
  const storePriceOption = useMemo<EChartsOption>(() => {
    const items =
      storeTab === 'passes'
        ? (details?.gamePasses || [])
            .filter((p) => p.price !== null && p.price > 0)
            .slice(0, 10)
            .map((p) => ({ name: p.displayName, price: p.price ?? 0 }))
        : (details?.devProducts || [])
            .filter((d) => d.priceInRobux !== null && d.priceInRobux > 0)
            .slice(0, 10)
            .map((d) => ({ name: d.name, price: d.priceInRobux ?? 0 }));

    if (items.length === 0) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 8, right: 8, top: 12, bottom: 26, containLabel: true },
      xAxis: {
        type: 'category',
        data: items.map((i) =>
          i.name.length > 12 ? `${i.name.slice(0, 11)}…` : i.name
        ),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: {
          color: themeColors.muted,
          fontSize: 10,
          formatter: (v: number) => `R$${formatCompactNumber(v)}`,
        },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      series: [
        {
          name: 'Price (R$)',
          type: 'bar',
          barMaxWidth: 24,
          data: items.map((i) => i.price),
          itemStyle: { color: themeColors.amber, borderRadius: [6, 6, 2, 2] },
        },
      ],
    };
  }, [details, storeTab, themeColors]);

  // 11. Badges Rarity Chart
  const badgesChartOption = useMemo<EChartsOption>(() => {
    const list = details?.badges || [];
    if (list.length === 0) return {};
    const buckets = [
      { label: 'Common (>25%)', count: 0, color: themeColors.accent },
      { label: 'Uncommon (5–25%)', count: 0, color: themeColors.cyan },
      { label: 'Rare (1–5%)', count: 0, color: themeColors.amber },
      { label: 'Ultra Rare (<1%)', count: 0, color: themeColors.rose },
    ];
    for (const b of list) {
      if (b.winRatePercentage >= 25) buckets[0].count += 1;
      else if (b.winRatePercentage >= 5) buckets[1].count += 1;
      else if (b.winRatePercentage >= 1) buckets[2].count += 1;
      else buckets[3].count += 1;
    }
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeColors.tooltipBg,
        textStyle: { color: themeColors.tooltipText, fontSize: 11 },
      },
      grid: { left: 8, right: 8, top: 12, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: buckets.map((b) => b.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeColors.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: { color: themeColors.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: themeColors.grid } },
      },
      series: [
        {
          name: 'Badges',
          type: 'bar',
          barMaxWidth: 30,
          data: buckets.map((b) => ({
            value: b.count,
            itemStyle: { color: b.color, borderRadius: [6, 6, 2, 2] },
          })),
        },
      ],
    };
  }, [details?.badges, themeColors]);

  const mediaList = useMemo(() => {
    if (details?.media && details.media.length > 0) return details.media;
    const fallback: Array<{
      id: string;
      type: 'logo' | 'thumbnail';
      imageUrl: string;
      label: string;
    }> = [];
    if (game.iconUrl) {
      fallback.push({
        id: 'icon',
        type: 'logo',
        imageUrl: game.iconUrl,
        label: 'Experience Logo',
      });
    }
    if (game.thumbnailUrl) {
      fallback.push({
        id: 'thumb',
        type: 'thumbnail',
        imageUrl: game.thumbnailUrl,
        label: 'Cover Thumbnail',
      });
    }
    return fallback;
  }, [details?.media, game.iconUrl, game.thumbnailUrl]);

  const activeMedia = mediaList[selectedMediaIdx] ?? mediaList[0] ?? null;
  const rankedRegions = (details?.regionalRanks || []).filter(
    (r) => r.rank !== null
  );
  const globalExploreRank = details?.regionalRanks?.find(
    (r) => r.regionCode === 'ALL'
  );
  const updatedTimestamp = details?.meta.updated ?? game.robloxUpdatedAt;

  return (
    <div className="space-y-6">
      {/* 6 Small Graph KPI Cards: Peak/Day, Daily Growth %, Daily Players, Robux/Day, Session Length, Market Share */}
      <FadeInSection>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Peak Players / Day */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Peak Players per Day`}
            className="rounded-3xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between pr-8">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-[#6F8796] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                  Peak Players / Day
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                  {formatCompactNumber(latestBucket?.peakCcu ?? game.peakCcuObserved)}
                </p>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                All-time {formatCompactNumber(game.peakCcuObserved)}
              </span>
            </div>
            <EChartWrapper option={peakPerDayOption} height={135} />
          </LiquidGlassCard>

          {/* 2. Daily Growth Percentage */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Daily Growth %`}
            className="rounded-3xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between pr-8">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-[#6F8796] flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                  Daily Growth %
                </p>
                <p
                  className={`mt-1 font-display text-2xl font-bold tabular-nums ${
                    (latestBucket?.growthPct ?? game.growth24h ?? game.growth1h ?? 0) >= 0
                      ? 'text-emerald-600 dark:text-[#10E89A]'
                      : 'text-rose-500 dark:text-rose-400'
                  }`}
                >
                  {latestBucket?.growthPct !== null &&
                  latestBucket?.growthPct !== undefined
                    ? `${latestBucket.growthPct > 0 ? '+' : ''}${latestBucket.growthPct.toFixed(1)}%`
                    : game.growth1h !== null && game.growth1h !== undefined
                      ? `${game.growth1h > 0 ? '+' : ''}${game.growth1h.toFixed(1)}%`
                      : '0.0%'}
                </p>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                Day-over-day
              </span>
            </div>
            <EChartWrapper option={growthPerDayOption} height={135} />
          </LiquidGlassCard>

          {/* 3. Daily Players (Est. DAU) */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Est. Daily Players`}
            className="rounded-3xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between pr-8">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-[#6F8796] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  Daily Players (Est.)
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                  {formatCompactNumber(latestBucket?.estDau ?? 0)}
                </p>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                Est. DAU
              </span>
            </div>
            <EChartWrapper option={dailyPlayersOption} height={135} />
          </LiquidGlassCard>

          {/* 4. Robux / Day */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Est. Robux per Day`}
            className="rounded-3xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between pr-8">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-[#6F8796] flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  Est. Robux / Day
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                  R$ {formatCompactNumber(dailyRobux)}
                </p>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                ~{formatCurrencyCompact(estRev.dailyUsd)}/d
              </span>
            </div>
            <EChartWrapper option={robuxPerDayOption} height={135} />
          </LiquidGlassCard>

          {/* 5. Session Length */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Est. Session Length`}
            className="rounded-3xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between pr-8">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-[#6F8796] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                  Session Length (Est.)
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                  {session.minutes} min
                </p>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                Genre avg {session.genreAvg}m
              </span>
            </div>
            <EChartWrapper option={sessionLengthOption} height={135} />
          </LiquidGlassCard>

          {/* 6. Share of Roblox Traffic */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Share of Roblox Traffic`}
            className="rounded-3xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between pr-8">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-[#6F8796] flex items-center gap-1.5">
                  <PieChart className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                  Share of Roblox
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                  {marketStats.platformSharePct >= 0.01
                    ? `${marketStats.platformSharePct.toFixed(2)}%`
                    : '<0.01%'}
                </p>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums text-right">
                {marketStats.genreSharePct}% of {game.genre}
              </span>
            </div>
            <div className="grid grid-cols-2 items-center gap-2">
              <EChartWrapper option={marketShareOption} height={135} />
              <div className="space-y-2 text-xs tabular-nums">
                <div>
                  <p className="text-slate-500 dark:text-[#6F8796]">Global Share</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {marketStats.platformSharePct}% of {formatCompactNumber(marketStats.totalPlatformCcu)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-[#6F8796]">Genre Share</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {marketStats.genreSharePct}% of {formatCompactNumber(marketStats.totalGenreCcu)}
                  </p>
                </div>
              </div>
            </div>
          </LiquidGlassCard>
        </div>
      </FadeInSection>

      {/* Global & Local Region Charts + Creator Benchmarks Percentile */}
      <FadeInSection>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* 7. Global & Regional Charts Ranking */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Global & Local Region Rankings`}
            className="lg:col-span-6 rounded-[28px] p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-2 pr-8">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
                  Global & Local Region Rankings
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CB3C0] mt-0.5">
                  Live Roblox global charts and regional Explore positions
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.04]">
                <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                  Global Rank
                </p>
                <p className="mt-1 font-display text-xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                  {marketStats.catalogGlobalRank
                    ? `#${marketStats.catalogGlobalRank}`
                    : globalExploreRank?.rank
                      ? `#${globalExploreRank.rank}`
                      : 'Unranked'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                  of {formatCompactNumber(marketStats.catalogTotal)} tracked
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.04]">
                <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                  Genre Rank
                </p>
                <p className="mt-1 font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                  {marketStats.catalogGenreRank
                    ? `#${marketStats.catalogGenreRank}`
                    : '—'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-[#9CB3C0] truncate">
                  in {game.genre}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.04]">
                <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                  Local Charts
                </p>
                <p className="mt-1 font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                  {rankedRegions.length}/10
                </p>
                <p className="text-[10px] text-slate-500 dark:text-[#9CB3C0]">
                  Regions charted
                </p>
              </div>
            </div>

            {rankedRegions.length > 0 ? (
              <>
                <EChartWrapper option={regionalChartOption} height={155} />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {(details?.regionalRanks || []).map((r) => (
                    <div
                      key={r.regionCode}
                      className="px-2.5 py-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-between text-xs tabular-nums"
                    >
                      <span className="text-slate-600 dark:text-[#9CB3C0] font-medium">
                        {r.regionCode === 'ALL' ? 'GLB' : r.regionCode}
                      </span>
                      <span
                        className={
                          r.rank
                            ? 'font-bold text-emerald-600 dark:text-[#10E89A]'
                            : 'text-slate-400 dark:text-[#6F8796]'
                        }
                      >
                        {r.rank ? `#${r.rank}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-900/12 dark:border-white/12 p-6 text-center text-xs text-slate-500 dark:text-[#9CB3C0]">
                {loadingDetails
                  ? 'Checking live Roblox global & regional Explore charts...'
                  : 'Currently outside the top 50 regional Explore slots in checked countries.'}
              </div>
            )}
          </LiquidGlassCard>

          {/* 8. Similar Games Benchmark & Creator Percentile */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Benchmarks & Creator Percentile`}
            className="lg:col-span-6 rounded-[28px] p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-2 pr-8">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
                  Similar Games Benchmark
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CB3C0] mt-0.5">
                  Creator-style percentile vs. {benchmarks.cohortSize} similar experiences
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                  {benchmarks.overallPct}th
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                  Top {Math.max(1, 100 - benchmarks.overallPct)}% overall
                </p>
              </div>
            </div>

            <EChartWrapper option={benchmarkChartOption} height={185} />

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {benchmarks.items.map((b) => (
                <div
                  key={b.label}
                  className="p-3 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 dark:text-[#6F8796] truncate">
                      {b.label}
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {b.valueLabel}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums shrink-0">
                    P{b.percentile}
                  </span>
                </div>
              ))}
            </div>
          </LiquidGlassCard>
        </div>
      </FadeInSection>

      {/* 9. Competition — Similar Games */}
      <FadeInSection>
        <LiquidGlassCard
          exportTitle={`${game.name} — Competition & Similar Games`}
          className="rounded-[28px] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
                Competition & Similar Games
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9CB3C0] mt-0.5">
                Live CCU comparison against competing Roblox experiences
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
              {competitors.length} competitors
            </span>
          </div>

          {competitors.length > 0 ? (
            <>
              <EChartWrapper option={competitionChartOption} height={220} />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {competitors.slice(0, 8).map((comp) => (
                  <Link
                    key={comp.universeId}
                    href={`/games/${comp.universeId}`}
                    className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035] hover:bg-emerald-500/[0.08] border border-transparent hover:border-emerald-500/30 transition-all flex items-center gap-3 min-w-0"
                  >
                    <GameArtwork src={comp.iconUrl} alt={comp.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {comp.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                        {formatCompactNumber(comp.currentCcu)} CCU
                        {comp.likeRatio !== null ? ` · ${comp.likeRatio}%` : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-[#9CB3C0]">
              {loadingDetails
                ? 'Loading similar games from Roblox...'
                : 'No competing titles returned for this experience yet.'}
            </p>
          )}
        </LiquidGlassCard>
      </FadeInSection>

      {/* 10. Store (Game Passes & Developer Products) */}
      <FadeInSection>
        <LiquidGlassCard
          exportTitle={`${game.name} — Store (Game Passes & Dev Products)`}
          className="rounded-[28px] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                Store
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9CB3C0] mt-0.5">
                Public Game Passes and Developer Products listed on Roblox
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/8 dark:border-white/10 w-fit">
              {(
                [
                  {
                    id: 'passes' as const,
                    label: `Game Passes (${details?.gamePasses.length ?? 0})`,
                  },
                  {
                    id: 'products' as const,
                    label: `Dev Products (${details?.devProducts.length ?? 0})`,
                  },
                ]
              ).map((tab) => {
                const active = storeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStoreTab(tab.id)}
                    className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'text-white dark:text-[#04130D]'
                        : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="store-tab-pill"
                        transition={APPLE_SPRING}
                        className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-[#10E89A] -z-10"
                      />
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {storeTab === 'passes' ? (
            details?.gamePasses && details.gamePasses.length > 0 ? (
              <div className="space-y-4">
                {Object.keys(storePriceOption).length > 0 && (
                  <EChartWrapper option={storePriceOption} height={155} />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {details.gamePasses.map((pass) => (
                    <a
                      key={pass.id}
                      href={`https://www.roblox.com/game-pass/${pass.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035] hover:bg-amber-500/[0.08] border border-transparent hover:border-amber-500/30 transition-all flex items-center gap-3 min-w-0"
                    >
                      <GameArtwork
                        src={pass.iconUrl}
                        alt={pass.displayName}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {pass.displayName}
                        </p>
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
                          {pass.price !== null
                            ? `R$ ${formatExactNumber(pass.price)}`
                            : 'Off Sale'}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-900/12 dark:border-white/12 p-6 text-center text-xs text-slate-500 dark:text-[#9CB3C0]">
                {loadingDetails
                  ? 'Fetching Game Passes from Roblox...'
                  : 'No public Game Passes listed for this experience.'}
              </div>
            )
          ) : details?.devProducts && details.devProducts.length > 0 ? (
            <div className="space-y-4">
              {Object.keys(storePriceOption).length > 0 && (
                <EChartWrapper option={storePriceOption} height={155} />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {details.devProducts.map((dp) => (
                  <div
                    key={dp.id}
                    className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035] space-y-1 min-w-0"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {dp.name}
                    </p>
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      {dp.priceInRobux !== null
                        ? `R$ ${formatExactNumber(dp.priceInRobux)}`
                        : 'Price N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-900/12 dark:border-white/12 p-6 text-center text-xs text-slate-500 dark:text-[#9CB3C0]">
              {loadingDetails
                ? 'Checking Developer Products on Roblox...'
                : details?.devProductsRestricted
                  ? 'Roblox restricts public unauthenticated listing of in-experience Developer Products for this game; Game Passes remain publicly accessible above.'
                  : 'No public Developer Products found for this experience.'}
            </div>
          )}
        </LiquidGlassCard>
      </FadeInSection>

      {/* 11. Badges Card */}
      <FadeInSection>
        <LiquidGlassCard
          exportTitle={`${game.name} — Badges & Rarity`}
          className="rounded-[28px] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
                Badges
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9CB3C0] mt-0.5">
                Public achievements, win rates, and unlock counts
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
              {details?.badges.length ?? 0} badges loaded
            </span>
          </div>

          {details?.badges && details.badges.length > 0 ? (
            <div className="space-y-4">
              {Object.keys(badgesChartOption).length > 0 && (
                <EChartWrapper option={badgesChartOption} height={155} />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {details.badges.map((badge) => (
                  <a
                    key={badge.id}
                    href={`https://www.roblox.com/badges/${badge.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035] hover:bg-emerald-500/[0.07] transition-colors flex items-start gap-3 min-w-0"
                  >
                    <GameArtwork
                      src={badge.iconUrl}
                      alt={badge.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {badge.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                        {badge.winRatePercentage.toFixed(1)}% win rate ·{' '}
                        {formatCompactNumber(badge.awardedCount)} won
                      </p>
                      <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600 dark:bg-[#10E89A]"
                          style={{
                            width: `${Math.max(3, Math.min(100, badge.winRatePercentage))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-900/12 dark:border-white/12 p-6 text-center text-xs text-slate-500 dark:text-[#9CB3C0]">
              {loadingDetails
                ? 'Loading public badges from Roblox...'
                : 'No public badges found for this experience.'}
            </div>
          )}
        </LiquidGlassCard>
      </FadeInSection>

      {/* 12. All Logos & Thumbnails + Social Links & Last Update */}
      <FadeInSection>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Media Gallery */}
          <LiquidGlassCard
            exportTitle={`${game.name} — Logos & Thumbnails`}
            className="lg:col-span-7 rounded-[28px] p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pr-8">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
                  Logos & Thumbnails
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CB3C0] mt-0.5">
                  All official public logos and promotional thumbnails
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
                {mediaList.length} assets
              </span>
            </div>

            {activeMedia ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900/5 dark:bg-black/30 aspect-video flex items-center justify-center border border-slate-900/8 dark:border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeMedia.imageUrl}
                    alt={activeMedia.label}
                    referrerPolicy="no-referrer"
                    className={
                      activeMedia.type === 'logo'
                        ? 'h-full max-h-[260px] w-auto object-contain rounded-2xl p-4'
                        : 'w-full h-full object-cover'
                    }
                  />
                  <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-black/65 text-white backdrop-blur-md">
                    {activeMedia.label}
                  </span>
                </div>

                {mediaList.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {mediaList.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMediaIdx(idx)}
                        className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          idx === selectedMediaIdx
                            ? 'border-emerald-600 dark:border-[#10E89A] scale-[1.02]'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        } ${m.type === 'logo' ? 'w-14 h-14' : 'w-24 h-14'}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.imageUrl}
                          alt={m.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-[#9CB3C0]">
                No public media available.
              </p>
            )}
          </LiquidGlassCard>

          {/* Social Links + Last Update & Roblox Details */}
          <div className="lg:col-span-5 space-y-5">
            {/* Social Links Card */}
            <LiquidGlassCard
              exportTitle={`${game.name} — Social Links`}
              className="rounded-[28px] p-5 sm:p-6 space-y-4"
            >
              <div className="pr-8">
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
                  Social Links
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CB3C0] mt-0.5">
                  Official links from Roblox & creator community
                </p>
              </div>

              {details?.socialLinks && details.socialLinks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {details.socialLinks.map((social) => {
                    const Icon = getSocialIcon(social.type);
                    return (
                      <a
                        key={social.id}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-transform hover:-translate-y-0.5 ${getSocialColor(social.type)}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{social.title}</span>
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-[#9CB3C0]">
                  {loadingDetails
                    ? 'Loading Roblox Social Links...'
                    : 'No public Social Links attached to this Roblox experience.'}
                </p>
              )}
            </LiquidGlassCard>

            {/* Last Update & Public Info Card */}
            <LiquidGlassCard
              exportTitle={`${game.name} — Last Update & Specs`}
              className="rounded-[28px] p-5 sm:p-6 space-y-4"
            >
              <div className="pr-8">
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
                  Last Update & Info
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
                  <p className="text-slate-500 dark:text-[#6F8796]">Last Updated</p>
                  <p className="mt-1 font-bold text-slate-900 dark:text-white tabular-nums">
                    {updatedTimestamp
                      ? formatRelativeTime(updatedTimestamp)
                      : '—'}
                  </p>
                  {updatedTimestamp && (
                    <p className="text-[10px] text-slate-500 dark:text-[#9CB3C0] mt-0.5 tabular-nums">
                      {formatUtcTimestamp(updatedTimestamp)}
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
                  <p className="text-slate-500 dark:text-[#6F8796]">Created</p>
                  <p className="mt-1 font-bold text-slate-900 dark:text-white tabular-nums">
                    {details?.meta.created
                      ? new Date(details.meta.created).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
                  <p className="text-slate-500 dark:text-[#6F8796] flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Max Server Size
                  </p>
                  <p className="mt-1 font-bold text-slate-900 dark:text-white tabular-nums">
                    {details?.meta.maxPlayers
                      ? `${details.meta.maxPlayers} players`
                      : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
                  <p className="text-slate-500 dark:text-[#6F8796]">Access Price</p>
                  <p className="mt-1 font-bold text-slate-900 dark:text-white tabular-nums">
                    {details?.meta.price && details.meta.price > 0
                      ? `R$ ${formatExactNumber(details.meta.price)}`
                      : 'Free'}
                  </p>
                </div>
              </div>
            </LiquidGlassCard>
          </div>
        </div>
      </FadeInSection>
    </div>
  );
}
