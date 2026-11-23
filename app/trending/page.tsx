'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, ShieldAlert, TrendingUp } from 'lucide-react';
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

  const evaluations = useMemo(() => {
    const active = games.filter((g) => g.active);
    const eligible = active
      .map((game) => ({ game, ev: evaluateTrending(game) }))
      .filter((item) => item.ev.eligible && item.ev.score !== null)
      .sort((a, b) => (b.ev.score ?? 0) - (a.ev.score ?? 0));

    const excluded = active
      .map((game) => ({ game, ev: evaluateTrending(game) }))
      .filter((item) => !item.ev.eligible);

    return { eligible, excluded };
  }, [games]);

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <h1 className="font-display text-3xl font-bold text-[#E8EEF2]">
            Trending Roblox Experiences
          </h1>
          <p className="text-sm text-[#9BB0BD] leading-relaxed">
            Powered by actual measured velocity—combining absolute player gains,
            percentage growth, observation completeness, and a strict minimum player
            floor so tiny 1-to-10 player jumps never distort discovery.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#6E8492] tabular-nums">
          <Clock className="w-3.5 h-3.5 text-[#48D597]" />
          <span>Last evaluated {formatRelativeTime(lastUpdatedAt)}</span>
        </div>
      </div>

      {/* Transparency Rules Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-[#48D597]">Minimum CCU Floor</p>
          <p className="text-sm font-semibold text-[#E8EEF2] tabular-nums">
            &ge; 50 Concurrent Players
          </p>
          <p className="text-xs text-[#6E8492]">
            Filters out noisy micro-games jumping from 1 to 10 players.
          </p>
        </div>
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-[#48D597]">Observation Completeness</p>
          <p className="text-sm font-semibold text-[#E8EEF2] tabular-nums">
            &ge; 2 Timestamped Snapshots
          </p>
          <p className="text-xs text-[#6E8492]">
            Requires multiple persisted observations—never guessed or estimated.
          </p>
        </div>
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-[#48D597]">Balanced Momentum Score</p>
          <p className="text-sm font-semibold text-[#E8EEF2]">
            Absolute + Relative Growth
          </p>
          <p className="text-xs text-[#6E8492]">
            Weights both percentage gain and log-scaled absolute player additions.
          </p>
        </div>
      </div>

      {/* Eligible Trending Results */}
      {loadingGames ? (
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-10 text-center text-sm text-[#6E8492]">
          Evaluating measured velocity across tracked games...
        </div>
      ) : evaluations.eligible.length > 0 ? (
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#263844] bg-[#162229] text-xs font-medium text-[#9BB0BD]">
                  <th className="py-3 pl-4 pr-2 w-12">#</th>
                  <th className="py-3 px-3">Experience</th>
                  <th className="py-3 px-3 text-right">Live CCU</th>
                  <th className="py-3 px-3 text-right">Measured Growth</th>
                  <th className="py-3 px-3 text-right hidden sm:table-cell">
                    Absolute Gain
                  </th>
                  <th className="py-3 px-3 text-right">Momentum Score</th>
                  <th className="py-3 pl-3 pr-4 text-right hidden md:table-cell">
                    Basis
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263844]/60">
                {evaluations.eligible.map(({ game, ev }, idx) => (
                  <tr
                    key={game.universeId}
                    className="hover:bg-[#22333D]/70 transition-colors"
                  >
                    <td className="py-3.5 pl-4 pr-2 text-sm font-semibold text-[#6E8492] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-3">
                      <Link
                        href={`/games/${game.universeId}`}
                        className="flex items-center gap-3 min-w-0 group"
                      >
                        <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#E8EEF2] group-hover:text-[#48D597] truncate">
                            {game.name}
                          </p>
                          <p className="text-xs text-[#6E8492] truncate">
                            {game.creatorName} · {game.genre}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5 px-3 text-right text-sm font-semibold text-[#E8EEF2] tabular-nums">
                      {formatCompactNumber(game.currentCcu)}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <GrowthValue value={ev.percentGain} />
                    </td>
                    <td className="py-3.5 px-3 text-right text-sm text-[#9BB0BD] tabular-nums hidden sm:table-cell">
                      {ev.absoluteGain !== null
                        ? `${ev.absoluteGain >= 0 ? '+' : ''}${formatExactNumber(ev.absoluteGain)}`
                        : 'N/A'}
                    </td>
                    <td className="py-3.5 px-3 text-right text-sm font-bold text-[#48D597] tabular-nums">
                      {ev.score}
                    </td>
                    <td className="py-3.5 pl-3 pr-4 text-right text-xs text-[#6E8492] hidden md:table-cell">
                      {ev.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-10 text-center space-y-4">
          <div className="w-10 h-10 rounded-lg bg-[#101820] border border-[#263844] flex items-center justify-center mx-auto text-[#48D597]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
              Awaiting Multi-Snapshot History
            </h2>
            <p className="text-sm text-[#9BB0BD] leading-relaxed">
              {evaluations.excluded.length} tracked games currently have fewer than
              2 persisted historical snapshots. Once the Admin Collector records at
              least two timed observations (separated by &ge;1 minute), real measured
              trending velocity will appear here automatically.
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286]"
            >
              Open Admin Collector
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/rankings"
              className="text-xs font-medium text-[#9BB0BD] hover:text-[#E8EEF2]"
            >
              Browse Live CCU Rankings
            </Link>
          </div>
        </div>
      )}

      {evaluations.excluded.length > 0 && evaluations.eligible.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-[#6E8492]">
          <ShieldAlert className="w-4 h-4 text-[#9BB0BD] shrink-0" />
          <span>
            {evaluations.excluded.length} tracked experiences were excluded from
            Trending for not yet meeting the &ge;50 CCU or &ge;2 snapshot stability
            requirements.
          </span>
        </div>
      )}
    </div>
  );
}
