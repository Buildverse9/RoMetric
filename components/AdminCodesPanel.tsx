'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Edit3,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Play,
  Power,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from './AppProvider';
import { LiquidGlassCard } from './MotionPrimitives';
import { formatExactNumber, formatRelativeTime, formatUtcTimestamp } from '@/lib/format';
import type {
  CodeSourceRecord,
  CodesAdminOverview,
  GameCodeRecord,
} from '@/lib/codes-types';

type ModerationTab = 'pending' | 'recent' | 'active' | 'expired';

interface CollectionSummaryResult {
  ok: boolean;
  gamesChecked: number;
  gamesWithProviderData: number;
  codesDiscovered: number;
  codesUpdated: number;
  codesExpired: number;
  apiRequests: number;
  http429Count: number;
  durationMs: number;
  errors: string[];
}

export function AdminCodesPanel() {
  const { user, isAdmin } = useApp();

  const [overview, setOverview] = useState<CodesAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Collection trigger state
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [targetUniverseId, setTargetUniverseId] = useState<string>('');
  const [batchSize, setBatchSize] = useState<number>(8);
  const [runningCollection, setRunningCollection] = useState(false);

  // Source toggle & moderation state
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [busyCodeId, setBusyCodeId] = useState<number | null>(null);
  const [modTab, setModTab] = useState<ModerationTab>('pending');
  const [codeSearch, setCodeSearch] = useState('');
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [editRewardValue, setEditRewardValue] = useState('');

  const getAuthHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error('Unable to verify admin session token.');
    }
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [user]);

  const loadOverview = useCallback(async () => {
    if (!isAdmin || !user) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/codes/admin', {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      const data = (await res.json()) as CodesAdminOverview & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load codes admin data.');
      }
      setOverview(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load codes overview.'
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user, getAuthHeaders]);

  useEffect(() => {
    if (!isAdmin || !user) return;
    let cancelled = false;
    async function init() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/codes/admin', {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        const data = (await res.json()) as CodesAdminOverview & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load codes admin data.');
        }
        if (!cancelled) {
          setOverview(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load codes overview.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user, getAuthHeaders]);

  const handleRunCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (runningCollection) return;

    const cleanUid = targetUniverseId.trim().replace(/[^0-9]/g, '');
    if (targetUniverseId.trim() && !cleanUid) {
      setBanner({
        type: 'error',
        text: 'Universe ID must be numeric (or leave blank to check stalest games).',
      });
      return;
    }

    setRunningCollection(true);
    setBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/codes/admin', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'trigger_collection',
          providerId: providerFilter,
          universeId: cleanUid || null,
          maxGames: batchSize,
        }),
      });
      const rawText = await res.text();
      let data: (CollectionSummaryResult & { error?: string }) | null = null;
      try {
        data = JSON.parse(rawText) as CollectionSummaryResult & {
          error?: string;
        };
      } catch {
        throw new Error(
          res.ok
            ? 'Received unexpected non-JSON response from server.'
            : `Server returned HTTP ${res.status} (request may have timed out — try a smaller batch of 5 games).`
        );
      }
      if (!res.ok || !data) {
        throw new Error(data?.error || `Code collection failed (HTTP ${res.status}).`);
      }

      const checked = data.gamesChecked ?? 0;
      const withData = data.gamesWithProviderData ?? 0;
      const discovered = data.codesDiscovered ?? 0;
      const updated = data.codesUpdated ?? 0;
      const expired = data.codesExpired ?? 0;
      const apiCalls = data.apiRequests ?? 0;
      const durSec = ((data.durationMs ?? 0) / 1000).toFixed(1);

      setBanner({
        type: data.ok ? 'success' : 'error',
        text: `Checked ${checked} game${checked === 1 ? '' : 's'} (${withData} with provider data) · ${discovered} new · ${updated} updated · ${expired} expired · ${apiCalls} API calls · ${durSec}s${data.errors?.length ? ` · Notes: ${data.errors.slice(0, 2).join('; ')}` : ''}`,
      });
      await loadOverview();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Code collection failed.',
      });
    } finally {
      setRunningCollection(false);
    }
  };

  const handleToggleSource = async (source: CodeSourceRecord) => {
    if (busySourceId) return;
    setBusySourceId(source.id);
    setBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/codes/admin', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'toggle_source',
          sourceId: source.id,
          enabled: !source.enabled,
        }),
      });
      const rawText = await res.text();
      let data: { ok?: boolean; error?: string } | null = null;
      try {
        data = JSON.parse(rawText) as { ok?: boolean; error?: string };
      } catch {
        throw new Error(`Server returned HTTP ${res.status}.`);
      }
      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || `Unable to update source state (HTTP ${res.status}).`
        );
      }
      setBanner({
        type: 'success',
        text: `${source.name} ${source.enabled ? 'disabled' : 'enabled'}.`,
      });
      await loadOverview();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to toggle source.',
      });
    } finally {
      setBusySourceId(null);
    }
  };

  const handleModerate = async (
    code: GameCodeRecord,
    modAction:
      | 'approve_active'
      | 'mark_expired'
      | 'mark_unverified'
      | 'update_reward'
      | 'delete_code',
    rewardDescription?: string
  ) => {
    if (busyCodeId) return;
    setBusyCodeId(code.id);
    setBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/codes/admin', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'moderate_code',
          codeId: code.id,
          modAction,
          rewardDescription:
            modAction === 'update_reward' ? rewardDescription ?? '' : undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || 'Moderation failed.');
      }
      setEditingCodeId(null);
      setBanner({
        type: 'success',
        text: `${code.code}: ${data.message || 'Updated.'}`,
      });
      await loadOverview();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Moderation failed.',
      });
    } finally {
      setBusyCodeId(null);
    }
  };

  const displayedCodes = useMemo(() => {
    if (!overview) return [];
    const base =
      modTab === 'pending'
        ? overview.reviewQueue
        : modTab === 'active'
          ? overview.recentCodes.filter((c) => c.status === 'active')
          : modTab === 'expired'
            ? overview.recentCodes.filter((c) => c.status === 'expired')
            : overview.recentCodes;

    const q = codeSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.gameName || '').toLowerCase().includes(q) ||
        c.universeId.includes(q) ||
        (c.rewardDescription || '').toLowerCase().includes(q)
    );
  }, [overview, modTab, codeSearch]);

  if (loading && !overview) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-3xl liquid-glass animate-pulse"
            />
          ))}
        </div>
        <div className="h-56 rounded-3xl liquid-glass animate-pulse" />
      </div>
    );
  }

  if (error && !overview) {
    return (
      <LiquidGlassCard className="rounded-3xl p-6 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-rose-500 mx-auto" />
        <p className="text-sm text-slate-700 dark:text-[#C5D8E2]">{error}</p>
        <button
          type="button"
          onClick={() => void loadOverview()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </LiquidGlassCard>
    );
  }

  if (!overview) return null;

  const { summary } = overview;

  return (
    <div className="space-y-6">
      {!overview.schemaReady && (
        <div className="liquid-glass rounded-3xl p-5 border-amber-500/40 flex items-start gap-3">
          <Database className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-slate-900 dark:text-[#F1F7FA]">
              Game Codes Database Tables Not Yet Initialized
            </p>
            <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
              Run the updated Supabase schema script in your Supabase SQL Editor
              to create <code className="font-mono">code_sources</code>,{' '}
              <code className="font-mono">game_codes</code>,{' '}
              <code className="font-mono">code_collection_logs</code>, and{' '}
              <code className="font-mono">code_verification_logs</code>, then
              refresh this tab.
            </p>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`liquid-glass rounded-3xl p-4 text-sm flex items-center justify-between gap-4 ${
            banner.type === 'success'
              ? 'border-emerald-500/40 text-slate-900 dark:text-[#F1F7FA]'
              : 'border-rose-500/40 text-rose-700 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <LiquidGlassCard exportTitle="Codes — Games Covered" className="rounded-3xl p-4">
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Games Covered
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatExactNumber(summary.gamesCovered)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#6F8796] tabular-nums">
            of {formatExactNumber(summary.totalGamesTracked)} tracked
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard exportTitle="Codes — No Provider Data" className="rounded-3xl p-4">
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            No Data Yet
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {formatExactNumber(summary.gamesWithoutCoverage)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#6F8796]">
            Awaiting provider signals
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard exportTitle="Codes — Active" className="rounded-3xl p-4">
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Active Codes
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatExactNumber(summary.activeCodes)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#6F8796] tabular-nums">
            {formatExactNumber(summary.totalCodes)} total stored
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard exportTitle="Codes — Pending Review" className="rounded-3xl p-4">
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Pending Review
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatExactNumber(summary.pendingCodes)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#6F8796]">
            {formatExactNumber(summary.unverifiedCodes)} unverified
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard exportTitle="Codes — Expired" className="rounded-3xl p-4">
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Expired Codes
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-700 dark:text-[#9CB3C0] tabular-nums">
            {formatExactNumber(summary.expiredCodes)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#6F8796]">
            Archived for history
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard exportTitle="Codes — API Requests Today" className="rounded-3xl p-4">
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Requests Today
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {formatExactNumber(summary.totalApiRequestsToday)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#6F8796] tabular-nums truncate">
            Last:{' '}
            {summary.lastCollectionAt
              ? formatRelativeTime(summary.lastCollectionAt)
              : 'Never'}
          </p>
        </LiquidGlassCard>
      </section>

      {/* Manual Collection Trigger + Modular Providers */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <LiquidGlassCard
          exportTitle="Manual Code Collection"
          className="lg:col-span-5 rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 pr-8">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
                Manual Collection Run
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#6F8796]">
                Trigger legitimate API providers on demand for stalest games or a
                specific Universe ID.
              </p>
            </div>
          </div>

          <form onSubmit={handleRunCollection} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-[#9CB3C0] mb-1">
                  Provider
                </label>
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="all">All Enabled Providers</option>
                  {overview.sources
                    .filter((s) => s.providerType !== 'community')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-[#9CB3C0] mb-1">
                  Batch Size (Games)
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:border-emerald-500/50"
                >
                  <option value={5}>5 games (Fast)</option>
                  <option value={8}>8 games (Default)</option>
                  <option value={15}>15 games (Deep)</option>
                  <option value={25}>25 games (Max)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-[#9CB3C0] mb-1">
                Optional Target Universe ID
              </label>
              <input
                type="text"
                value={targetUniverseId}
                onChange={(e) => setTargetUniverseId(e.target.value)}
                placeholder="Leave blank to rotate stalest tracked games"
                className="w-full px-3.5 py-2 text-xs font-mono rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-400 dark:placeholder:text-[#6F8796] focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={runningCollection || !overview.schemaReady}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {runningCollection ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {runningCollection
                  ? 'Collecting Codes...'
                  : 'Run Code Collection'}
              </button>

              <button
                type="button"
                onClick={() => void loadOverview()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium liquid-glass-pill text-slate-700 dark:text-[#C5D8E2] rounded-full hover:border-emerald-500/50 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>
          </form>
        </LiquidGlassCard>

        <LiquidGlassCard
          exportTitle="Code Providers & Health"
          className="lg:col-span-7 rounded-3xl p-5 space-y-4"
        >
          <div className="pr-8">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA]">
              Modular Code Providers
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#6F8796]">
              Enable or disable adapters independently. Commercial API adapters
              stay inactive until configured via server environment variables.
            </p>
          </div>

          <div className="divide-y divide-slate-900/8 dark:divide-white/8">
            {overview.sources.map((src) => {
              const isHealthy = src.lastStatus === 'healthy';
              const isError = src.lastStatus === 'error';
              const needsKey = src.requiresApiKey && !src.apiKeyConfigured;
              return (
                <div
                  key={src.id}
                  className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA]">
                        {src.name}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          !src.enabled
                            ? 'text-slate-400 dark:text-[#6F8796]'
                            : isHealthy
                              ? 'text-emerald-600 dark:text-[#10E89A]'
                              : isError
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        · {!src.enabled ? 'Disabled' : src.lastStatus || 'Idle'}
                      </span>
                      {src.requiresApiKey && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            src.apiKeyConfigured
                              ? 'text-emerald-600 dark:text-[#10E89A]'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <KeyRound className="w-3 h-3" />
                          {src.apiKeyConfigured
                            ? 'Server Key Set'
                            : 'Env Key Required'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-[#6F8796] tabular-nums">
                      {src.requestsToday} req today · Limit {src.rateLimitRpm}{' '}
                      rpm · Last run:{' '}
                      {src.lastRunAt ? formatRelativeTime(src.lastRunAt) : 'Never'}
                    </p>

                    {src.lastError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 truncate max-w-xl">
                        {src.lastError}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={busySourceId === src.id || (needsKey && !src.enabled)}
                    onClick={() => void handleToggleSource(src)}
                    title={
                      needsKey && !src.enabled
                        ? 'Configure server API key before enabling'
                        : src.enabled
                          ? 'Disable provider'
                          : 'Enable provider'
                    }
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors shrink-0 cursor-pointer disabled:opacity-45 ${
                      src.enabled
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-[#10E89A] hover:bg-emerald-500/20'
                        : 'border-slate-900/15 dark:border-white/15 text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {busySourceId === src.id
                      ? 'Saving...'
                      : src.enabled
                        ? 'Enabled'
                        : 'Disabled'}
                  </button>
                </div>
              );
            })}
          </div>
        </LiquidGlassCard>
      </section>

      {/* Moderation Queue & Code Management */}
      <LiquidGlassCard
        exportTitle="Code Moderation Queue"
        className="rounded-3xl overflow-hidden"
      >
        <div className="p-5 border-b border-slate-900/8 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#F1F7FA] mr-2">
              Code Review & Moderation
            </h2>
            {(
              [
                {
                  id: 'pending',
                  label: `Review Queue (${overview.reviewQueue.length})`,
                },
                {
                  id: 'recent',
                  label: `Recent (${overview.recentCodes.length})`,
                },
                { id: 'active', label: 'Active' },
                { id: 'expired', label: 'Expired' },
              ] as Array<{ id: ModerationTab; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setModTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                  modTab === t.id
                    ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                    : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              placeholder="Filter code, game, or ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-900/8 dark:border-white/10 text-slate-500 dark:text-[#6F8796]">
                <th className="py-3 px-4 font-medium">Code</th>
                <th className="py-3 px-3 font-medium">Game</th>
                <th className="py-3 px-3 font-medium">Reward</th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-3 font-medium">Source</th>
                <th className="py-3 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
              {displayedCodes.map((item) => {
                const isEditing = editingCodeId === item.id;
                const isBusy = busyCodeId === item.id;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <td className="py-3 px-4 align-top">
                      <span className="font-mono font-bold text-sm text-slate-950 dark:text-white tracking-wide">
                        {item.code}
                      </span>
                      {item.adminLocked && (
                        <p className="text-[10px] text-emerald-600 dark:text-[#10E89A] mt-0.5">
                          Admin locked
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top max-w-[180px]">
                      <Link
                        href={`/codes/${encodeURIComponent(item.gameSlug || item.universeId)}`}
                        className="font-medium text-slate-900 dark:text-[#F1F7FA] hover:text-emerald-600 dark:hover:text-[#10E89A] truncate block"
                      >
                        {item.gameName || `Universe ${item.universeId}`}
                      </Link>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-[#6F8796]">
                        {item.universeId}
                      </span>
                    </td>

                    <td className="py-3 px-3 align-top min-w-[200px] max-w-[280px]">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editRewardValue}
                            onChange={(e) => setEditRewardValue(e.target.value)}
                            placeholder="Reward description..."
                            className="w-full px-2.5 py-1 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.08] border border-emerald-500/50 text-slate-900 dark:text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleModerate(
                                item,
                                'update_reward',
                                editRewardValue
                              )
                            }
                            aria-label="Save reward"
                            className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCodeId(null)}
                            aria-label="Cancel edit"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-slate-700 dark:text-[#C5D8E2]">
                            {item.rewardDescription || (
                              <span className="italic text-slate-400 dark:text-[#6F8796]">
                                Reward not specified by source
                              </span>
                            )}
                          </p>
                          {item.submittedByNote && (
                            <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                              Submitted by: {item.submittedByNote}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          item.status === 'active'
                            ? 'text-emerald-600 dark:text-[#10E89A]'
                            : item.status === 'pending_verification'
                              ? 'text-amber-600 dark:text-amber-400'
                              : item.status === 'expired'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500 dark:text-[#9CB3C0]'
                        }`}
                      >
                        {item.status === 'active' && (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {item.status === 'pending_verification' && (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {item.status === 'expired' && (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {item.status === 'unverified' && (
                          <HelpCircle className="w-3.5 h-3.5" />
                        )}
                        {item.status.replace('_', ' ')}
                      </span>
                      <p className="text-[10px] text-slate-400 dark:text-[#6F8796] tabular-nums mt-0.5">
                        {formatRelativeTime(item.updatedAt)}
                      </p>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <p className="text-slate-700 dark:text-[#C5D8E2]">
                        {item.sourceName || item.sourceId}
                      </p>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-[#10E89A] hover:underline mt-0.5"
                        >
                          Source
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>

                    <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        {item.status !== 'active' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleModerate(item, 'approve_active')
                            }
                            title="Approve as Active"
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-[#10E89A] hover:bg-emerald-500/25 cursor-pointer disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {item.status !== 'expired' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleModerate(item, 'mark_expired')
                            }
                            title="Mark Expired"
                            className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 cursor-pointer disabled:opacity-50"
                          >
                            Expire
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setEditingCodeId(item.id);
                            setEditRewardValue(item.rewardDescription || '');
                          }}
                          title="Edit Reward"
                          aria-label="Edit Reward"
                          className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleModerate(item, 'delete_code')
                          }
                          title="Delete Code"
                          aria-label="Delete Code"
                          className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {displayedCodes.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-500 dark:text-[#6F8796]"
                  >
                    {modTab === 'pending'
                      ? 'No codes waiting in the verification queue.'
                      : 'No matching codes found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* Collection Logs & Verification Audit */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <LiquidGlassCard
          exportTitle="Code Collection Logs"
          className="xl:col-span-7 rounded-3xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-900/8 dark:border-white/10 pr-12">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
              Recent Collection Logs
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-900/8 dark:border-white/10 text-slate-500 dark:text-[#6F8796]">
                  <th className="py-2.5 px-4 font-medium">Time (UTC)</th>
                  <th className="py-2.5 px-2.5 font-medium">Provider</th>
                  <th className="py-2.5 px-2.5 font-medium">Status</th>
                  <th className="py-2.5 px-2.5 text-right font-medium">Games</th>
                  <th className="py-2.5 px-2.5 text-right font-medium">New/Upd</th>
                  <th className="py-2.5 px-2.5 text-right font-medium">API/429</th>
                  <th className="py-2.5 px-4 text-right font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/6 dark:divide-white/8 tabular-nums">
                {overview.collectionLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-[#9CB3C0] whitespace-nowrap">
                      {formatUtcTimestamp(log.completedAt)}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-900 dark:text-[#F1F7FA]">
                      <div className="font-medium">{log.sourceId}</div>
                      <div className="text-[10px] text-slate-400 dark:text-[#6F8796]">
                        {log.triggeredBy}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5">
                      <span
                        className={`font-semibold ${
                          log.status === 'success'
                            ? 'text-emerald-600 dark:text-[#10E89A]'
                            : log.status === 'partial'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-700 dark:text-[#C5D8E2]">
                      {log.gamesWithProviderData}/{log.gamesChecked}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-700 dark:text-[#C5D8E2]">
                      +{log.codesDiscovered} / {log.codesUpdated}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-600 dark:text-[#9CB3C0]">
                      {log.apiRequests} / {log.http429Count}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-600 dark:text-[#9CB3C0]">
                      {(log.durationMs / 1000).toFixed(1)}s
                    </td>
                  </tr>
                ))}
                {overview.collectionLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-slate-500 dark:text-[#6F8796]"
                    >
                      No code collection logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard
          exportTitle="Verification Audit Trail"
          className="xl:col-span-5 rounded-3xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-900/8 dark:border-white/10 pr-12">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
              Verification Audit Log
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-900/8 dark:border-white/10 text-slate-500 dark:text-[#6F8796]">
                  <th className="py-2.5 px-4 font-medium">Code</th>
                  <th className="py-2.5 px-2.5 font-medium">Change</th>
                  <th className="py-2.5 px-2.5 font-medium">Actor</th>
                  <th className="py-2.5 px-4 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/6 dark:divide-white/8 tabular-nums">
                {overview.verificationLogs.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-[#F1F7FA]">
                      {v.codeText}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-600 dark:text-[#9CB3C0]">
                      {v.previousStatus ? `${v.previousStatus} → ` : ''}
                      <span className="font-semibold text-slate-900 dark:text-[#F1F7FA]">
                        {v.newStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-500 dark:text-[#6F8796] max-w-[120px] truncate">
                      {v.actor}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500 dark:text-[#6F8796] whitespace-nowrap">
                      {formatRelativeTime(v.verifiedAt)}
                    </td>
                  </tr>
                ))}
                {overview.verificationLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-slate-500 dark:text-[#6F8796]"
                    >
                      No verification audit events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </LiquidGlassCard>
      </section>
    </div>
  );
}
