import { SITE_URL } from '@/lib/seo';
import { buildSitemapIndexXml, xmlResponse } from '@/lib/sitemap-xml';

export const revalidate = 3600;

export async function GET() {
  const nowIso = new Date().toISOString();
  const xml = buildSitemapIndexXml([
    { loc: `${SITE_URL}/sitemaps/pages.xml`, lastmod: nowIso },
    { loc: `${SITE_URL}/sitemaps/games.xml`, lastmod: nowIso },
    { loc: `${SITE_URL}/sitemaps/studios.xml`, lastmod: nowIso },
    { loc: `${SITE_URL}/sitemaps/updates.xml`, lastmod: nowIso },
    { loc: `${SITE_URL}/sitemaps/similar.xml`, lastmod: nowIso },
    { loc: `${SITE_URL}/sitemaps/codes.xml`, lastmod: nowIso },
  ]);
  return xmlResponse(xml);
}
