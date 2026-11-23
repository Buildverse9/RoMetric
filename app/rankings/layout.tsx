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
  },
};

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
