import { notFound, permanentRedirect } from 'next/navigation';
import { fetchSupabaseGameById, isSupabaseConfigured } from '@/lib/supabase-server';
import { buildGameUrlPath, extractUniverseIdFromParam } from '@/lib/seo';

export default async function LegacyGameRedirectPage({
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
      permanentRedirect(buildGameUrlPath(game));
    }
  }

  permanentRedirect(`/g/${cleanId}`);
}
