import type { Metadata } from 'next';
import { fetchCodesDirectory } from '@/lib/codes-server';
import { CodesDirectoryClient } from '@/components/CodesDirectoryClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Roblox Game Codes Directory — Active & Working Codes',
  description:
    'Browse automatically updated Roblox game promo codes across tracked experiences, with clear verification timestamps, reward details, and source attribution on RoMetric.',
  alternates: {
    canonical: 'https://rometrics.vercel.app/codes',
  },
  openGraph: {
    title: 'Roblox Game Codes Directory | RoMetric',
    description:
      'Search active and historical Roblox promo codes with honest verification timestamps and one-tap copy.',
    url: 'https://rometrics.vercel.app/codes',
    type: 'website',
  },
};

export default async function CodesDirectoryPage() {
  const initialData = await fetchCodesDirectory({
    status: 'all',
    sort: 'popular',
  });

  return <CodesDirectoryClient initialData={initialData} />;
}
