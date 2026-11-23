'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Users } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useApp } from '@/components/AppProvider';
import { fetchGameHistory } from '@/lib/analytics-store';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import {
  estimatePortfolioMonthlyRevenue,
  formatCurrencyCompact,
} from '@/lib/revenue';
import { GameTable } from '@/components/GameTable';
import { EChartWrapper } from '@/components/EChartWrapper';
import {
  AnimatedNumber,
  FadeInSection,
  LiquidGlassCard,
} from '@/components/MotionPrimitives';

export default function DeveloperDetailPage() {
  const params = useParams<{ creatorId: string }>();
  const creatorId = String(params?.creatorId ?? '');
  const { theme, developers, loadingGames } = useApp();
  const isDark = theme === 'dark';

  const developer = useMemo(
    () => developers.find((d) => d.creatorId === creatorId) ?? null,
    [developers, creatorId]
  );

  const [combinedHistory, setCombinedHistory] = useState<
    Array<{ ts: number; totalCcu: number }>
  >([]);

  const gameIdsKey = developer
    ? developer.games.map((g) => g.universeId).join(',')
    : '';

  useEffect(() => {
    let cancelled = false;
    async function loadCombinedTrend() {
      if (!gameIdsKey) {
        setCombinedHistory([]);
        return;
      }
      const ids = gameIdsKey.split(',');
      const buckets = new Map<number, number>();

      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetchGameHistory(id, '7d');
            for (const pt of res.points) {
              const rounded = Math.floor(pt.timestampMs / 300_000) * 300_000;
              buckets.set(rounded, (buckets.get(rounded) ?? 0) + pt.ccu);
            }
          } catch {
            // Skip individual error
          }
        })
      );

      if (!cancelled) {
        const sorted = Array.from(buckets.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([ts, totalCcu]) => ({ ts, totalCcu }));
        setCombinedHistory(sorted);
      }
    }
    void loadCombinedTrend();
    return () => {
      cancelled = true;
    };
  }, [gameIdsKey]);

  const trendOption = useMemo<EChartsOption>(() => {
    const accent = isDark ? '#10E89A' : '#059669';
    const textMuted = isDark ? '#7893A3' : '#64748B';
    const gridLine = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
    const tooltipBg = isDark
      ? 'rgba(9, 19, 25, 0.92)'
      : 'rgba(255, 255, 255, 0.96)';
    const tooltipBorder = isDark
      ? 'rgba(255,255,255,0.14)'
      : 'rgba(15,23,42,0.1)';
    const tooltipText = isDark ? '#F1F7FA' : '#0B141A';

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12 },
      },
      grid: { left: 12, right: 16, top: 20, bottom: 16, containLabel: true },
      xAxis: {
        type: 'time',
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
          name: 'Combined CCU',
          type: 'line',
          smooth: 0.35,
          symbol: 'none',
          data: combinedHistory.map((p) => [p.ts, p.totalCcu]),
          lineStyle: { color: accent, width: 2.5 },
          itemStyle: { color: accent },
          areaStyle: {
            color: isDark
              ? 'rgba(16, 232, 154, 0.18)'
              : 'rgba(5, 150, 105, 0.16)',
          },
        },
      ],
    };
  }, [combinedHistory, isDark]);

  if (loadingGames) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 text-sm text-slate-500 dark:text-[#6F8796]">
        Loading developer...
      </div>
    );
  }

  if (!developer) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
        <LiquidGlassCard className="max-w-md mx-auto rounded-3xl p-8 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA]">
            Developer Not Found
          </h1>
          <Link
            href="/developers"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            All Developers
          </Link>
        </LiquidGlassCard>
      </div>
    );
  }

  const combinedObservedPeak = developer.games.reduce(
    (sum, g) => sum + g.peakCcuObserved,
    0
  );
  const portfolioEstMonthly = estimatePortfolioMonthlyRevenue(developer.games);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#6F8796]">
        <Link
          href="/developers"
          className="hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Developers
        </Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-[#9CB3C0]">
          {developer.creatorName}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center text-emerald-600 dark:text-[#10E89A]">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">
              {developer.creatorName}
            </h1>
            {developer.creatorVerified && (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-[#6F8796] mt-1 tabular-nums">
            {developer.creatorType} · {developer.gameCount}{' '}
            {developer.gameCount === 1 ? 'game' : 'games'}
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <LiquidGlassCard
          interactive
          exportTitle={`${developer.creatorName} — Live CCU`}
          className="rounded-3xl p-5"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Live CCU
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            <AnimatedNumber
              value={developer.combinedCcu}
              formatter={(v) => formatExactNumber(Math.round(v))}
            />
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard
          interactive
          exportTitle={`${developer.creatorName} — Est. Revenue`}
          className="rounded-3xl p-5"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Est. Rev / mo
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            <AnimatedNumber
              value={portfolioEstMonthly}
              formatter={(v) => formatCurrencyCompact(v)}
            />
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard
          interactive
          exportTitle={`${developer.creatorName} — Visits`}
          className="rounded-3xl p-5"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Visits
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {formatCompactNumber(developer.totalVisits)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard
          interactive
          exportTitle={`${developer.creatorName} — Peak CCU`}
          className="rounded-3xl p-5"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Peak CCU
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {formatExactNumber(combinedObservedPeak)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard
          interactive
          exportTitle={`${developer.creatorName} — Avg Rating`}
          className="rounded-3xl p-5"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Avg Rating
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {developer.avgLikeRatio !== null
              ? `${developer.avgLikeRatio}%`
              : '—'}
          </p>
        </LiquidGlassCard>
      </div>

      {/* Combined History */}
      {combinedHistory.length >= 2 && (
        <FadeInSection>
          <LiquidGlassCard
            variant="hero"
            exportTitle={`${developer.creatorName} — Player History`}
            className="rounded-[28px] p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA] pr-9">
              Player History
            </h2>
            <EChartWrapper option={trendOption} height={260} />
          </LiquidGlassCard>
        </FadeInSection>
      )}

      {/* Portfolio Games Table */}
      <FadeInSection className="space-y-4">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
          Games ({developer.gameCount})
        </h2>
        <GameTable games={developer.games} pageSize={10} />
      </FadeInSection>
    </div>
  );
}
