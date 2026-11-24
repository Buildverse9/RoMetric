import type { Metadata } from 'next';
import { fetchSupabaseGameById } from '@/lib/supabase-server';
import { formatCompactNumber } from '@/lib/format';
import { cleanSeoGameName, getCurrentMonthYear } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ universeId: string }>;
}): Promise<Metadata> {
  const { universeId } = await params;
  const cleanId = String(universeId || '').replace(/[^0-9]/g, '');

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
      const title = `${seoName} Live Player Count, Stats & Revenue (${monthYear})`;
      const description = `${seoName} by ${game.creatorName} has ${formatCompactNumber(game.currentCcu)} live players and ${formatCompactNumber(game.totalVisits)} total visits. Track live CCU charts, peak records, estimated revenue, and active codes on RoMetric.`;
      const ogCardUrl = `https://rometrics.vercel.app/og/social?t=surge&g=${game.universeId}`;

      return {
        title,
        description,
        alternates: {
          canonical: `/games/${game.universeId}`,
        },
        openGraph: {
          title: `${title} | RoMetric`,
          description,
          url: `https://rometrics.vercel.app/games/${game.universeId}`,
          type: 'website',
          images: [
            {
              url: ogCardUrl,
              width: 1200,
              height: 630,
              alt: `${seoName} live stats on RoMetric`,
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
      canonical: `/games/${cleanId}`,
    },
  };
}

export default function GameDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
