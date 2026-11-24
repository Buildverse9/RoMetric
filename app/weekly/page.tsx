import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Calendar } from 'lucide-react';
import {
  formatWeekRangeLabel,
  getRecentWeekDates,
} from '@/lib/market-intelligence';
import { SITE_URL, getCurrentMonthYear, safeJsonLd } from '@/lib/seo';
import { LiquidGlassCard } from '@/components/MotionPrimitives';

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const monthYear = getCurrentMonthYear();
  return {
    title: `Weekly Roblox Market Recaps & Player Reports (${monthYear})`,
    description:
      'Browse weekly Roblox analytics recaps covering top-performing experiences, breakout climbers, leading studios, and genre market share.',
    alternates: { canonical: `${SITE_URL}/weekly` },
  };
}

export default function WeeklyArchivePage() {
  const weeks = getRecentWeekDates(12);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Weekly Roblox Market Recaps',
    url: `${SITE_URL}/weekly`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: weeks.length,
      itemListElement: weeks.map((w, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: `Roblox Weekly Recap (${formatWeekRangeLabel(w)})`,
        url: `${SITE_URL}/weekly/${w}`,
      })),
    },
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <header className="space-y-2 max-w-3xl">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#7893A3]">
          <Link
            href="/"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-700 dark:text-[#C5D8E2]">Weekly Recaps</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Weekly Roblox Market Recaps
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Structured weekly snapshots tracking the largest Roblox experiences,
          fastest-rising breakouts, studio leaders, and category shifts.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {weeks.map((week, idx) => (
          <Link
            key={week}
            href={`/weekly/${week}`}
            className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <LiquidGlassCard className="rounded-2xl p-5 h-full flex items-center justify-between gap-4 group-hover:border-emerald-500/40 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#7893A3]">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                  <span>{idx === 0 ? 'Current Week' : `Week of ${week}`}</span>
                </div>
                <p className="font-display text-base font-bold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors">
                  {formatWeekRangeLabel(week)}
                </p>
                <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                  Top games · Breakouts · Studio leaders
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] shrink-0 transition-colors" />
            </LiquidGlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
