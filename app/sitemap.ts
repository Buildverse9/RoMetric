import type { MetadataRoute } from 'next';
import { fetchIndexableCodeGameSlugs } from '@/lib/codes-server';
import { fetchSupabaseGamesList, isSupabaseConfigured } from '@/lib/supabase-server';

const SITE_URL = 'https://rometrics.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/codes`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/rankings`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/trending`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/developers`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.75,
    },
    {
      url: `${SITE_URL}/compare`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.65,
    },
  ];

  if (!isSupabaseConfigured()) {
    return staticEntries;
  }

  try {
    const [codeSlugs, topGames] = await Promise.all([
      fetchIndexableCodeGameSlugs(),
      fetchSupabaseGamesList(),
    ]);

    // Quality-gated SEO: ONLY emit /codes/[slug] URLs for games with actual codes
    const codeEntries: MetadataRoute.Sitemap = codeSlugs.map((item) => ({
      url: `${SITE_URL}/codes/${encodeURIComponent(item.slug)}`,
      lastModified: new Date(item.updatedAt),
      changeFrequency: 'daily',
      priority: 0.85,
    }));

    // Top 200 tracked games analytics pages
    const gameEntries: MetadataRoute.Sitemap = topGames.slice(0, 200).map((g) => ({
      url: `${SITE_URL}/games/${g.universeId}`,
      lastModified: new Date(g.lastCollectedAt || now),
      changeFrequency: 'hourly',
      priority: 0.75,
    }));

    return [...staticEntries, ...codeEntries, ...gameEntries];
  } catch {
    return staticEntries;
  }
}
