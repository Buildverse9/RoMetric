import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { fetchGameCodesBySlugOrId } from '@/lib/codes-server';
import { GameCodesDetailClient } from '@/components/GameCodesDetailClient';
import {
  SITE_URL,
  buildCanonicalCodeSlug,
  buildCodeFaqItems,
  cleanSeoGameName,
  findGameAliasEntry,
  formatAliasPhrase,
  getCurrentMonthYear,
  safeJsonLd,
} from '@/lib/seo';

export const revalidate = 900;

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
  const aliasEntry = findGameAliasEntry(seoName);
  const monthYear = getCurrentMonthYear();
  const activeCodes = payload.codes.filter((c) => c.status === 'active');
  const activeCount = activeCodes.length;
  const canonicalSlug = buildCanonicalCodeSlug(game) || game.slug || slug;

  const title =
    activeCount > 0
      ? aliasEntry && seoName.length <= 24
        ? `${seoName} (${aliasEntry.shortAcronym}) Codes (${monthYear}) — ${activeCount} Working`
        : `${seoName} Codes (${monthYear}) — ${activeCount} Working Codes`
      : `${seoName} Codes (${monthYear}) — Working & Expired List`;

  const aliasNote = aliasEntry ? ` (${formatAliasPhrase(aliasEntry)})` : '';
  const description =
    activeCount > 0
      ? `${activeCount} verified working ${seoName}${aliasNote} codes for ${monthYear}. One-tap copy, redeem checklist, how-to-redeem guide & live player count on RoMetric.`
      : `Track the latest verified ${seoName}${aliasNote} Roblox codes for ${monthYear}. Updated continuously with active drops, redeem instructions & expired archive.`;

  const pageUrl = `${SITE_URL}/codes/${encodeURIComponent(canonicalSlug)}`;
  const ogCardUrl = `${SITE_URL}/og/social?t=codes&slug=${encodeURIComponent(game.slug || canonicalSlug)}`;

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
  const canonicalSlug = buildCanonicalCodeSlug(game);
  const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();

  // Safely redirect noisy event-prefixed or alias slugs (e.g. "upd-21-5-anime-adventures" -> "anime-adventures")
  // only when the canonical slug resolves cleanly to the same game (loop-free guard).
  if (canonicalSlug && canonicalSlug !== decodedSlug) {
    const check = await fetchGameCodesBySlugOrId(canonicalSlug);
    if (check.game && check.game.universeId === game.universeId) {
      permanentRedirect(`/codes/${encodeURIComponent(canonicalSlug)}`);
    }
  }

  const seoName = cleanSeoGameName(game.name);
  const monthYear = getCurrentMonthYear();
  const activeCodes = payload.codes.filter((c) => c.status === 'active');
  const expiredCount = payload.codes.filter((c) => c.status === 'expired').length;
  const pageUrl = `${SITE_URL}/codes/${encodeURIComponent(canonicalSlug || game.slug || slug)}`;

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
