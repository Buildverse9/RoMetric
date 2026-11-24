import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getGamesSortedByRecentUpdate } from '@/lib/market-intelligence';
import { formatExactNumber } from '@/lib/format';
import { SITE_URL, getCurrentMonthYear, safeJsonLd } from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { UpdatesFeedClient } from '@/components/UpdatesFeedClient';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 120;

export function generateMetadata(): Metadata {
  const monthYear = getCurrentMonthYear();
  return {
    title: `Live Roblox Game Updates & Patch Tracker (${monthYear})`,
    description: `See which Roblox games just pushed a live update in ${monthYear}. Track recent patches, event releases, and post-update player surges in real time.`,
    alternates: { canonical: `${SITE_URL}/updates` },
    openGraph: {
      title: `Live Roblox Game Updates Tracker (${monthYear}) | RoMetric`,
      description:
        'Real-time feed of newly updated Roblox games paired with live concurrent player growth.',
      url: `${SITE_URL}/updates`,
      type: 'website',
    },
  };
}

async function loadUpdatesSnapshot() {
  const nowMs = Date.now();
  let games: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      games = await fetchSupabaseGamesList();
    } catch {
      games = [];
    }
  }
  const sortedByUpdate = getGamesSortedByRecentUpdate(games);
  const updated24h = sortedByUpdate.filter(
    (g) =>
      g.robloxUpdatedAt &&
      nowMs - new Date(g.robloxUpdatedAt).getTime() <= 24 * 3_600_000
  );
  const updated7d = sortedByUpdate.filter(
    (g) =>
      g.robloxUpdatedAt &&
      nowMs - new Date(g.robloxUpdatedAt).getTime() <= 7 * 86_400_000
  );
  const surgingUpdated = updated24h.filter(
    (g) => typeof g.growth24h === 'number' && g.growth24h > 10
  );
  return { nowMs, sortedByUpdate, updated24h, updated7d, surgingUpdated };
}

export default async function UpdatesDirectoryPage() {
  const monthYear = getCurrentMonthYear();
  const { nowMs, sortedByUpdate, updated24h, updated7d, surgingUpdated } =
    await loadUpdatesSnapshot();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Live Roblox Game Updates (${monthYear})`,
    url: `${SITE_URL}/updates`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: Math.min(50, sortedByUpdate.length),
      itemListElement: sortedByUpdate.slice(0, 50).map((g, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: `${g.name} Updates`,
        url: `${SITE_URL}/games/${g.universeId}/updates`,
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
          <span className="text-slate-700 dark:text-[#C5D8E2]">Updates</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Live Roblox Game Updates
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Real-time patch velocity across {formatExactNumber(sortedByUpdate.length)}{' '}
          tracked Roblox experiences—spot fresh updates and post-patch player
          surges as they happen.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Updated in Last 24 Hours
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(updated24h.length)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Updated in Last 7 Days
          </p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatExactNumber(updated7d.length)}
          </p>
        </LiquidGlassCard>
        <LiquidGlassCard className="rounded-2xl p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
            Post-Update Surges (+10% 24h)
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
            {formatExactNumber(surgingUpdated.length)}
          </p>
        </LiquidGlassCard>
      </div>

      <UpdatesFeedClient games={sortedByUpdate} referenceNowMs={nowMs} />
    </div>
  );
}
