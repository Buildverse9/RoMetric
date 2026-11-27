import { aggregateStudiosServer } from '@/lib/market-intelligence';
import { SITE_URL } from '@/lib/seo';
import { buildUrlSetXml, type SitemapUrlItem, xmlResponse } from '@/lib/sitemap-xml';
import { fetchSupabaseGamesList, isSupabaseConfigured } from '@/lib/supabase-server';

export const revalidate = 21600;

export async function GET() {
  const nowIso = new Date().toISOString();
  const urls: SitemapUrlItem[] = [];

  if (isSupabaseConfigured()) {
    try {
      const games = await fetchSupabaseGamesList();
      const studios = aggregateStudiosServer(games);
      const seen = new Set<string>();
      for (const studio of studios.slice(0, 1000)) {
        if (!studio.creatorId || studio.creatorId === '0' || seen.has(studio.creatorId)) {
          continue;
        }
        seen.add(studio.creatorId);
        urls.push({
          loc: `${SITE_URL}/developers/${encodeURIComponent(studio.creatorId)}`,
          lastmod: studio.topGame.lastCollectedAt || nowIso,
          changefreq: 'daily',
          priority: studio.combinedCcu >= 10000 ? 0.8 : 0.7,
        });
      }
    } catch {
      // Return empty urlset gracefully
    }
  }

  return xmlResponse(buildUrlSetXml(urls));
}
