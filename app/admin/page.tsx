'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
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
  Share2,
  Shield,
  Ticket,
  Trash2,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import {
  addGameToTracking,
  DEFAULT_SYSTEM_CONFIG,
  fetchAdminTelemetry,
  fetchSystemConfig,
  pruneExpiredRawSnapshots,
  removeGameFromTracking,
  runCollectionCycle,
  saveSystemConfig,
  updateGameTrackingSettings,
  type AdminTelemetrySnapshot,
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
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import { AdminCodesPanel } from '@/components/AdminCodesPanel';
import { AdminSocialStudio } from '@/components/AdminSocialStudio';

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
  const [telemetry, setTelemetry] = useState<AdminTelemetrySnapshot | null>(null);
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
  const [listFilter, setListFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [adminTab, setAdminTab] = useState<'analytics' | 'codes' | 'social'>('analytics');

  const jobs = useMemo(() => telemetry?.jobs ?? [], [telemetry]);
  const snapshotCount = telemetry?.snapshotCount ?? 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(listFilter.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [listFilter]);

  const loadAdminTelemetry = useCallback(
    async (searchQuery = debouncedFilter) => {
      if (!isAdmin) return;
      setLoadingAdmin(true);
      try {
        const [cfg, snap] = await Promise.all([
          fetchSystemConfig().catch(() => DEFAULT_SYSTEM_CONFIG),
          fetchAdminTelemetry(searchQuery),
        ]);
        setConfig(cfg);
        setTelemetry(snap);
      } catch (err) {
        console.error('Admin telemetry error:', err);
        setStatusMessage({
          type: 'error',
          text: 'Unable to load admin telemetry. Please verify your admin permissions.',
        });
      } finally {
        setLoadingAdmin(false);
      }
    },
    [isAdmin, debouncedFilter]
  );

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function init() {
      setLoadingAdmin(true);
      try {
        const [cfg, snap] = await Promise.all([
          fetchSystemConfig().catch(() => DEFAULT_SYSTEM_CONFIG),
          fetchAdminTelemetry(debouncedFilter),
        ]);
        if (!cancelled) {
          setConfig(cfg);
          setTelemetry(snap);
        }
      } catch (err) {
        console.error('Admin telemetry error:', err);
        if (!cancelled) {
          setStatusMessage({
            type: 'error',
            text: 'Unable to load admin telemetry. Please verify your admin permissions.',
          });
        }
      } finally {
        if (!cancelled) setLoadingAdmin(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, debouncedFilter]);

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
      await Promise.all([refreshCatalog(false), loadAdminTelemetry()]);
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
      await Promise.all([refreshCatalog(false), loadAdminTelemetry()]);
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

    const isSupabaseLive = telemetry?.source === 'supabase';
    const totalTrackedGames = isSupabaseLive
      ? telemetry.totalActiveGames
      : games.length;
    const hourlyRows = telemetry?.hourlyRowCount ?? 0;
    const dailyRows = telemetry?.dailyRowCount ?? 0;

    // Realistic PostgreSQL row + index footprint estimate on Supabase Free 500 MB
    const estimatedKb =
      totalTrackedGames * 1.4 +
      snapshotCount * 0.25 +
      hourlyRows * 0.25 +
      dailyRows * 0.25 +
      totalJobs * 0.6;
    const estimatedMb = Number((estimatedKb / 1024).toFixed(1));
    const freeQuotaMb = 500;
    const usagePct = Math.min(
      100,
      Number(((estimatedMb / freeQuotaMb) * 100).toFixed(1))
    );

    const freshWithin35m = isSupabaseLive
      ? telemetry.freshGames35m
      : (() => {
          const fallbackMs = lastUpdatedAt ? new Date(lastUpdatedAt).getTime() : 0;
          if (!Number.isFinite(fallbackMs) || fallbackMs <= 0) return 0;
          return games.filter((g) => {
            const ts = new Date(g.lastCollectedAt).getTime();
            return Number.isFinite(ts) && fallbackMs - ts <= 35 * 60 * 1000;
          }).length;
        })();

    const lastArchiveJob =
      jobs.find((j) => j.triggeredBy === 'google_apps_script_archive') ?? null;

    return {
      totalTrackedGames,
      hourlyRows,
      dailyRows,
      totalJobs,
      failedJobs,
      successRate,
      totalApiCalls,
      total429,
      lastSuccess,
      lastArchiveJob,
      estimatedMb,
      freeQuotaMb,
      usagePct,
      freshWithin35m,
      warmD1Configured: Boolean(telemetry?.warmD1Configured),
      fetchedAt: telemetry?.fetchedAt ?? lastUpdatedAt,
    };
  }, [jobs, games, snapshotCount, telemetry, lastUpdatedAt]);

  const filteredManagedGames = useMemo(() => {
    if (telemetry?.source === 'supabase') {
      // Live uncached games directly from Supabase (already server-filtered by debouncedFilter)
      return telemetry.games;
    }
    const q = listFilter.trim().toLowerCase();
    const matched = q
      ? games.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.universeId.includes(q) ||
            g.creatorName.toLowerCase().includes(q)
        )
      : games;
    return matched.slice(0, 150);
  }, [telemetry, games, listFilter]);

  const formatJobSource = (triggeredBy: string): string => {
    if (triggeredBy === 'cloudflare_cron_1m_pulse') return 'Cloudflare 1m Pulse';
    if (triggeredBy === 'cloudflare_cron_15m_breakout') return 'Cloudflare 15m Breakout + D1';
    if (triggeredBy === 'cloudflare_cron_30m_pulse') return 'Cloudflare 30m Pulse';
    if (triggeredBy === 'cloudflare_cron_15m_sweep') return 'Cloudflare 15m Sweep';
    if (triggeredBy === 'cloudflare_cron_tier1') return 'Cloudflare Tier 1';
    if (triggeredBy === 'google_apps_script_discover') return 'Apps Script Discovery';
    if (triggeredBy === 'google_apps_script_votes') return 'Apps Script Votes';
    if (triggeredBy === 'google_apps_script_archive') return 'Google Drive Archive';
    if (triggeredBy === 'google_apps_script_codes') return 'Apps Script Codes';
    if (triggeredBy.includes('cloudflare')) return 'Cloudflare Cron';
    return triggeredBy;
  };

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
          <div className="inline-flex items-center justify-center rounded-2xl overflow-hidden bg-[#091318] px-4 py-2.5 border border-emerald-500/25 shadow-sm mx-auto">
            <Image
              src="/assets/aistudio/logowithName_50295ff0.png"
              alt="RoMetric — Operations & Analytics"
              width={210}
              height={62}
              referrerPolicy="no-referrer"
              className="h-11 w-auto object-contain"
            />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] inline-flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
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
              : 'Sync Live Charts (500+)'}
          </button>

          <button
            type="button"
            disabled={loadingAdmin}
            onClick={() => void loadAdminTelemetry()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium liquid-glass-pill text-slate-900 dark:text-[#F1F7FA] hover:border-emerald-500/50 disabled:opacity-50 rounded-full cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingAdmin ? 'animate-spin' : ''}`}
            />
            {loadingAdmin ? 'Refreshing...' : 'Refresh Live Data'}
          </button>

          <button
            type="button"
            disabled={collecting || config.paused}
            onClick={() => void handleRunCollection('manual', false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium liquid-glass-pill text-slate-900 dark:text-[#F1F7FA] hover:border-emerald-500/50 disabled:opacity-50 rounded-full cursor-pointer"
          >
            Collect Tracked
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

      {/* Admin Section Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAdminTab('analytics')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            adminTab === 'analytics'
              ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
              : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Analytics & Collector
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('codes')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            adminTab === 'codes'
              ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
              : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          Game Codes
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('social')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            adminTab === 'social'
              ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
              : 'liquid-glass-pill text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          Social Studio
        </button>
      </div>

      {adminTab === 'codes' ? (
        <AdminCodesPanel />
      ) : adminTab === 'social' ? (
        <AdminSocialStudio />
      ) : (
        <>
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

      {!collecting && metrics.totalTrackedGames > 0 && metrics.totalTrackedGames < 150 && (
        <div className="liquid-glass-hero rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-slate-900 dark:text-[#F1F7FA]">
            <span className="font-semibold">
              {formatExactNumber(metrics.totalTrackedGames)} games currently tracked.
            </span>{' '}
            <span className="text-slate-600 dark:text-[#9CB3C0]">
              Sync live Roblox Explore charts (or run your Google Apps Script sidecar) to discover and track all active 25+ CCU experiences.
            </span>
          </div>
          <button
            type="button"
            disabled={collecting || config.paused}
            onClick={() => void handleRunCollection('all', true)}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 whitespace-nowrap cursor-pointer shrink-0"
          >
            Sync 500+ Games
          </button>
        </div>
      )}

      {/* Operations KPI Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LiquidGlassCard
          exportTitle="RoMetric — Tracked Games"
          className="rounded-3xl p-5 space-y-1"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Tracked Games (Live DB)
          </p>
          <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {formatExactNumber(metrics.totalTrackedGames)}
          </p>
          <p className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
            {dataMode === 'persisted' || telemetry?.source === 'supabase'
              ? `${formatExactNumber(metrics.freshWithin35m)}/${formatExactNumber(metrics.totalTrackedGames)} updated ≤ 35m`
              : 'Ready to seed'}
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard
          exportTitle="RoMetric — Stored Snapshots"
          className="rounded-3xl p-5 space-y-1"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Hot Snapshots (Tier 1)
          </p>
          <p className="font-display text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatExactNumber(snapshotCount)}
          </p>
          <p className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
            {formatExactNumber(metrics.hourlyRows)} hourly · {formatExactNumber(metrics.dailyRows)} daily
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard
          exportTitle="RoMetric — Collector Success Rate"
          className="rounded-3xl p-5 space-y-1"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Success Rate (Last 25)
          </p>
          <p className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA] tabular-nums">
            {metrics.successRate === 'N/A' ? 'N/A' : `${metrics.successRate}%`}
          </p>
          <p className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
            {metrics.failedJobs} failed · {metrics.total429} 429s
          </p>
        </LiquidGlassCard>

        <LiquidGlassCard
          exportTitle="RoMetric — System Status"
          className="rounded-3xl p-5 space-y-1"
        >
          <p className="text-xs text-slate-500 dark:text-[#6F8796] pr-7">
            Collector Status
          </p>
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
              : formatRelativeTime(metrics.fetchedAt)}
          </p>
        </LiquidGlassCard>
      </section>

      {/* Storage + Add Game */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <LiquidGlassCard
          exportTitle="RoMetric — Storage Usage"
          className="lg:col-span-5 rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between pr-9">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
                3-Tier Storage Architecture
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#9CB3C0] tabular-nums">
              ~{metrics.estimatedMb} MB / {metrics.freeQuotaMb} MB Hot
            </span>
          </div>

          <div className="w-full h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-[#10E89A] rounded-full transition-all"
              style={{ width: `${Math.max(2, metrics.usagePct)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#6F8796]">
            <span>
              Tier 1: 12h raw · 3d hourly · 90d daily · Tier 2 D1:{' '}
              <span className={metrics.warmD1Configured ? 'text-emerald-600 dark:text-[#10E89A] font-medium' : ''}>
                {metrics.warmD1Configured ? 'Connected' : 'Ready'}
              </span>
              {' · '}Tier 3 Drive
              {metrics.lastArchiveJob
                ? ` (${formatRelativeTime(metrics.lastArchiveJob.completedAt)})`
                : ''}
            </span>
            <button
              type="button"
              disabled={pruning}
              onClick={() => void handlePruneRetention()}
              className="text-emerald-600 dark:text-[#10E89A] hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              {pruning ? 'Rolling up...' : 'Rollup & Prune'}
            </button>
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard
          exportTitle="RoMetric — Add Game"
          className="lg:col-span-7 rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 pr-9">
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
                Tier 2 (30m)
              </option>
              <option value="tier_3" className="bg-white dark:bg-[#0D1A22]">
                Tier 3 (30m)
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
        </LiquidGlassCard>
      </section>

      {/* Managed Tracking List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F1F7FA]">
              Managed Tracking List ({formatExactNumber(metrics.totalTrackedGames)})
            </h2>
            <input
              type="text"
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              placeholder="Search all games or ID..."
              className="px-3.5 py-1.5 text-xs liquid-glass-pill rounded-full text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 w-52"
            />
          </div>
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

        <LiquidGlassCard
          exportTitle="RoMetric — Managed Tracking List"
          className="rounded-3xl overflow-hidden"
        >
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white/85 dark:bg-[#0E1A22]/90 backdrop-blur-md border-b border-slate-900/8 dark:border-white/10 z-10">
                <tr className="text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                  <th className="py-3.5 px-5">Game</th>
                  <th className="py-3.5 px-3 text-right">Live CCU</th>
                  <th className="py-3.5 px-3 text-right">Total Visits</th>
                  <th className="py-3.5 px-3">Tier</th>
                  <th className="py-3.5 px-3">Updated</th>
                  <th className="py-3.5 pl-3 pr-12 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/6 dark:divide-white/8 text-sm">
                {filteredManagedGames.map((g) => (
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
                      {formatCompactNumber(g.totalVisits)}
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
                          Tier 2 (30m)
                        </option>
                        <option
                          value="tier_3"
                          className="bg-white dark:bg-[#0D1A22]"
                        >
                          Tier 3 (30m)
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
        </LiquidGlassCard>
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

        <LiquidGlassCard
          exportTitle="RoMetric — Recent Collection Jobs"
          className="rounded-3xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                  <th className="py-3.5 px-5">Completed (UTC)</th>
                  <th className="py-3.5 px-3">Source</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3 text-right">Games</th>
                  <th className="py-3.5 px-3 text-right">Calls</th>
                  <th className="py-3.5 px-3 text-right">429s</th>
                  <th className="py-3.5 px-3 text-right">Duration</th>
                  <th className="py-3.5 pl-3 pr-12">Notes / Errors</th>
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
                    <td className="py-3 px-3 text-slate-900 dark:text-[#F1F7FA] whitespace-nowrap">
                      {formatJobSource(job.triggeredBy)}
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
        </LiquidGlassCard>
      </section>
        </>
      )}
    </div>
  );
}
