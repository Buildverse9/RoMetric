import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart2, GitCompare, History, Ticket } from 'lucide-react';
import { findSimilarGames } from '@/lib/market-intelligence';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  SITE_URL,
  cleanSeoGameName,
  getCurrentMonthYear,
  safeJsonLd,
} from '@/lib/seo';
import {
  fetchSupabaseGameById,
  fetchSupabaseGamesList,
  isSupabaseConfigured,
  isValidNumericId,
} from '@/lib/supabase-server';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ universeId: string }>;
}): Promise<Metadata> {
  const { universeId } = await params;
  const cleanId = String(universeId || '').replace(/[^0-9]/g, '');
  if (!isValidNumericId(cleanId) || !isSupabaseConfigured()) {
    return { title: 'Similar Roblox Games' };
  }
  const game = await fetchSupabaseGameById(cleanId).catch(() => null);
  if (!game) return { title: 'Game Not Found' };

  const cleanName = cleanSeoGameName(game.name);
  const monthYear = getCurrentMonthYear();
  return {
    title: `Best Games Like ${cleanName} on Roblox (${monthYear})`,
    description: `Discover the top Roblox games similar to ${cleanName} in ${monthYear}. Ranked by gameplay match, live concurrent players, approval rating, and growth.`,
    alternates: { canonical: `${SITE_URL}/similar/${game.universeId}` },
    openGraph: {
      title: `Best Games Like ${cleanName} on Roblox (${monthYear}) | RoMetric`,
      description: `Live player counts, match scores, and side-by-side comparisons for Roblox games similar to ${cleanName}.`,
      url: `${SITE_URL}/similar/${game.universeId}`,
      type: 'website',
    },
  };
}

export default async function SimilarGameDetailPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = await params;
  const cleanId = String(universeId || '').replace(/[^0-9]/g, '');
  if (!isValidNumericId(cleanId)) notFound();

  let allGames: GameRecordData[] = [];
  let targetGame: GameRecordData | null = null;

  if (isSupabaseConfigured()) {
    const [fetchedList, fetchedTarget] = await Promise.all([
      fetchSupabaseGamesList().catch(() => []),
      fetchSupabaseGameById(cleanId).catch(() => null),
    ]);
    allGames = fetchedList;
    targetGame =
      fetchedTarget ??
      allGames.find((g) => g.universeId === cleanId) ??
      null;
  }

  if (!targetGame) notFound();

  const cleanName = cleanSeoGameName(targetGame.name);
  const monthYear = getCurrentMonthYear();
  const similar = findSimilarGames(targetGame, allGames, 18);
  const topAltNames = similar
    .slice(0, 3)
    .map((s) => cleanSeoGameName(s.game.name))
    .join(', ');

  const faqItems = [
    {
      question: `What are the best Roblox games like ${cleanName} in ${monthYear}?`,
      answer: topAltNames
        ? `Based on live player activity, shared genre, and theme overlap, top Roblox alternatives to ${cleanName} include ${topAltNames}.`
        : `RoMetric ranks similar Roblox experiences to ${cleanName} by genre, theme keywords, and live player activity.`,
    },
    {
      question: `How does RoMetric find games similar to ${cleanName}?`,
      answer: `Our similarity model scores every tracked Roblox game across shared official and sub-genre categories, normalized title keyword overlap, studio portfolio links, audience scale proximity, and community upvote ratio.`,
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Similar Games',
          item: `${SITE_URL}/similar`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: `Games Like ${cleanName}`,
          item: `${SITE_URL}/similar/${targetGame.universeId}`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Best Roblox Games Like ${cleanName} (${monthYear})`,
      numberOfItems: similar.length,
      itemListElement: similar.map((s, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: s.game.name,
        url: `${SITE_URL}/games/${s.game.universeId}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="space-y-4">
        <Link
          href={`/games/${targetGame.universeId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7893A3] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {cleanName} Analytics
        </Link>

        <LiquidGlassCard className="rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <GameArtwork
              src={targetGame.iconUrl}
              alt={targetGame.name}
              size="lg"
            />
            <div className="space-y-1.5 min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
                Best Games Like {cleanName} ({monthYear})
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums">
                {formatExactNumber(targetGame.currentCcu)} live players ·{' '}
                {targetGame.genre} · by{' '}
                <Link
                  href={`/developers/${targetGame.creatorId}`}
                  className="text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-[#10E89A] underline decoration-emerald-500/30 underline-offset-2"
                >
                  {targetGame.creatorName}
                </Link>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href={`/games/${targetGame.universeId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Live Analytics
            </Link>
            <Link
              href={`/games/${targetGame.universeId}/updates`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full liquid-glass-pill text-slate-700 dark:text-[#C5D8E2] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors whitespace-nowrap"
            >
              <History className="w-3.5 h-3.5" />
              Updates
            </Link>
            <Link
              href={`/codes/${encodeURIComponent(targetGame.slug)}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full liquid-glass-pill text-slate-700 dark:text-[#C5D8E2] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors whitespace-nowrap"
            >
              <Ticket className="w-3.5 h-3.5" />
              Codes
            </Link>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Similar games grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {similar.map((item, idx) => {
          const rev = estimateGameRevenue(item.game);
          return (
            <LiquidGlassCard
              key={item.game.universeId}
              className="rounded-2xl p-4 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/games/${item.game.universeId}`}
                    className="flex items-center gap-3 min-w-0 group"
                  >
                    <GameArtwork
                      src={item.game.iconUrl}
                      alt={item.game.name}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                        {idx + 1}. {item.game.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate">
                        {item.game.creatorName}
                      </p>
                    </div>
                  </Link>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums shrink-0">
                    {item.score}% match
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-[#9CB3C0]">
                  {item.reasons.join(' · ')}
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900/8 dark:border-white/8 text-xs">
                  <div>
                    <p className="text-slate-500 dark:text-[#7893A3]">Players</p>
                    <p className="font-semibold text-slate-950 dark:text-white tabular-nums">
                      {formatCompactNumber(item.game.currentCcu)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-[#7893A3]">24h</p>
                    <GrowthValue value={item.game.growth24h} />
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 dark:text-[#7893A3]">Est. Rev</p>
                    <p className="font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                      {formatCurrencyCompact(rev.monthlyUsd)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-900/8 dark:border-white/8 text-xs">
                <Link
                  href={`/compare?games=${targetGame.universeId},${item.game.universeId}`}
                  className="inline-flex items-center gap-1 text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Compare
                </Link>
                <Link
                  href={`/similar/${item.game.universeId}`}
                  className="text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
                >
                  More like this
                </Link>
              </div>
            </LiquidGlassCard>
          );
        })}
      </div>

      {/* Visible FAQ section */}
      <LiquidGlassCard className="rounded-3xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-slate-900/8 dark:divide-white/8">
          {faqItems.map((item) => (
            <div key={item.question} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA]">
                {item.question}
              </h3>
              <p className="text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </LiquidGlassCard>
    </div>
  );
}
