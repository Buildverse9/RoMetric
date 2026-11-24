import { fetchIndexableCodeGameSlugs } from '@/lib/codes-server';
import { SITE_URL } from '@/lib/seo';
import { buildUrlSetXml, type SitemapUrlItem, xmlResponse } from '@/lib/sitemap-xml';
import { isSupabaseConfigured } from '@/lib/supabase-server';

export const revalidate = 3600;

export async function GET() {
  const urls: SitemapUrlItem[] = [];

  if (isSupabaseConfigured()) {
    try {
      const codeSlugs = await fetchIndexableCodeGameSlugs();
      for (const item of codeSlugs) {
        urls.push({
          loc: `${SITE_URL}/codes/${encodeURIComponent(item.slug)}`,
          lastmod: item.updatedAt,
          changefreq: 'daily',
          priority: 0.88,
        });
      }
    } catch {
      // Return empty urlset gracefully
    }
  }

  return xmlResponse(buildUrlSetXml(urls));
}
