'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, Search } from 'lucide-react';
import {
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
} from '@/lib/format';
import { extractUpdateBadgeText } from '@/lib/market-intelligence';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

type TimeWindow = '24h' | '7d' | '30d' | 'all';

const WINDOWS: Array<{ id: TimeWindow; label: string; ms: number }> = [
  { id: '24h', label: 'Last 24h', ms: 24 * 3_600_000 },
  { id: '7d', label: '7 Days', ms: 7 * 86_400_000 },
  { id: '30d', label: '30 Days', ms: 30 * 86_400_000 },
  { id: 'all', label: 'All Updates', ms: Number.MAX_SAFE_INTEGER },
];

export function UpdatesFeedClient({
  games,
  referenceNowMs,
}: {
  games: GameRecordData[];
  referenceNowMs: number;
}) {
  const [windowId, setWindowId] = useState<TimeWindow>('7d');
  const [query, setQuery] = useState('');
  const [minCcu, setMinCcu] = useState<number>(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const maxAgeMs =
      WINDOWS.find((w) => w.id === windowId)?.ms ?? Number.MAX_SAFE_INTEGER;

    return games.filter((g) => {
      if (!g.robloxUpdatedAt) return false;
      const updatedMs = new Date(g.robloxUpdatedAt).getTime();
      if (!Number.isFinite(updatedMs)) return false;
      if (windowId !== 'all' && referenceNowMs - updatedMs > maxAgeMs) {
        return false;
      }
      if (g.currentCcu < minCcu) return false;
      if (
        q &&
        !g.name.toLowerCase().includes(q) &&
        !g.creatorName.toLowerCase().includes(q) &&
        !g.genre.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [games, windowId, query, minCcu, referenceNowMs]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#6F8796] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter updated games, studios, or genres..."
            className="w-full pl-10 pr-4 py-2 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 liquid-glass-pill rounded-full">
            {WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWindowId(w.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                  windowId === w.id
                    ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                    : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMinCcu((prev) => (prev === 0 ? 1000 : 0))}
            className={`px-3.5 py-2 text-xs font-semibold rounded-full border transition-colors cursor-pointer whitespace-nowrap ${
              minCcu > 0
                ? 'bg-emerald-600/15 dark:bg-[#10E89A]/15 border-emerald-500/40 text-emerald-700 dark:text-[#10E89A]'
                : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            {minCcu > 0 ? '1K+ CCU Only' : 'All Sizes'}
          </button>
        </div>
      </div>

      <LiquidGlassCard
        exportTitle="Recently Updated Roblox Games"
        className="rounded-3xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                <th className="py-3.5 pl-5 pr-3">Experience</th>
                <th className="py-3.5 px-3">Updated</th>
                <th className="py-3.5 px-3 text-right">Live CCU</th>
                <th className="py-3.5 px-3 text-right hidden sm:table-cell">24h Delta</th>
                <th className="py-3.5 px-3 text-right hidden md:table-cell">Visits</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
              {filtered.slice(0, 120).map((game) => {
                const tag = extractUpdateBadgeText(game.name);
                return (
                  <tr
                    key={game.universeId}
                    className="hover:bg-black/[0.025] dark:hover:bg-white/[0.035] transition-colors group"
                  >
                    <td className="py-3 pl-5 pr-3">
                      <Link
                        href={`/games/${game.universeId}/updates`}
                        className="flex items-center gap-3 min-w-0"
                      >
                        <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate max-w-[260px] sm:max-w-[380px]">
                            {game.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate">
                            {game.creatorName} · {game.genre}
                            {tag ? ` · ${tag}` : ''}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600 dark:text-[#9CB3C0] whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A] shrink-0" />
                        {game.robloxUpdatedAt
                          ? formatRelativeTime(game.robloxUpdatedAt)
                          : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-sm font-semibold text-slate-950 dark:text-white tabular-nums">
                      {formatExactNumber(game.currentCcu)}
                    </td>
                    <td className="py-3 px-3 text-right hidden sm:table-cell">
                      <GrowthValue value={game.growth24h} />
                    </td>
                    <td className="py-3 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden md:table-cell">
                      {formatCompactNumber(game.totalVisits)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right text-xs font-medium whitespace-nowrap">
                      <Link
                        href={`/games/${game.universeId}/updates`}
                        className="text-emerald-600 dark:text-[#10E89A] hover:underline"
                      >
                        View Log
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-slate-500 dark:text-[#7893A3]"
                  >
                    No recently updated games matched your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
