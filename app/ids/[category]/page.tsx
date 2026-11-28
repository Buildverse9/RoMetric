import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AssetIdsHubClient } from '@/components/AssetIdsHubClient';
import {
  ASSET_HUB_META,
  isValidAssetIdCategory,
  type CuratedAssetHubType,
  type LiveCatalogAssetItem,
  type LiveCatalogHubType,
} from '@/lib/asset-ids-data';
import { fetchCuratedAssetIds } from '@/lib/asset-ids-server';
import { SITE_NAME, SITE_URL, safeJsonLd } from '@/lib/seo';

export const revalidate = 900;

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category } = await params;
  const slug = category.toLowerCase();
  if (!isValidAssetIdCategory(slug)) {
    return { title: `Asset IDs Not Found | ${SITE_NAME}` };
  }
  const meta = ASSET_HUB_META[slug];
  const canonicalUrl = `${SITE_URL}/ids/${meta.slug}`;

  return {
    title: `${meta.seoTitle} | ${SITE_NAME}`,
    description: meta.seoDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: meta.seoTitle,
      description: meta.seoDescription,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
    },
  };
}

interface RobloxCatalogRawItem {
  id?: number;
  itemType?: string;
  name?: string;
  creatorName?: string;
  price?: number | null;
  lowestPrice?: number | null;
  favoriteCount?: number;
}

async function fetchInitialCatalogAssets(
  category: LiveCatalogHubType
): Promise<{ items: LiveCatalogAssetItem[]; nextCursor: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const params = new URLSearchParams();
    params.set('Limit', '30');
    params.set('SortType', '1');
    if (category === 'hair') {
      params.set('Category', '11');
      params.set('Subcategory', '20');
    } else if (category === 'faces') {
      params.set('Category', '4');
      params.set('Subcategory', '10');
    } else {
      params.set('Category', '5');
    }

    const res = await fetch(
      `https://catalog.roblox.com/v1/search/items/details?${params.toString()}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RoMetric/1.0 (+https://rometrics.vercel.app)',
        },
        next: { revalidate: 900 },
      }
    );

    if (!res.ok) {
      return { items: [], nextCursor: null };
    }

    const payload = (await res.json()) as {
      nextPageCursor?: string | null;
      data?: RobloxCatalogRawItem[];
    };

    const rawRows = (payload.data || []).filter((r) => Boolean(r.id && r.name));
    const assetIds = rawRows.map((r) => String(r.id));

    const thumbMap = new Map<string, string>();
    if (assetIds.length > 0) {
      try {
        const thumbRes = await fetch(
          `https://thumbnails.roblox.com/v1/assets?assetIds=${encodeURIComponent(
            assetIds.slice(0, 50).join(',')
          )}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'RoMetric/1.0 (+https://rometrics.vercel.app)',
            },
            next: { revalidate: 3600 },
          }
        );
        if (thumbRes.ok) {
          const thumbJson = (await thumbRes.json()) as {
            data?: Array<{ targetId?: number; imageUrl?: string }>;
          };
          for (const row of thumbJson.data || []) {
            if (row.targetId && row.imageUrl) {
              thumbMap.set(String(row.targetId), row.imageUrl);
            }
          }
        }
      } catch {
        // Non-fatal thumbnail fallback
      }
    }

    const items: LiveCatalogAssetItem[] = rawRows.map((row) => {
      const id = String(row.id);
      const price =
        typeof row.price === 'number'
          ? row.price
          : typeof row.lowestPrice === 'number'
            ? row.lowestPrice
            : null;
      return {
        assetId: id,
        name: String(row.name || `Asset ${id}`),
        creatorName: String(row.creatorName || 'Roblox'),
        priceRobux: price,
        favoriteCount:
          typeof row.favoriteCount === 'number' ? row.favoriteCount : 0,
        thumbnailUrl: thumbMap.get(id) ?? null,
        itemType: String(row.itemType || 'Asset'),
        hubType: category,
      };
    });

    return { items, nextCursor: payload.nextPageCursor ?? null };
  } catch {
    return { items: [], nextCursor: null };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function AssetIdCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const slug = category.toLowerCase();

  if (!isValidAssetIdCategory(slug)) {
    notFound();
  }

  const meta = ASSET_HUB_META[slug];
  const isCurated = meta.mode === 'curated';

  const initialCuratedItems = isCurated
    ? await fetchCuratedAssetIds({ hubType: slug as CuratedAssetHubType }).catch(
        () => []
      )
    : [];

  const catalogBoot = !isCurated
    ? await fetchInitialCatalogAssets(slug as LiveCatalogHubType)
    : { items: [], nextCursor: null };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Roblox Asset IDs',
            item: `${SITE_URL}/ids`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: meta.label,
            item: `${SITE_URL}/ids/${meta.slug}`,
          },
        ],
      },
      ...(meta.faqs.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: meta.faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <AssetIdsHubClient
        category={slug}
        initialCuratedItems={initialCuratedItems}
        initialCatalogItems={catalogBoot.items}
        initialCatalogCursor={catalogBoot.nextCursor}
      />
    </>
  );
}
