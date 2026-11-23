'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
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
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import { GameArtwork } from './GameArtwork';
import { APPLE_EASE, APPLE_SPRING, LiquidGlassCard } from './MotionPrimitives';

export type SortField =
  | 'currentCcu'
  | 'estMonthlyRevenue'
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
      <span className="text-xs text-slate-400 dark:text-[#6F8796] tabular-nums">
        —
      </span>
    );
  }
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${
        positive
          ? 'text-emerald-600 dark:text-[#10E89A]'
          : negative
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-slate-500 dark:text-[#9CB3C0]'
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
  emptyMessage = 'No games found.',
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

  const revenueById = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of games) {
      map.set(g.universeId, estimateGameRevenue(g).monthlyUsd);
    }
    return map;
  }, [games]);

  const sorted = useMemo(() => {
    return [...games].sort((a, b) => {
      const av =
        sortField === 'estMonthlyRevenue'
          ? (revenueById.get(a.universeId) ?? 0)
          : a[sortField];
      const bv =
        sortField === 'estMonthlyRevenue'
          ? (revenueById.get(b.universeId) ?? 0)
          : b[sortField];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) return b.currentCcu - a.currentCcu;
      if (aNull) return 1;
      if (bNull) return -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [games, sortField, sortDir, revenueById]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  if (loading) {
    return (
      <div className="liquid-glass rounded-3xl overflow-hidden">
        <div className="divide-y divide-slate-900/6 dark:divide-white/8">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="px-5 py-4 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                <div className="w-10 h-10 bg-slate-900/10 dark:bg-white/10 rounded-xl" />
                <div className="space-y-1.5">
                  <div className="w-40 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                  <div className="w-24 h-3 bg-slate-900/6 dark:bg-white/6 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-16 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
                <div className="hidden sm:block w-16 h-4 bg-slate-900/10 dark:bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="liquid-glass rounded-3xl p-12 text-center">
        <p className="text-sm text-slate-600 dark:text-[#9CB3C0]">
          {emptyMessage}
        </p>
      </div>
    );
  }

  const renderSortHeader = (label: string, field: SortField) => {
    const active = sortField === field;
    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => handleSort(field)}
        className={`inline-flex items-center justify-end gap-1 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
          active
            ? 'text-emerald-600 dark:text-[#10E89A]'
            : 'text-slate-500 dark:text-[#9CB3C0] hover:text-slate-900 dark:hover:text-white'
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
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        )}
      </motion.button>
    );
  };

  return (
    <LiquidGlassCard
      exportTitle="Roblox Game Rankings"
      className="rounded-3xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
              <th className="py-3.5 pl-5 pr-2 text-xs font-medium text-slate-500 dark:text-[#6F8796] w-12">
                #
              </th>
              <th className="py-3.5 px-3 text-xs font-medium text-slate-500 dark:text-[#9CB3C0] min-w-[230px]">
                Game
              </th>
              <th className="py-3.5 px-3 text-right">
                {renderSortHeader('Players', 'currentCcu')}
              </th>
              <th className="py-3.5 px-3 text-right">
                {renderSortHeader('Est. Rev / mo', 'estMonthlyRevenue')}
              </th>
              <th className="py-3.5 px-3 text-right pr-12 sm:pr-3">
                {renderSortHeader('24h', 'growth24h')}
              </th>
              <th className="py-3.5 px-3 text-right hidden lg:table-cell">
                {renderSortHeader('7d', 'growth7d')}
              </th>
              <th className="py-3.5 px-3 text-right hidden sm:table-cell">
                {renderSortHeader('Visits', 'totalVisits')}
              </th>
              <th className="py-3.5 px-3 text-right hidden md:table-cell">
                {renderSortHeader('Rating', 'likeRatio')}
              </th>
              <th className="py-3.5 px-3 text-right hidden xl:table-cell">
                {renderSortHeader('Peak', 'peakCcuObserved')}
              </th>
              <th className="py-3.5 pl-3 pr-12 text-right text-xs font-medium text-slate-500 dark:text-[#6F8796] hidden xl:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
            {pageItems.map((game, idx) => {
              const rank = (safePage - 1) * pageSize + idx + 1;
              const estMonthly = revenueById.get(game.universeId) ?? 0;
              return (
                <motion.tr
                  key={game.universeId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.24,
                    delay: Math.min(idx * 0.02, 0.24),
                    ease: APPLE_EASE,
                  }}
                  className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group"
                >
                  <td className="py-3.5 pl-5 pr-2 text-sm text-slate-500 dark:text-[#6F8796] tabular-nums font-medium">
                    {rank}
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Link
                        href={`/games/${game.universeId}`}
                        className="shrink-0 group-hover:scale-105 transition-transform duration-200"
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
                            className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors truncate max-w-[200px] sm:max-w-[260px]"
                          >
                            {game.name}
                          </Link>
                          <Link
                            href={`/compare?ids=${game.universeId}`}
                            title="Compare"
                            className="text-slate-400 dark:text-[#6F8796] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors shrink-0"
                          >
                            <GitCompare className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate">
                          <Link
                            href={`/developers/${game.creatorId}`}
                            className="hover:text-slate-900 dark:hover:text-[#9CB3C0] transition-colors"
                          >
                            {game.creatorName}
                          </Link>
                          <span aria-hidden="true"> · </span>
                          <span>{game.genre}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                    {formatCompactNumber(game.currentCcu)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums whitespace-nowrap">
                    {formatCurrencyCompact(estMonthly)}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <GrowthValue value={game.growth24h ?? game.growth1h} />
                  </td>
                  <td className="py-3.5 px-3 text-right hidden lg:table-cell">
                    <GrowthValue value={game.growth7d} />
                  </td>
                  <td className="py-3.5 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden sm:table-cell">
                    {formatCompactNumber(game.totalVisits)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden md:table-cell">
                    {game.likeRatio !== null && game.likeRatio !== undefined
                      ? `${game.likeRatio.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden xl:table-cell">
                    {formatCompactNumber(game.peakCcuObserved)}
                  </td>
                  <td className="py-3.5 pl-3 pr-5 text-right text-xs text-slate-500 dark:text-[#6F8796] tabular-nums hidden xl:table-cell whitespace-nowrap">
                    {formatRelativeTime(game.lastCollectedAt)}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-5 py-3.5 border-t border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs text-slate-500 dark:text-[#9CB3C0]">
        <span className="tabular-nums">
          {(safePage - 1) * pageSize + 1}–
          {Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              transition={APPLE_SPRING}
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-full border border-slate-900/10 dark:border-white/12 text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
            <span className="px-2 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              transition={APPLE_SPRING}
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-full border border-slate-900/10 dark:border-white/12 text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>
    </LiquidGlassCard>
  );
}
