import type { Metadata } from 'next';
import {
  fetchSupabaseGameById,
  fetchSupabaseGamesList,
} from '@/lib/supabase-server';
import { fetchGameCodesBySlugOrId } from '@/lib/codes-server';
import { formatCompactNumber, formatPercent } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  buildCardQueryString,
  computeGameRevenueSurge,
  detectGameMilestone,
  SITE_ORIGIN,
  type SocialTemplateId,
} from '@/lib/social-studio-shared';
import { CardDestinationRedirect } from '@/components/CardDestinationRedirect';

export const dynamic = 'force-dynamic';

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return (val[0] || '').trim();
  return (val || '').trim();
}

const VALID_TEMPLATES: SocialTemplateId[] = [
  'leaderboard',
  'top_earning',
  'revenue_surge',
  'surge',
  'milestone',
  'codes',
  'vs',
];

function resolveParams(sp: RawSearchParams) {
  const rawT = firstParam(sp.t);
  const template: SocialTemplateId = VALID_TEMPLATES.includes(
    rawT as SocialTemplateId
  )
    ? (rawT as SocialTemplateId)
    : 'leaderboard';
  const count: 5 | 10 = Number(firstParam(sp.count)) === 5 ? 5 : 10;
  const primaryId = (firstParam(sp.g) || firstParam(sp.a)).replace(/[^0-9]/g, '');
  const secondaryId = firstParam(sp.b).replace(/[^0-9]/g, '');
  const codeSlug = firstParam(sp.slug);
  const headline = firstParam(sp.h).slice(0, 90);
  const showRevenue = firstParam(sp.rev) !== '0';

  const utm = new URLSearchParams();
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const v = firstParam(sp[key]);
    if (v) utm.set(key, v);
  }

  return {
    template,
    count,
    primaryId,
    secondaryId,
    codeSlug,
    headline,
    showRevenue,
    utmString: utm.toString(),
  };
}

