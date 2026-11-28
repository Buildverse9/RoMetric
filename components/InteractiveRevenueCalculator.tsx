'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, GitCompare, RotateCcw } from 'lucide-react';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { formatCurrencyCompact } from '@/lib/revenue';
import { LiquidGlassCard } from '@/components/MotionPrimitives';

type MonetizationTier = 'casual' | 'baseline' | 'high_sim';

const TIER_META: Record<
  MonetizationTier,
  { label: string; multiplier: number; hint: string }
> = {
  casual: {
    label: 'Casual / Obby',
    multiplier: 0.65,
    hint: 'Lower gamepass & microtransaction density',
  },
  baseline: {
    label: 'Genre Baseline',
    multiplier: 1.0,
    hint: 'RoMetric genre-calibrated DevEx benchmark',
  },
  high_sim: {
    label: 'High Sim / Anime',
    multiplier: 1.45,
    hint: 'Aggressive passes, gacha rolls & VIP boosts',
  },
};

interface InteractiveRevenueCalculatorProps {
  gameName: string;
  universeId: string;
  baseCcu: number;
  baseMonthlyUsd: number;
  baseMonthlyRobux: number;
  topPeerUniverseId?: string | null;
  topPeerName?: string | null;
}

export function InteractiveRevenueCalculator({
  gameName,
  universeId,
  baseCcu,
  baseMonthlyUsd,
  baseMonthlyRobux,
  topPeerUniverseId,
  topPeerName,
}: InteractiveRevenueCalculatorProps) {
  const safeBaseCcu = Math.max(10, Math.round(baseCcu || 100));
  const maxCcu = Math.max(25_000, Math.round(safeBaseCcu * 4));
  const [simulatedCcu, setSimulatedCcu] = useState<number>(safeBaseCcu);
  const [tier, setTier] = useState<MonetizationTier>('baseline');

  const computed = useMemo(() => {
    const ratio = simulatedCcu / safeBaseCcu;
    const mult = TIER_META[tier].multiplier;
    const monthlyUsd = Math.round(baseMonthlyUsd * ratio * mult);
    const dailyUsd = Math.round(monthlyUsd / 30);
    const yearlyUsd = Math.round(monthlyUsd * 12);
    const monthlyRobux = Math.round(baseMonthlyRobux * ratio * mult);
    return { monthlyUsd, dailyUsd, yearlyUsd, monthlyRobux };
  }, [simulatedCcu, safeBaseCcu, tier, baseMonthlyUsd, baseMonthlyRobux]);

  const isModified = simulatedCcu !== safeBaseCcu || tier !== 'baseline';

  return (
    <LiquidGlassCard className="rounded-3xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] inline-flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5" />
            Interactive DevEx Revenue Simulator
          </p>
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            What If {gameName} Scales Up or Down?
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {isModified && (
            <button
              type="button"
              onClick={() => {
                setSimulatedCcu(safeBaseCcu);
                setTier('baseline');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium liquid-glass-pill rounded-full text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Live
            </button>
          )}
          {topPeerUniverseId && (
            <Link
              href={`/compare?ids=${universeId},${topPeerUniverseId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold liquid-glass-pill rounded-full text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/50 transition-colors"
            >
              <GitCompare className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
              Compare vs {topPeerName || 'Top Peer'}
            </Link>
          )}
        </div>
      </div>

      {/* CCU Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label
            htmlFor="revenue-ccu-slider"
            className="font-medium text-slate-600 dark:text-[#9CB3C0]"
          >
            Simulated Live Concurrent Players (CCU)
          </label>
          <span className="font-mono text-sm font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(simulatedCcu)} CCU
          </span>
        </div>
        <input
          id="revenue-ccu-slider"
          type="range"
          min={10}
          max={maxCcu}
          step={maxCcu > 50_000 ? 100 : 10}
          value={simulatedCcu}
          onChange={(e) => setSimulatedCcu(Number(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-slate-400 dark:text-[#6F8796] tabular-nums">
          <span>10 CCU</span>
          <span>Live: {formatCompactNumber(safeBaseCcu)}</span>
          <span>{formatCompactNumber(maxCcu)} CCU</span>
        </div>
      </div>

      {/* Monetization Tier Selector */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600 dark:text-[#9CB3C0]">
          Monetization Intensity
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(Object.keys(TIER_META) as MonetizationTier[]).map((key) => {
            const active = tier === key;
            const info = TIER_META[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTier(key)}
                className={`p-3 rounded-2xl text-left transition-colors border cursor-pointer ${
                  active
                    ? 'bg-emerald-500/12 dark:bg-[#10E89A]/14 border-emerald-500/45 text-slate-950 dark:text-white'
                    : 'bg-black/[0.02] dark:bg-white/[0.03] border-slate-900/8 dark:border-white/10 text-slate-600 dark:text-[#9CB3C0] hover:border-emerald-500/30'
                }`}
              >
                <p className="text-xs font-semibold">{info.label}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{info.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Simulated Outputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-900/8 dark:border-white/10">
        <div className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
          <p className="text-[11px] text-slate-500 dark:text-[#7893A3]">
            Est. Daily USD
          </p>
          <p className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white tabular-nums">
            {formatCurrencyCompact(computed.dailyUsd)}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-500/[0.08] dark:bg-[#10E89A]/[0.1] border border-emerald-500/25">
          <p className="text-[11px] text-emerald-700 dark:text-[#10E89A]">
            Est. Monthly USD
          </p>
          <p className="mt-1 font-display text-lg font-bold text-emerald-700 dark:text-[#10E89A] tabular-nums">
            {formatCurrencyCompact(computed.monthlyUsd)}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
          <p className="text-[11px] text-slate-500 dark:text-[#7893A3]">
            Est. Annual USD
          </p>
          <p className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white tabular-nums">
            {formatCurrencyCompact(computed.yearlyUsd)}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-black/[0.025] dark:bg-white/[0.035]">
          <p className="text-[11px] text-slate-500 dark:text-[#7893A3]">
            Est. Monthly Robux
          </p>
          <p className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white tabular-nums">
            {formatCompactNumber(computed.monthlyRobux)} R$
          </p>
        </div>
      </div>
    </LiquidGlassCard>
  );
}
