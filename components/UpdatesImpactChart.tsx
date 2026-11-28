'use client';

import React, { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { TrendingUp } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { EChartWrapper } from '@/components/EChartWrapper';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import { formatCompactNumber } from '@/lib/format';

export interface UpdatesChartPoint {
  timestamp: string;
  ccu: number;
  maxCcu?: number;
}

export function UpdatesImpactChart({
  gameName,
  points,
  latestUpdateIso,
}: {
  gameName: string;
  points: UpdatesChartPoint[];
  latestUpdateIso?: string | null;
}) {
  const { theme } = useApp();
  const isDark = theme === 'dark';
  const [windowDays, setWindowDays] = useState<'7d' | '30d'>('30d');

  const sliced = useMemo(() => {
    if (points.length === 0) return [];
    const sorted = [...points].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
    );
    if (windowDays === '7d') {
      return sorted.slice(-7);
    }
    return sorted.slice(-30);
  }, [points, windowDays]);

  const option = useMemo<EChartsOption>(() => {
    const accent = isDark ? '#10E89A' : '#059669';
    const textMuted = isDark ? '#7893A3' : '#64748B';
    const gridLine = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
    const tooltipBg = isDark
      ? 'rgba(9, 19, 25, 0.94)'
      : 'rgba(255, 255, 255, 0.96)';

    const labels = sliced.map((p) => {
      const d = new Date(p.timestamp);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    // Locate closest index to latestUpdateIso for dashed vertical marker
    let updateLabel: string | null = null;
    if (latestUpdateIso && sliced.length > 0) {
      const targetMs = Date.parse(latestUpdateIso);
      if (Number.isFinite(targetMs)) {
        let bestIdx = -1;
        let bestDiff = Infinity;
        sliced.forEach((pt, idx) => {
          const diff = Math.abs(Date.parse(pt.timestamp) - targetMs);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = idx;
          }
        });
        if (bestIdx >= 0 && bestDiff <= 48 * 3600 * 1000) {
          updateLabel = labels[bestIdx];
        }
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
        textStyle: { color: isDark ? '#F1F7FA' : '#0B141A', fontSize: 12 },
      },
      legend: {
        top: 0,
        right: 8,
        textStyle: { color: textMuted, fontSize: 11 },
      },
      grid: { left: 10, right: 16, top: 36, bottom: 14, containLabel: true },
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
          name: 'Avg CCU',
          type: 'line',
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 5,
          data: sliced.map((p) => p.ccu),
          lineStyle: { color: accent, width: 2.5 },
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
                    ? 'rgba(16,232,154,0.28)'
                    : 'rgba(5,150,105,0.2)',
                },
                {
                  offset: 1,
                  color: isDark
                    ? 'rgba(16,232,154,0.01)'
                    : 'rgba(5,150,105,0.01)',
                },
              ],
            },
          },
          ...(updateLabel
            ? {
                markLine: {
                  symbol: ['none', 'none'],
                  label: {
                    formatter: 'Latest Update',
                    color: isDark ? '#fbbf24' : '#b45309',
                    fontSize: 11,
                  },
                  lineStyle: {
                    color: '#f59e0b',
                    type: 'dashed' as const,
                    width: 1.5,
                  },
                  data: [{ xAxis: updateLabel }],
                },
              }
            : {}),
        },
        {
          name: 'Peak CCU',
          type: 'line',
          smooth: 0.3,
          symbol: 'none',
          data: sliced.map((p) => p.maxCcu ?? p.ccu),
          lineStyle: {
            color: isDark ? '#9CB3C0' : '#475569',
            width: 1.5,
            type: 'dashed',
          },
        },
      ],
    };
  }, [sliced, latestUpdateIso, isDark]);

  if (sliced.length < 2) {
    return null;
  }

  return (
    <LiquidGlassCard className="rounded-3xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            {gameName} Post-Update Player Trend
          </h2>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
          {(['7d', '30d'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                windowDays === w
                  ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                  : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {w.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <EChartWrapper option={option} height={280} />
    </LiquidGlassCard>
  );
}
