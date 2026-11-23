'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Coins,
  Flame,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import type {
  RobloxChartGameEntry,
  RobloxOfficialChartColumn,
  RobloxOfficialChartsResponse,
} from '@/app/api/roblox/charts/route';
import { evaluateBreakoutGames, formatCompactNumber } from '@/lib/format';
import { estimateGameRevenue } from '@/lib/revenue';
import type { GameRecordData } from '@/lib/types';
import { GameArtwork } from './GameArtwork';
import { APPLE_EASE, FadeInSection, LiquidGlassCard } from './MotionPrimitives';

const CHART_META: Record<
  RobloxOfficialChartColumn['id'],
  {
    title: string;
    subtitle: string;
    robloxUrl: string;
    icon: React.ComponentType<{ className?: string }>;
    accentText: string;
  }
> = {
  'top-trending': {
    title: 'Top Trending',
    subtitle: 'Fastest rising globally',
    robloxUrl: 'https://www.roblox.com/charts/top-trending',
    icon: Flame,
    accentText: 'text-emerald-600 dark:text-[#10E89A]',
  },
  'up-and-coming': {
    title: 'Up-and-Coming',
    subtitle: 'Emerging hits on Roblox',
    robloxUrl: 'https://www.roblox.com/charts/up-and-coming',
    icon: Sparkles,
    accentText: 'text-sky-600 dark:text-sky-400',
  },
  'top-earning': {
    title: 'Top Earning',
    subtitle: 'Highest grossing experiences',
    robloxUrl: 'https://www.roblox.com/charts/top-earning',
    icon: Coins,
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  'fun-with-friends': {
    title: 'Fun with Friends',
    subtitle: 'Top social & group play',
    robloxUrl: 'https://www.roblox.com/charts/fun-with-friends',
    icon: Users,
    accentText: 'text-violet-600 dark:text-violet-400',
  },
};

const CHART_ORDER: Array<RobloxOfficialChartColumn['id']> = [
  'top-trending',
  'up-and-coming',
  'top-earning',
  'fun-with-friends',
];

function toEntry(g: GameRecordData, rank: number): RobloxChartGameEntry {
  return {
    rank,
    universeId: g.universeId,
    rootPlaceId: g.rootPlaceId,
    name: g.name,
    creatorName: g.creatorName,
    currentCcu: g.currentCcu,
    likeRatio: g.likeRatio ?? null,
    iconUrl: g.iconUrl ?? null,
  };
}

export function HomeChartsCard({
  games,
  loading,
}: {
  games: GameRecordData[];
  loading: boolean;
}) {
  const [liveCharts, setLiveCharts] = useState<RobloxOfficialChartColumn[] | null>(
    null
  );
  const [fetchingCharts, setFetchingCharts] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadOfficialCharts() {
      setFetchingCharts(true);
      try {
        const res = await fetch('/api/roblox/charts');
        if (res.ok && !cancelled) {
          const data = (await res.json()) as RobloxOfficialChartsResponse;
          if (Array.isArray(data.charts) && data.charts.length > 0) {
            setLiveCharts(data.charts);
          }
        }
      } catch {
        // Fallback smoothly to tracked catalog slices below
      } finally {
        if (!cancelled) setFetchingCharts(false);
      }
    }
    void loadOfficialCharts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build guaranteed 4-column dataset using live Roblox Explore Charts first, with smart catalog fallbacks
  const columns = useMemo<RobloxOfficialChartColumn[]>(() => {
    const byId = new Map<RobloxOfficialChartColumn['id'], RobloxChartGameEntry[]>();
    if (liveCharts) {
      for (const col of liveCharts) {
        if (col.games.length > 0) {
          byId.set(col.id, col.games.slice(0, 5));
        }
      }
    }

    const active = games.filter((g) => g.active);

    const fallbackFor = (
      id: RobloxOfficialChartColumn['id']
    ): RobloxChartGameEntry[] => {
      if (active.length === 0) return [];
      if (id === 'top-trending') {
        return [...active]
          .sort(
            (a, b) =>
              (b.growth24h ?? b.growth1h ?? -999) -
                (a.growth24h ?? a.growth1h ?? -999) ||
              b.currentCcu - a.currentCcu
          )
          .slice(0, 5)
          .map((g, i) => toEntry(g, i + 1));
      }
      if (id === 'up-and-coming') {
        const breakouts = evaluateBreakoutGames(active, 5).map((b) => b.game);
        const list = breakouts.length >= 3 ? breakouts : active.slice(5, 10);
        return list.slice(0, 5).map((g, i) => toEntry(g, i + 1));
      }
      if (id === 'top-earning') {
        return [...active]
          .sort(
            (a, b) =>
              estimateGameRevenue(b).monthlyUsd -
              estimateGameRevenue(a).monthlyUsd
          )
          .slice(0, 5)
          .map((g, i) => toEntry(g, i + 1));
      }
      // fun-with-friends: prioritize high-rating social/party/roleplay/high-CCU experiences
      return [...active]
        .sort((a, b) => {
          const aSocial = /social|party|roleplay|casual|hangout|friends/i.test(
            `${a.genre} ${a.name}`
          )
            ? 1
            : 0;
          const bSocial = /social|party|roleplay|casual|hangout|friends/i.test(
            `${b.genre} ${b.name}`
          )
            ? 1
            : 0;
          if (bSocial !== aSocial) return bSocial - aSocial;
          return (b.likeRatio ?? 0) - (a.likeRatio ?? 0) || b.currentCcu - a.currentCcu;
        })
        .slice(0, 5)
        .map((g, i) => toEntry(g, i + 1));
    };

    return CHART_ORDER.map((id) => {
      const meta = CHART_META[id];
      const entries = byId.get(id);
      return {
        id,
        title: meta.title,
        robloxUrl: meta.robloxUrl,
        games: entries && entries.length > 0 ? entries : fallbackFor(id),
      };
    });
  }, [liveCharts, games]);

  const showSkeleton = (loading && games.length === 0) || (fetchingCharts && columns.every((c) => c.games.length === 0));

  return (
    <FadeInSection>
      <LiquidGlassCard
        variant="hero"
        exportTitle="Roblox Official Charts"
        className="rounded-[28px] overflow-hidden"
      >
        {/* Unified Charts Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 pr-12 border-b border-slate-900/6 dark:border-white/8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/12 dark:bg-[#10E89A]/15 border border-emerald-500/25 dark:border-[#10E89A]/25 flex items-center justify-center text-emerald-600 dark:text-[#10E89A]">
              <Trophy className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white leading-tight">
                Roblox Charts
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#7E98A8]">
                Live official rankings across Top Trending, Up-and-Coming, Top
                Earning &amp; Fun with Friends
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2">
            <span className="relative w-5 h-5 rounded-md overflow-hidden bg-[#091318] ring-1 ring-emerald-500/30 shrink-0">
              <Image
                src="/assets/aistudio/logoofrometric_7c92ca67.png"
                alt="RoMetric"
                fill
                sizes="20px"
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </span>
            <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-[#E2EEF4]">
              Ro<span className="text-emerald-600 dark:text-[#10E89A]">Metric</span>
            </span>
          </div>
        </div>

        {/* 4 Official Roblox Charts Inside One Unified Card (No Graphs) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 xl:divide-x divide-slate-900/6 dark:divide-white/8">
          {columns.map((col, colIdx) => {
            const meta = CHART_META[col.id];
            const Icon = meta.icon;

            return (
              <div
                key={col.id}
                className={`p-5 flex flex-col justify-between gap-3 ${
                  colIdx === 2 || colIdx === 3
                    ? 'md:border-t xl:border-t-0 border-slate-900/6 dark:border-white/8'
                    : ''
                } ${
                  colIdx % 2 === 1
                    ? 'md:border-l xl:border-l-0 border-slate-900/6 dark:border-white/8'
                    : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Column Header */}
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-900/6 dark:border-white/8">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 shrink-0 ${meta.accentText}`} />
                        <h3 className="font-display text-sm font-bold text-slate-950 dark:text-white truncate">
                          {col.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#6F8796] mt-0.5">
                        {meta.subtitle}
                      </p>
                    </div>
                    <a
                      href={col.robloxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${col.title} on Roblox`}
                      className="p-1.5 rounded-full text-slate-400 dark:text-[#6F8796] hover:text-emerald-600 dark:hover:text-[#10E89A] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors shrink-0"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Top 5 Ranked Games List */}
                  <div className="space-y-1">
                    {showSkeleton
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className="py-2 flex items-center justify-between gap-2.5 animate-pulse"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-4 h-3.5 bg-slate-900/10 dark:bg-white/10 rounded" />
                              <div className="w-9 h-9 bg-slate-900/10 dark:bg-white/10 rounded-xl" />
                              <div className="space-y-1.5">
                                <div className="w-24 h-3.5 bg-slate-900/10 dark:bg-white/10 rounded" />
                                <div className="w-16 h-2.5 bg-slate-900/6 dark:bg-white/6 rounded" />
                              </div>
                            </div>
                          </div>
                        ))
                      : col.games.map((item, idx) => (
                          <motion.div
                            key={`${col.id}-${item.universeId}`}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.24,
                              delay: colIdx * 0.04 + idx * 0.025,
                              ease: APPLE_EASE,
                            }}
                          >
                            <Link
                              href={`/games/${item.universeId}`}
                              className="py-2 -mx-2 px-2 rounded-2xl flex items-center justify-between gap-2.5 hover:bg-black/[0.035] dark:hover:bg-white/[0.05] transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-4 text-xs font-bold tabular-nums text-center shrink-0 ${
                                    idx === 0
                                      ? meta.accentText
                                      : 'text-slate-400 dark:text-[#6F8796]'
                                  }`}
                                >
                                  {item.rank}
                                </span>
                                <div className="group-hover:scale-105 transition-transform duration-200 shrink-0">
                                  <GameArtwork
                                    src={item.iconUrl}
                                    alt={item.name}
                                    size="sm"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                                    {item.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-[#7E98A8] truncate">
                                    {item.creatorName}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right shrink-0 tabular-nums">
                                <p className="text-xs font-bold text-slate-900 dark:text-[#F1F7FA]">
                                  {formatCompactNumber(item.currentCcu)}
                                </p>
                                {item.likeRatio !== null && (
                                  <p className="text-[10px] text-slate-500 dark:text-[#6F8796]">
                                    {item.likeRatio.toFixed(0)}%
                                  </p>
                                )}
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                  </div>
                </div>

                {/* Subtle Roblox Source Link */}
                <a
                  href={col.robloxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pt-2 border-t border-slate-900/5 dark:border-white/6 inline-flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-[#7E98A8] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
                >
                  <span>View on Roblox</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            );
          })}
        </div>
      </LiquidGlassCard>
    </FadeInSection>
  );
}
