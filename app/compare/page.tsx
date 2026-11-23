'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useApp } from '@/components/AppProvider';
import { fetchGameHistory } from '@/lib/analytics-store';
import {
  formatCompactNumber,
  formatExactNumber,
  formatUtcTimestamp,
} from '@/lib/format';
import type { GameRecordData, TimeRange } from '@/lib/types';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { EChartWrapper } from '@/components/EChartWrapper';

const SERIES_COLORS = ['#48D597', '#60A5FA', '#F59E0B', '#F472B6'];
const COMPARE_RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: '1h', label: '1H' },
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'All' },
];

function CompareContent() {
  const searchParams = useSearchParams();
  const { games, loadingGames } = useApp();

  const [customIds, setCustomIds] = useState<string[] | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [range, setRange] = useState<TimeRange>('24h');
  const [historyByGame, setHistoryByGame] = useState<
    Record<string, Array<{ ts: number; ccu: number }>>
  >({});

  const defaultIds = useMemo(() => {
    if (loadingGames || games.length === 0) return [];
    const paramIds = (searchParams.get('ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[0-9]+$/.test(s))
      .slice(0, 4);

    if (paramIds.length > 0) {
      if (paramIds.length === 1) {
        const second = games.find((g) => g.universeId !== paramIds[0]);
        return second ? [paramIds[0], second.universeId] : [paramIds[0]];
      }
      return paramIds;
    }
    return games.slice(0, 2).map((g) => g.universeId);
  }, [games, loadingGames, searchParams]);

  const selectedIds = customIds ?? defaultIds;

  const selectedGames = useMemo<GameRecordData[]>(() => {
    const map = new Map(games.map((g) => [g.universeId, g]));
    return selectedIds
      .map((id) => map.get(id))
      .filter((g): g is GameRecordData => Boolean(g));
  }, [games, selectedIds]);

  const availableToPick = useMemo(() => {
    const chosen = new Set(selectedIds);
    const q = pickerQuery.trim().toLowerCase();
    return games
      .filter((g) => !chosen.has(g.universeId))
      .filter(
        (g) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.creatorName.toLowerCase().includes(q) ||
          g.universeId.includes(q)
      )
      .slice(0, 8);
  }, [games, selectedIds, pickerQuery]);

  // Fetch persisted histories for selected games
  const selectedIdsKey = selectedIds.join(',');
  useEffect(() => {
    let cancelled = false;
    async function loadHistories() {
      const ids = selectedIdsKey ? selectedIdsKey.split(',') : [];
      if (ids.length === 0) {
        setHistoryByGame({});
        return;
      }
      const next: Record<string, Array<{ ts: number; ccu: number }>> = {};
      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetchGameHistory(id, range);
            next[id] = res.points.map((p) => ({ ts: p.timestampMs, ccu: p.ccu }));
          } catch {
            next[id] = [];
          }
        })
      );
      if (!cancelled) setHistoryByGame(next);
    }
    void loadHistories();
    return () => {
      cancelled = true;
    };
  }, [selectedIdsKey, range]);

  const hasMultiPointHistory = useMemo(() => {
    return selectedGames.some(
      (g) => (historyByGame[g.universeId]?.length ?? 0) >= 2
    );
  }, [selectedGames, historyByGame]);

  const historyChartOption = useMemo<EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#101820',
        borderColor: '#263844',
        textStyle: { color: '#E8EEF2', fontSize: 12 },
      },
      legend: {
        top: 0,
        textStyle: { color: '#9BB0BD', fontSize: 12 },
      },
      grid: { left: 16, right: 20, top: 38, bottom: 20, containLabel: true },
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
      series: selectedGames.map((g, idx) => ({
        name: g.name,
        type: 'line',
        smooth: true,
        showSymbol: (historyByGame[g.universeId]?.length ?? 0) <= 10,
        data: (historyByGame[g.universeId] ?? []).map((p) => [p.ts, p.ccu]),
        lineStyle: { color: SERIES_COLORS[idx % SERIES_COLORS.length], width: 2.5 },
        itemStyle: { color: SERIES_COLORS[idx % SERIES_COLORS.length] },
      })),
    };
  }, [selectedGames, historyByGame]);

  const snapshotComparisonBarOption = useMemo<EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#101820',
        borderColor: '#263844',
        textStyle: { color: '#E8EEF2', fontSize: 12 },
      },
      legend: {
        top: 0,
        textStyle: { color: '#9BB0BD', fontSize: 12 },
      },
      grid: { left: 16, right: 20, top: 38, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: selectedGames.map((g) =>
          g.name.length > 20 ? g.name.slice(0, 18) + '…' : g.name
        ),
        axisLine: { lineStyle: { color: '#263844' } },
        axisLabel: { color: '#E8EEF2', fontSize: 12 },
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
          name: 'Current Live CCU',
          type: 'bar',
          barMaxWidth: 36,
          data: selectedGames.map((g) => g.currentCcu),
          itemStyle: { color: '#48D597', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Highest Observed CCU',
          type: 'bar',
          barMaxWidth: 36,
          data: selectedGames.map((g) => g.peakCcuObserved),
          itemStyle: { color: '#60A5FA', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [selectedGames]);

  const addGame = (universeId: string) => {
    if (selectedIds.length >= 4 || selectedIds.includes(universeId)) return;
    setCustomIds([...selectedIds, universeId]);
    setPickerQuery('');
    setPickerOpen(false);
  };

  const removeGame = (universeId: string) => {
    setCustomIds(selectedIds.filter((id) => id !== universeId));
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-[#E8EEF2]">
          Compare Roblox Experiences
        </h1>
        <p className="text-sm text-[#9BB0BD]">
          Benchmark up to 4 experiences side-by-side across live concurrency,
          historical trends, visits, favorites, like ratio, and observed peaks.
        </p>
      </div>

      {/* Selected Games Selector Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {selectedGames.map((game, idx) => (
          <div
            key={game.universeId}
            className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-2.5 h-8 rounded-full shrink-0"
                style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
              />
              <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
              <div className="min-w-0">
                <Link
                  href={`/games/${game.universeId}`}
                  className="text-sm font-semibold text-[#E8EEF2] hover:text-[#48D597] truncate block"
                >
                  {game.name}
                </Link>
                <p className="text-xs text-[#6E8492] tabular-nums">
                  {formatCompactNumber(game.currentCcu)} CCU
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Remove ${game.name}`}
              onClick={() => removeGame(game.universeId)}
              className="p-1.5 text-[#6E8492] hover:text-rose-400 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {selectedIds.length < 4 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="w-full h-full min-h-[76px] border border-dashed border-[#263844] hover:border-[#48D597] rounded-xl p-4 flex items-center justify-center gap-2 text-sm font-medium text-[#9BB0BD] hover:text-[#48D597] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add experience ({selectedIds.length}/4)
            </button>

            {pickerOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-[#1C2A32] border border-[#263844] rounded-xl shadow-2xl z-30 overflow-hidden">
                <div className="p-2.5 border-b border-[#263844] flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#6E8492]" />
                  <input
                    type="text"
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Filter tracked games..."
                    className="w-full bg-transparent text-xs text-[#E8EEF2] placeholder:text-[#6E8492] focus:outline-none"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-[#263844]/60">
                  {availableToPick.map((g) => (
                    <button
                      key={g.universeId}
                      type="button"
                      onClick={() => addGame(g.universeId)}
                      className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#22333D] text-left cursor-pointer"
                    >
                      <span className="text-xs font-medium text-[#E8EEF2] truncate">
                        {g.name}
                      </span>
                      <span className="text-xs text-[#48D597] tabular-nums shrink-0">
                        {formatCompactNumber(g.currentCcu)}
                      </span>
                    </button>
                  ))}
                  {availableToPick.length === 0 && (
                    <p className="p-3 text-xs text-[#6E8492] text-center">
                      No other matching tracked games.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedGames.length > 0 && (
        <>
          {/* Historical Comparison Chart */}
          <section className="bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
                  {hasMultiPointHistory
                    ? 'Historical CCU Comparison'
                    : 'Live CCU vs. Highest Observed Peak Comparison'}
                </h2>
                <p className="text-xs text-[#6E8492]">
                  {hasMultiPointHistory
                    ? 'Directly observed player timelines overlaid across selected games.'
                    : 'Multi-point historical lines will plot automatically once >=2 timed snapshots exist for these games.'}
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#101820] border border-[#263844] rounded-lg w-fit">
                {COMPARE_RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRange(r.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                      range === r.id
                        ? 'bg-[#48D597] text-[#101820] font-semibold'
                        : 'text-[#9BB0BD] hover:text-[#E8EEF2]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <EChartWrapper
              option={
                hasMultiPointHistory
                  ? historyChartOption
                  : snapshotComparisonBarOption
              }
              height={320}
            />
          </section>

          {/* Side-by-Side Metrics Matrix */}
          <section className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#263844] bg-[#162229]">
                    <th className="py-3.5 px-4 text-xs font-medium text-[#6E8492] w-48">
                      Metric
                    </th>
                    {selectedGames.map((g, idx) => (
                      <th
                        key={g.universeId}
                        className="py-3.5 px-4 text-sm font-semibold text-[#E8EEF2]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                SERIES_COLORS[idx % SERIES_COLORS.length],
                            }}
                          />
                          <Link
                            href={`/games/${g.universeId}`}
                            className="hover:text-[#48D597] truncate max-w-[180px]"
                          >
                            {g.name}
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#263844]/60 text-sm">
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      Current Live CCU
                    </td>
                    {selectedGames.map((g) => (
                      <td
                        key={g.universeId}
                        className="py-3 px-4 font-bold text-[#48D597] tabular-nums"
                      >
                        {formatExactNumber(g.currentCcu)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      Highest Observed CCU
                    </td>
                    {selectedGames.map((g) => (
                      <td
                        key={g.universeId}
                        className="py-3 px-4 font-semibold text-[#E8EEF2] tabular-nums"
                      >
                        {formatExactNumber(g.peakCcuObserved)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      24-Hour Growth
                    </td>
                    {selectedGames.map((g) => (
                      <td key={g.universeId} className="py-3 px-4">
                        <GrowthValue value={g.growth24h ?? g.growth1h} />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      7-Day Growth
                    </td>
                    {selectedGames.map((g) => (
                      <td key={g.universeId} className="py-3 px-4">
                        <GrowthValue value={g.growth7d} />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      Total Visits
                    </td>
                    {selectedGames.map((g) => (
                      <td
                        key={g.universeId}
                        className="py-3 px-4 text-[#E8EEF2] tabular-nums"
                      >
                        {formatCompactNumber(g.totalVisits)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      Favorites
                    </td>
                    {selectedGames.map((g) => (
                      <td
                        key={g.universeId}
                        className="py-3 px-4 text-[#E8EEF2] tabular-nums"
                      >
                        {formatCompactNumber(g.favorites)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      Like Ratio
                    </td>
                    {selectedGames.map((g) => (
                      <td
                        key={g.universeId}
                        className="py-3 px-4 text-[#E8EEF2] tabular-nums"
                      >
                        {g.likeRatio !== null && g.likeRatio !== undefined
                          ? `${g.likeRatio.toFixed(1)}%`
                          : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      Developer / Group
                    </td>
                    {selectedGames.map((g) => (
                      <td key={g.universeId} className="py-3 px-4 text-[#9BB0BD]">
                        <Link
                          href={`/developers/${g.creatorId}`}
                          className="hover:text-[#48D597]"
                        >
                          {g.creatorName}
                        </Link>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">Genre</td>
                    {selectedGames.map((g) => (
                      <td key={g.universeId} className="py-3 px-4 text-[#9BB0BD]">
                        {g.genre}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-xs text-[#9BB0BD]">
                      Last Observed
                    </td>
                    {selectedGames.map((g) => (
                      <td
                        key={g.universeId}
                        className="py-3 px-4 text-xs text-[#6E8492] tabular-nums"
                      >
                        {formatUtcTimestamp(g.lastCollectedAt)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-10 text-sm text-[#6E8492]">
          Loading comparison workbench...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
