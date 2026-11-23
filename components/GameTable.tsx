'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  GitCompare,
} from 'lucide-react';
import type { GameRecordData } from '@/lib/types';
import {
  formatCompactNumber,
  formatPercent,
  formatRelativeTime,
} from '@/lib/format';
import { GameArtwork } from './GameArtwork';

export type SortField =
  | 'currentCcu'
  | 'growth24h'
  | 'growth7d'
  | 'totalVisits'
  | 'favorites'
  | 'likeRatio'
  | 'peakCcuObserved';

interface GameTableProps {
  games: GameRecordData[];
  defaultSort?: SortField;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
}

export function GrowthValue({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span
        title="Requires historical snapshots spanning this time window"
        className="text-xs text-[#6E8492] tabular-nums"
      >
        N/A
      </span>
    );
  }
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-sm font-medium tabular-nums ${
        positive
          ? 'text-[#48D597]'
          : negative
            ? 'text-rose-400'
            : 'text-[#9BB0BD]'
      }`}
    >
      {positive && <ArrowUp className="w-3.5 h-3.5" />}
      {negative && <ArrowDown className="w-3.5 h-3.5" />}
      {formatPercent(value)}
    </span>
  );
}

export function GameTable({
  games,
  defaultSort = 'currentCcu',
  pageSize = 15,
  loading = false,
  emptyMessage = 'No games match the current filters.',
}: GameTableProps) {
  const [sortField, setSortField] = useState<SortField>(defaultSort);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    return [...games].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) return b.currentCcu - a.currentCcu;
      if (aNull) return 1;
      if (bNull) return -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [games, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  if (loading) {
    return (
      <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden">
        <div className="divide-y divide-[#263844]/70">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="px-4 py-3.5 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-4 bg-[#263844] rounded" />
                <div className="w-10 h-10 bg-[#263844] rounded-lg" />
                <div className="space-y-1.5">
                  <div className="w-40 h-4 bg-[#263844] rounded" />
                  <div className="w-28 h-3 bg-[#263844]/70 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-16 h-4 bg-[#263844] rounded" />
                <div className="hidden sm:block w-16 h-4 bg-[#263844] rounded" />
                <div className="hidden md:block w-16 h-4 bg-[#263844] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-12 text-center">
        <p className="text-sm text-[#9BB0BD]">{emptyMessage}</p>
      </div>
    );
  }

  const renderSortHeader = (label: string, field: SortField) => {
    const active = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center justify-end gap-1 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
          active ? 'text-[#48D597]' : 'text-[#9BB0BD] hover:text-[#E8EEF2]'
        }`}
      >
        <span>{label}</span>
        {active ? (
          sortDir === 'desc' ? (
            <ArrowDown className="w-3.5 h-3.5" />
          ) : (
            <ArrowUp className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-60" />
        )}
      </button>
    );
  };

  return (
    <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#263844] bg-[#162229]">
              <th className="py-3 pl-4 pr-2 text-xs font-medium text-[#6E8492] w-12">
                #
              </th>
              <th className="py-3 px-3 text-xs font-medium text-[#9BB0BD] min-w-[240px]">
                Experience
              </th>
              <th className="py-3 px-3 text-right">
                {renderSortHeader('Live CCU', 'currentCcu')}
              </th>
              <th className="py-3 px-3 text-right">
                {renderSortHeader('24h Growth', 'growth24h')}
              </th>
              <th className="py-3 px-3 text-right hidden lg:table-cell">
                {renderSortHeader('7d Growth', 'growth7d')}
              </th>
              <th className="py-3 px-3 text-right hidden sm:table-cell">
                {renderSortHeader('Total Visits', 'totalVisits')}
              </th>
              <th className="py-3 px-3 text-right hidden md:table-cell">
                {renderSortHeader('Like Ratio', 'likeRatio')}
              </th>
              <th className="py-3 px-3 text-right hidden xl:table-cell">
                {renderSortHeader('Observed Peak', 'peakCcuObserved')}
              </th>
              <th className="py-3 pl-3 pr-4 text-right text-xs font-medium text-[#6E8492] hidden xl:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#263844]/60">
            {pageItems.map((game, idx) => {
              const rank = (safePage - 1) * pageSize + idx + 1;
              return (
                <tr
                  key={game.universeId}
                  className="hover:bg-[#22333D]/70 transition-colors"
                >
                  <td className="py-3 pl-4 pr-2 text-sm text-[#6E8492] tabular-nums font-medium">
                    {rank}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Link
                        href={`/games/${game.universeId}`}
                        className="shrink-0"
                      >
                        <GameArtwork
                          src={game.iconUrl}
                          alt={game.name}
                          size="sm"
                        />
                      </Link>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/games/${game.universeId}`}
                            className="text-sm font-semibold text-[#E8EEF2] hover:text-[#48D597] transition-colors truncate max-w-[220px] sm:max-w-[280px]"
                          >
                            {game.name}
                          </Link>
                          <Link
                            href={`/compare?ids=${game.universeId}`}
                            title="Compare this game"
                            className="text-[#6E8492] hover:text-[#48D597] transition-colors shrink-0"
                          >
                            <GitCompare className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                        <p className="text-xs text-[#6E8492] truncate">
                          <Link
                            href={`/developers/${game.creatorId}`}
                            className="hover:text-[#9BB0BD] transition-colors"
                          >
                            {game.creatorName}
                          </Link>
                          <span aria-hidden="true"> · </span>
                          <span>{game.genre}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-semibold text-[#E8EEF2] tabular-nums">
                    {formatCompactNumber(game.currentCcu)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <GrowthValue value={game.growth24h ?? game.growth1h} />
                  </td>
                  <td className="py-3 px-3 text-right hidden lg:table-cell">
                    <GrowthValue value={game.growth7d} />
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-[#9BB0BD] tabular-nums hidden sm:table-cell">
                    {formatCompactNumber(game.totalVisits)}
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-[#9BB0BD] tabular-nums hidden md:table-cell">
                    {game.likeRatio !== null && game.likeRatio !== undefined
                      ? `${game.likeRatio.toFixed(1)}%`
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-[#9BB0BD] tabular-nums hidden xl:table-cell">
                    {formatCompactNumber(game.peakCcuObserved)}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right text-xs text-[#6E8492] tabular-nums hidden xl:table-cell whitespace-nowrap">
                    {formatRelativeTime(game.lastCollectedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-[#263844] bg-[#162229] flex items-center justify-between text-xs text-[#9BB0BD]">
        <span className="tabular-nums">
          Showing {(safePage - 1) * pageSize + 1}–
          {Math.min(safePage * pageSize, sorted.length)} of {sorted.length}{' '}
          experiences
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-[#263844] text-[#9BB0BD] hover:text-[#E8EEF2] hover:bg-[#22333D] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-[#263844] text-[#9BB0BD] hover:text-[#E8EEF2] hover:bg-[#22333D] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
