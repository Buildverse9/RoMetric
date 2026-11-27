'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Search,
  Ticket,
  Users,
} from 'lucide-react';
import {
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
} from '@/lib/format';
import { cleanSeoGameName } from '@/lib/seo';
import type {
  CodeSourceRecord,
  GameCodeDirectoryItem,
} from '@/lib/codes-types';
import { GameArtwork } from './GameArtwork';
import {
  APPLE_EASE,
  APPLE_SPRING,
  FadeInSection,
  LiquidGlassCard,
} from './MotionPrimitives';

export interface CodesDirectoryResponse {
  configured: boolean;
  schemaReady: boolean;
  games: GameCodeDirectoryItem[];
  sources: CodeSourceRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalMatchedGames: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  stats: {
    totalGamesCovered: number;
    totalGamesTracked: number;
    totalActiveCodes: number;
    totalPendingCodes: number;
    totalExpiredCodes: number;
    totalCodes: number;
  };
}

const STATUS_FILTERS: Array<{
  id: 'all' | 'active' | 'expired';
  label: string;
}> = [
  { id: 'all', label: 'All Games' },
  { id: 'active', label: 'Active Codes' },
  { id: 'expired', label: 'Expired Archive' },
];

const SORT_OPTIONS: Array<{
  id: 'popular' | 'recently_updated' | 'most_codes';
  label: string;
}> = [
  { id: 'popular', label: 'Popularity' },
  { id: 'recently_updated', label: 'Recently Updated' },
  { id: 'most_codes', label: 'Most Active Codes' },
];

