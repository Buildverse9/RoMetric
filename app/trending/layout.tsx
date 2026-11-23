import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trending & Breakout Roblox Games Today',
  description:
    'Discover fast-rising and breakout Roblox games with the sharpest 24-hour player growth, surging CCU momentum, and live trend velocity.',
  alternates: { canonical: '/trending' },
  openGraph: {
    title: 'Trending & Breakout Roblox Games Today | RoMetric',
    description:
      'Spot breakout Roblox hits and fastest-growing games tracked live by player surge percentage and momentum.',
    url: 'https://rometrics.vercel.app/trending',
  },
};

export default function TrendingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
