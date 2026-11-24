'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { GrowthValue } from '@/components/GameTable';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { KeywordTrendSummary } from '@/lib/market-intelligence';

type SortKey = 'totalCcu' | 'avgCcu' | 'gameCount' | 'growth';

export function TrendsDirectoryClient({
  trends,
}: {
  trends: KeywordTrendSummary[];
}) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('totalCcu');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? trends.filter((t) => t.keyword.includes(q))
      : [...trends];

    list.sort((a, b) => {
      if (sortBy === 'avgCcu') return b.avgCcu - a.avgCcu;
      if (sortBy === 'gameCount') return b.gameCount - a.gameCount;
      if (sortBy === 'growth') {
        return (b.avgGrowth24h ?? -999) - (a.avgGrowth24h ?? -999);
      }
      return b.totalCcu - a.totalCcu;
    });
    return list;
  }, [trends, query, sortBy]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#6F8796] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Roblox theme or mechanic (e.g. anime, rng, obby)..."
            className="w-full pl-10 pr-4 py-2 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="flex items-center gap-1 p-1 liquid-glass-pill rounded-full w-fit overflow-x-auto">
          {(
            [
              { id: 'totalCcu', label: 'Total CCU' },
              { id: 'avgCcu', label: 'Avg / Game' },
              { id: 'gameCount', label: 'Most Games' },
              { id: 'growth', label: '24h Momentum' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSortBy(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                sortBy === tab.id
                  ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                  : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <LiquidGlassCard
        exportTitle="Roblox Keyword & Theme Trends"
        className="rounded-3xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                <th className="py-3.5 pl-5 pr-2 w-12">#</th>
                <th className="py-3.5 px-3">Theme / Keyword</th>
                <th className="py-3.5 px-3 text-right">Total CCU</th>
                <th className="py-3.5 px-3 text-right">Games</th>
                <th className="py-3.5 px-3 text-right hidden sm:table-cell">Avg CCU / Game</th>
                <th className="py-3.5 px-3 text-right hidden md:table-cell">Leader Share</th>
                <th className="py-3.5 px-3 text-right hidden md:table-cell">Avg 24h</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Explore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
              {filtered.map((item, idx) => (
                <tr
                  key={item.keyword}
                  className="hover:bg-black/[0.025] dark:hover:bg-white/[0.035] transition-colors group"
                >
                  <td className="py-3 pl-5 pr-2 text-sm text-slate-400 dark:text-[#6F8796] tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3">
                    <Link
                      href={`/trends/${encodeURIComponent(item.keyword)}`}
                      className="block"
                    >
                      <p className="text-sm font-semibold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate max-w-[260px]">
                        Top: {item.topGames[0]?.name ?? '—'}
                      </p>
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-semibold text-slate-950 dark:text-white tabular-nums">
                    {formatExactNumber(item.totalCcu)}
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-slate-700 dark:text-[#C5D8E2] tabular-nums">
                    {item.gameCount}
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden sm:table-cell">
                    {formatCompactNumber(item.avgCcu)}
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden md:table-cell">
                    {item.topGameSharePct}%
                  </td>
                  <td className="py-3 px-3 text-right hidden md:table-cell">
                    <GrowthValue value={item.avgGrowth24h} />
                  </td>
                  <td className="py-3 pl-3 pr-5 text-right">
                    <Link
                      href={`/trends/${encodeURIComponent(item.keyword)}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-[#10E89A] hover:underline whitespace-nowrap"
                    >
                      <span>Niche</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-sm text-slate-500 dark:text-[#7893A3]"
                  >
                    No Roblox keyword trends matched &ldquo;{query}&rdquo;.
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
