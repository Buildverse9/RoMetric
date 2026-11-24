import type { Metadata } from 'next';
import { DevelopersDirectoryClient } from '@/components/DevelopersDirectoryClient';
import { aggregateStudiosServer } from '@/lib/market-intelligence';
import { SITE_URL, safeJsonLd } from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Top Roblox Developers & Studios — Live Player & Revenue Rankings',
  description:
    'Explore top Roblox studios, groups, and independent creators ranked by combined live concurrent players (CCU), total visits, portfolio size, and estimated monthly revenue.',
  alternates: { canonical: `${SITE_URL}/developers` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/developers`,
    title: 'Top Roblox Developers & Studios | RoMetric',
    description:
      'Live Roblox studio and creator leaderboard ranked by combined concurrent players and estimated monthly revenue.',
  },
};

export default async function DevelopersDirectoryPage() {
  let games: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      games = await fetchSupabaseGamesList();
    } catch {
      games = [];
    }
  }
  const developers = aggregateStudiosServer(games);

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Top Roblox Developers & Studios',
    url: `${SITE_URL}/developers`,
    numberOfItems: Math.min(developers.length, 50),
    itemListElement: developers.slice(0, 50).map((dev, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: dev.creatorName,
      url: `${SITE_URL}/developers/${dev.creatorId}`,
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'RoMetric', item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Developers & Studios',
        item: `${SITE_URL}/developers`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd([itemListSchema, breadcrumbSchema]),
        }}
      />
      <DevelopersDirectoryClient initialDevelopers={developers} />
    </>
  );
}
