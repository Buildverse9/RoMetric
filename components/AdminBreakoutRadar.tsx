'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Ticket,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import {
  AdminAddCodeModal,
  type AdminCodeAddedPayload,
} from '@/components/AdminAddCodeModal';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import type { BreakoutRadarItem } from '@/app/api/admin/breakout-radar/route';

interface RadarResponse {
  generatedAt: string;
  summary: {
    totalScanned: number;
    missingCodesHighCcu: number;
    surgingMissingCodes: number;
    recentReleasesMissingCodes: number;
  };
  missingCodes: BreakoutRadarItem[];
  surging24h: BreakoutRadarItem[];
  allRising: BreakoutRadarItem[];
}

type RadarFilter = 'missing' | 'surging' | 'all';
type SortKey = 'score' | 'ccu' | 'growth' | 'visits';

export function AdminBreakoutRadar() {
  const { user, isAdmin } = useApp();
  const [data, setData] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RadarFilter>('missing');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [lockedTarget, setLockedTarget] = useState<BreakoutRadarItem | null>(
    null
  );
  const [banner, setBanner] = useState<string | null>(null);

  const loadRadar = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/breakout-radar', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = (await res.json()) as RadarResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load Breakout Radar.');
      }
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load Breakout Radar.'
      );
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        setLoading(true);
        setError(null);
        const res = await fetch('/api/admin/breakout-radar', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = (await res.json()) as RadarResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || 'Failed to load Breakout Radar.');
        }
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to load Breakout Radar.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

  const rows = useMemo(() => {
    if (!data) return [];
    const base =
      filter === 'missing'
        ? data.missingCodes
        : filter === 'surging'
          ? data.surging24h
          : data.allRising;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (item) =>
            item.cleanName.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q) ||
            item.creatorName.toLowerCase().includes(q) ||
            item.genre.toLowerCase().includes(q) ||
            item.universeId.includes(q)
        )
      : base;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'ccu') return b.currentCcu - a.currentCcu;
      if (sortBy === 'growth')
        return (b.growth24h ?? -999) - (a.growth24h ?? -999);
      if (sortBy === 'visits') return b.totalVisits - a.totalVisits;
      return b.breakoutScore - a.breakoutScore;
    });
  }, [data, filter, query, sortBy]);

  const handleCodeAdded = useCallback(
    (payload: AdminCodeAddedPayload) => {
      setBanner(payload.message || 'Code published and radar refreshed.');
      void loadRadar();
    },
    [loadRadar]
  );

  return (
    <div className="space-y-5">
      {banner && (
        <div className="liquid-glass rounded-2xl px-4 py-3 text-xs text-slate-900 dark:text-[#F1F7FA] border border-emerald-500/40 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
            {banner}
          </span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LiquidGlassCard className="rounded-3xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#6F8796]">
            Games Scanned
          </p>
          <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {formatExactNumber(data?.summary.totalScanned ?? 0)}
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard className="rounded-3xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#6F8796]">
            500+ CCU Missing Codes
          </p>
          <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatExactNumber(data?.summary.missingCodesHighCcu ?? 0)}
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard className="rounded-3xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#6F8796]">
            Surging (+15% 24h) &amp; 0 Codes
          </p>
          <p className="font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatExactNumber(data?.summary.surgingMissingCodes ?? 0)}
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard className="rounded-3xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#6F8796]">
            New Releases Missing Codes
          </p>
          <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {formatExactNumber(data?.summary.recentReleasesMissingCodes ?? 0)}
          </p>
        </LiquidGlassCard>
      </div>

      {/* Controls & Table */}
      <LiquidGlassCard className="rounded-3xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-900/8 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-950 dark:text-white mr-2">
              <Flame className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
              Viral Breakout Radar
            </span>
            {(
              [
                { id: 'missing', label: 'Missing Codes (0 Active)' },
                { id: 'surging', label: '24h Surges' },
                { id: 'all', label: 'All Rising' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                  filter === tab.id
                    ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                    : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter radar..."
                className="pl-8 pr-3 py-1.5 text-xs liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] w-44"
              />
            </div>

            <div className="inline-flex items-center gap-1 liquid-glass-pill rounded-full px-3 py-1.5 text-xs">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <select
                aria-label="Sort radar rows"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="bg-transparent text-slate-900 dark:text-[#F1F7FA] focus:outline-none cursor-pointer"
              >
                <option value="score" className="bg-white dark:bg-[#0D1A22]">
                  Priority Score
                </option>
                <option value="ccu" className="bg-white dark:bg-[#0D1A22]">
                  Live CCU
                </option>
                <option value="growth" className="bg-white dark:bg-[#0D1A22]">
                  24h Surge %
                </option>
                <option value="visits" className="bg-white dark:bg-[#0D1A22]">
                  Total Visits
                </option>
              </select>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => void loadRadar()}
              className="p-2 rounded-full liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] cursor-pointer"
              aria-label="Refresh Breakout Radar"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div className="overflow-x-auto max-h-[540px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/90 dark:bg-[#0E1A22]/95 backdrop-blur-md border-b border-slate-900/8 dark:border-white/10 text-xs text-slate-500 dark:text-[#9CB3C0]">
              <tr>
                <th className="py-3 px-5">Game</th>
                <th className="py-3 px-3 text-right">Live CCU</th>
                <th className="py-3 px-3 text-right">24h Delta</th>
                <th className="py-3 px-3 text-right">Active Codes</th>
                <th className="py-3 px-3">Signals</th>
                <th className="py-3 px-5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8 text-xs">
              {rows.map((item) => (
                <tr
                  key={item.universeId}
                  className="hover:bg-black/[0.025] dark:hover:bg-white/[0.03]"
                >
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <GameArtwork
                        src={item.iconUrl}
                        alt={item.cleanName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <Link
                          href={item.gamePath}
                          className="font-semibold text-slate-900 dark:text-[#F1F7FA] hover:text-emerald-600 dark:hover:text-[#10E89A] truncate block max-w-[240px]"
                        >
                          {item.cleanName}
                        </Link>
                        <p className="text-[11px] text-slate-500 dark:text-[#7893A3] truncate">
                          {item.creatorName} · {item.genre}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                    {formatCompactNumber(item.currentCcu)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <GrowthValue value={item.growth24h} />
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    <span
                      className={
                        item.activeCodeCount === 0
                          ? 'font-bold text-amber-600 dark:text-amber-400'
                          : 'font-semibold text-emerald-600 dark:text-[#10E89A]'
                      }
                    >
                      {item.activeCodeCount}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[11px] text-slate-500 dark:text-[#86A1B0] whitespace-nowrap">
                    {item.reasonTags.join(' · ') || `Score ${item.breakoutScore}`}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <a
                        href={`https://www.roblox.com/games/${item.rootPlaceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Inspect on Roblox"
                        className="p-1.5 rounded-full text-slate-500 hover:text-emerald-600 dark:hover:text-[#10E89A] hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Link
                        href={`/codes/${encodeURIComponent(item.canonicalCodeSlug)}`}
                        title="Open Codes Page"
                        className="p-1.5 rounded-full text-slate-500 hover:text-emerald-600 dark:hover:text-[#10E89A] hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setLockedTarget(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Add Code
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-slate-500 dark:text-[#7893A3]"
                  >
                    No games match this radar filter right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {lockedTarget && (
        <AdminAddCodeModal
          open={Boolean(lockedTarget)}
          onClose={() => setLockedTarget(null)}
          targetGame={{
            universeId: lockedTarget.universeId,
            name: lockedTarget.name,
            slug: lockedTarget.slug,
            iconUrl: lockedTarget.iconUrl,
          }}
          onCodeAdded={handleCodeAdded}
        />
      )}
    </div>
  );
}
