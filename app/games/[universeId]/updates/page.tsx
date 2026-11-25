import { notFound, permanentRedirect } from 'next/navigation';
import { fetchSupabaseGameById, isSupabaseConfigured } from '@/lib/supabase-server';
import { buildGameUpdatesUrlPath, extractUniverseIdFromParam } from '@/lib/seo';

export default async function LegacyGameUpdatesRedirectPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = await params;
  const cleanId = extractUniverseIdFromParam(universeId);
  if (!cleanId) notFound();

  if (isSupabaseConfigured()) {
    const game = await fetchSupabaseGameById(cleanId).catch(() => null);
    if (game) {
      permanentRedirect(buildGameUpdatesUrlPath(game));
    }
  }

  permanentRedirect(`/g/${cleanId}/updates`);
}
