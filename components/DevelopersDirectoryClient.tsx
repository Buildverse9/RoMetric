'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Search, ShieldCheck, Users } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import {
  estimatePortfolioMonthlyRevenue,
  formatCurrencyCompact,
} from '@/lib/revenue';
import type { DeveloperSummary } from '@/lib/types';
import { GameArtwork } from '@/components/GameArtwork';
import {
  APPLE_EASE,
  APPLE_SPRING,
  LiquidGlassCard,
} from '@/components/MotionPrimitives';

interface DevelopersDirectoryClientProps {
  initialDevelopers: DeveloperSummary[];
}

export function DevelopersDirectoryClient({
  initialDevelopers,
}: DevelopersDirectoryClientProps) {
  const { developers: liveDevelopers, loadingGames } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Group' | 'User'>('All');

  const developers =
    liveDevelopers.length > 0 ? liveDevelopers : initialDevelopers;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return developers.filter((d) => {
      if (typeFilter !== 'All' && d.creatorType !== typeFilter) return false;
      if (
        q &&
        !d.creatorName.toLowerCase().includes(q) &&
        !d.creatorId.includes(q) &&
        !d.topGame.name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [developers, search, typeFilter]);

  const totalCombinedCcu = useMemo(
    () => developers.reduce((sum, d) => sum + d.combinedCcu, 0),
    [developers]
  );

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-6 space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white tracking-tight">
          Roblox Developers &amp; Studios
        </h1>
        <p className="text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums">
          {formatExactNumber(developers.length)} tracked studios &amp; creators ·{' '}
          {formatCompactNumber(totalCombinedCcu)} combined live players
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#6F8796] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search studios, creators, or top games..."
            className="w-full pl-10 pr-4 py-2 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="flex items-center gap-1 p-1 liquid-glass-pill rounded-full w-fit">
          {(['All', 'Group', 'User'] as const).map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-full cursor-pointer transition-colors ${
                  active
                    ? 'text-white dark:text-[#04130D]'
                    : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="dev-type-pill"
                    transition={APPLE_SPRING}
                    className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-[#10E89A] -z-10"
                  />
                )}
                {t === 'All' ? 'All' : `${t}s`}
              </button>
            );
          })}
        </div>
      </div>

      {loadingGames && developers.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-10 text-center text-sm text-slate-500 dark:text-[#6F8796]">
          Loading developers...
        </div>
      ) : (
        <LiquidGlassCard
          exportTitle="Top Roblox Developers"
          className="rounded-3xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                  <th className="py-3.5 pl-5 pr-2 w-12">#</th>
                  <th className="py-3.5 px-3">Studio / Developer</th>
                  <th className="py-3.5 px-3 text-right">Players</th>
                  <th className="py-3.5 px-3 text-right pr-12 md:pr-3">
                    Est. Rev / mo
                  </th>
                  <th className="py-3.5 px-3 text-right hidden sm:table-cell">
                    Visits
                  </th>
                  <th className="py-3.5 px-3 text-right hidden md:table-cell">
                    Games
                  </th>
                  <th className="py-3.5 px-3 text-right hidden lg:table-cell">
                    Rating
                  </th>
                  <th className="py-3.5 pl-3 pr-12 hidden md:table-cell">
                    Top Game
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
                {filtered.slice(0, 200).map((dev, idx) => {
                  const estRev = estimatePortfolioMonthlyRevenue(dev.games);
                  return (
                    <motion.tr
                      key={`${dev.creatorType}_${dev.creatorId}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.24,
                        delay: Math.min(idx * 0.015, 0.2),
                        ease: APPLE_EASE,
                      }}
                      className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group"
                    >
                      <td className="py-3.5 pl-5 pr-2 text-sm text-slate-400 dark:text-[#6F8796] tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-3">
                        <Link
                          href={`/developers/${dev.creatorId}`}
                          className="flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/12 dark:bg-[#10E89A]/14 flex items-center justify-center text-emerald-600 dark:text-[#10E89A] shrink-0 group-hover:scale-105 transition-transform">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                                {dev.creatorName}
                              </span>
                              {dev.creatorVerified && (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A] shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-[#6F8796]">
                              {dev.creatorType}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3.5 px-3 text-right text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                        {formatExactNumber(dev.combinedCcu)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums whitespace-nowrap">
                        {formatCurrencyCompact(estRev)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden sm:table-cell">
                        {formatCompactNumber(dev.totalVisits)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-sm text-slate-900 dark:text-[#F1F7FA] tabular-nums hidden md:table-cell">
                        {dev.gameCount}
                      </td>
                      <td className="py-3.5 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden lg:table-cell">
                        {dev.avgLikeRatio !== null
                          ? `${dev.avgLikeRatio}%`
                          : '—'}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 hidden md:table-cell">
                        <Link
                          href={`/games/${dev.topGame.universeId}`}
                          className="inline-flex items-center gap-2 hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
                        >
                          <GameArtwork
                            src={dev.topGame.iconUrl}
                            alt={dev.topGame.name}
                            size="sm"
                          />
                          <span className="text-xs font-medium text-slate-900 dark:text-[#F1F7FA] truncate max-w-[180px]">
                            {dev.topGame.name}
                          </span>
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-sm text-slate-500 dark:text-[#6F8796]"
                    >
                      No developers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </LiquidGlassCard>
      )}
    </div>
  );
}