async function resolveCardContext(sp: RawSearchParams) {
  const parsed = resolveParams(sp);
  const ogQuery = buildCardQueryString({
    template: parsed.template,
    count: parsed.count,
    primaryId: parsed.primaryId || undefined,
    secondaryId: parsed.secondaryId || undefined,
    codeSlug: parsed.codeSlug || undefined,
    headline: parsed.headline || undefined,
    showRevenue: parsed.showRevenue,
  });

  const ogImageUrl = `${SITE_ORIGIN}/api/og/social?${ogQuery}`;
  const ogImageRelative = `/api/og/social?${ogQuery}`;

  let title = 'RoMetric — Live Roblox Game Analytics & Codes';
  let description =
    'Track live Roblox player counts, estimated DevEx revenue, breakout surges, and verified game codes on RoMetric.';
  let destPath = '/rankings';

  try {
    if (parsed.template === 'leaderboard') {
      destPath = '/rankings';
      title =
        parsed.headline ||
        `Top ${parsed.count} Roblox Games by Live Players | RoMetric`;
      description =
        'Live Roblox concurrent player rankings, 24-hour momentum deltas, and historical CCU charts on RoMetric.';
    } else if (parsed.template === 'top_earning') {
      destPath = '/rankings';
      title =
        parsed.headline ||
        `Top ${parsed.count} Earning Roblox Games (Est. Monthly) | RoMetric`;
      description =
        'Live Roblox earnings leaderboard ranked by estimated monthly DevEx USD and Robux revenue on RoMetric.';
    } else if (
      (parsed.template === 'revenue_surge' ||
        parsed.template === 'surge' ||
        parsed.template === 'milestone') &&
      parsed.primaryId
    ) {
      destPath = `/games/${parsed.primaryId}`;
      const game = await fetchSupabaseGameById(parsed.primaryId);
      if (game) {
        if (parsed.template === 'revenue_surge') {
          const rev = computeGameRevenueSurge(game);
          title =
            parsed.headline ||
            `${game.name} Est. Monthly Revenue: ${formatCurrencyCompact(rev.currentMonthlyUsd)} | RoMetric`;
          description = `${game.name} is pacing ${formatCurrencyCompact(rev.currentMonthlyUsd)}/mo (${formatCurrencyCompact(rev.currentDailyUsd)}/day) at ${formatCompactNumber(game.currentCcu)} live players.`;
        } else if (parsed.template === 'surge') {
          const pct = game.growth24h ?? game.growth1h ?? null;
          title =
            parsed.headline ||
            `${game.name} Surges ${pct !== null ? formatPercent(pct) : ''} (${formatCompactNumber(game.currentCcu)} Live) | RoMetric`;
          description = `Live breakout telemetry for ${game.name} by ${game.creatorName}: ${formatCompactNumber(game.currentCcu)} concurrent players and ${formatCompactNumber(game.totalVisits)} lifetime visits.`;
        } else {
          const ms = detectGameMilestone(game);
          title = parsed.headline || `${ms.headline} | RoMetric`;
          description = `${ms.subDetail} — Live Roblox analytics & peaks for ${game.name}.`;
        }
      }
    } else if (parsed.template === 'codes') {
      destPath = parsed.codeSlug
        ? `/codes/${encodeURIComponent(parsed.codeSlug)}`
        : '/codes';
      if (parsed.codeSlug) {
        const detail = await fetchGameCodesBySlugOrId(parsed.codeSlug);
        if (detail.game) {
          const activeCount = detail.codes.filter(
            (c) => c.status === 'active'
          ).length;
          title =
            parsed.headline ||
            `${detail.game.name} Codes (${activeCount} Active & Working) | RoMetric`;
          description = `Tap to copy ${activeCount} verified working Roblox promo codes for ${detail.game.name} on RoMetric.`;
        }
      }
    } else if (parsed.template === 'vs') {
      const ids = [parsed.primaryId, parsed.secondaryId].filter(Boolean);
      destPath =
        ids.length > 0 ? `/compare?games=${ids.join(',')}` : '/compare';
      if (parsed.primaryId && parsed.secondaryId) {
        const [a, b] = await Promise.all([
          fetchSupabaseGameById(parsed.primaryId),
          fetchSupabaseGameById(parsed.secondaryId),
        ]);
        if (a && b) {
          title = parsed.headline || `${a.name} vs ${b.name} — Live Comparison | RoMetric`;
          description = `${a.name} (${formatCompactNumber(a.currentCcu)} CCU, ${formatCurrencyCompact(estimateGameRevenue(a).monthlyUsd)}/mo) vs ${b.name} (${formatCompactNumber(b.currentCcu)} CCU, ${formatCurrencyCompact(estimateGameRevenue(b).monthlyUsd)}/mo).`;
        }
      } else {
        const list = await fetchSupabaseGamesList();
        if (list.length >= 2) {
          title = `${list[0].name} vs ${list[1].name} — Live Roblox Comparison | RoMetric`;
        }
      }
    }
  } catch {
    // Keep resilient fallback metadata
  }

  const sep = destPath.includes('?') ? '&' : '?';
  const targetUrl = parsed.utmString
    ? `${destPath}${sep}${parsed.utmString}`
    : destPath;

  return {
    title,
    description,
    ogImageUrl,
    ogImageRelative,
    targetUrl,
    canonicalUrl: `${SITE_ORIGIN}${destPath}`,
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const ctx = await resolveCardContext(sp);

  return {
    title: ctx.title,
    description: ctx.description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: ctx.canonicalUrl,
    },
    openGraph: {
      title: ctx.title,
      description: ctx.description,
      url: ctx.canonicalUrl,
      siteName: 'RoMetric',
      type: 'website',
      images: [
        {
          url: ctx.ogImageUrl,
          width: 1200,
          height: 630,
          alt: ctx.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ctx.title,
      description: ctx.description,
      images: [ctx.ogImageUrl],
    },
  };
}

export default async function ClickableSocialCardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const ctx = await resolveCardContext(sp);

  return (
    <CardDestinationRedirect
      targetUrl={ctx.targetUrl}
      title={ctx.title}
      description={ctx.description}
      previewImageUrl={ctx.ogImageRelative}
    />
  );
}
