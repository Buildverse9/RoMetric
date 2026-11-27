import { fetchSupabaseGamesList, isSupabaseConfigured } from '@/lib/supabase-server';
import { HomeDashboard } from '@/components/HomeDashboard';
import { SITE_URL, buildGameUrlPath, safeJsonLd } from '@/lib/seo';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 900;

export default async function HomePage() {
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

  const top10 = initialGames
    .filter((g) => g.active)
    .sort((a, b) => b.currentCcu - a.currentCcu)
    .slice(0, 10);

  const homeItemListLd =
    top10.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Most Played Roblox Games Live Right Now',
          url: SITE_URL,
          numberOfItems: top10.length,
          itemListElement: top10.map((g, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: g.name,
            url: `${SITE_URL}${buildGameUrlPath(g)}`,
          })),
        }
      : null;

  return (
    <>
      {homeItemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(homeItemListLd) }}
        />
      )}
      <HomeDashboard
        initialGames={initialGames}
        initialLastUpdatedAt={latestCollected}
      />
    </>
  );
}
