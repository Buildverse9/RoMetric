import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { GUIDE_TOPICS } from '@/lib/market-intelligence';
import { SITE_URL, safeJsonLd } from '@/lib/seo';
import { LiquidGlassCard } from '@/components/MotionPrimitives';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'RoMetric Methodology & Help Guide',
  description:
    'Learn how RoMetric collects live Roblox player counts, estimates developer revenue, calculates game similarity, tracks updates, and verifies promo codes.',
  alternates: { canonical: `${SITE_URL}/guide` },
};

export default function GuideIndexPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'RoMetric Methodology & Help Guide',
    url: `${SITE_URL}/guide`,
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-8">
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
          <span className="text-slate-700 dark:text-[#C5D8E2]">Guide</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          Methodology &amp; Help Guide
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          Transparent documentation on how RoMetric measures live Roblox
          telemetry, revenue estimates, update velocity, similarity scoring, and
          promo code classification.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GUIDE_TOPICS.map((topic) => (
          <Link
            key={topic.slug}
            href={`/guide/${topic.slug}`}
            className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <LiquidGlassCard className="rounded-2xl p-5 h-full flex flex-col justify-between gap-4 group-hover:border-emerald-500/40 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#7893A3]">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                  <span>{topic.category}</span>
                </div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors">
                  {topic.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                  {topic.summary}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
                Read Guide <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </LiquidGlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
