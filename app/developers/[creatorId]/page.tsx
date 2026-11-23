'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Info, ShieldCheck, Trophy, Users } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useApp } from '@/components/AppProvider';
import { fetchGameHistory } from '@/lib/analytics-store';
import {
  formatCompactNumber,
  formatExactNumber,
  formatUtcTimestamp,
} from '@/lib/format';
import { GameTable } from '@/components/GameTable';
import { EChartWrapper } from '@/components/EChartWrapper';

export default function DeveloperDetailPage() {
  const params = useParams<{ creatorId: string }>();
  const creatorId = String(params?.creatorId ?? '');
  const { developers, loadingGames } = useApp();

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
              // Group into 5-minute buckets to sum across portfolio
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

  const trendOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#101820',
        borderColor: '#263844',
        textStyle: { color: '#E8EEF2', fontSize: 12 },
      },
      grid: { left: 16, right: 20, top: 20, bottom: 20, containLabel: true },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: '#263844' } },
        axisLabel: { color: '#6E8492', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#6E8492',
          fontSize: 11,
          formatter: (val: number) => formatCompactNumber(val),
        },
        splitLine: { lineStyle: { color: '#263844', type: 'dashed' } },
      },
      series: [
        {
          name: 'Combined Observed CCU',
          type: 'line',
          smooth: true,
          data: combinedHistory.map((p) => [p.ts, p.totalCcu]),
          lineStyle: { color: '#48D597', width: 2.5 },
          itemStyle: { color: '#48D597' },
          areaStyle: {
            color: 'rgba(72, 213, 151, 0.16)',
          },
        },
      ],
    }),
    [combinedHistory]
  );

  if (loadingGames) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-12 text-sm text-[#6E8492]">
        Loading developer profile...
      </div>
    );
  }

  if (!developer) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-lg mx-auto bg-[#1C2A32] border border-[#263844] rounded-xl p-8 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#E8EEF2]">
            Developer Not Found in Tracked Catalog
          </h1>
          <p className="text-sm text-[#9BB0BD]">
            Creator ID {creatorId} does not currently have tracked experiences in
            RoMetric.
          </p>
          <Link
            href="/developers"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#48D597] text-[#101820] rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            All Developers
          </Link>
        </div>
      </div>
    );
  }

  const combinedObservedPeak = developer.games.reduce(
    (sum, g) => sum + g.peakCcuObserved,
    0
  );

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex items-center gap-2 text-xs text-[#6E8492]">
        <Link href="/developers" className="hover:text-[#E8EEF2]">
          Developers
        </Link>
        <span>/</span>
        <span className="text-[#9BB0BD]">{developer.creatorName}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#1C2A32] border border-[#263844] flex items-center justify-center text-[#48D597]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-bold text-[#E8EEF2]">
                {developer.creatorName}
              </h1>
              {developer.creatorVerified && (
                <ShieldCheck className="w-5 h-5 text-[#48D597]" />
              )}
            </div>
            <p className="text-xs text-[#6E8492] mt-1 tabular-nums">
              {developer.creatorType} · Creator ID {developer.creatorId} ·{' '}
              {developer.gameCount} tracked{' '}
              {developer.gameCount === 1 ? 'experience' : 'experiences'}
            </p>
          </div>
        </div>
      </div>

      {/* Public vs Private Creator Analytics Distinction */}
      <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 flex items-start gap-3 text-xs text-[#9BB0BD]">
        <Info className="w-4 h-4 text-[#48D597] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[#E8EEF2]">Public Portfolio Data:</strong>{' '}
          Metrics below are aggregated strictly from publicly observable Roblox
          endpoints for tracked experiences belonging to this creator. Private
          Roblox Creator Analytics (retention funnels, Robux revenue, demographic
          breakdowns, and ad spend) are never accessed without direct developer
          Open Cloud OAuth authorization.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5">
          <p className="text-xs text-[#6E8492]">Combined Live CCU</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#48D597] tabular-nums">
            {formatExactNumber(developer.combinedCcu)}
          </p>
        </div>
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5">
          <p className="text-xs text-[#6E8492]">Combined Total Visits</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#E8EEF2] tabular-nums">
            {formatCompactNumber(developer.totalVisits)}
          </p>
        </div>
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5">
          <p className="text-xs text-[#6E8492]">Combined Observed Peak</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#E8EEF2] tabular-nums">
            {formatExactNumber(combinedObservedPeak)}
          </p>
        </div>
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5">
          <p className="text-xs text-[#6E8492]">Avg Portfolio Like Ratio</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#E8EEF2] tabular-nums">
            {developer.avgLikeRatio !== null
              ? `${developer.avgLikeRatio}%`
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Combined Historical Player Trends */}
      <section className="bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
            Combined Historical Player Trends
          </h2>
          <p className="text-xs text-[#6E8492]">
            Sum of observed concurrent players across all tracked games for{' '}
            {developer.creatorName}
          </p>
        </div>

        {combinedHistory.length >= 2 ? (
          <EChartWrapper option={trendOption} height={280} />
        ) : (
          <div className="border border-dashed border-[#263844] rounded-lg p-8 text-center text-xs text-[#9BB0BD]">
            Historical portfolio trend plotting starts automatically once at least
            2 timestamped collection runs have been stored for this creator&apos;s
            games.
          </div>
        )}
      </section>

      {/* Historical Milestones */}
      <section className="bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#48D597]" />
          <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
            Observed Portfolio Milestones
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-[#101820] border border-[#263844] space-y-1">
            <p className="text-[#6E8492]">Flagship Experience</p>
            <p className="text-sm font-semibold text-[#E8EEF2] truncate">
              {developer.topGame.name}
            </p>
            <p className="text-[#48D597] tabular-nums">
              {formatExactNumber(developer.topGame.currentCcu)} live CCU
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#101820] border border-[#263844] space-y-1">
            <p className="text-[#6E8492]">Highest Single-Game Peak Observed</p>
            <p className="text-sm font-semibold text-[#E8EEF2] tabular-nums">
              {formatExactNumber(
                Math.max(...developer.games.map((g) => g.peakCcuObserved))
              )}{' '}
              CCU
            </p>
            <p className="text-[#6E8492] tabular-nums">
              Recorded{' '}
              {formatUtcTimestamp(developer.topGame.peakCcuAt)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#101820] border border-[#263844] space-y-1">
            <p className="text-[#6E8492]">Total Lifetime Favorites</p>
            <p className="text-sm font-semibold text-[#E8EEF2] tabular-nums">
              {formatCompactNumber(developer.totalFavorites)}
            </p>
            <p className="text-[#6E8492]">Across tracked portfolio</p>
          </div>
        </div>
      </section>

      {/* Portfolio Games Table */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
          Tracked Experiences ({developer.gameCount})
        </h2>
        <GameTable games={developer.games} pageSize={10} />
      </section>
    </div>
  );
}
