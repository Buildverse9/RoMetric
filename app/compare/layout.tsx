import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare Roblox Games Side-by-Side (CCU, Visits & Revenue)',
  description:
    'Compare up to four Roblox games head-to-head on live concurrent players, historical CCU charts, like ratio, visits, and estimated Robux revenue.',
  alternates: { canonical: '/compare' },
  openGraph: {
    title: 'Compare Roblox Games Side-by-Side | RoMetric',
    description:
      'Benchmark Roblox experiences head-to-head on live CCU, growth momentum, visits, and revenue estimates.',
    url: 'https://rometrics.vercel.app/compare',
  },
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
