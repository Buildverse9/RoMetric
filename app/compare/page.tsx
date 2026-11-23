'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Search, X } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useApp } from '@/components/AppProvider';
import { fetchGameHistory } from '@/lib/analytics-store';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import type { GameRecordData, TimeRange } from '@/lib/types';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { EChartWrapper } from '@/components/EChartWrapper';
import {
  APPLE_SPRING,
  FadeInSection,
  LiquidGlassCard,
} from '@/components/MotionPrimitives';

const SERIES_COLORS_DARK = ['#10E89A', '#38BDF8', '#F59E0B', '#F472B6'];
const SERIES_COLORS_LIGHT = ['#059669', '#0284C7', '#D97706', '#DB2777'];

const COMPARE_RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: '1h', label: '1H' },
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'All' },
];

function CompareContent() {
  const searchParams = useSearchParams();
  const { theme, games, loadingGames } = useApp();
  const isDark = theme === 'dark';
  const seriesColors = isDark ? SERIES_COLORS_DARK : SERIES_COLORS_LIGHT;

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

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12 },
      },
      legend: {
        top: 0,
        textStyle: { color: textLegend, fontSize: 12 },
      },
      grid: { left: 12, right: 16, top: 38, bottom: 16, containLabel: true },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: gridLine } },
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
      series: selectedGames.map((g, idx) => ({
        name: g.name,
        type: 'line',
        smooth: true,
        showSymbol: (historyByGame[g.universeId]?.length ?? 0) <= 10,
        data: (historyByGame[g.universeId] ?? []).map((p) => [p.ts, p.ccu]),
        lineStyle: { color: seriesColors[idx % seriesColors.length], width: 2.5 },
        itemStyle: { color: seriesColors[idx % seriesColors.length] },
      })),
    };
  }, [selectedGames, historyByGame, isDark, seriesColors]);

  const snapshotComparisonBarOption = useMemo<EChartsOption>(() => {
    const textMuted = isDark ? '#7893A3' : '#64748B';
    const textPrimary = isDark ? '#F1F7FA' : '#0B141A';
    const gridLine = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
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
      legend: {
        top: 0,
        textStyle: { color: textMuted, fontSize: 12 },
      },
      grid: { left: 12, right: 16, top: 38, bottom: 16, containLabel: true },
      xAxis: {
        type: 'category',
        data: selectedGames.map((g) =>
          g.name.length > 20 ? g.name.slice(0, 18) + '…' : g.name
        ),
        axisLine: { lineStyle: { color: gridLine } },
        axisLabel: { color: textPrimary, fontSize: 12 },
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
          barMaxWidth: 34,
          data: selectedGames.map((g) => g.currentCcu),
          itemStyle: { color: seriesColors[0], borderRadius: [8, 8, 2, 2] },
        },
        {
          name: 'Peak CCU',
          type: 'bar',
          barMaxWidth: 34,
          data: selectedGames.map((g) => g.peakCcuObserved),
          itemStyle: { color: seriesColors[1], borderRadius: [8, 8, 2, 2] },
        },
      ],
    };
  }, [selectedGames, isDark, seriesColors]);

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
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-6 space-y-6">
      <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">
        Compare
      </h1>

      {/* Selected Games Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {selectedGames.map((game, idx) => {
            const rev = estimateGameRevenue(game);
            return (
              <LiquidGlassCard
                key={game.universeId}
                exportTitle={game.name}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={APPLE_SPRING}
                className="rounded-3xl p-4 pr-11 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{
                      backgroundColor: seriesColors[idx % seriesColors.length],
                    }}
                  />
                  <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                  <div className="min-w-0">
                    <Link
                      href={`/games/${game.universeId}`}
                      className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] hover:text-emerald-600 dark:hover:text-[#10E89A] truncate block"
                    >
                      {game.name}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-[#6F8796] tabular-nums truncate">
                      {formatCompactNumber(game.currentCcu)} CCU · ~
                      {formatCurrencyCompact(rev.monthlyUsd)}/mo
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  aria-label={`Remove ${game.name}`}
                  onClick={() => removeGame(game.universeId)}
                  className="p-1.5 rounded-full text-slate-400 dark:text-[#6F8796] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </LiquidGlassCard>
            );
          })}
        </AnimatePresence>

        {selectedIds.length < 4 && (
          <div className="relative">
            <motion.button
              type="button"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              transition={APPLE_SPRING}
              onClick={() => setPickerOpen((v) => !v)}
              className="w-full h-full min-h-[76px] border border-dashed border-slate-900/20 dark:border-white/20 hover:border-emerald-500 dark:hover:border-[#10E89A] rounded-3xl p-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add game ({selectedIds.length}/4)
            </motion.button>

            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={APPLE_SPRING}
                  className="absolute left-0 right-0 mt-2 liquid-glass-strong rounded-3xl z-30 overflow-hidden"
                >
                  <div className="p-3 border-b border-slate-900/8 dark:border-white/10 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400 dark:text-[#6F8796]" />
                    <input
                      type="text"
                      autoFocus
                      value={pickerQuery}
                      onChange={(e) => setPickerQuery(e.target.value)}
                      placeholder="Search games..."
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-900/6 dark:divide-white/8">
                    {availableToPick.map((g) => (
                      <button
                        key={g.universeId}
                        type="button"
                        onClick={() => addGame(g.universeId)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left cursor-pointer"
                      >
                        <span className="text-xs font-medium text-slate-900 dark:text-[#F1F7FA] truncate">
                          {g.name}
                        </span>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums shrink-0">
                          {formatCompactNumber(g.currentCcu)}
                        </span>
                      </button>
                    ))}
                    {availableToPick.length === 0 && (
                      <p className="p-3 text-xs text-slate-500 dark:text-[#6F8796] text-center">
                        No games found.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {selectedGames.length > 0 && (
        <>
          <FadeInSection>
            <LiquidGlassCard
              exportTitle="Roblox Game Comparison"
              className="rounded-[28px] p-6 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-9">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
                  {hasMultiPointHistory ? 'Player History' : 'Live vs Peak'}
                </h2>
                <div className="flex items-center gap-1 p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/8 dark:border-white/10 w-fit">
                  {COMPARE_RANGES.map((r) => {
                    const active = range === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRange(r.id)}
                        className={`relative px-3 py-1 text-xs font-semibold rounded-full cursor-pointer transition-colors ${
                          active
                            ? 'text-white dark:text-[#04130D]'
                            : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="compare-range-pill"
                            transition={APPLE_SPRING}
                            className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-[#10E89A] -z-10"
                          />
                        )}
                        {r.label}
                      </button>
                    );
                  })}
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
            </LiquidGlassCard>
          </FadeInSection>

          <FadeInSection>
            <LiquidGlassCard
              exportTitle="Roblox Metrics Comparison"
              className="rounded-[28px] overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
                      <th className="py-3.5 px-5 text-xs font-medium text-slate-500 dark:text-[#6F8796] w-44">
                        Metric
                      </th>
                      {selectedGames.map((g, idx) => (
                        <th
                          key={g.universeId}
                          className="py-3.5 px-4 text-sm font-semibold text-slate-900 dark:text-[#F1F7FA]"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  seriesColors[idx % seriesColors.length],
                              }}
                            />
                            <Link
                              href={`/games/${g.universeId}`}
                              className="hover:text-emerald-600 dark:hover:text-[#10E89A] truncate max-w-[180px]"
                            >
                              {g.name}
                            </Link>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/6 dark:divide-white/8 text-sm">
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Live CCU
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums"
                        >
                          {formatExactNumber(g.currentCcu)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Est. Monthly Revenue
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums"
                        >
                          {formatCurrencyCompact(
                            estimateGameRevenue(g).monthlyUsd
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Est. Daily Revenue
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 font-medium text-slate-900 dark:text-[#F1F7FA] tabular-nums"
                        >
                          {formatCurrencyCompact(
                            estimateGameRevenue(g).dailyUsd
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Peak CCU
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums"
                        >
                          {formatExactNumber(g.peakCcuObserved)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        24h Change
                      </td>
                      {selectedGames.map((g) => (
                        <td key={g.universeId} className="py-3.5 px-4">
                          <GrowthValue value={g.growth24h ?? g.growth1h} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        7d Change
                      </td>
                      {selectedGames.map((g) => (
                        <td key={g.universeId} className="py-3.5 px-4">
                          <GrowthValue value={g.growth7d} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Total Visits
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 text-slate-900 dark:text-[#F1F7FA] tabular-nums"
                        >
                          {formatCompactNumber(g.totalVisits)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Favorites
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 text-slate-900 dark:text-[#F1F7FA] tabular-nums"
                        >
                          {formatCompactNumber(g.favorites)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Like Ratio
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 text-slate-900 dark:text-[#F1F7FA] tabular-nums"
                        >
                          {g.likeRatio !== null && g.likeRatio !== undefined
                            ? `${g.likeRatio.toFixed(1)}%`
                            : '—'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Developer
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 text-slate-600 dark:text-[#9CB3C0]"
                        >
                          <Link
                            href={`/developers/${g.creatorId}`}
                            className="hover:text-emerald-600 dark:hover:text-[#10E89A]"
                          >
                            {g.creatorName}
                          </Link>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9CB3C0]">
                        Genre
                      </td>
                      {selectedGames.map((g) => (
                        <td
                          key={g.universeId}
                          className="py-3.5 px-4 text-slate-600 dark:text-[#9CB3C0]"
                        >
                          {g.genre}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </LiquidGlassCard>
          </FadeInSection>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 text-sm text-slate-500 dark:text-[#6F8796]">
          Loading...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
