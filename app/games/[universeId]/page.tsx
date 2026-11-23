'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  GitCompare,
  Info,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
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
import type {
  GamePeakRecord,
  GameRecordData,
  RobloxFetchResponse,
  TimeRange,
} from '@/lib/types';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { EChartWrapper } from '@/components/EChartWrapper';

const TIME_RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: '1h', label: '1H' },
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All' },
];

export default function GameDetailPage() {
  const params = useParams<{ universeId: string }>();
  const universeId = String(params?.universeId ?? '').replace(/[^0-9]/g, '');

  const [game, setGame] = useState<GameRecordData | null>(null);
  const [isTracked, setIsTracked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<TimeRange>('24h');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [peakRecord, setPeakRecord] = useState<GamePeakRecord | null>(null);
  const [historyPoints, setHistoryPoints] = useState<
    Array<{
      timestamp: string;
      timestampMs: number;
      ccu: number;
      minCcu?: number;
      maxCcu?: number;
      visits: number;
      favorites: number;
      sourceTable: 'game_snapshots' | 'game_hourly_stats' | 'game_daily_stats';
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;

    async function loadGame() {
      if (!universeId) {
        setError('Invalid Universe ID.');
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

        // Not tracked in DB yet — fetch live directly from Roblox public API
        const res = await fetch(
          `/api/roblox/fetch?ids=${encodeURIComponent(universeId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          throw new Error('Unable to fetch game details from Roblox.');
        }
        const data = (await res.json()) as RobloxFetchResponse;
        if (!data.games.length) {
          throw new Error(
            `No public Roblox experience found for Universe ID ${universeId}.`
          );
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
            err instanceof Error ? err.message : 'Failed to load experience.'
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

  const ccuChartOption = useMemo<EChartsOption>(() => {
    const labels = historyPoints.map((p) => {
      const d = new Date(p.timestampMs);
      if (range === '1h' || range === '24h') {
        return d.toISOString().slice(11, 16) + ' UTC';
      }
      return d.toISOString().slice(5, 16).replace('T', ' ');
    });

    const hasPeakBands = historyPoints.some(
      (p) => p.maxCcu !== undefined && p.maxCcu !== p.ccu
    );

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#101820',
        borderColor: '#263844',
        textStyle: { color: '#E8EEF2', fontSize: 12 },
      },
      legend: hasPeakBands
        ? {
            top: 0,
            right: 8,
            textStyle: { color: '#9BB0BD', fontSize: 11 },
          }
        : undefined,
      grid: { left: 12, right: 16, top: hasPeakBands ? 34 : 18, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
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
          name: hasPeakBands ? 'Average CCU' : 'Observed CCU',
          type: 'line',
          smooth: true,
          symbol: historyPoints.length <= 12 ? 'circle' : 'none',
          symbolSize: 6,
          data: historyPoints.map((p) => p.ccu),
          lineStyle: { color: '#48D597', width: 2.5 },
          itemStyle: { color: '#48D597' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(72, 213, 151, 0.25)' },
                { offset: 1, color: 'rgba(72, 213, 151, 0.01)' },
              ],
            },
          },
        },
        ...(hasPeakBands
          ? [
              {
                name: 'Observed Peak',
                type: 'line' as const,
                smooth: true,
                symbol: 'none',
                data: historyPoints.map((p) => p.maxCcu ?? p.ccu),
                lineStyle: {
                  color: '#9BB0BD',
                  width: 1.5,
                  type: 'dashed' as const,
                },
              },
            ]
          : []),
      ],
    };
  }, [historyPoints, range]);

  if (loading) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-10 space-y-6 animate-pulse">
        <div className="h-5 w-32 bg-[#1C2A32] rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 aspect-video bg-[#1C2A32] rounded-xl" />
          <div className="lg:col-span-7 space-y-4">
            <div className="h-8 w-2/3 bg-[#1C2A32] rounded" />
            <div className="h-4 w-1/2 bg-[#1C2A32] rounded" />
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="h-20 bg-[#1C2A32] rounded-xl" />
              <div className="h-20 bg-[#1C2A32] rounded-xl" />
              <div className="h-20 bg-[#1C2A32] rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-lg mx-auto bg-[#1C2A32] border border-[#263844] rounded-xl p-8 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#E8EEF2]">
            Experience Unavailable
          </h1>
          <p className="text-sm text-[#9BB0BD]">
            {error || 'Could not load this Roblox experience.'}
          </p>
          <Link
            href="/rankings"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Rankings
          </Link>
        </div>
      </div>
    );
  }

  const highestPeak =
    peakRecord?.highestObservedCcu ?? game.peakCcuObserved ?? game.currentCcu;
  const highestPeakAt = peakRecord?.highestObservedAt ?? game.peakCcuAt;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-4 text-xs text-[#6E8492]">
        <div className="flex items-center gap-2">
          <Link href="/rankings" className="hover:text-[#E8EEF2] transition-colors">
            Rankings
          </Link>
          <span>/</span>
          <span className="text-[#9BB0BD] truncate max-w-[260px]">{game.name}</span>
        </div>
        <div className="flex items-center gap-2 tabular-nums">
          <Clock className="w-3.5 h-3.5 text-[#48D597]" />
          <span>
            Last observed {formatRelativeTime(game.lastCollectedAt)} (
            {formatUtcTimestamp(game.lastCollectedAt)})
          </span>
        </div>
      </div>

      {/* Header Split: Artwork + Core Identity & KPIs */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5">
          <GameArtwork
            src={game.thumbnailUrl || game.iconUrl}
            alt={game.name}
            variant="banner"
          />
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <GameArtwork src={game.iconUrl} alt={game.name} size="lg" />
              <div className="min-w-0 space-y-1">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8EEF2] leading-tight">
                  {game.name}
                </h1>
                <p className="text-sm text-[#9BB0BD] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    By{' '}
                    <Link
                      href={`/developers/${game.creatorId}`}
                      className="text-[#E8EEF2] hover:text-[#48D597] font-medium transition-colors"
                    >
                      {game.creatorName}
                    </Link>
                  </span>
                  {game.creatorVerified && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#48D597]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{game.creatorType}</span>
                  <span aria-hidden="true">·</span>
                  <span>{game.genre}</span>
                </p>
                <p className="text-xs text-[#6E8492] tabular-nums">
                  Universe ID {game.universeId} · Root Place {game.rootPlaceId} · Status:{' '}
                  {game.collectionStatus}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/compare?ids=${game.universeId}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286] transition-colors whitespace-nowrap"
              >
                <GitCompare className="w-3.5 h-3.5" />
                Compare
              </Link>
              <a
                href={`https://www.roblox.com/games/${game.rootPlaceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#1C2A32] border border-[#263844] text-[#9BB0BD] hover:text-[#E8EEF2] rounded-lg transition-colors whitespace-nowrap"
              >
                Roblox
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4">
              <p className="text-xs text-[#6E8492]">Live CCU</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#48D597] tabular-nums">
                {formatExactNumber(game.currentCcu)}
              </p>
            </div>
            <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4">
              <p className="text-xs text-[#6E8492]">Total Visits</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#E8EEF2] tabular-nums">
                {formatCompactNumber(game.totalVisits)}
              </p>
            </div>
            <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4">
              <p className="text-xs text-[#6E8492]">Favorites</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#E8EEF2] tabular-nums">
                {formatCompactNumber(game.favorites)}
              </p>
            </div>
            <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4">
              <p className="text-xs text-[#6E8492]">Like Ratio</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#E8EEF2] tabular-nums">
                {game.likeRatio !== null && game.likeRatio !== undefined
                  ? `${game.likeRatio.toFixed(1)}%`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Votes Breakdown + Observed Peak */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-[#6E8492]">Verified Votes</p>
                <div className="flex items-center gap-4 text-sm tabular-nums">
                  <span className="inline-flex items-center gap-1.5 text-[#48D597] font-medium">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    {formatCompactNumber(game.upVotes)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#9BB0BD]">
                    <ThumbsDown className="w-3.5 h-3.5" />
                    {formatCompactNumber(game.downVotes)}
                  </span>
                </div>
              </div>
              <span className="text-xs text-[#6E8492]">games/v1/votes</span>
            </div>

            <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-[#6E8492]">
                  Highest Observed CCU (RoMetric Record)
                </p>
                <p className="text-base font-bold text-[#E8EEF2] tabular-nums">
                  {formatExactNumber(highestPeak)}
                </p>
              </div>
              <span className="text-xs text-[#6E8492] text-right tabular-nums">
                {highestPeakAt ? formatUtcTimestamp(highestPeakAt) : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Growth Windows Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '1-Hour Growth', value: game.growth1h },
          { label: '24-Hour Growth', value: game.growth24h },
          { label: '7-Day Growth', value: game.growth7d },
          { label: '30-Day Growth', value: game.growth30d },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 flex items-center justify-between"
          >
            <span className="text-xs text-[#9BB0BD]">{item.label}</span>
            <GrowthValue value={item.value} />
          </div>
        ))}
      </section>

      {/* Historical CCU & Peak Chart */}
      <section className="bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
              Historical Concurrent Players (CCU)
            </h2>
            <p className="text-xs text-[#6E8492] mt-0.5">
              {isTracked
                ? `Directly observed history starting ${formatUtcTimestamp(game.firstObservedAt)} · ${game.snapshotCount ?? historyPoints.length} observations recorded`
                : 'Live lookup only — this game is not yet in the tracked historical database.'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#101820] border border-[#263844] rounded-lg w-fit">
            {TIME_RANGES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRange(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  range === t.id
                    ? 'bg-[#48D597] text-[#101820] font-semibold'
                    : 'text-[#9BB0BD] hover:text-[#E8EEF2]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-[#6E8492]">
            Loading historical observations...
          </div>
        ) : historyPoints.length >= 2 ? (
          <EChartWrapper option={ccuChartOption} height={340} />
        ) : (
          <div className="border border-dashed border-[#263844] rounded-xl p-8 text-center space-y-3 bg-[#101820]/40">
            <p className="text-sm font-semibold text-[#E8EEF2]">
              {isTracked
                ? historyPoints.length === 1
                  ? `History tracking started ${formatUtcTimestamp(historyPoints[0].timestamp)}`
                  : 'No observations recorded in this selected time window yet'
                : 'Historical timeline unavailable (Not yet tracked)'}
            </p>
            <p className="text-xs text-[#9BB0BD] max-w-lg mx-auto leading-relaxed">
              RoMetric never fabricates or backfills missing Roblox CCU history.
              {isTracked
                ? ` Current live point: ${formatExactNumber(game.currentCcu)} CCU. The timeline will plot automatically as subsequent scheduled or manual collection cycles run.`
                : ' Add this Universe ID in the Owner Admin Console to begin building a permanent, verifiable historical timeline.'}
            </p>
          </div>
        )}
      </section>

      {/* Transparent Revenue Estimation Module (Explicitly Experimental / Disabled) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
            About This Experience
          </h2>
          <p className="text-sm text-[#9BB0BD] leading-relaxed whitespace-pre-line">
            {game.description?.trim()
              ? game.description
              : 'No public description provided by Roblox for this experience.'}
          </p>
          <p className="text-xs text-[#6E8492] pt-2 border-t border-[#263844] tabular-nums">
            Last Roblox experience update:{' '}
            {game.robloxUpdatedAt
              ? formatUtcTimestamp(game.robloxUpdatedAt)
              : 'N/A'}{' '}
            · Data source: {game.dataSource}
          </p>
        </div>

        <div className="lg:col-span-5 bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
              Estimated Revenue
            </h2>
            <span className="text-xs font-medium text-amber-400">
              Experimental · Disabled
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#101820] border border-[#263844]">
              <p className="text-[#6E8492]">Estimated Range</p>
              <p className="mt-1 text-base font-semibold text-[#9BB0BD] tabular-nums">
                N/A
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#101820] border border-[#263844]">
              <p className="text-[#6E8492]">Confidence Level</p>
              <p className="mt-1 text-sm font-medium text-[#9BB0BD]">
                Unavailable
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-[#9BB0BD] leading-relaxed">
            <Info className="w-4 h-4 text-[#48D597] shrink-0 mt-0.5" />
            <p>
              Roblox does not expose actual developer earnings or ARPDAU publicly.
              In accordance with RoMetric&apos;s accuracy policy, revenue estimates
              remain disabled until validated opt-in monetization benchmarks are
              verified.{' '}
              <Link
                href="/methodology#revenue"
                className="text-[#48D597] hover:underline"
              >
                Read methodology
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
