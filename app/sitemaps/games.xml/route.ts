import { SITE_URL, buildGameUrlPath } from '@/lib/seo';
import { buildUrlSetXml, type SitemapUrlItem, xmlResponse } from '@/lib/sitemap-xml';
import { fetchSupabaseGamesList, isSupabaseConfigured } from '@/lib/supabase-server';

export const revalidate = 3600;

export async function GET() {
  const nowIso = new Date().toISOString();
  const urls: SitemapUrlItem[] = [];

  if (isSupabaseConfigured()) {
    try {
      const games = await fetchSupabaseGamesList();
      for (const g of games.filter((item) => item.active).slice(0, 3000)) {
        urls.push({
          loc: `${SITE_URL}${buildGameUrlPath(g)}`,
          lastmod: g.lastCollectedAt || nowIso,
          changefreq: 'hourly',
          priority: g.currentCcu >= 10000 ? 0.85 : 0.75,
        });
      }
    } catch {
      // Return empty urlset gracefully
    }
  }

  return xmlResponse(buildUrlSetXml(urls));
}
