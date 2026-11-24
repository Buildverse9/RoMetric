import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import {
  STATIC_INSIGHTS,
  buildGameRevenueInsightSlug,
} from '@/lib/market-intelligence';
import { formatCompactNumber } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  SITE_URL,
  cleanSeoGameName,
  getCurrentMonthYear,
  safeJsonLd,
} from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { GameArtwork } from '@/components/GameArtwork';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 180;

export function generateMetadata(): Metadata {
  const monthYear = getCurrentMonthYear();
  return {
    title: `Roblox Market Insights & Revenue Estimates (${monthYear})`,
    description: `Data-backed Roblox market answers: how much top Roblox games make per month, fastest-growing titles, highest-rated games, and DevEx monetization benchmarks.`,
    alternates: { canonical: `${SITE_URL}/insights` },
  };
}

export default async function InsightsDirectoryPage() {
  const monthYear = getCurrentMonthYear();
  let games: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      games = await fetchSupabaseGamesList();
    } catch {
      games = [];
    }
  }

  const topRevenueGames = games.slice(0, 36);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Roblox Market Insights & Revenue Answers (${monthYear})`,
    url: `${SITE_URL}/insights`,
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-10">
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
          <span className="text-slate-700 dark:text-[#C5D8E2]">Insights</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Roblox Market Insights &amp; Revenue Answers
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Live data-backed answers to the most asked Roblox analytics and
          monetization questions, refreshed continuously for {monthYear}.
        </p>
      </header>

      {/* Core Market Reports */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
          Featured Research &amp; Benchmarks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STATIC_INSIGHTS.map((article) => (
            <Link
              key={article.slug}
              href={`/insights/${article.slug}`}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <LiquidGlassCard className="rounded-2xl p-5 h-full flex flex-col justify-between gap-4 group-hover:border-emerald-500/40 transition-colors">
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                    {article.category} · {article.readMinutes} min read
                  </p>
                  <h3 className="font-display text-base font-bold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors leading-snug">
                    {article.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                    {article.summary}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
                  Read Report <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </LiquidGlassCard>
            </Link>
          ))}
        </div>
      </section>

      {/* Dynamic Per-Game Revenue Estimates */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            How Much Do Top Roblox Games Make?
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#9CB3C0]">
            Select any experience for a full directional monthly &amp; annual
            revenue estimate based on live CCU, genre benchmarks, and DevEx rates.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {topRevenueGames.map((game) => {
            const cleanName = cleanSeoGameName(game.name);
            const rev = estimateGameRevenue(game);
            const slug = buildGameRevenueInsightSlug(game);
            return (
              <Link
                key={game.universeId}
                href={`/insights/${encodeURIComponent(slug)}`}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <LiquidGlassCard className="rounded-2xl p-4 flex items-center justify-between gap-3 group-hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <GameArtwork src={game.iconUrl} alt={game.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                        How much does {cleanName} make?
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
                        {formatCompactNumber(game.currentCcu)} CCU · Est.{' '}
                        <span className="text-emerald-600 dark:text-[#10E89A] font-medium">
                          {formatCurrencyCompact(rev.monthlyUsd)}/mo
                        </span>
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] shrink-0" />
                </LiquidGlassCard>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
