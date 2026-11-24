import type { MetadataRoute } from 'next';

const SITE_URL = 'https://rometrics.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['Twitterbot', 'facebookexternalhit', 'Discordbot'],
        allow: ['/', '/og/', '/api/og/'],
        disallow: ['/admin'],
      },
      {
        userAgent: '*',
        allow: ['/', '/og/', '/api/og/'],
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
