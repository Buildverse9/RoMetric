'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import { formatCompactNumber } from '@/lib/format';
import { cleanSeoGameName } from '@/lib/seo';
import { GameArtwork } from '@/components/GameArtwork';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

export function SimilarHubClient({ games }: { games: GameRecordData[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games.slice(0, 60);
    return games
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.creatorName.toLowerCase().includes(q) ||
          g.genre.toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [games, query]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-lg">
        <Search className="w-4 h-4 text-slate-400 dark:text-[#6F8796] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any Roblox game (e.g. Blox Fruits, Fisch, DOORS)..."
          className="w-full pl-10 pr-4 py-2.5 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((game) => {
          const cleanName = cleanSeoGameName(game.name);
          return (
            <Link
              key={game.universeId}
              href={`/similar/${game.universeId}`}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <LiquidGlassCard className="rounded-2xl p-4 h-full flex items-center justify-between gap-3 group-hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                      Games like {cleanName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate tabular-nums">
                      {formatCompactNumber(game.currentCcu)} CCU · {game.genre}
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] shrink-0 transition-colors" />
              </LiquidGlassCard>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="liquid-glass rounded-3xl p-10 text-center text-sm text-slate-500 dark:text-[#7893A3]">
          No tracked games matched &ldquo;{query}&rdquo;.
        </div>
      )}
    </div>
  );
}
