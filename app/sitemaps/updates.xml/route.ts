import { getGamesSortedByRecentUpdate } from '@/lib/market-intelligence';
import { SITE_URL, buildGameUpdatesUrlPath } from '@/lib/seo';
import { buildUrlSetXml, type SitemapUrlItem, xmlResponse } from '@/lib/sitemap-xml';
import { fetchSupabaseGamesList, isSupabaseConfigured } from '@/lib/supabase-server';

export const revalidate = 3600;

export async function GET() {
  const nowIso = new Date().toISOString();
  const urls: SitemapUrlItem[] = [];

  if (isSupabaseConfigured()) {
    try {
      const games = await fetchSupabaseGamesList();
      const updatedGames = getGamesSortedByRecentUpdate(games);
      for (const g of updatedGames.slice(0, 1000)) {
        urls.push({
          loc: `${SITE_URL}${buildGameUpdatesUrlPath(g)}`,
          lastmod: g.robloxUpdatedAt || g.lastCollectedAt || nowIso,
          changefreq: 'daily',
          priority: 0.72,
        });
      }
    } catch {
      // Return empty urlset gracefully
    }
  }

  return xmlResponse(buildUrlSetXml(urls));
}
