import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchGameCodesDetail } from '@/lib/codes-server';
import { GameCodesDetailClient } from '@/components/GameCodesDetailClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const payload = await fetchGameCodesDetail(slug);
  const game = payload.game;

  if (!game) {
    return {
      title: 'Roblox Game Codes Not Found | RoMetric',
      description: 'We could not find codes for this Roblox experience.',
    };
  }

  const activeCount = payload.codes.filter((c) => c.status === 'active').length;
  const title = `${game.name} Codes (${activeCount} Active & Working) — RoMetric`;
  const description = `Find all active and working Roblox promo codes for ${game.name}. Verified codes, reward descriptions, and one-tap copy on RoMetric.`;
  const pageUrl = `https://rometrics.vercel.app/codes/${encodeURIComponent(game.slug || slug)}`;

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: 'website',
      images: game.thumbnailUrl ? [game.thumbnailUrl] : game.iconUrl ? [game.iconUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: game.thumbnailUrl ? [game.thumbnailUrl] : game.iconUrl ? [game.iconUrl] : undefined,
    },
  };
}

export default async function GameCodesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const payload = await fetchGameCodesDetail(slug);

  if (!payload.game) {
    notFound();
  }

  return <GameCodesDetailClient initialPayload={payload} />;
}
