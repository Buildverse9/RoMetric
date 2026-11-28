import type { Metadata } from 'next';
import { fetchSupabaseGameById } from '@/lib/supabase-server';
import { formatCompactNumber } from '@/lib/format';
import {
  SITE_URL,
  buildGameUrlPath,
  cleanSeoGameName,
  extractUniverseIdFromParam,
  findGameAliasEntry,
  formatAliasPhrase,
} from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cleanId = extractUniverseIdFromParam(slug);

  if (!cleanId) {
    return {
      title: 'Roblox Game Analytics',
      robots: { index: false, follow: true },
    };
  }

  try {
    const game = await fetchSupabaseGameById(cleanId);
    if (game) {
      const seoName = cleanSeoGameName(game.name);
      const aliasEntry = findGameAliasEntry(seoName);
      const canonicalPath = buildGameUrlPath(game);

      const title =
        aliasEntry && seoName.length <= 28
          ? `${seoName} (${aliasEntry.shortAcronym}) Live Player Count & Stats`
          : `${seoName} Live Player Count, Peak CCU & Stats`;

      const aliasBit = aliasEntry
        ? ` (${formatAliasPhrase(aliasEntry)})`
        : '';
      const description = `Track ${seoName}${aliasBit} live player count, 24h & 30d CCU charts, ${formatCompactNumber(game.totalVisits)} total visits, DevEx revenue breakdown & working codes on RoMetric.`;
      const ogCardUrl = `${SITE_URL}/og/social?t=surge&g=${game.universeId}`;

      return {
        title,
        description,
        alternates: {
          canonical: canonicalPath,
        },
        openGraph: {
          title: `${title} | RoMetric`,
          description,
          url: `${SITE_URL}${canonicalPath}`,
          type: 'website',
          images: [
            {
              url: ogCardUrl,
              width: 1200,
              height: 630,
              alt: `${seoName} live player count & analytics on RoMetric`,
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
  } catch {
    // Fallback metadata below
  }

  return {
    title: `Roblox Experience #${cleanId} Live Stats`,
    description:
      'Track live Roblox concurrent players, historical CCU charts, visits, revenue estimates, and active codes on RoMetric.',
    alternates: {
      canonical: `/g/${cleanId}`,
    },
  };
}

export default function CanonicalGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
