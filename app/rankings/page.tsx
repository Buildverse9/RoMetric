'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock, Search } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { GameTable, type SortField } from '@/components/GameTable';
import {
  evaluateTrending,
  formatRelativeTime,
  formatUtcTimestamp,
} from '@/lib/format';

type RankingTab =
  | 'live_ccu'
  | 'growth_24h'
  | 'growth_7d'
  | 'visits'
  | 'peaks'
  | 'trending';

const RANKING_TABS: Array<{
  id: RankingTab;
  label: string;
  defaultSort: SortField;
  description: string;
}> = [
  {
    id: 'live_ccu',
    label: 'Live CCU',
    defaultSort: 'currentCcu',
    description: 'Ranked by active concurrent players right now.',
  },
  {
    id: 'growth_24h',
    label: '24h Growth',
    defaultSort: 'growth24h',
    description: 'Measured 24-hour player percentage change from stored snapshots.',
  },
  {
    id: 'growth_7d',
    label: '7d Growth',
    defaultSort: 'growth7d',
    description: 'Measured 7-day player percentage change across daily observations.',
  },
  {
    id: 'visits',
    label: 'Total Visits',
    defaultSort: 'totalVisits',
    description: 'Cumulative all-time Roblox visits reported by official public APIs.',
  },
  {
    id: 'peaks',
    label: 'Observed CCU Peaks',
    defaultSort: 'peakCcuObserved',
    description: 'Highest concurrent player count directly observed by RoMetric.',
  },
  {
    id: 'trending',
    label: 'Trending',
    defaultSort: 'currentCcu',
    description: 'Filtered for stability (>=50 CCU and >=2 snapshots).',
  },
];

function RankingsContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { games, loadingGames, lastUpdatedAt, dataMode } = useApp();

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
      const scored = list
        .map((game) => ({ game, ev: evaluateTrending(game) }))
        .filter((x) => x.ev.eligible)
        .sort((a, b) => (b.ev.score ?? 0) - (a.ev.score ?? 0))
        .map((x) => x.game);
      return scored;
    }

    return list;
  }, [games, genreFilter, searchTerm, activeTab]);

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-bold text-[#E8EEF2]">
            Roblox Game Rankings
          </h1>
          <p className="text-sm text-[#9BB0BD]">{activeConfig.description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#6E8492] tabular-nums">
          <Clock className="w-3.5 h-3.5 text-[#48D597]" />
          <span>
            {dataMode === 'persisted' ? 'Stored snapshot' : 'Live observation'} ·{' '}
            {formatRelativeTime(lastUpdatedAt)} ({formatUtcTimestamp(lastUpdatedAt)})
          </span>
        </div>
      </div>

      {/* Category Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#162229] border border-[#263844] rounded-lg w-fit">
        {RANKING_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#48D597] text-[#101820] font-semibold'
                : 'text-[#9BB0BD] hover:text-[#E8EEF2] hover:bg-[#1C2A32]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#6E8492] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by game title, developer, genre, or Universe ID..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#1C2A32] border border-[#263844] rounded-lg text-[#E8EEF2] placeholder:text-[#6E8492] focus:outline-none focus:border-[#48D597]"
          />
        </div>

        <select
          aria-label="Filter by genre"
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm bg-[#1C2A32] border border-[#263844] rounded-lg text-[#E8EEF2] focus:outline-none focus:border-[#48D597]"
        >
          {genres.map((g) => (
            <option key={g} value={g} className="bg-[#1C2A32]">
              {g === 'All' ? 'All Genres' : g}
            </option>
          ))}
        </select>
      </div>

      <GameTable
        key={activeTab}
        games={filteredGames}
        defaultSort={activeConfig.defaultSort}
        pageSize={20}
        loading={loadingGames}
        emptyMessage={
          activeTab === 'trending'
            ? 'Trending requires at least 2 persisted historical snapshots and >= 50 CCU. Run a second collection cycle in the Admin Console to populate measured Trending rankings.'
            : 'No games match your search or genre filter.'
        }
      />
    </div>
  );
}

export default function RankingsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-10 text-sm text-[#6E8492]">
          Loading rankings...
        </div>
      }
    >
      <RankingsContent />
    </Suspense>
  );
}
