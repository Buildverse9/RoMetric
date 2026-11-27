import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchGameCodesBySlugOrId } from '@/lib/codes-server';
import { GameCodesDetailClient } from '@/components/GameCodesDetailClient';
import {
  SITE_URL,
  buildCodeFaqItems,
  cleanSeoGameName,
  getCurrentMonthYear,
  safeJsonLd,
} from '@/lib/seo';

export const revalidate = 180;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const payload = await fetchGameCodesBySlugOrId(slug);
  const game = payload.game;

  if (!game) {
    return {
      title: 'Roblox Game Codes Not Found',
      description: 'We could not find codes for this Roblox experience.',
      robots: { index: false, follow: true },
    };
  }

  const seoName = cleanSeoGameName(game.name);
  const monthYear = getCurrentMonthYear();
  const activeCodes = payload.codes.filter((c) => c.status === 'active');
  const activeCount = activeCodes.length;
  const newestCode = activeCodes[0]?.code ?? null;
  const title =
    activeCount > 0
      ? `${seoName} Codes (${monthYear}) — ${activeCount} Working [Updated]`
      : `${seoName} Codes (${monthYear}) — Active & Expired List`;
  const description =
    activeCount > 0
      ? `${activeCount} working ${seoName} codes verified for ${monthYear}${newestCode ? ` (New: ${newestCode})` : ''}. Claim free rewards with one-tap copy, redeem steps & expired list on RoMetric.`
      : `Check the latest verified ${seoName} Roblox codes for ${monthYear}. Automatically updated with new working codes, how-to-redeem steps & expired archive on RoMetric.`;
  const pageUrl = `${SITE_URL}/codes/${encodeURIComponent(game.slug || slug)}`;
  const ogCardUrl = `${SITE_URL}/og/social?t=codes&slug=${encodeURIComponent(game.slug || slug)}`;

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${title} | RoMetric`,
      description,
      url: pageUrl,
      type: 'website',
      images: [
        {
          url: ogCardUrl,
          width: 1200,
          height: 630,
          alt: `${seoName} active Roblox codes (${monthYear}) on RoMetric`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | RoMetric`,
      description,
      images: [ogCardUrl],
    },
  };
}

export default async function GameCodesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const payload = await fetchGameCodesBySlugOrId(slug);

  if (!payload.game) {
    notFound();
  }

  const game = payload.game;
  const seoName = cleanSeoGameName(game.name);
  const monthYear = getCurrentMonthYear();
  const activeCodes = payload.codes.filter((c) => c.status === 'active');
  const expiredCount = payload.codes.filter((c) => c.status === 'expired').length;
  const pageUrl = `${SITE_URL}/codes/${encodeURIComponent(game.slug || slug)}`;

  const faqItems = buildCodeFaqItems({
    gameName: game.name,
    activeCount: activeCodes.length,
    expiredCount,
    monthYear,
    newestCode: activeCodes[0]?.code ?? null,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Roblox Codes',
            item: `${SITE_URL}/codes`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${seoName} Codes`,
            item: pageUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <GameCodesDetailClient initialPayload={payload} monthYear={monthYear} />
    </>
  );
}
