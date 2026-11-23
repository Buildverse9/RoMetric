'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ShieldCheck, Users } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { GameArtwork } from '@/components/GameArtwork';

export default function DevelopersDirectoryPage() {
  const { developers, loadingGames } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Group' | 'User'>('All');

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

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="space-y-2 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-[#E8EEF2]">
          Developer & Group Analytics
        </h1>
        <p className="text-sm text-[#9BB0BD]">
          Public portfolio performance aggregated across tracked experiences.
          Clearly separated from private Roblox Creator Analytics data.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#6E8492] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search studio groups, creators, or top games..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#1C2A32] border border-[#263844] rounded-lg text-[#E8EEF2] placeholder:text-[#6E8492] focus:outline-none focus:border-[#48D597]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#162229] border border-[#263844] rounded-lg w-fit">
          {(['All', 'Group', 'User'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                typeFilter === t
                  ? 'bg-[#48D597] text-[#101820] font-semibold'
                  : 'text-[#9BB0BD] hover:text-[#E8EEF2]'
              }`}
            >
              {t === 'All' ? 'All Creators' : `${t}s`}
            </button>
          ))}
        </div>
      </div>

      {loadingGames ? (
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-10 text-center text-sm text-[#6E8492]">
          Aggregating developer portfolios...
        </div>
      ) : (
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#263844] bg-[#162229] text-xs font-medium text-[#9BB0BD]">
                  <th className="py-3 pl-4 pr-2 w-12">#</th>
                  <th className="py-3 px-3">Developer / Group</th>
                  <th className="py-3 px-3 text-right">Combined CCU</th>
                  <th className="py-3 px-3 text-right hidden sm:table-cell">
                    Total Visits
                  </th>
                  <th className="py-3 px-3 text-right hidden md:table-cell">
                    Tracked Games
                  </th>
                  <th className="py-3 px-3 text-right hidden lg:table-cell">
                    Avg Like Ratio
                  </th>
                  <th className="py-3 pl-3 pr-4 hidden md:table-cell">
                    Top Experience
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263844]/60">
                {filtered.map((dev, idx) => (
                  <tr
                    key={`${dev.creatorType}_${dev.creatorId}`}
                    className="hover:bg-[#22333D]/70 transition-colors"
                  >
                    <td className="py-3.5 pl-4 pr-2 text-sm text-[#6E8492] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-3">
                      <Link
                        href={`/developers/${dev.creatorId}`}
                        className="flex items-center gap-2.5 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#101820] border border-[#263844] flex items-center justify-center text-[#48D597] shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-[#E8EEF2] group-hover:text-[#48D597] truncate">
                              {dev.creatorName}
                            </span>
                            {dev.creatorVerified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-[#48D597] shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-[#6E8492] tabular-nums">
                            {dev.creatorType} · ID {dev.creatorId}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5 px-3 text-right text-sm font-semibold text-[#48D597] tabular-nums">
                      {formatExactNumber(dev.combinedCcu)}
                    </td>
                    <td className="py-3.5 px-3 text-right text-sm text-[#9BB0BD] tabular-nums hidden sm:table-cell">
                      {formatCompactNumber(dev.totalVisits)}
                    </td>
                    <td className="py-3.5 px-3 text-right text-sm text-[#E8EEF2] tabular-nums hidden md:table-cell">
                      {dev.gameCount}
                    </td>
                    <td className="py-3.5 px-3 text-right text-sm text-[#9BB0BD] tabular-nums hidden lg:table-cell">
                      {dev.avgLikeRatio !== null ? `${dev.avgLikeRatio}%` : 'N/A'}
                    </td>
                    <td className="py-3.5 pl-3 pr-4 hidden md:table-cell">
                      <Link
                        href={`/games/${dev.topGame.universeId}`}
                        className="inline-flex items-center gap-2 hover:text-[#48D597] transition-colors"
                      >
                        <GameArtwork
                          src={dev.topGame.iconUrl}
                          alt={dev.topGame.name}
                          size="sm"
                        />
                        <span className="text-xs font-medium text-[#E8EEF2] truncate max-w-[180px]">
                          {dev.topGame.name}
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-sm text-[#6E8492]"
                    >
                      No developers or groups match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
