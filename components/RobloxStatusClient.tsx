'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { formatExactNumber, formatUtcTimestamp } from '@/lib/format';
import { LiquidGlassCard } from '@/components/MotionPrimitives';

export interface StatusProbePayload {
  overall: 'operational' | 'degraded' | 'outage';
  checkedAt: string;
  trackedGames: number;
  totalLiveCcu: number;
  services: Array<{
    id: string;
    name: string;
    endpoint: string;
    status: 'operational' | 'degraded' | 'outage';
    httpStatus: number;
    latencyMs: number;
  }>;
}

function StatusLabel({
  status,
}: {
  status: 'operational' | 'degraded' | 'outage';
}) {
  if (status === 'operational') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
        <CheckCircle2 className="w-4 h-4" />
        Operational
      </span>
    );
  }
  if (status === 'degraded') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-4 h-4" />
        Degraded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
      <XCircle className="w-4 h-4" />
      Unreachable
    </span>
  );
}

export function RobloxStatusClient({
  initialData,
}: {
  initialData: StatusProbePayload;
}) {
  const [data, setData] = useState<StatusProbePayload>(initialData);
  const [checking, setChecking] = useState(false);

  const handleRecheck = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/roblox/status', { cache: 'no-store' });
      if (res.ok) {
        const next = (await res.json()) as StatusProbePayload;
        setData(next);
      }
    } catch {
      // Keep last valid state on transient client error
    } finally {
      setChecking(false);
    }
  };

  const headline =
    data.overall === 'operational'
      ? 'Roblox Public APIs Are Operational'
      : data.overall === 'degraded'
        ? 'Partial Roblox API Slowdown Detected'
        : 'Roblox Services Experiencing Disruption';

  return (
    <div className="space-y-6">
      <LiquidGlassCard className="rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <StatusLabel status={data.overall} />
          <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            {headline}
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
            Last verified {formatUtcTimestamp(data.checkedAt)} ·{' '}
            {formatExactNumber(data.totalLiveCcu)} live players tracked across{' '}
            {formatExactNumber(data.trackedGames)} games
          </p>
        </div>

        <button
          type="button"
          disabled={checking}
          onClick={() => void handleRecheck()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Run Live Check'}
        </button>
      </LiquidGlassCard>

      <LiquidGlassCard className="rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-900/8 dark:border-white/10">
          <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
            Live Endpoint Health Probes
          </h3>
        </div>
        <div className="divide-y divide-slate-900/8 dark:divide-white/8">
          {data.services.map((svc) => (
            <div
              key={svc.id}
              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {svc.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-[#7893A3] font-mono">
                  {svc.endpoint}
                </p>
              </div>
              <div className="flex items-center gap-6 text-xs tabular-nums">
                <span className="text-slate-500 dark:text-[#9CB3C0]">
                  HTTP {svc.httpStatus || 'ERR'}
                </span>
                <span className="text-slate-700 dark:text-[#C5D8E2] font-mono">
                  {svc.latencyMs} ms
                </span>
                <StatusLabel status={svc.status} />
              </div>
            </div>
          ))}
        </div>
      </LiquidGlassCard>
    </div>
  );
}
