import type { Metadata } from 'next';
import { SITE_URL, getCurrentMonthYear } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const monthYear = getCurrentMonthYear();
  const title = `Most Played Roblox Games Right Now (${monthYear}) — Live Rankings`;
  const description = `See the top Roblox games live right now ranked by concurrent players (CCU), 24h growth, total visits, and estimated monthly revenue on RoMetric.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/rankings` },
    openGraph: {
      title: `${title} | RoMetric`,
      description,
      url: `${SITE_URL}/rankings`,
      images: [
        {
          url: `${SITE_URL}/og/social?t=leaderboard&count=10`,
          width: 1200,
          height: 630,
          alt: `Top Roblox Games Live CCU Rankings (${monthYear}) on RoMetric`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | RoMetric`,
      description,
      images: [`${SITE_URL}/og/social?t=leaderboard&count=10`],
    },
  };
}

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
