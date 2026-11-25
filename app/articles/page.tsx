import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, Newspaper } from 'lucide-react';
import {
  ARTICLES,
  fetchLiveArticleGameSnapshot,
  formatArticleDate,
} from '@/lib/articles';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { SITE_URL, safeJsonLd } from '@/lib/seo';
import { GameArtwork } from '@/components/GameArtwork';
import { LiquidGlassCard } from '@/components/MotionPrimitives';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Roblox Articles, Viral Stories & Deep Dives',
  description:
    'Read RoMetric articles covering viral Roblox experiences, player trends, parody games like GTA 6 on Roblox, and live market stories.',
  alternates: { canonical: `${SITE_URL}/articles` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/articles`,
    title: 'Roblox Articles & Viral Stories | RoMetric',
    description:
      'Editorial stories and data-backed breakdowns on viral Roblox games, trending experiences, and platform culture.',
  },
};

export default async function ArticlesIndexPage() {
  const snapshots = await Promise.all(
    ARTICLES.map((article) =>
      article.featuredGame
        ? fetchLiveArticleGameSnapshot(
            article.featuredGame.placeId,
            article.featuredGame.universeId
          )
        : Promise.resolve(null)
    )
  );

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'RoMetric Roblox Articles',
      url: `${SITE_URL}/articles`,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: ARTICLES.length,
        itemListElement: ARTICLES.map((article, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: article.title,
          url: `${SITE_URL}/articles/${article.slug}`,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Articles',
          item: `${SITE_URL}/articles`,
        },
      ],
    },
  ];

  const leadArticle = ARTICLES[0];
  const leadSnapshot = snapshots[0];
  const remainingArticles = ARTICLES.slice(1);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-8">
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
          <span className="text-slate-700 dark:text-[#C5D8E2]">Articles</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Roblox Articles &amp; Viral Stories
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Data-backed editorial stories covering breakout Roblox hits, viral
          community pranks, and platform trends—paired with live game telemetry.
        </p>
      </header>

      {/* Featured Lead Story */}
      {leadArticle && (
        <Link href={`/articles/${leadArticle.slug}`} className="block group">
          <LiquidGlassCard
            variant="hero"
            interactive
            className="rounded-[28px] overflow-hidden p-5 sm:p-7"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5">
                <GameArtwork
                  src={
                    leadSnapshot?.thumbnailUrl || leadSnapshot?.iconUrl || null
                  }
                  alt={leadArticle.title}
                  variant="banner"
                />
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-[#86A1B0]">
                  <span className="font-semibold text-emerald-600 dark:text-[#10E89A]">
                    {leadArticle.category}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatArticleDate(leadArticle.publishedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {leadArticle.readTimeMinutes} min read
                  </span>
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white leading-tight group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors [text-wrap:balance]">
                  {leadArticle.title}
                </h2>

                <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                  {leadArticle.excerpt}
                </p>

                {leadSnapshot && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs sm:text-sm tabular-nums">
                    <div>
                      <span className="text-slate-500 dark:text-[#7893A3]">
                        Live CCU:{' '}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-[#10E89A]">
                        {formatExactNumber(leadSnapshot.playing)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-[#7893A3]">
                        Total Visits:{' '}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-[#F1F7FA]">
                        {formatCompactNumber(leadSnapshot.visits)}
                      </span>
                    </div>
                    {leadSnapshot.likeRatio !== null && (
                      <div>
                        <span className="text-slate-500 dark:text-[#7893A3]">
                          Rating:{' '}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-[#F1F7FA]">
                          {leadSnapshot.likeRatio.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-[#10E89A] group-hover:gap-2.5 transition-all">
                    Read full article
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
      )}

      {/* Additional Articles Grid */}
      {remainingArticles.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {remainingArticles.map((article, idx) => {
            const snap = snapshots[idx + 1];
            return (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                className="block group"
              >
                <LiquidGlassCard
                  interactive
                  className="rounded-3xl p-5 h-full flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {snap && (
                      <GameArtwork
                        src={snap.thumbnailUrl || snap.iconUrl}
                        alt={article.title}
                        variant="banner"
                      />
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#86A1B0]">
                      <span className="font-semibold text-emerald-600 dark:text-[#10E89A]">
                        {article.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatArticleDate(article.publishedAt)}</span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors leading-snug">
                      {article.shortTitle}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9CB3C0] line-clamp-3">
                      {article.excerpt}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
                    Read story
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </LiquidGlassCard>
              </Link>
            );
          })}
        </section>
      )}

      {/* Cross-Link Strip to Related Market Hubs */}
      <LiquidGlassCard className="rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Newspaper className="w-5 h-5 text-emerald-600 dark:text-[#10E89A] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA]">
              Looking for automated revenue reports and weekly market digests?
            </p>
            <p className="text-xs text-slate-600 dark:text-[#9CB3C0]">
              Browse live revenue breakdowns and weekly Roblox recaps generated
              from our telemetry database.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/insights"
            className="px-4 py-2 text-xs font-semibold liquid-glass-pill rounded-full text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/50 transition-colors"
          >
            Market Insights
          </Link>
          <Link
            href="/weekly"
            className="px-4 py-2 text-xs font-semibold liquid-glass-pill rounded-full text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/50 transition-colors"
          >
            Weekly Recaps
          </Link>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
