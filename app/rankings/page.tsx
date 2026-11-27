import { fetchSupabaseGamesList, isSupabaseConfigured } from '@/lib/supabase-server';
import { RankingsClient } from '@/components/RankingsClient';
import { SITE_URL, buildGameUrlPath, safeJsonLd } from '@/lib/seo';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 900;

export default async function RankingsPage() {
  let initialGames: GameRecordData[] = [];
  if (isSupabaseConfigured()) {
    try {
      initialGames = await fetchSupabaseGamesList();
    } catch {
      initialGames = [];
    }
  }

  const latestCollected = initialGames.reduce<string | null>((acc, g) => {
    if (!g.lastCollectedAt) return acc;
    if (!acc) return g.lastCollectedAt;
    return g.lastCollectedAt > acc ? g.lastCollectedAt : acc;
  }, null);

  const top20 = initialGames
    .filter((g) => g.active)
    .sort((a, b) => b.currentCcu - a.currentCcu)
    .slice(0, 20);

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
            name: 'Top Roblox Games Rankings',
            item: `${SITE_URL}/rankings`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Top Roblox Games by Live Concurrent Players',
        url: `${SITE_URL}/rankings`,
        numberOfItems: top20.length,
        itemListElement: top20.map((g, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: g.name,
          url: `${SITE_URL}${buildGameUrlPath(g)}`,
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
      <RankingsClient
        initialGames={initialGames}
        initialLastUpdatedAt={latestCollected}
      />
    </>
  );
}
