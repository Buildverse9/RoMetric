'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Lock,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import {
  addGameToTracking,
  countStoredSnapshotsSample,
  DEFAULT_SYSTEM_CONFIG,
  fetchCollectionJobs,
  fetchSystemConfig,
  pruneExpiredRawSnapshots,
  removeGameFromTracking,
  runCollectionCycle,
  saveSystemConfig,
  updateGameTrackingSettings,
} from '@/lib/analytics-store';
import {
  formatCompactNumber,
  formatExactNumber,
  formatRelativeTime,
  formatUtcTimestamp,
} from '@/lib/format';
import type {
  CollectionJob,
  GameRecordData,
  LiveRobloxGamePayload,
  SystemConfig,
  TrackingTier,
} from '@/lib/types';
import { GameArtwork } from '@/components/GameArtwork';

export default function AdminDashboardPage() {
  const {
    user,
    authReady,
    isAdmin,
    signInWithGoogle,
    signOutUser,
    games,
    dataMode,
    lastUpdatedAt,
    refreshCatalog,
  } = useApp();

  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [jobs, setJobs] = useState<CollectionJob[]>([]);
  const [snapshotCount, setSnapshotCount] = useState<number>(0);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [autoCollect, setAutoCollect] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Add Game form state
  const [addInput, setAddInput] = useState('');
  const [addTier, setAddTier] = useState<TrackingTier>('tier_1');
  const [addingGame, setAddingGame] = useState(false);
  const [pruning, setPruning] = useState(false);

  const loadAdminTelemetry = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingAdmin(true);
    try {
      const [cfg, jobList, snapCount] = await Promise.all([
        fetchSystemConfig(),
        fetchCollectionJobs(25),
        countStoredSnapshotsSample(),
      ]);
      setConfig(cfg);
      setJobs(jobList);
      setSnapshotCount(snapCount);
    } catch (err) {
      console.error('Admin telemetry error:', err);
      setStatusMessage({
        type: 'error',
        text: 'Unable to load admin telemetry. Please verify your admin permissions.',
      });
    } finally {
      setLoadingAdmin(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function init() {
      try {
        const [cfg, jobList, snapCount] = await Promise.all([
          fetchSystemConfig(),
          fetchCollectionJobs(25),
          countStoredSnapshotsSample(),
        ]);
        if (!cancelled) {
          setConfig(cfg);
          setJobs(jobList);
          setSnapshotCount(snapCount);
        }
      } catch (err) {
        console.error('Admin telemetry error:', err);
        if (!cancelled) {
          setStatusMessage({
            type: 'error',
            text: 'Unable to load admin telemetry. Please verify your admin permissions.',
          });
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const handleRunCollection = useCallback(
    async (
      tier: 'all' | 'tier_1' | 'tier_2' | 'tier_3' | 'manual',
      includeLiveDiscovery = false
    ) => {
      if (!isAdmin || collecting) return;
      setCollecting(true);
      setProgressText('Starting collection...');
      setStatusMessage(null);
      try {
        const result = await runCollectionCycle({
          tier,
          triggeredBy: user?.email || 'admin',
          includeLiveDiscovery,
          onProgress: (msg) => setProgressText(msg),
        });
        await refreshCatalog(false);
        await loadAdminTelemetry();
        setStatusMessage({
          type: result.job.status === 'failed' ? 'error' : 'success',
          text: `Collection finished (${result.job.status}): ${result.job.gamesSucceeded}/${result.job.gamesAttempted} games saved · ${result.job.apiRequests} Roblox API calls · ${result.job.http429Count} HTTP 429s · ${(result.job.durationMs / 1000).toFixed(1)}s`,
        });
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text:
            err instanceof Error ? err.message : 'Collection cycle failed.',
        });
      } finally {
        setCollecting(false);
        setProgressText(null);
      }
    },
    [isAdmin, collecting, user, refreshCatalog, loadAdminTelemetry]
  );

  // Optional 5-minute automated live collection while Admin Console stays open
  useEffect(() => {
    if (!autoCollect || !isAdmin || config.paused) return;
    const interval = setInterval(() => {
      void handleRunCollection('all');
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoCollect, isAdmin, config.paused, handleRunCollection]);

  const handleTogglePause = async () => {
    if (!isAdmin) return;
    const nextConfig: SystemConfig = { ...config, paused: !config.paused };
    try {
      await saveSystemConfig(nextConfig, user?.email || 'admin');
      setConfig(nextConfig);
      setStatusMessage({
        type: 'success',
        text: nextConfig.paused
          ? 'Global collection paused.'
          : 'Global collection resumed.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update config.',
      });
    }
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim() || addingGame) return;
    setAddingGame(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `/api/roblox/resolve?q=${encodeURIComponent(addInput.trim())}`
      );
      const data = (await res.json()) as {
        game?: LiveRobloxGamePayload;
        capturedAt?: string;
        error?: string;
      };
      if (!res.ok || !data.game) {
        throw new Error(data.error || 'Could not resolve Roblox experience.');
      }

      const saved = await addGameToTracking(
        data.game,
        addTier,
        data.capturedAt || new Date().toISOString()
      );
      setAddInput('');
      await refreshCatalog(false);
      await loadAdminTelemetry();
      setStatusMessage({
        type: 'success',
        text: `Added "${saved.name}" (Universe ${saved.universeId}) to ${addTier.replace('_', ' ').toUpperCase()} tracking.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to add game.',
      });
    } finally {
      setAddingGame(false);
    }
  };

  const handleTierChange = async (
    game: GameRecordData,
    nextTier: TrackingTier
  ) => {
    try {
      await updateGameTrackingSettings(game, { trackingTier: nextTier });
      await refreshCatalog(false);
      setStatusMessage({
        type: 'success',
        text: `Updated "${game.name}" priority to ${nextTier.replace('_', ' ').toUpperCase()}.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update tier.',
      });
    }
  };

  const handleRemoveGame = async (game: GameRecordData) => {
    try {
      await removeGameFromTracking(game.universeId);
      await refreshCatalog(false);
      setStatusMessage({
        type: 'success',
        text: `Removed "${game.name}" from active tracking.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove game.',
      });
    }
  };

  const handlePruneRetention = async () => {
    if (pruning) return;
    setPruning(true);
    try {
      const removed = await pruneExpiredRawSnapshots(config.retentionRawHours);
      await loadAdminTelemetry();
      setStatusMessage({
        type: 'success',
        text:
          removed > 0
            ? `Retention cleanup deleted ${removed} raw snapshots older than ${config.retentionRawHours}h (hourly & daily rollups preserved).`
            : `No raw snapshots older than ${config.retentionRawHours}h needed cleanup.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Retention cleanup failed.',
      });
    } finally {
      setPruning(false);
    }
  };

  // Computed Admin KPIs
  const metrics = useMemo(() => {
    const totalJobs = jobs.length;
    const succeededJobs = jobs.filter((j) => j.status === 'success').length;
    const failedJobs = jobs.filter((j) => j.status === 'failed').length;
    const successRate =
      totalJobs > 0 ? ((succeededJobs / totalJobs) * 100).toFixed(1) : 'N/A';
    const totalApiCalls = jobs.reduce((s, j) => s + j.apiRequests, 0);
    const total429 = jobs.reduce((s, j) => s + j.http429Count, 0);
    const lastSuccess = jobs.find((j) => j.status !== 'failed') ?? null;

    // Conservative storage footprint estimate (~1.2 KB per Firestore doc + indexes)
    const estimatedDocs = games.length * 3 + snapshotCount + jobs.length;
    const estimatedMb = Number(((estimatedDocs * 1.2) / 1024).toFixed(2));
    const freeQuotaMb = 500;
    const usagePct = Math.min(100, Number(((estimatedMb / freeQuotaMb) * 100).toFixed(1)));

    return {
      totalJobs,
      failedJobs,
      successRate,
      totalApiCalls,
      total429,
      lastSuccess,
      estimatedMb,
      freeQuotaMb,
      usagePct,
    };
  }, [jobs, games.length, snapshotCount]);

  // --------------------------------------------------------------------------
  // Auth Gate (Admin dashboard is strictly private)
  // --------------------------------------------------------------------------
  if (!authReady) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-16 text-center text-sm text-[#6E8492]">
        Verifying session...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-md mx-auto bg-[#1C2A32] border border-[#263844] rounded-xl p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#101820] border border-[#263844] flex items-center justify-center text-[#48D597] mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-[#E8EEF2]">
              Protected Owner Admin Console
            </h1>
            <p className="text-sm text-[#9BB0BD] leading-relaxed">
              {user
                ? `Signed in as ${user.email}, which does not have administrator privileges for RoMetric.`
                : 'Sign in with the verified owner Google account to manage tracked games, trigger live data collection, and monitor system health.'}
            </p>
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="w-full py-2.5 px-4 text-sm font-medium bg-[#101820] border border-[#263844] text-[#E8EEF2] rounded-lg hover:border-[#48D597] transition-colors cursor-pointer"
            >
              Sign out and switch account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full py-2.5 px-4 text-sm font-semibold bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286] transition-colors cursor-pointer"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#263844] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#48D597] font-medium">
            <Shield className="w-3.5 h-3.5" />
            <span>Authenticated Owner Console · {user.email}</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-[#E8EEF2]">
            RoMetric Operations & Collector
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={collecting || config.paused}
            onClick={() => void handleRunCollection('all', true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${collecting ? 'animate-spin' : ''}`}
            />
            {collecting
              ? progressText || 'Syncing live Roblox charts...'
              : 'Sync Live Top Charts (80+ Games)'}
          </button>

          <button
            type="button"
            disabled={collecting || config.paused}
            onClick={() => void handleRunCollection('manual', false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#1C2A32] border border-[#263844] text-[#E8EEF2] hover:border-[#48D597] disabled:opacity-50 rounded-lg cursor-pointer"
          >
            Refresh Tracked Only
          </button>

          <button
            type="button"
            onClick={() => setAutoCollect((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              autoCollect
                ? 'bg-[#48D597]/15 border-[#48D597] text-[#48D597]'
                : 'bg-[#1C2A32] border-[#263844] text-[#9BB0BD] hover:text-[#E8EEF2]'
            }`}
          >
            {autoCollect ? 'Auto-Collect Active (5m)' : 'Enable 5m Auto-Collect'}
          </button>

          <button
            type="button"
            onClick={() => void handleTogglePause()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#1C2A32] border border-[#263844] text-[#E8EEF2] hover:border-[#48D597] rounded-lg cursor-pointer"
          >
            {config.paused ? (
              <>
                <Play className="w-3.5 h-3.5 text-[#48D597]" />
                Resume Collection
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                Pause Collection
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#101820] border border-[#263844] text-[#9BB0BD] hover:text-[#E8EEF2] rounded-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-xl p-4 border text-sm flex items-center justify-between gap-4 ${
            statusMessage.type === 'success'
              ? 'bg-[#48D597]/10 border-[#48D597]/40 text-[#E8EEF2]'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#48D597] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs text-[#9BB0BD] hover:text-[#E8EEF2]"
          >
            Dismiss
          </button>
        </div>
      )}

      {!collecting && games.length > 0 && games.length < 25 && (
        <div className="rounded-xl p-4 border border-[#48D597]/35 bg-[#48D597]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-[#E8EEF2]">
            <span className="font-semibold">
              Only {games.length} experiences are currently saved in your database.
            </span>{' '}
            <span className="text-[#9BB0BD]">
              Click &ldquo;Sync Live Top Charts (80+ Games)&rdquo; to automatically
              discover and track Roblox&apos;s live Top Playing Now, Trending, and
              Up &amp; Coming charts alongside classics.
            </span>
          </div>
          <button
            type="button"
            disabled={collecting || config.paused}
            onClick={() => void handleRunCollection('all', true)}
            className="px-4 py-2 text-xs font-semibold bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286] whitespace-nowrap cursor-pointer shrink-0"
          >
            Sync 80+ Live Games Now
          </button>
        </div>
      )}

      {/* Operations KPI Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#6E8492]">Tracked Games</p>
          <p className="font-display text-2xl font-bold text-[#E8EEF2] tabular-nums">
            {formatExactNumber(games.length)}
          </p>
          <p className="text-xs text-[#9BB0BD]">
            {dataMode === 'persisted' ? 'Persisted in database' : 'Ready to seed'}
          </p>
        </div>

        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#6E8492]">Stored Raw Snapshots</p>
          <p className="font-display text-2xl font-bold text-[#48D597] tabular-nums">
            {formatExactNumber(snapshotCount)}
          </p>
          <p className="text-xs text-[#9BB0BD] tabular-nums">
            Retention window: {config.retentionRawHours}h raw
          </p>
        </div>

        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#6E8492]">Collection Success Rate</p>
          <p className="font-display text-2xl font-bold text-[#E8EEF2] tabular-nums">
            {metrics.successRate === 'N/A' ? 'N/A' : `${metrics.successRate}%`}
          </p>
          <p className="text-xs text-[#9BB0BD] tabular-nums">
            {metrics.failedJobs} failed · {metrics.totalApiCalls} API calls ·{' '}
            {metrics.total429} HTTP 429s
          </p>
        </div>

        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#6E8492]">Collector Health & Freshness</p>
          <p className="font-display text-xl font-bold text-[#E8EEF2]">
            {config.paused
              ? 'Paused'
              : metrics.lastSuccess
                ? 'Healthy'
                : 'Awaiting First Run'}
          </p>
          <p className="text-xs text-[#9BB0BD] tabular-nums">
            Last run:{' '}
            {metrics.lastSuccess
              ? formatRelativeTime(metrics.lastSuccess.completedAt)
              : formatRelativeTime(lastUpdatedAt)}
          </p>
        </div>
      </section>

      {/* Free-Tier Storage Monitor + Add Game Form */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#48D597]" />
              <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
                Free-Tier Database Storage
              </h2>
            </div>
            <span className="text-xs text-[#9BB0BD] tabular-nums">
              {metrics.estimatedMb} MB / {metrics.freeQuotaMb} MB
            </span>
          </div>

          <div className="w-full h-2.5 bg-[#101820] rounded-full overflow-hidden border border-[#263844]">
            <div
              className="h-full bg-[#48D597] transition-all"
              style={{ width: `${Math.max(2, metrics.usagePct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#6E8492]">
            <span>
              Policy: {config.retentionRawHours}h raw → {config.retentionHourlyDays}d
              hourly → permanent daily
            </span>
            <button
              type="button"
              disabled={pruning}
              onClick={() => void handlePruneRetention()}
              className="text-[#48D597] hover:underline font-medium cursor-pointer disabled:opacity-50"
            >
              {pruning ? 'Pruning...' : 'Prune expired raw'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#48D597]" />
            <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
              Add Roblox Experience to Tracking
            </h2>
          </div>

          <form
            onSubmit={handleAddGame}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              placeholder="Search game name (e.g. Steal An Egg), Universe ID, Place ID, or URL"
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#101820] border border-[#263844] rounded-lg text-[#E8EEF2] placeholder:text-[#6E8492] focus:outline-none focus:border-[#48D597]"
            />
            <select
              aria-label="Priority tier"
              value={addTier}
              onChange={(e) => setAddTier(e.target.value as TrackingTier)}
              className="px-3 py-2.5 text-sm bg-[#101820] border border-[#263844] rounded-lg text-[#E8EEF2] focus:outline-none focus:border-[#48D597]"
            >
              <option value="tier_1">Tier 1 (5m)</option>
              <option value="tier_2">Tier 2 (15m)</option>
              <option value="tier_3">Tier 3 (60m)</option>
            </select>
            <button
              type="submit"
              disabled={addingGame || !addInput.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {addingGame ? 'Verifying...' : 'Add Game'}
            </button>
          </form>
        </div>
      </section>

      {/* Tracked Catalog Management Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
            Managed Tracking List ({games.length})
          </h2>
          <div className="flex items-center gap-2">
            {(['tier_1', 'tier_2', 'tier_3'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                disabled={collecting || config.paused}
                onClick={() => void handleRunCollection(tier)}
                className="px-3 py-1.5 text-xs font-medium bg-[#1C2A32] border border-[#263844] text-[#9BB0BD] hover:text-[#48D597] hover:border-[#48D597]/50 rounded-md cursor-pointer disabled:opacity-50"
              >
                Collect {tier.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#162229] border-b border-[#263844] z-10">
                <tr className="text-xs font-medium text-[#9BB0BD]">
                  <th className="py-3 px-4">Experience</th>
                  <th className="py-3 px-3 text-right">Live CCU</th>
                  <th className="py-3 px-3 text-right">Snapshots</th>
                  <th className="py-3 px-3">Priority Tier</th>
                  <th className="py-3 px-3">Last Observed</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263844]/60 text-sm">
                {games.map((g) => (
                  <tr
                    key={g.universeId}
                    className="hover:bg-[#22333D]/70 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/games/${g.universeId}`}
                            className="font-medium text-[#E8EEF2] hover:text-[#48D597] truncate block max-w-[240px]"
                          >
                            {g.name}
                          </Link>
                          <span className="text-xs text-[#6E8492] tabular-nums">
                            Universe {g.universeId}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#E8EEF2] tabular-nums">
                      {formatCompactNumber(g.currentCcu)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs text-[#9BB0BD] tabular-nums">
                      {g.snapshotCount ?? 0}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        aria-label={`Priority for ${g.name}`}
                        value={g.trackingTier}
                        disabled={dataMode !== 'persisted'}
                        onChange={(e) =>
                          void handleTierChange(
                            g,
                            e.target.value as TrackingTier
                          )
                        }
                        className="px-2.5 py-1 text-xs bg-[#101820] border border-[#263844] rounded-md text-[#E8EEF2]"
                      >
                        <option value="tier_1">Tier 1 (5m)</option>
                        <option value="tier_2">Tier 2 (15m)</option>
                        <option value="tier_3">Tier 3 (60m)</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#6E8492] tabular-nums whitespace-nowrap">
                      {formatRelativeTime(g.lastCollectedAt)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={dataMode !== 'persisted'}
                        onClick={() => void handleRemoveGame(g)}
                        title="Remove game from tracking"
                        className="p-1.5 text-[#6E8492] hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Collection Jobs & System Error Logs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
            Recent Collection Jobs & Error Logs
          </h2>
          <button
            type="button"
            disabled={loadingAdmin}
            onClick={() => void loadAdminTelemetry()}
            className="text-xs font-medium text-[#48D597] hover:underline cursor-pointer"
          >
            Refresh logs
          </button>
        </div>

        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#263844] bg-[#162229] text-xs font-medium text-[#9BB0BD]">
                  <th className="py-3 px-4">Completed (UTC)</th>
                  <th className="py-3 px-3">Tier</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Games</th>
                  <th className="py-3 px-3 text-right">API Calls</th>
                  <th className="py-3 px-3 text-right">429s</th>
                  <th className="py-3 px-3 text-right">Duration</th>
                  <th className="py-3 px-4">Error Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263844]/60 text-xs">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#22333D]/50">
                    <td className="py-3 px-4 text-[#9BB0BD] tabular-nums whitespace-nowrap">
                      {formatUtcTimestamp(job.completedAt)}
                    </td>
                    <td className="py-3 px-3 text-[#E8EEF2] uppercase">
                      {job.tier.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          job.status === 'success'
                            ? 'text-[#48D597]'
                            : job.status === 'partial'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-[#E8EEF2] tabular-nums">
                      {job.gamesSucceeded}/{job.gamesAttempted}
                    </td>
                    <td className="py-3 px-3 text-right text-[#9BB0BD] tabular-nums">
                      {job.apiRequests}
                    </td>
                    <td className="py-3 px-3 text-right text-[#9BB0BD] tabular-nums">
                      {job.http429Count}
                    </td>
                    <td className="py-3 px-3 text-right text-[#9BB0BD] tabular-nums">
                      {(job.durationMs / 1000).toFixed(1)}s
                    </td>
                    <td className="py-3 px-4 text-[#6E8492] max-w-[280px] truncate">
                      {job.errorSummary || 'None'}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-[#6E8492]"
                    >
                      No collection jobs recorded yet. Click &ldquo;Sync Live
                      Top Charts (80+ Games)&rdquo; above to capture the first
                      persisted snapshot batch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
