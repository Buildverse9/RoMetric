import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  BarChart2,
  Clock,
  ExternalLink,
  Info,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import {
  ARTICLES,
  fetchLiveArticleGameSnapshot,
  formatArticleDate,
  getArticleBySlug,
} from '@/lib/articles';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { SITE_URL, safeJsonLd } from '@/lib/seo';
import { GameArtwork } from '@/components/GameArtwork';
import { LiquidGlassCard } from '@/components/MotionPrimitives';
import { XVideoEmbedSection } from '@/components/XVideoEmbed';

export const revalidate = 120;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) {
    return { title: 'Article Not Found' };
  }

  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.keywords,
    alternates: { canonical: `${SITE_URL}/articles/${article.slug}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/articles/${article.slug}`,
      title: `${article.title} | RoMetric`,
      description: article.excerpt,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
    },
  };
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const snapshot = article.featuredGame
    ? await fetchLiveArticleGameSnapshot(
        article.featuredGame.placeId,
        article.featuredGame.universeId
      )
    : null;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.excerpt,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      author: {
        '@type': 'Organization',
        name: article.author,
        url: SITE_URL,
      },
      publisher: {
        '@type': 'Organization',
        name: 'RoMetric',
        url: SITE_URL,
      },
      mainEntityOfPage: `${SITE_URL}/articles/${article.slug}`,
      ...(snapshot?.thumbnailUrl ? { image: [snapshot.thumbnailUrl] } : {}),
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
        {
          '@type': 'ListItem',
          position: 3,
          name: article.shortTitle,
          item: `${SITE_URL}/articles/${article.slug}`,
        },
      ],
    },
    ...(article.faqs.length > 0
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: article.faqs.map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: f.answer,
              },
            })),
          },
        ]
      : []),
  ];

  const featuredGame = article.featuredGame;

  return (
    <article className="max-w-[980px] mx-auto px-4 sm:px-6 pt-8 pb-14 space-y-7">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-[#7893A3]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href="/articles"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Articles
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-700 dark:text-[#C5D8E2] truncate">
            {article.shortTitle}
          </span>
        </div>

        <Link
          href="/articles"
          className="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Articles
        </Link>
      </nav>

      {/* Editorial Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-[#86A1B0]">
          <span className="font-semibold text-emerald-600 dark:text-[#10E89A]">
            {article.category}
          </span>
          <span aria-hidden="true">·</span>
          <span>By {article.author}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={article.publishedAt}>
            {formatArticleDate(article.publishedAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {article.readTimeMinutes} min read
          </span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.12] [text-wrap:balance]">
          {article.title}
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          {article.excerpt}
        </p>
      </header>

      {/* Featured Roblox Game Hero Card + Live Telemetry */}
      {featuredGame && (
        <LiquidGlassCard
          variant="hero"
          className="rounded-[28px] p-5 sm:p-6 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-5">
              <GameArtwork
                src={snapshot?.thumbnailUrl || snapshot?.iconUrl || null}
                alt={`${featuredGame.name} on Roblox`}
                variant="banner"
              />
            </div>

            <div className="md:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <GameArtwork
                  src={snapshot?.iconUrl || null}
                  alt={featuredGame.name}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold text-slate-950 dark:text-white truncate">
                    {snapshot?.name || featuredGame.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#86A1B0]">
                    By {snapshot?.creatorName || featuredGame.creatorName} ·
                    Place ID{' '}
                    <span className="tabular-nums">{featuredGame.placeId}</span>
                  </p>
                </div>
              </div>

              {snapshot && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
                    <p className="text-[11px] text-slate-500 dark:text-[#7893A3]">
                      Live Players
                    </p>
                    <p className="mt-0.5 font-display text-lg font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                      {formatExactNumber(snapshot.playing)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
                    <p className="text-[11px] text-slate-500 dark:text-[#7893A3]">
                      Total Visits
                    </p>
                    <p className="mt-0.5 font-display text-lg font-bold text-slate-950 dark:text-white tabular-nums">
                      {formatCompactNumber(snapshot.visits)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
                    <p className="text-[11px] text-slate-500 dark:text-[#7893A3]">
                      Favorites
                    </p>
                    <p className="mt-0.5 font-display text-lg font-bold text-slate-950 dark:text-white tabular-nums">
                      {formatCompactNumber(snapshot.favorites)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
                    <p className="text-[11px] text-slate-500 dark:text-[#7893A3]">
                      Rating
                    </p>
                    <p className="mt-0.5 font-display text-lg font-bold text-slate-950 dark:text-white tabular-nums">
                      {snapshot.likeRatio !== null
                        ? `${snapshot.likeRatio.toFixed(1)}%`
                        : '—'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                <a
                  href={featuredGame.robloxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity"
                >
                  Open on Roblox
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Link
                  href={`/games/${snapshot?.universeId || featuredGame.universeId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold liquid-glass-pill text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/50 rounded-full transition-colors"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                  Live Analytics Page
                </Link>
                {snapshot && (snapshot.upVotes > 0 || snapshot.downVotes > 0) && (
                  <span className="inline-flex items-center gap-3 text-xs text-slate-500 dark:text-[#86A1B0] ml-auto tabular-nums">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-[#10E89A] font-medium">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {formatCompactNumber(snapshot.upVotes)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsDown className="w-3.5 h-3.5" />
                      {formatCompactNumber(snapshot.downVotes)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </LiquidGlassCard>
      )}

      {/* Clear Reality Check Callout (User's Core Point) */}
      <LiquidGlassCard className="rounded-3xl p-5 sm:p-6 bg-emerald-500/[0.06] dark:bg-[#10E89A]/[0.06] border border-emerald-500/25 dark:border-[#10E89A]/25">
        <div className="flex items-start gap-3.5">
          <Info className="w-5 h-5 text-emerald-600 dark:text-[#10E89A] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
              {article.disclaimerTitle}
            </h2>
            <p className="text-sm text-slate-700 dark:text-[#C5D8E2] leading-relaxed">
              {article.disclaimerBody}
            </p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* X (Twitter) Video Embed Section */}
      <XVideoEmbedSection
        urls={article.xVideoUrls}
        xSearchUrl={article.xVideoUrls[0] || article.xSearchUrl}
        xSearchLabel="Open post on X"
      />

      {/* Editorial Body */}
      <LiquidGlassCard className="rounded-[28px] p-6 sm:p-8 space-y-8">
        {article.sections.map((section) => (
          <section key={section.heading} className="space-y-3.5">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
              {section.heading}
            </h2>
            {section.paragraphs.map((p, idx) => (
              <p
                key={idx}
                className="text-sm sm:text-base text-slate-700 dark:text-[#C5D8E2] leading-relaxed"
              >
                {p}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="space-y-2 pt-1 pl-5 list-disc marker:text-emerald-600 dark:marker:text-[#10E89A] text-sm sm:text-base text-slate-700 dark:text-[#C5D8E2]">
                {section.bullets.map((b, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </LiquidGlassCard>

      {/* Frequently Asked Questions */}
      {article.faqs.length > 0 && (
        <LiquidGlassCard className="rounded-[28px] p-6 sm:p-8 space-y-5">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-900/8 dark:divide-white/10">
            {article.faqs.map((faq) => (
              <div key={faq.question} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-[#F1F7FA]">
                  {faq.question}
                </h3>
                <p className="text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </LiquidGlassCard>
      )}
    </article>
  );
}
