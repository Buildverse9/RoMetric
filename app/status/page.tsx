import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, getCurrentMonthYear, safeJsonLd } from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import {
  RobloxStatusClient,
  type StatusProbePayload,
} from '@/components/RobloxStatusClient';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const monthYear = getCurrentMonthYear();
  return {
    title: `Is Roblox Down? Live Platform & API Status (${monthYear})`,
    description:
      'Check if Roblox is down right now with real-time probes of Roblox Games, Votes, Thumbnails, and Universe APIs plus live global player counts.',
    alternates: { canonical: `${SITE_URL}/status` },
  };
}

async function runInitialProbe(): Promise<StatusProbePayload> {
  const targets = [
    {
      id: 'roblox_games',
      name: 'Roblox Games API',
      url: 'https://games.roblox.com/v1/games?universeIds=994732206',
    },
    {
      id: 'roblox_votes',
      name: 'Roblox Votes API',
      url: 'https://games.roblox.com/v1/games/votes?universeIds=994732206',
    },
    {
      id: 'roblox_thumbnails',
      name: 'Roblox Thumbnails CDN',
      url: 'https://thumbnails.roblox.com/v1/games/icons?universeIds=994732206&size=150x150&format=Png&isCircular=false',
    },
    {
      id: 'roblox_universes',
      name: 'Roblox Universes Resolver',
      url: 'https://apis.roblox.com/universes/v1/places/2753915549/universe',
    },
  ];

  const services = await Promise.all(
    targets.map(async (t) => {
      const started = Date.now();
      const c = new AbortController();
      const timer = setTimeout(() => c.abort(), 4500);
      try {
        const res = await fetch(t.url, {
          signal: c.signal,
          cache: 'no-store',
        });
        clearTimeout(timer);
        const latencyMs = Date.now() - started;
        const status: 'operational' | 'degraded' | 'outage' = res.ok
          ? latencyMs > 2500
            ? 'degraded'
            : 'operational'
          : res.status >= 500
            ? 'outage'
            : 'degraded';
        return {
          id: t.id,
          name: t.name,
          endpoint: new URL(t.url).host,
          status,
          httpStatus: res.status,
          latencyMs,
        };
      } catch {
        clearTimeout(timer);
        return {
          id: t.id,
          name: t.name,
          endpoint: new URL(t.url).host,
          status: 'outage' as const,
          httpStatus: 0,
          latencyMs: Date.now() - started,
        };
      }
    })
  );

  let trackedGames = 0;
  let totalLiveCcu = 0;
  if (isSupabaseConfigured()) {
    try {
      const games = await fetchSupabaseGamesList();
      trackedGames = games.length;
      totalLiveCcu = games.reduce((sum, g) => sum + g.currentCcu, 0);
    } catch {
      // Ignore DB error on status page
    }
  }

  const outages = services.filter((s) => s.status === 'outage').length;
  const degraded = services.filter((s) => s.status === 'degraded').length;
  const overall =
    outages >= 2
      ? 'outage'
      : outages > 0 || degraded > 0
        ? 'degraded'
        : 'operational';

  return {
    overall,
    checkedAt: new Date().toISOString(),
    trackedGames,
    totalLiveCcu,
    services,
  };
}

export default async function RobloxStatusPage() {
  const initialData = await runInitialProbe();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Is Roblox Down? Live Roblox Status Monitor',
    url: `${SITE_URL}/status`,
  };

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-8">
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
          <span className="text-slate-700 dark:text-[#C5D8E2]">Status</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Is Roblox Down? Live Platform Status
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Real-time server-side health checks across core public Roblox APIs,
          paired with live concurrent player activity across RoMetric.
        </p>
      </header>

      <RobloxStatusClient initialData={initialData} />
    </div>
  );
}
