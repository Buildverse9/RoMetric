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
      for (const g of games.filter((item) => item.active).slice(0, 1000)) {
        urls.push({
          loc: `${SITE_URL}/similar/${g.universeId}`,
          lastmod: g.lastCollectedAt || nowIso,
          changefreq: 'weekly',
          priority: 0.74,
        });
      }
    } catch {
      // Return empty urlset gracefully
    }
  }

  return xmlResponse(buildUrlSetXml(urls));
}
