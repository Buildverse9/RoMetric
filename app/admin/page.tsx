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
          text: `Collection finished (${result.job.status}): ${result.job.gamesSucceeded}/${result.job.gamesAttempted} games saved · ${result.job.apiRequests} API calls · ${result.job.http429Count} 429s · ${(result.job.durationMs / 1000).toFixed(1)}s`,
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
        text: `Added "${saved.name}" (Universe ${saved.universeId}) to ${addTier.replace('_', ' ').toUpperCase()}.`,
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
        text: `Removed "${game.name}" from tracking.`,
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
            ? `Deleted ${removed} raw snapshots older than ${config.retentionRawHours}h.`
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

  const metrics = useMemo(() => {
    const totalJobs = jobs.length;
    const succeededJobs = jobs.filter((j) => j.status === 'success').length;
    const failedJobs = jobs.filter((j) => j.status === 'failed').length;
    const successRate =
      totalJobs > 0 ? ((succeededJobs / totalJobs) * 100).toFixed(1) : 'N/A';
    const totalApiCalls = jobs.reduce((s, j) => s + j.apiRequests, 0);
    const total429 = jobs.reduce((s, j) => s + j.http429Count, 0);
    const lastSuccess = jobs.find((j) => j.status !== 'failed') ?? null;

    const estimatedDocs = games.length * 3 + snapshotCount + jobs.length;
    const estimatedMb = Number(((estimatedDocs * 1.2) / 1024).toFixed(2));
    const freeQuotaMb = 500;
    const usagePct = Math.min(
      100,
      Number(((estimatedMb / freeQuotaMb) * 100).toFixed(1))
    );

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

  if (!authReady) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16 text-center text-sm text-slate-500 dark:text-[#6F8796]">
        Verifying session...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-md mx-auto liquid-glass rounded-3xl p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/12 dark:bg-[#10E89A]/14 flex items-center justify-center text-emerald-600 dark:text-[#10E89A] mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA]">
              Admin Console
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
              {user
                ? `Signed in as ${user.email}, which does not have admin access.`
                : 'Sign in with the owner Google account to manage tracking and logs.'}
            </p>
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="w-full py-2.5 px-4 text-sm font-medium liquid-glass-pill text-slate-900 dark:text-[#F1F7FA] rounded-full hover:border-emerald-500/50 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full py-2.5 px-4 text-sm font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity cursor-pointer"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-6 space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-900/8 dark:border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-[#10E89A] font-semibold">
            <Shield className="w-3.5 h-3.5" />
            <span>Owner Console · {user.email}</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">
            Operations & Collector
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={collecting || config.paused}
            onClick={() => void handleRunCollection('all', true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${collecting ? 'animate-spin' : ''}`}
            />
            {collecting
              ? progressText || 'Syncing charts...'
              : 'Sync Live Charts (80+)'}
          </button>

          <button
            type="button"
            disabled={collecting || config.paused}
            onClick={() => void handleRunCollection('manual', false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium liquid-glass-pill text-slate-900 dark:text-[#F1F7FA] hover:border-emerald-500/50 disabled:opacity-50 rounded-full cursor-pointer"
          >
            Refresh Tracked
          </button>

          <button
            type="button"
            onClick={() => setAutoCollect((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
              autoCollect
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-[#10E89A]'
                : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            {autoCollect ? 'Auto-Collect On (5m)' : 'Auto-Collect (5m)'}
          </button>

          <button
            type="button"
            onClick={() => void handleTogglePause()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium liquid-glass-pill text-slate-900 dark:text-[#F1F7FA] hover:border-emerald-500/50 rounded-full cursor-pointer"
          >
            {config.paused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-500" />
                Pause
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white rounded-full cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`liquid-glass rounded-3xl p-4 text-sm flex items-center justify-between gap-4 ${
            statusMessage.type === 'success'
              ? 'border-emerald-500/40 text-slate-900 dark:text-[#F1F7FA]'
              : 'border-rose-500/40 text-rose-700 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs text-slate-500 dark:text-[#9CB3C0] hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {!collecting && games.length > 0 && games.length < 25 && (
        <div className="liquid-glass-hero rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-slate-900 dark:text-[#F1F7FA]">
            <span className="font-semibold">
              {games.length} games currently tracked.
            </span>{' '}
            <span className="text-slate-600 dark:text-[#9CB3C0]">
              Sync live charts to expand to 80+ games.
            </span>
          </div>
          <button
            type="button"
            disabled={collecting || config.paused}
            onClick={() => void handleRunCollection('all', true)}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 whitespace-nowrap cursor-pointer shrink-0"
          >
            Sync 80+ Games
          </button>
        </div>
      )}

      {/* Operations KPI Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="liquid-glass rounded-3xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#6F8796]">
            Tracked Games
          </p>
          <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {formatExactNumber(games.length)}
          </p>
          <p className="text-xs text-slate-500 dark:text-[#9CB3C0]">
            {dataMode === 'persisted' ? 'Database connected' : 'Ready to seed'}
          </p>
        </div>

        <div className="liquid-glass rounded-3xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#6F8796]">
            Stored Raw Snapshots
          </p>
          <p className="font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatExactNumber(snapshotCount)}
          </p>
          <p className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
            {config.retentionRawHours}h raw retention
          </p>
        </div>

        <div className="liquid-glass rounded-3xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#6F8796]">
            Success Rate
          </p>
          <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {metrics.successRate === 'N/A' ? 'N/A' : `${metrics.successRate}%`}
          </p>
          <p className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
            {metrics.failedJobs} failed · {metrics.total429} 429s
          </p>
        </div>

        <div className="liquid-glass rounded-3xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#6F8796]">Status</p>
          <p className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
            {config.paused
              ? 'Paused'
              : metrics.lastSuccess
                ? 'Healthy'
                : 'Pending'}
          </p>
          <p className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
            Last run:{' '}
            {metrics.lastSuccess
              ? formatRelativeTime(metrics.lastSuccess.completedAt)
              : formatRelativeTime(lastUpdatedAt)}
          </p>
        </div>
      </section>

      {/* Storage + Add Game */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 liquid-glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
                Storage Usage
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
              {metrics.estimatedMb} MB / {metrics.freeQuotaMb} MB
            </span>
          </div>

          <div className="w-full h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-[#10E89A] rounded-full transition-all"
              style={{ width: `${Math.max(2, metrics.usagePct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#6F8796]">
            <span>
              {config.retentionRawHours}h raw → {config.retentionHourlyDays}d
              hourly → daily
            </span>
            <button
              type="button"
              disabled={pruning}
              onClick={() => void handlePruneRetention()}
              className="text-emerald-600 dark:text-[#10E89A] hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              {pruning ? 'Pruning...' : 'Prune expired'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 liquid-glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
              Add Game to Tracking
            </h2>
          </div>

          <form
            onSubmit={handleAddGame}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              placeholder="Game name, Universe ID, Place ID, or URL"
              className="flex-1 px-4 py-2.5 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <select
              aria-label="Priority tier"
              value={addTier}
              onChange={(e) => setAddTier(e.target.value as TrackingTier)}
              className="px-4 py-2.5 text-sm liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] focus:outline-none"
            >
              <option value="tier_1" className="bg-white dark:bg-[#0D1A22]">
                Tier 1 (5m)
              </option>
              <option value="tier_2" className="bg-white dark:bg-[#0D1A22]">
                Tier 2 (15m)
              </option>
              <option value="tier_3" className="bg-white dark:bg-[#0D1A22]">
                Tier 3 (60m)
              </option>
            </select>
            <button
              type="submit"
              disabled={addingGame || !addInput.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {addingGame ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      </section>

      {/* Managed Tracking List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
            Managed Tracking List ({games.length})
          </h2>
          <div className="flex items-center gap-2">
            {(['tier_1', 'tier_2', 'tier_3'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                disabled={collecting || config.paused}
                onClick={() => void handleRunCollection(tier)}
                className="px-3.5 py-1.5 text-xs font-medium liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] rounded-full cursor-pointer disabled:opacity-50"
              >
                Collect {tier.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="liquid-glass rounded-3xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white/85 dark:bg-[#0E1A22]/90 backdrop-blur-md border-b border-slate-900/8 dark:border-white/10 z-10">
                <tr className="text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                  <th className="py-3.5 px-5">Game</th>
                  <th className="py-3.5 px-3 text-right">Live CCU</th>
                  <th className="py-3.5 px-3 text-right">Snapshots</th>
                  <th className="py-3.5 px-3">Tier</th>
                  <th className="py-3.5 px-3">Updated</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/6 dark:divide-white/8 text-sm">
                {games.map((g) => (
                  <tr
                    key={g.universeId}
                    className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/games/${g.universeId}`}
                            className="font-medium text-slate-900 dark:text-[#F1F7FA] hover:text-emerald-600 dark:hover:text-[#10E89A] truncate block max-w-[240px]"
                          >
                            {g.name}
                          </Link>
                          <span className="text-xs text-slate-500 dark:text-[#6F8796] tabular-nums">
                            {g.universeId}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                      {formatCompactNumber(g.currentCcu)}
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-slate-600 dark:text-[#9CB3C0] tabular-nums">
                      {g.snapshotCount ?? 0}
                    </td>
                    <td className="py-3 px-3">
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
                        className="px-3 py-1 text-xs liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA]"
                      >
                        <option
                          value="tier_1"
                          className="bg-white dark:bg-[#0D1A22]"
                        >
                          Tier 1 (5m)
                        </option>
                        <option
                          value="tier_2"
                          className="bg-white dark:bg-[#0D1A22]"
                        >
                          Tier 2 (15m)
                        </option>
                        <option
                          value="tier_3"
                          className="bg-white dark:bg-[#0D1A22]"
                        >
                          Tier 3 (60m)
                        </option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500 dark:text-[#6F8796] tabular-nums whitespace-nowrap">
                      {formatRelativeTime(g.lastCollectedAt)}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        disabled={dataMode !== 'persisted'}
                        onClick={() => void handleRemoveGame(g)}
                        title="Remove"
                        className="p-1.5 rounded-full text-slate-400 dark:text-[#6F8796] hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 cursor-pointer"
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

      {/* Collection Jobs & Error Logs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
            Recent Collection Jobs
          </h2>
          <button
            type="button"
            disabled={loadingAdmin}
            onClick={() => void loadAdminTelemetry()}
            className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline cursor-pointer"
          >
            Refresh logs
          </button>
        </div>

        <div className="liquid-glass rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                  <th className="py-3.5 px-5">Completed (UTC)</th>
                  <th className="py-3.5 px-3">Tier</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3 text-right">Games</th>
                  <th className="py-3.5 px-3 text-right">Calls</th>
                  <th className="py-3.5 px-3 text-right">429s</th>
                  <th className="py-3.5 px-3 text-right">Duration</th>
                  <th className="py-3.5 px-5">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/6 dark:divide-white/8 text-xs">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <td className="py-3 px-5 text-slate-600 dark:text-[#9CB3C0] tabular-nums whitespace-nowrap">
                      {formatUtcTimestamp(job.completedAt)}
                    </td>
                    <td className="py-3 px-3 text-slate-900 dark:text-[#F1F7FA] uppercase">
                      {job.tier.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          job.status === 'success'
                            ? 'text-emerald-600 dark:text-[#10E89A]'
                            : job.status === 'partial'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-900 dark:text-[#F1F7FA] tabular-nums">
                      {job.gamesSucceeded}/{job.gamesAttempted}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 dark:text-[#9CB3C0] tabular-nums">
                      {job.apiRequests}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 dark:text-[#9CB3C0] tabular-nums">
                      {job.http429Count}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 dark:text-[#9CB3C0] tabular-nums">
                      {(job.durationMs / 1000).toFixed(1)}s
                    </td>
                    <td className="py-3 px-5 text-slate-500 dark:text-[#6F8796] max-w-[280px] truncate">
                      {job.errorSummary || 'None'}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-slate-500 dark:text-[#6F8796]"
                    >
                      No collection jobs yet.
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
