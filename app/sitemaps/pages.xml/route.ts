import {
  GENRE_DEFINITIONS,
  GUIDE_TOPICS,
  STATIC_INSIGHTS,
  buildGameRevenueInsightSlug,
  extractKeywordTrends,
  getRecentWeekDates,
} from '@/lib/market-intelligence';
import { SITE_URL } from '@/lib/seo';
import { buildUrlSetXml, type SitemapUrlItem, xmlResponse } from '@/lib/sitemap-xml';
import { fetchSupabaseGamesList, isSupabaseConfigured } from '@/lib/supabase-server';

export const revalidate = 3600;

export async function GET() {
  const nowIso = new Date().toISOString();
  const urls: SitemapUrlItem[] = [
    { loc: SITE_URL, lastmod: nowIso, changefreq: 'hourly', priority: 1.0 },
    { loc: `${SITE_URL}/rankings`, lastmod: nowIso, changefreq: 'hourly', priority: 0.95 },
    { loc: `${SITE_URL}/codes`, lastmod: nowIso, changefreq: 'hourly', priority: 0.95 },
    { loc: `${SITE_URL}/trending`, lastmod: nowIso, changefreq: 'hourly', priority: 0.9 },
    { loc: `${SITE_URL}/updates`, lastmod: nowIso, changefreq: 'hourly', priority: 0.9 },
    { loc: `${SITE_URL}/genres`, lastmod: nowIso, changefreq: 'daily', priority: 0.85 },
    { loc: `${SITE_URL}/trends`, lastmod: nowIso, changefreq: 'daily', priority: 0.85 },
    { loc: `${SITE_URL}/similar`, lastmod: nowIso, changefreq: 'daily', priority: 0.85 },
    { loc: `${SITE_URL}/developers`, lastmod: nowIso, changefreq: 'daily', priority: 0.85 },
    { loc: `${SITE_URL}/weekly`, lastmod: nowIso, changefreq: 'weekly', priority: 0.8 },
    { loc: `${SITE_URL}/insights`, lastmod: nowIso, changefreq: 'daily', priority: 0.8 },
    { loc: `${SITE_URL}/status`, lastmod: nowIso, changefreq: 'hourly', priority: 0.75 },
    { loc: `${SITE_URL}/compare`, lastmod: nowIso, changefreq: 'weekly', priority: 0.7 },
    { loc: `${SITE_URL}/guide`, lastmod: nowIso, changefreq: 'monthly', priority: 0.65 },
  ];

  for (const genre of GENRE_DEFINITIONS) {
    urls.push({
      loc: `${SITE_URL}/genres/${genre.slug}`,
      lastmod: nowIso,
      changefreq: 'daily',
      priority: 0.82,
    });
  }

  for (const week of getRecentWeekDates(12)) {
    urls.push({
      loc: `${SITE_URL}/weekly/${week}`,
      lastmod: nowIso,
      changefreq: 'weekly',
      priority: 0.72,
    });
  }

  for (const insight of STATIC_INSIGHTS) {
    urls.push({
      loc: `${SITE_URL}/insights/${insight.slug}`,
      lastmod: nowIso,
      changefreq: 'daily',
      priority: 0.78,
    });
  }

  for (const topic of GUIDE_TOPICS) {
    urls.push({
      loc: `${SITE_URL}/guide/${topic.slug}`,
      lastmod: nowIso,
      changefreq: 'monthly',
      priority: 0.6,
    });
  }

  if (isSupabaseConfigured()) {
    try {
      const games = await fetchSupabaseGamesList();
      const keywords = extractKeywordTrends(games, 2, 120);
      for (const kw of keywords) {
        urls.push({
          loc: `${SITE_URL}/trends/${encodeURIComponent(kw.keyword)}`,
          lastmod: nowIso,
          changefreq: 'daily',
          priority: 0.74,
        });
      }

      // Top 150 game revenue Q&A insight pages
      const seenInsightSlugs = new Set(STATIC_INSIGHTS.map((s) => s.slug));
      for (const g of games.slice(0, 150)) {
        const revSlug = buildGameRevenueInsightSlug(g);
        if (seenInsightSlugs.has(revSlug)) continue;
        seenInsightSlugs.add(revSlug);
        urls.push({
          loc: `${SITE_URL}/insights/${encodeURIComponent(revSlug)}`,
          lastmod: g.lastCollectedAt || nowIso,
          changefreq: 'daily',
          priority: 0.76,
        });
      }
    } catch {
      // Serve core pages if Supabase temporarily unavailable
    }
  }

  return xmlResponse(buildUrlSetXml(urls));
}
