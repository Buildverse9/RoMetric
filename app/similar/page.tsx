import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, getCurrentMonthYear, safeJsonLd } from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { SimilarHubClient } from '@/components/SimilarHubClient';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 1800;

export function generateMetadata(): Metadata {
  const monthYear = getCurrentMonthYear();
  return {
    title: `Games Like Your Favorite Roblox Experiences (${monthYear})`,
    description: `Find the best similar Roblox games ranked by live player count, shared genre, gameplay mechanics, and community approval rating on RoMetric.`,
    alternates: { canonical: `${SITE_URL}/similar` },
  };
}

export default async function SimilarDirectoryPage() {
  const monthYear = getCurrentMonthYear();
  let games: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      games = await fetchSupabaseGamesList();
    } catch {
      games = [];
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Similar Roblox Games Discovery (${monthYear})`,
    url: `${SITE_URL}/similar`,
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
          <span className="text-slate-700 dark:text-[#C5D8E2]">Similar Games</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Find Similar Roblox Games
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Pick any tracked Roblox experience to see high-match alternatives
          scored by shared genre, theme keywords, audience scale, and player
          ratings.
        </p>
      </header>

      <SimilarHubClient games={games} />
    </div>
  );
}
