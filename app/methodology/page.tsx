import React from 'react';
import Link from 'next/link';
import { OFFICIAL_DATA_SOURCES } from '@/lib/analytics-store';

export const metadata = {
  title: 'About & Methodology',
  description:
    'Learn how RoMetric collects public Roblox data, computes growth metrics, protects data accuracy, and handles revenue estimation.',
};

export default function MethodologyPage() {
  return (
    <div className="max-w-[980px] mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
      <header className="space-y-3 border-b border-[#263844] pb-8">
        <p className="text-xs font-medium text-[#48D597]">
          Transparency & Data Provenance
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#E8EEF2]">
          About RoMetric & Methodology
        </h1>
        <p className="text-base text-[#9BB0BD] leading-relaxed">
          RoMetric is an independent Roblox analytics and market intelligence
          platform. Our core principle is simple: data accuracy matters more
          than inflated numbers or filled-in charts.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
          1. Where the Data Comes From
        </h2>
        <p className="text-sm text-[#9BB0BD] leading-relaxed">
          RoMetric collects data exclusively from official, publicly accessible
          Roblox web endpoints without using private credentials, leaked API
          keys, or unauthorized third-party datasets. Every stored observation
          records its source endpoint and exact UTC timestamp.
        </p>
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl overflow-hidden divide-y divide-[#263844]">
          {OFFICIAL_DATA_SOURCES.map((ds) => (
            <div key={ds.id} className="p-4 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#E8EEF2]">
                  {ds.name}
                </h3>
                <span className="text-xs text-[#48D597] tabular-nums">
                  Max batch: {ds.batchLimit} Universe IDs / request
                </span>
              </div>
              <p className="text-xs font-mono text-[#6E8492]">{ds.endpoint}</p>
              <p className="text-xs text-[#9BB0BD]">{ds.notes}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
          2. Collection Cadence & Historical Storage
        </h2>
        <p className="text-sm text-[#9BB0BD] leading-relaxed">
          Roblox does not provide public historical CCU timelines for every
          experience. RoMetric builds and owns its historical record over time
          using tiered collection schedules designed to respect API rate limits
          and fit within free-tier database storage:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 space-y-1.5">
            <p className="font-semibold text-[#48D597]">Tier 1 · Top 100</p>
            <p className="text-sm font-semibold text-[#E8EEF2]">
              Every ~5 minutes
            </p>
            <p className="text-[#9BB0BD]">
              High-frequency snapshots for flagship high-concurrency experiences.
            </p>
          </div>
          <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 space-y-1.5">
            <p className="font-semibold text-[#48D597]">Tier 2 · Next 900</p>
            <p className="text-sm font-semibold text-[#E8EEF2]">
              Every ~15 minutes
            </p>
            <p className="text-[#9BB0BD]">
              Balanced cadence for active mid-tier and rising experiences.
            </p>
          </div>
          <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-4 space-y-1.5">
            <p className="font-semibold text-[#48D597]">Tier 3 · Catalog</p>
            <p className="text-sm font-semibold text-[#E8EEF2]">
              Every ~60 minutes
            </p>
            <p className="text-[#9BB0BD]">
              Hourly monitoring for broader ecosystem tracking and discovery.
            </p>
          </div>
        </div>
        <p className="text-sm text-[#9BB0BD] leading-relaxed">
          Raw immutable snapshots (`game_snapshots`) are never overwritten. To
          maintain fast queries and sustainable storage, snapshots are rolled up
          into hourly (`game_hourly_stats`) and permanent daily summaries
          (`game_daily_stats`). All timestamps are recorded in UTC.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
          3. Growth Percentages & Trending Discovery
        </h2>
        <div className="bg-[#1C2A32] border border-[#263844] rounded-xl p-5 space-y-3 text-sm text-[#9BB0BD] leading-relaxed">
          <p>
            <strong className="text-[#E8EEF2]">Growth Formula:</strong>{' '}
            <code className="text-xs text-[#48D597] bg-[#101820] px-2 py-0.5 rounded">
              ((Current CCU − Baseline CCU) / Baseline CCU) × 100
            </code>
          </p>
          <p>
            If RoMetric does not yet hold a real stored observation near the
            requested lookback window (1h, 24h, 7d, or 30d), we display{' '}
            <strong className="text-[#E8EEF2]">N/A</strong> rather than guessing
            or interpolating missing history.
          </p>
          <p>
            <strong className="text-[#E8EEF2]">Trending Eligibility:</strong> To
            prevent tiny games jumping from 1 to 10 players (+900%) from
            dominating discovery, Trending requires at least{' '}
            <strong className="text-[#E8EEF2]">50 live CCU</strong> and at least{' '}
            <strong className="text-[#E8EEF2]">2 stored snapshots</strong>,
            combining relative percentage velocity with log-scaled absolute
            player additions and observation completeness.
          </p>
        </div>
      </section>

      <section id="revenue" className="space-y-4 scroll-mt-24">
        <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
          4. Estimated Revenue Policy (Currently Disabled)
        </h2>
        <p className="text-sm text-[#9BB0BD] leading-relaxed">
          Actual Roblox game revenue, DevEx payouts, and ARPDAU are private to
          experience creators and are not exposed on public Roblox endpoints.
          RoMetric will never present invented dollar figures as official
          earnings. Revenue estimation ranges remain disabled until an opt-in
          benchmark model is validated with clear assumptions and confidence
          intervals.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-[#E8EEF2]">
          5. Data Limitations & Provenance
        </h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-[#9BB0BD] leading-relaxed">
          <li>
            <strong>History Start Date:</strong> Historical charts begin on the
            exact date RoMetric started tracking an experience—never backfilled.
          </li>
          <li>
            <strong>Observed Peak vs. Official All-Time Record:</strong>{' '}
            &ldquo;Highest Observed CCU&rdquo; reflects the maximum concurrent
            player count directly witnessed by RoMetric&apos;s collector and may
            differ from historical peaks achieved prior to tracking.
          </li>
          <li>
            <strong>Rate-Limit Gaps:</strong> Temporary Roblox API maintenance or
            HTTP 429 rate-limit pauses may create gaps in raw timelines; gaps
            are left transparent rather than smoothed with fake points.
          </li>
        </ul>
      </section>

      <section
        id="disclaimer"
        className="bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-2 scroll-mt-24"
      >
        <h2 className="font-display text-lg font-bold text-[#E8EEF2]">
          Roblox Affiliation Disclaimer
        </h2>
        <p className="text-sm text-[#9BB0BD] leading-relaxed">
          RoMetric is an independent analytics platform and is not affiliated
          with, endorsed by, sponsored by, or officially connected with Roblox
          Corporation. &ldquo;Roblox&rdquo; and all experience titles, icons,
          and thumbnails remain the property of their respective copyright and
          trademark owners.
        </p>
        <div className="pt-2">
          <Link
            href="/rankings"
            className="text-xs font-semibold text-[#48D597] hover:underline"
          >
            Explore live verified rankings →
          </Link>
        </div>
      </section>
    </div>
  );
}
