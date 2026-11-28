import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart2, Sparkles, Ticket } from 'lucide-react';
import {
  STATIC_INSIGHTS,
  findGameByRevenueInsightSlug,
  findSimilarGames,
} from '@/lib/market-intelligence';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  SITE_URL,
  buildCanonicalCodeSlug,
  buildGameUrlPath,
  cleanSeoGameName,
  getCurrentMonthYear,
  safeJsonLd,
} from '@/lib/seo';
import { fetchGameCodesBySlugOrId } from '@/lib/codes-server';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { GameArtwork } from '@/components/GameArtwork';
import { GrowthValue } from '@/components/GameTable';
import { InteractiveRevenueCalculator } from '@/components/InteractiveRevenueCalculator';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const monthYear = getCurrentMonthYear();

  const staticArt = STATIC_INSIGHTS.find((s) => s.slug === decoded);
  if (staticArt) {
    return {
      title: `${staticArt.title} (${monthYear})`,
      description: staticArt.summary,
      alternates: { canonical: `${SITE_URL}/insights/${staticArt.slug}` },
    };
  }

  if (isSupabaseConfigured()) {
    const games = await fetchSupabaseGamesList().catch(() => []);
    const matchedGame = findGameByRevenueInsightSlug(decoded, games);
    if (matchedGame) {
      const cleanName = cleanSeoGameName(matchedGame.name);
      const year = new Date().getUTCFullYear();
      const pageUrl = `${SITE_URL}/insights/${encodeURIComponent(decoded)}`;
      const ogImage = `${SITE_URL}/og/social?t=surge&g=${matchedGame.universeId}`;
      const title = `How Much Does ${cleanName} Make? (${year} DevEx Breakdown)`;
      const description = `Explore ${cleanName}'s estimated daily, monthly & annual Roblox DevEx revenue with ${formatExactNumber(matchedGame.currentCcu)} live players—plus our interactive CCU earnings calculator.`;

      return {
        title,
        description,
        alternates: { canonical: pageUrl },
        openGraph: {
          title: `${title} | RoMetric`,
          description,
          url: pageUrl,
          type: 'article',
          images: [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: `${cleanName} estimated monthly Roblox revenue on RoMetric`,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} | RoMetric`,
          description,
          images: [ogImage],
        },
      };
    }
  }

  return { title: 'Insight Not Found' };
}

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const monthYear = getCurrentMonthYear();

  let games: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      games = await fetchSupabaseGamesList();
    } catch {
      games = [];
    }
  }

  // Case 1: Dynamic per-game revenue answer (/insights/how-much-does-blox-fruits-make)
  const revenueGame = findGameByRevenueInsightSlug(decoded, games);
  if (revenueGame) {
    const cleanName = cleanSeoGameName(revenueGame.name);
    const rev = estimateGameRevenue(revenueGame);
    const lowMonthly = Math.round(rev.monthlyUsd * 0.65);
    const highMonthly = Math.round(rev.monthlyUsd * 1.45);
    const annualUsd = Math.round(rev.monthlyUsd * 12);
    const peers = findSimilarGames(revenueGame, games, 6);
    const topPeer = peers[0]?.game ?? null;
    const codesPayload = await fetchGameCodesBySlugOrId(
      revenueGame.universeId
    ).catch(() => null);
    const activeCodesCount =
      codesPayload?.codes.filter((c) => c.status === 'active').length ?? 0;
    const codeSlug = buildCanonicalCodeSlug(revenueGame) || revenueGame.slug;

    const faqItems = [
      {
        question: `How much money does ${cleanName} make per month?`,
        answer: `As of ${monthYear}, RoMetric estimates ${cleanName} generates roughly ${formatCurrencyCompact(rev.monthlyUsd)} per month (directional range ${formatCurrencyCompact(lowMonthly)} to ${formatCurrencyCompact(highMonthly)}, or about ${formatCurrencyCompact(rev.dailyUsd)}/day and ${formatCompactNumber(rev.monthlyRobux)} Robux/month at DevEx rates) based on ${formatExactNumber(revenueGame.currentCcu)} live concurrent players and ${revenueGame.genre} monetization benchmarks.`,
      },
      {
        question: `How much does ${cleanName} make per day on Roblox?`,
        answer: `At ${formatExactNumber(revenueGame.currentCcu)} live players, ${cleanName} makes an estimated ${formatCurrencyCompact(rev.dailyUsd)} per day in developer DevEx-equivalent earnings.`,
      },
      {
        question: `How much does ${cleanName} make per year on Roblox?`,
        answer: `At current player run-rate, ${cleanName} tracks toward an estimated ${formatCurrencyCompact(annualUsd)} in annualized gross developer earnings before platform and studio expenses.`,
      },
      {
        question: `Who created ${cleanName}?`,
        answer: `${cleanName} is published by ${revenueGame.creatorName} (${revenueGame.creatorType}) and has accumulated ${formatCompactNumber(revenueGame.totalVisits)} total Roblox visits.`,
      },
    ];

    const pageUrl = `${SITE_URL}/insights/${encodeURIComponent(decoded)}`;
    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Market Insights',
            item: `${SITE_URL}/insights`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: `How Much Does ${cleanName} Make?`,
            item: pageUrl,
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `How Much Does ${cleanName} Make a Month on Roblox? (${monthYear})`,
        url: pageUrl,
        dateModified: revenueGame.lastCollectedAt,
        author: { '@type': 'Organization', name: 'RoMetric', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'RoMetric', url: SITE_URL },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ];

    return (
      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />

        <Link
          href="/insights"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7893A3] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Market Insights
        </Link>

        <LiquidGlassCard className="rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <GameArtwork
              src={revenueGame.iconUrl}
              alt={revenueGame.name}
              size="lg"
            />
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                Revenue Estimate · {monthYear} · {revenueGame.genre}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
                How Much Does {cleanName} Make a Month?
              </h1>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-700 dark:text-[#C5D8E2] leading-relaxed">
            With{' '}
            <strong className="font-semibold text-slate-950 dark:text-white tabular-nums">
              {formatExactNumber(revenueGame.currentCcu)}
            </strong>{' '}
            live concurrent players and{' '}
            <strong className="font-semibold text-slate-950 dark:text-white tabular-nums">
              {formatCompactNumber(revenueGame.totalVisits)}
            </strong>{' '}
            total visits, RoMetric estimates that{' '}
            <strong className="font-semibold text-slate-950 dark:text-white">
              {cleanName}
            </strong>{' '}
            generates approximately{' '}
            <strong className="font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums">
              {formatCurrencyCompact(rev.monthlyUsd)} per month
            </strong>{' '}
            (directional range {formatCurrencyCompact(lowMonthly)} –{' '}
            {formatCurrencyCompact(highMonthly)}).
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2 border-t border-slate-900/8 dark:border-white/8">
            <div>
              <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                Est. Daily USD
              </p>
              <p className="text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                {formatCurrencyCompact(rev.dailyUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                Est. Monthly USD
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                {formatCurrencyCompact(rev.monthlyUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                Est. Annual Run-Rate
              </p>
              <p className="text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                {formatCurrencyCompact(annualUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                Est. Monthly Robux
              </p>
              <p className="text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                {formatCompactNumber(rev.monthlyRobux)} R$
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                Live Players
              </p>
              <p className="text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                {formatExactNumber(revenueGame.currentCcu)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <Link
              href={buildGameUrlPath(revenueGame)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Open Full {cleanName} Analytics
            </Link>
            <Link
              href={`/similar/${revenueGame.universeId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full liquid-glass-pill text-slate-700 dark:text-[#C5D8E2] hover:text-emerald-600 dark:hover:text-[#10E89A]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Similar Games
            </Link>
            <Link
              href={`/codes/${encodeURIComponent(codeSlug)}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full liquid-glass-pill text-slate-700 dark:text-[#C5D8E2] hover:text-emerald-600 dark:hover:text-[#10E89A]"
            >
              <Ticket className="w-3.5 h-3.5" />
              {activeCodesCount > 0
                ? `Promo Codes (${activeCodesCount})`
                : 'Promo Codes'}
            </Link>
          </div>
        </LiquidGlassCard>

        <InteractiveRevenueCalculator
          gameName={cleanName}
          universeId={revenueGame.universeId}
          baseCcu={revenueGame.currentCcu}
          baseMonthlyUsd={rev.monthlyUsd}
          baseMonthlyRobux={rev.monthlyRobux}
          topPeerUniverseId={topPeer?.universeId ?? null}
          topPeerName={topPeer ? cleanSeoGameName(topPeer.name) : null}
        />

        <LiquidGlassCard className="rounded-3xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Comparable Peer Benchmarks
          </h2>
          <div className="divide-y divide-slate-900/8 dark:divide-white/8">
            {peers.map((p) => {
              const pRev = estimateGameRevenue(p.game);
              return (
                <Link
                  key={p.game.universeId}
                  href={buildGameUrlPath(p.game)}
                  className="py-3 flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GameArtwork
                      src={p.game.iconUrl}
                      alt={cleanSeoGameName(p.game.name)}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] truncate">
                        {cleanSeoGameName(p.game.name)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
                        {formatCompactNumber(p.game.currentCcu)} CCU · {p.game.genre}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums shrink-0">
                    {formatCurrencyCompact(pRev.monthlyUsd)}/mo
                  </span>
                </Link>
              );
            })}
          </div>
        </LiquidGlassCard>

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

  // Case 2: Static data-backed research article
  const article = STATIC_INSIGHTS.find((s) => s.slug === decoded);
  if (!article) notFound();

  const rankedList =
    article.slug === 'fastest-growing-roblox-games-this-week'
      ? [...games]
          .filter((g) => typeof g.growth24h === 'number' && g.growth24h > 0 && g.currentCcu >= 200)
          .sort((a, b) => (b.growth24h ?? 0) - (a.growth24h ?? 0))
          .slice(0, 20)
      : article.slug === 'highest-rated-roblox-games'
        ? [...games]
            .filter((g) => typeof g.likeRatio === 'number' && g.currentCcu >= 500)
            .sort((a, b) => (b.likeRatio ?? 0) - (a.likeRatio ?? 0))
            .slice(0, 20)
        : games.slice(0, 20);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${article.title} (${monthYear})`,
    description: article.summary,
    url: `${SITE_URL}/insights/${article.slug}`,
  };

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Link
        href="/insights"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7893A3] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Market Insights
      </Link>

      <header className="space-y-3 max-w-3xl">
        <p className="text-xs text-slate-500 dark:text-[#7893A3]">
          {article.category} · {monthYear} · {article.readMinutes} min read
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          {article.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          {article.summary}
        </p>
      </header>

      <LiquidGlassCard className="rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-900/8 dark:border-white/10">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Live Dataset Snapshot ({monthYear})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-medium text-slate-500 dark:text-[#9CB3C0]">
                <th className="py-3 pl-5 pr-2 w-12">#</th>
                <th className="py-3 px-3">Experience</th>
                <th className="py-3 px-3 text-right">Live CCU</th>
                <th className="py-3 px-3 text-right hidden sm:table-cell">24h</th>
                <th className="py-3 px-3 text-right hidden md:table-cell">Rating</th>
                <th className="py-3 pl-3 pr-5 text-right">Est. Rev / mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/6 dark:divide-white/8">
              {rankedList.map((g, idx) => {
                const rev = estimateGameRevenue(g);
                return (
                  <tr
                    key={g.universeId}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3 pl-5 pr-2 text-sm text-slate-400 dark:text-[#6F8796] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={buildGameUrlPath(g)}
                        className="flex items-center gap-3 min-w-0 group"
                      >
                        <GameArtwork src={g.iconUrl} alt={g.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] truncate max-w-[260px]">
                            {g.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#7893A3]">
                            {g.creatorName} · {g.genre}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-right text-sm font-semibold text-slate-950 dark:text-white tabular-nums">
                      {formatExactNumber(g.currentCcu)}
                    </td>
                    <td className="py-3 px-3 text-right hidden sm:table-cell">
                      <GrowthValue value={g.growth24h} />
                    </td>
                    <td className="py-3 px-3 text-right text-sm text-slate-600 dark:text-[#9CB3C0] tabular-nums hidden md:table-cell">
                      {g.likeRatio !== null ? `${g.likeRatio}%` : '—'}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                      {formatCurrencyCompact(rev.monthlyUsd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
