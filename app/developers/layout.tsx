import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Top Roblox Developers & Studios Leaderboard',
  description:
    'Explore the top Roblox studios and creators ranked by combined live CCU, total visits, average rating, and estimated portfolio revenue.',
  alternates: { canonical: '/developers' },
  openGraph: {
    title: 'Top Roblox Developers & Studios Leaderboard | RoMetric',
    description:
      'Track top Roblox game studios and developers by combined live players, portfolio visits, and revenue estimates.',
    url: 'https://rometrics.vercel.app/developers',
  },
};

export default function DevelopersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
