import type { Metadata } from 'next';
import { fetchCodesDirectory } from '@/lib/codes-server';
import { CodesDirectoryClient } from '@/components/CodesDirectoryClient';
import {
  SITE_URL,
  cleanSeoGameName,
  getCurrentMonthYear,
  safeJsonLd,
} from '@/lib/seo';

export const revalidate = 180;

export async function generateMetadata(): Promise<Metadata> {
  const monthYear = getCurrentMonthYear();
  let totalActive = 0;
  let totalGames = 0;
  try {
    const dir = await fetchCodesDirectory({ status: 'all', sort: 'popular' });
    totalActive = dir.stats.totalActiveCodes;
    totalGames = dir.stats.totalGamesCovered;
  } catch {
    // Fallback to clean generic count
  }

  const title =
    totalActive > 0
      ? `Roblox Game Codes (${monthYear}) — ${totalActive.toLocaleString('en-US')} Working Codes`
      : `Roblox Game Codes (${monthYear}) — Active & Working Directory`;
  const description =
    totalActive > 0
      ? `Browse ${totalActive.toLocaleString('en-US')} active Roblox promo codes across ${totalGames.toLocaleString('en-US')} popular games for ${monthYear}. Verified automatically with one-tap copy on RoMetric.`
      : `Browse automatically updated active and working Roblox promo codes for ${monthYear} across hundreds of top games, with verification timestamps and one-tap copy on RoMetric.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/codes`,
    },
    openGraph: {
      title: `${title} | RoMetric`,
      description,
      url: `${SITE_URL}/codes`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | RoMetric`,
      description,
    },
  };
}

export default async function CodesDirectoryPage() {
  const initialData = await fetchCodesDirectory({
    status: 'all',
    sort: 'popular',
  });

  const topGames = initialData.games.slice(0, 20);
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
            name: 'Roblox Game Codes',
            item: `${SITE_URL}/codes`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Active Roblox Game Codes (${getCurrentMonthYear()})`,
        url: `${SITE_URL}/codes`,
        numberOfItems: topGames.length,
        itemListElement: topGames.map((g, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: `${cleanSeoGameName(g.name)} Codes`,
          url: `${SITE_URL}/codes/${encodeURIComponent(g.slug)}`,
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
      <CodesDirectoryClient initialData={initialData} />
    </>
  );
}
