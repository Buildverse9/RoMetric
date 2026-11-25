import { permanentRedirect } from 'next/navigation';
import { fetchSupabaseGameById, isSupabaseConfigured } from '@/lib/supabase-server';
import { GameDetailClient } from '@/components/GameDetailClient';
import { formatCompactNumber } from '@/lib/format';
import {
  SITE_URL,
  buildGameSlugParam,
  buildGameUrlPath,
  cleanSeoGameName,
  extractUniverseIdFromParam,
  safeJsonLd,
} from '@/lib/seo';
import type { GameRecordData } from '@/lib/types';

export const revalidate = 120;

export default async function CanonicalGameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanId = extractUniverseIdFromParam(slug);

  let initialGame: GameRecordData | null = null;
  if (cleanId && isSupabaseConfigured()) {
    try {
      initialGame = await fetchSupabaseGameById(cleanId);
    } catch {
      initialGame = null;
    }
  }

  // Enforce exact canonical "{universeId}-{slug}" URL via 308 redirect
  if (initialGame) {
    const canonicalSlug = buildGameSlugParam(initialGame);
    if (canonicalSlug && slug !== canonicalSlug) {
      permanentRedirect(`/g/${canonicalSlug}`);
    }
  }

  const canonicalUrl = initialGame
    ? `${SITE_URL}${buildGameUrlPath(initialGame)}`
    : `${SITE_URL}/g/${cleanId}`;

  const jsonLd = initialGame
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Rankings',
                item: `${SITE_URL}/rankings`,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: cleanSeoGameName(initialGame.name),
                item: canonicalUrl,
              },
            ],
          },
          {
            '@type': 'VideoGame',
            name: cleanSeoGameName(initialGame.name),
            alternateName:
              initialGame.name !== cleanSeoGameName(initialGame.name)
                ? initialGame.name
                : undefined,
            url: canonicalUrl,
            image: initialGame.thumbnailUrl || initialGame.iconUrl || undefined,
            genre: initialGame.genre || 'Roblox',
            gamePlatform: ['Roblox', 'PC', 'Mobile', 'Console'],
            applicationCategory: 'Game',
            author: {
              '@type': 'Organization',
              name: initialGame.creatorName,
            },
            description: `${cleanSeoGameName(initialGame.name)} by ${initialGame.creatorName} has ${formatCompactNumber(initialGame.currentCcu)} live concurrent players and ${formatCompactNumber(initialGame.totalVisits)} total visits on Roblox.`,
            ...((initialGame.upVotes ?? 0) + (initialGame.downVotes ?? 0) > 10
              ? {
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: Number(
                      (
                        ((initialGame.upVotes ?? 0) /
                          Math.max(
                            1,
                            (initialGame.upVotes ?? 0) +
                              (initialGame.downVotes ?? 0)
                          )) *
                        5
                      ).toFixed(2)
                    ),
                    bestRating: 5,
                    worstRating: 1,
                    ratingCount:
                      (initialGame.upVotes ?? 0) +
                      (initialGame.downVotes ?? 0),
                  },
                }
              : {}),
          },
        ],
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      )}
      <GameDetailClient
        initialGame={initialGame}
        initialTracked={Boolean(initialGame)}
      />
    </>
  );
}