export function CodesDirectoryClient({
  initialData,
}: {
  initialData: CodesDirectoryResponse;
}) {
  const [data, setData] = useState<CodesDirectoryResponse>(initialData);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'expired'
  >('all');
  const [sortBy, setSortBy] = useState<
    'popular' | 'recently_updated' | 'most_codes'
  >('popular');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 260);
    return () => window.clearTimeout(t);
  }, [query]);

  const isDefaultView =
    debouncedQuery === '' &&
    statusFilter === 'all' &&
    sortBy === 'popular' &&
    page === 1 &&
    initialData.schemaReady;

  useEffect(() => {
    // Skip redundant fetch on exact default state if SSR already loaded data
    if (isDefaultView) {
      return;
    }

    const controller = new AbortController();
    async function syncDirectory() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.set('q', debouncedQuery);
        params.set('status', statusFilter);
        params.set('sort', sortBy);
        params.set('page', String(page));
        params.set('pageSize', '48');
        const res = await fetch(`/api/codes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok && !controller.signal.aborted) {
          const json = (await res.json()) as CodesDirectoryResponse;
          setData(json);
        }
      } catch {
        // Ignore aborted or transient fetch errors
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    void syncDirectory();
    return () => controller.abort();
  }, [debouncedQuery, statusFilter, sortBy, page, isDefaultView]);

  const activeData = isDefaultView ? initialData : data;
  const { stats, games, schemaReady, configured, pagination } = activeData;
  const rangeStart =
    pagination.totalMatchedGames === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(
    pagination.page * pagination.pageSize,
    pagination.totalMatchedGames
  );

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-10 space-y-7">
      {/* Header & Summary Strip */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, ease: APPLE_EASE }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-5"
      >
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-[#10E89A]">
            <Ticket className="w-3.5 h-3.5" />
            <span>100% Automated Roblox Codes Engine</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-950 dark:text-white tracking-tight text-balance">
            Roblox Game Codes
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
            Automatically discovered and continuously updated from official
            Roblox game descriptions, developer group announcements, official
            Trello boards, Fandom &amp; Wiki.gg databases, and{' '}
            <a
              href="https://bloxarchive.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 dark:text-[#10E89A] underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              BloxArchive
            </a>
            —with live verification timestamps and source attribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 shrink-0 text-xs tabular-nums">
          <div>
            <p className="text-slate-500 dark:text-[#6F8796]">Active Codes</p>
            <p className="font-display text-xl font-bold text-emerald-600 dark:text-[#10E89A]">
              {formatExactNumber(stats.totalActiveCodes)}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-[#6F8796]">Games Listed</p>
            <p className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
              {formatExactNumber(stats.totalGamesCovered)}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-[#6F8796]">Total Codes</p>
            <p className="font-display text-xl font-bold text-slate-700 dark:text-[#C8D9E2]">
              {formatExactNumber(stats.totalCodes)}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Schema Setup Notice (if Supabase SQL migration hasn't been executed yet) */}
      {configured && !schemaReady && (
        <LiquidGlassCard
          exportTitle="Game Codes Setup Notice"
          className="rounded-[24px] p-5 border-amber-500/30 space-y-2"
        >
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
            <Database className="w-4 h-4" />
            <span>Initialize Game Codes Tables in Supabase</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
            Run the updated Game Codes SQL section in your Supabase SQL Editor
            to create the <code className="font-mono">game_codes</code>,{' '}
            <code className="font-mono">code_sources</code>, and log tables,
            then trigger your first collection run from the Admin Dashboard.
          </p>
        </LiquidGlassCard>
      )}

      {/* Search + Segmented Status Filter + Sort Controls */}
      <LiquidGlassCard
        hideCardActions
        className="rounded-[24px] p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#7B95A5] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Roblox game name, code string, or reward..."
              className="w-full pl-11 pr-4 py-2.5 text-sm rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/10 dark:border-white/10 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#7B95A5] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="codes-sort"
              className="text-xs text-slate-500 dark:text-[#8BA3B2]"
            >
              Sort by
            </label>
            <select
              id="codes-sort"
              value={sortBy}
              onChange={(e) => {
                setSortBy(
                  e.target.value as
                    | 'popular'
                    | 'recently_updated'
                    | 'most_codes'
                );
                setPage(1);
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 text-slate-800 dark:text-[#F1F7FA] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option
                  key={opt.id}
                  value={opt.id}
                  className="bg-white dark:bg-[#0D1A22] text-slate-900 dark:text-white"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Interactive Status Filter Buttons + Result Count */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(f.id);
                    setPage(1);
                  }}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'text-white dark:text-[#04130D]'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="codes-status-filter-pill"
                      transition={APPLE_SPRING}
                      className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-[#10E89A] -z-10"
                    />
                  )}
                  {f.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
            Showing {formatExactNumber(rangeStart)}–{formatExactNumber(rangeEnd)}{' '}
            of {formatExactNumber(pagination.totalMatchedGames)} games
          </p>
        </div>
      </LiquidGlassCard>

      {/* Responsive Game Codes Grid */}
      <FadeInSection>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="liquid-glass rounded-[24px] p-5 animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900/10 dark:bg-white/10 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-3/4 rounded bg-slate-900/10 dark:bg-white/10" />
                    <div className="h-3 w-1/2 rounded bg-slate-900/6 dark:bg-white/6" />
                  </div>
                </div>
                <div className="h-9 rounded-xl bg-slate-900/5 dark:bg-white/5" />
              </div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <LiquidGlassCard
            hideCardActions
            className="rounded-[28px] p-10 text-center space-y-3"
          >
            <p className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
              No matching Roblox games or codes found
            </p>
            <p className="text-xs text-slate-500 dark:text-[#8BA3B2] max-w-md mx-auto">
              Try a broader search term or switch to All Games. Our automated
              crawler continuously discovers and updates codes across every
              tracked Roblox experience.
            </p>
            {(query || statusFilter !== 'all') && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setDebouncedQuery('');
                    setStatusFilter('all');
                    setPage(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </LiquidGlassCard>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((g) => {
                const displayName = cleanSeoGameName(g.name);
                const previewRows =
                  g.matchingCodes && g.matchingCodes.length > 0
                    ? g.matchingCodes.slice(0, 2).map((mc) => ({
                        id: mc.id,
                        code: mc.code,
                        badge: mc.status.replace('_', ' '),
                      }))
                    : g.activeCodesPreview && g.activeCodesPreview.length > 0
                      ? g.activeCodesPreview.slice(0, 2).map((ac) => ({
                          id: ac.id,
                          code: ac.code,
                          badge: ac.rewardDescription || 'Active',
                        }))
                      : [];

                return (
                  <Link
                    key={g.universeId}
                    href={`/codes/${encodeURIComponent(g.slug || g.universeId)}`}
                    className="block group"
                  >
                    <LiquidGlassCard
                      interactive
                      exportTitle={`${displayName} — Roblox Codes`}
                      className="rounded-[24px] p-4 sm:p-5 h-full flex flex-col justify-between gap-4 hover:border-emerald-500/35 dark:hover:border-[#10E89A]/35"
                    >
                      <div className="flex items-start gap-3.5 pr-8 min-w-0">
                        <div className="group-hover:scale-105 transition-transform duration-200 shrink-0">
                          <GameArtwork
                            src={g.iconUrl || g.thumbnailUrl}
                            alt={displayName}
                            size="md"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-base font-bold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                            {displayName}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-[#8BA3B2] truncate">
                            {g.creatorName} · {g.genre}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-[#6F8796] inline-flex items-center gap-1 tabular-nums">
                            <Users className="w-3 h-3" />
                            <span>
                              {formatCompactNumber(g.currentCcu)} playing
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Live Code Preview (Active or Search Match) */}
                      {previewRows.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {previewRows.map((row) => (
                            <div
                              key={row.id}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/[0.07] dark:bg-[#10E89A]/[0.08] border border-emerald-500/20 flex items-center justify-between gap-2 text-xs"
                            >
                              <code className="font-mono font-bold text-slate-900 dark:text-white truncate">
                                {row.code}
                              </code>
                              <span className="text-[11px] text-emerald-700 dark:text-[#10E89A] truncate max-w-[130px] shrink-0">
                                {row.badge}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Honest Code Coverage & Counts Footer */}
                      <div className="pt-3 border-t border-slate-900/6 dark:border-white/8 flex items-center justify-between gap-2 text-xs tabular-nums">
                        {g.totalCodeCount > 0 ? (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-bold text-emerald-600 dark:text-[#10E89A]">
                              {g.activeCodeCount} Active
                            </span>
                            {g.expiredCodeCount > 0 && (
                              <>
                                <span
                                  className="text-slate-400"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span className="text-slate-500 dark:text-[#7893A3]">
                                  {g.expiredCodeCount} Expired
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 dark:text-[#7893A3]">
                            {g.codeCoverageStatus === 'no_provider_data'
                              ? 'Monitoring sources'
                              : 'Queued for auto-scan'}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-[#9CB3C0] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors shrink-0">
                          {g.latestCodeUpdatedAt ? (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatRelativeTime(g.latestCodeUpdatedAt)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>View</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </>
                          )}
                        </span>
                      </div>
                    </LiquidGlassCard>
                  </Link>
                );
              })}
            </div>

            {/* Full Directory Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
                  Page {pagination.page} of {pagination.totalPages} (
                  {formatExactNumber(pagination.totalMatchedGames)} total games)
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold liquid-glass-pill text-slate-800 dark:text-[#F1F7FA] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:border-emerald-500/45 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    disabled={!pagination.hasNextPage}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </FadeInSection>
    </div>
  );
}
