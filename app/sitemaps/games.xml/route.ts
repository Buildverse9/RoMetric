import { SITE_URL, buildGameUrlPath } from '@/lib/seo';
import { buildUrlSetXml, type SitemapUrlItem, xmlResponse } from '@/lib/sitemap-xml';
import {
  fetchSupabaseSitemapGameSlugs,
  isSupabaseConfigured,
} from '@/lib/supabase-server';

export const revalidate = 21600;

export async function GET() {
  const nowIso = new Date().toISOString();
  const urls: SitemapUrlItem[] = [];

  if (isSupabaseConfigured()) {
    try {
      const games = await fetchSupabaseSitemapGameSlugs();
      for (const g of games.slice(0, 25000)) {
        urls.push({
          loc: `${SITE_URL}${buildGameUrlPath({ universeId: g.universeId, slug: g.slug })}`,
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
