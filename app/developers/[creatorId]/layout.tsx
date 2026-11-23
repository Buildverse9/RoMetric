import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}): Promise<Metadata> {
  const { creatorId } = await params;
  const cleanId = String(creatorId || '').replace(/[^0-9]/g, '');

  return {
    title: cleanId
      ? `Roblox Developer #${cleanId} — Portfolio & Live CCU`
      : 'Roblox Developer Portfolio',
    description:
      'View combined live player counts, tracked Roblox experiences, visits, and performance charts for this Roblox creator on RoMetric.',
    alternates: {
      canonical: cleanId ? `/developers/${cleanId}` : '/developers',
    },
  };
}

export default function DeveloperDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
