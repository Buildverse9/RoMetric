import { fetchSupabaseGamesList, isSupabaseConfigured } from '@/lib/supabase-server';
import { TrendingClient } from '@/components/TrendingClient';
import { evaluateTrending } from '@/lib/format';
import { SITE_URL, safeJsonLd } from '@/lib/seo';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 120;

export default async function TrendingPage() {
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

  const topTrending = initialGames
    .filter((g) => g.active)
    .map((game) => ({ game, ev: evaluateTrending(game) }))
    .filter((item) => item.ev.eligible && item.ev.score !== null)
    .sort((a, b) => (b.ev.score ?? 0) - (a.ev.score ?? 0))
    .slice(0, 15);

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
            name: 'Trending Roblox Games',
            item: `${SITE_URL}/trending`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Trending & Breakout Roblox Games Today',
        url: `${SITE_URL}/trending`,
        numberOfItems: topTrending.length,
        itemListElement: topTrending.map(({ game }, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: game.name,
          url: `${SITE_URL}/games/${game.universeId}`,
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
      <TrendingClient
        initialGames={initialGames}
        initialLastUpdatedAt={latestCollected}
      />
    </>
  );
}
