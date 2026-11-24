import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { extractKeywordTrends } from '@/lib/market-intelligence';
import { SITE_URL, getCurrentMonthYear, safeJsonLd } from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { TrendsDirectoryClient } from '@/components/TrendsDirectoryClient';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 120;

export function generateMetadata(): Metadata {
  const monthYear = getCurrentMonthYear();
  return {
    title: `Roblox Keyword & Mechanic Trends — Niche Saturation (${monthYear})`,
    description: `Analyze live player demand, game count, and niche saturation across top Roblox mechanics and themes in ${monthYear}. Built for players and Roblox developers.`,
    alternates: { canonical: `${SITE_URL}/trends` },
    openGraph: {
      title: `Roblox Keyword Trends & Niche Radar (${monthYear}) | RoMetric`,
      description:
        'Live player totals, average CCU per game, and leader market share across 120+ Roblox title themes.',
      url: `${SITE_URL}/trends`,
      type: 'website',
    },
  };
}

export default async function TrendsDirectoryPage() {
  const monthYear = getCurrentMonthYear();
  let games: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      games = await fetchSupabaseGamesList();
    } catch {
      games = [];
    }
  }

  const trends = extractKeywordTrends(games, 2, 120);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Roblox Keyword & Mechanic Trends (${monthYear})`,
    url: `${SITE_URL}/trends`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: Math.min(50, trends.length),
      itemListElement: trends.slice(0, 50).map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${t.label} Roblox Games`,
        url: `${SITE_URL}/trends/${encodeURIComponent(t.keyword)}`,
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
          <span className="text-slate-700 dark:text-[#C5D8E2]">Keyword Trends</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Roblox Keyword &amp; Mechanic Trends
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Live demand and saturation metrics mined across tracked Roblox titles
          in {monthYear}. Compare total concurrent players against competing
          games and top-title dominance.
        </p>
      </header>

      <TrendsDirectoryClient trends={trends} />
    </div>
  );
}
