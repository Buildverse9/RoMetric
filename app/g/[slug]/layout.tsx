import type { Metadata } from 'next';
import { fetchSupabaseGameById } from '@/lib/supabase-server';
import { formatCompactNumber, formatExactNumber } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  SITE_URL,
  buildGameUrlPath,
  cleanSeoGameName,
  extractUniverseIdFromParam,
  getCurrentMonthYear,
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
      const monthYear = getCurrentMonthYear();
      const canonicalPath = buildGameUrlPath(game);
      const rev = estimateGameRevenue(game);
      const hasLiveCcu = (game.currentCcu ?? 0) > 0;
      const title =
        hasLiveCcu && rev.monthlyUsd > 0
          ? `${seoName} Live Players (${formatCompactNumber(game.currentCcu)}) & Est. Revenue (${monthYear})`
          : `${seoName} Live Player Count, Stats & Revenue (${monthYear})`;
      const description =
        rev.monthlyUsd > 0
          ? `${seoName} has ${formatExactNumber(game.currentCcu)} live players right now and makes an est. ${formatCurrencyCompact(rev.monthlyUsd)}/month (${formatCurrencyCompact(rev.dailyUsd)}/day). View live CCU charts, peak records & working codes.`
          : `${seoName} by ${game.creatorName} has ${formatExactNumber(game.currentCcu)} live players and ${formatCompactNumber(game.totalVisits)} total visits. View live CCU charts, peak records, estimated revenue & working codes.`;
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
              alt: `${seoName} live player count & revenue estimate on RoMetric`,
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
