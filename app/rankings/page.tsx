'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Clock, Search } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { GameTable, type SortField } from '@/components/GameTable';
import { evaluateTrending, formatRelativeTime } from '@/lib/format';
import { APPLE_SPRING } from '@/components/MotionPrimitives';

type RankingTab =
  | 'live_ccu'
  | 'revenue'
  | 'growth_24h'
  | 'growth_7d'
  | 'visits'
  | 'peaks'
  | 'trending';

const RANKING_TABS: Array<{
  id: RankingTab;
  label: string;
  defaultSort: SortField;
}> = [
  { id: 'live_ccu', label: 'Players', defaultSort: 'currentCcu' },
  { id: 'revenue', label: 'Est. Revenue', defaultSort: 'estMonthlyRevenue' },
  { id: 'growth_24h', label: '24h', defaultSort: 'growth24h' },
  { id: 'growth_7d', label: '7d', defaultSort: 'growth7d' },
  { id: 'visits', label: 'Visits', defaultSort: 'totalVisits' },
  { id: 'peaks', label: 'Peaks', defaultSort: 'peakCcuObserved' },
  { id: 'trending', label: 'Trending', defaultSort: 'currentCcu' },
];

function RankingsContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { games, loadingGames, lastUpdatedAt } = useApp();

  const [activeTab, setActiveTab] = useState<RankingTab>('live_ccu');
  const [genreFilter, setGenreFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState(initialQuery);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const g of games) {
      if (g.active && g.genre) set.add(g.genre);
    }
    return ['All', ...Array.from(set).sort()];
  }, [games]);

  const activeConfig =
    RANKING_TABS.find((t) => t.id === activeTab) ?? RANKING_TABS[0];

  const filteredGames = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = games.filter((g) => g.active);

    if (genreFilter !== 'All') {
      list = list.filter((g) => g.genre === genreFilter);
    }

    if (q) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.creatorName.toLowerCase().includes(q) ||
          g.universeId.includes(q) ||
          g.genre.toLowerCase().includes(q)
      );
    }

    if (activeTab === 'trending') {
      return list
        .map((game) => ({ game, ev: evaluateTrending(game) }))
        .filter((x) => x.ev.eligible)
        .sort((a, b) => (b.ev.score ?? 0) - (a.ev.score ?? 0))
        .map((x) => x.game);
    }

    return list;
  }, [games, genreFilter, searchTerm, activeTab]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">
          Rankings
        </h1>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#6F8796] tabular-nums">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
          <span>Updated {formatRelativeTime(lastUpdatedAt)}</span>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 liquid-glass-pill rounded-full w-fit">
          {RANKING_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'text-white dark:text-[#04130D]'
                    : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="rankings-tab-pill"
                    transition={APPLE_SPRING}
                    className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-[#10E89A] -z-10"
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#6F8796] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter games..."
              className="w-full pl-10 pr-4 py-2 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <select
            aria-label="Filter by genre"
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="px-4 py-2 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
          >
            {genres.map((g) => (
              <option
                key={g}
                value={g}
                className="bg-white dark:bg-[#0D1A22] text-slate-900 dark:text-[#F1F7FA]"
              >
                {g === 'All' ? 'All Genres' : g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <GameTable
        key={activeTab}
        games={filteredGames}
        defaultSort={activeConfig.defaultSort}
        pageSize={25}
        loading={loadingGames}
        emptyMessage="No games match your filters."
      />
    </div>
  );
}

export default function RankingsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 text-sm text-slate-500 dark:text-[#6F8796]">
          Loading rankings...
        </div>
      }
    >
      <RankingsContent />
    </Suspense>
  );
}
