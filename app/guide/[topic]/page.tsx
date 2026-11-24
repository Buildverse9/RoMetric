import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { GUIDE_TOPICS, getGuideBySlug } from '@/lib/market-intelligence';
import { SITE_URL, safeJsonLd } from '@/lib/seo';
import { LiquidGlassCard } from '@/components/MotionPrimitives';

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const guide = getGuideBySlug(topic);
  if (!guide) return { title: 'Guide Not Found' };
  return {
    title: `${guide.title} — RoMetric Guide`,
    description: guide.summary,
    alternates: { canonical: `${SITE_URL}/guide/${guide.slug}` },
  };
}

export default async function GuideTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const guide = getGuideBySlug(topic);
  if (!guide) notFound();

  const others = GUIDE_TOPICS.filter((t) => t.slug !== guide.slug);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.summary,
    url: `${SITE_URL}/guide/${guide.slug}`,
  };

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Link
        href="/guide"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7893A3] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Guides
      </Link>

      <header className="space-y-2.5">
        <p className="text-xs text-slate-500 dark:text-[#7893A3]">
          {guide.category} · RoMetric Methodology
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
          {guide.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
          {guide.summary}
        </p>
      </header>

      <LiquidGlassCard className="rounded-3xl p-6 sm:p-8 space-y-6">
        {guide.sections.map((section, idx) => (
          <section
            key={section.heading}
            className={
              idx > 0
                ? 'pt-6 border-t border-slate-900/8 dark:border-white/8 space-y-2'
                : 'space-y-2'
            }
          >
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              {String(idx + 1).padStart(2, '0')}. {section.heading}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
              {section.body}
            </p>
          </section>
        ))}
      </LiquidGlassCard>

      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
          Related Guides
        </h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/guide/${o.slug}`}
              className="text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
            >
              {o.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
