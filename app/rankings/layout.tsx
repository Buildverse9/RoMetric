import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Top Roblox Games Rankings — Live CCU & Visits',
  description:
    'Live Roblox game leaderboard ranked by concurrent players (CCU), total visits, like ratio, peak players, and estimated monthly revenue on RoMetric.',
  alternates: { canonical: '/rankings' },
  openGraph: {
    title: 'Top Roblox Games Rankings — Live CCU & Visits | RoMetric',
    description:
      'Explore the highest-playing Roblox experiences ranked in real time by live players, visits, ratings, and revenue estimates.',
    url: 'https://rometrics.vercel.app/rankings',
    images: [
      {
        url: 'https://rometrics.vercel.app/api/og/social?t=leaderboard&count=10',
        width: 1200,
        height: 630,
        alt: 'Top Roblox Games Live CCU Rankings on RoMetric',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top Roblox Games Rankings — Live CCU & Visits | RoMetric',
    description:
      'Live Roblox player count leaderboard, 24h momentum, and estimated DevEx revenue on RoMetric.',
    images: ['https://rometrics.vercel.app/api/og/social?t=leaderboard&count=10'],
  },
};

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
