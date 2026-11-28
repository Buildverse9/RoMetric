import { ASSET_HUB_ORDER } from '@/lib/asset-ids-data';
import { SITE_URL } from '@/lib/seo';
import { buildUrlSetXml, xmlResponse } from '@/lib/sitemap-xml';

export const revalidate = 21600;

export async function GET() {
  const nowIso = new Date().toISOString();

  const urls = [
    {
      loc: `${SITE_URL}/ids`,
      lastmod: nowIso,
      changefreq: 'daily' as const,
      priority: 0.9,
    },
    ...ASSET_HUB_ORDER.map((slug) => ({
      loc: `${SITE_URL}/ids/${slug}`,
      lastmod: nowIso,
      changefreq: 'daily' as const,
      priority: 0.85,
    })),
  ];

  return xmlResponse(buildUrlSetXml(urls));
}
