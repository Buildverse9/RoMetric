'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Flame, TrendingUp } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import {
  evaluateTrending,
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
} from '@/lib/format';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';

export default function TrendingPage() {
  const { games, loadingGames, lastUpdatedAt } = useApp();

  const eligible = useMemo(() => {
    return games
      .filter((g) => g.active)
      .map((game) => ({ game, ev: evaluateTrending(game) }))
      .filter((item) => item.ev.eligible && item.ev.score !== null)
      .sort((a, b) => (b.ev.score ?? 0) - (a.ev.score ?? 0));
  }, [games]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Flame className="w-6 h-6 text-emerald-600 dark:text-[#10E89A]" />
          <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">
            Trending
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#6F8796] tabular-nums">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
          <span>Updated {formatRelativeTime(lastUpdatedAt)}</span>
        </div>
      </div>

      {loadingGames ? (
        <div className="liquid-glass rounded-3xl p-10 text-center text-sm text-slate-500 dark:text-[#6F8796]">
          Loading trending games...
        </div>
      ) : eligible.length > 0 ? (
        <div className="liquid-glass rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                  <th className="py-3.5 pl-5 pr-2 w-12">#</th>
                  <th className="py-3.5 px-3">Game</th>
                  <th className="py-3.5 px-3 text-right">Players</th>
                  <th className="py-3.5 px-3 text-right">Change</th>
                  <th className="py-3.5 pl-3 pr-5 text-right hidden sm:table-cell">
                    Gain
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
                {eligible.map(({ game, ev }, idx) => (
                  <tr
                    key={game.universeId}
                    className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="py-3.5 pl-5 pr-2 text-sm font-semibold text-slate-400 dark:text-[#6F8796] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-3">
                      <Link
                        href={`/games/${game.universeId}`}
                        className="flex items-center gap-3 min-w-0 group"
                      >
                        <GameArtwork
                          src={game.iconUrl}
                          alt={game.name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                            {game.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate">
                            {game.creatorName} · {game.genre}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5 px-3 text-right text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                      {formatCompactNumber(game.currentCcu)}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <GrowthValue value={ev.percentGain} />
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden sm:table-cell">
                      {ev.absoluteGain !== null
                        ? `${ev.absoluteGain >= 0 ? '+' : ''}${formatExactNumber(ev.absoluteGain)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="liquid-glass rounded-3xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/12 dark:bg-[#10E89A]/14 flex items-center justify-center mx-auto text-emerald-600 dark:text-[#10E89A]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
              No trending movers yet
            </h2>
            <p className="text-sm text-slate-500 dark:text-[#9CB3C0]">
              Trending updates automatically as player activity changes.
            </p>
          </div>
          <div className="pt-1">
            <Link
              href="/rankings"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity"
            >
              Browse Rankings
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
