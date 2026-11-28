import { NextRequest, NextResponse } from 'next/server';
import { getSeedCodesCatalog } from '@/lib/codes-seed-catalog';
import {
  buildCanonicalCodeSlug,
  buildGameUrlPath,
  cleanSeoGameName,
} from '@/lib/seo';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
  supabaseRest,
  verifyAdminBearerToken,
} from '@/lib/supabase-server';

export interface BreakoutRadarItem {
  universeId: string;
  rootPlaceId: string;
  name: string;
  cleanName: string;
  slug: string;
  canonicalCodeSlug: string;
  gamePath: string;
  creatorName: string;
  genre: string;
  iconUrl: string | null;
  currentCcu: number;
  growth24h: number | null;
  totalVisits: number;
  activeCodeCount: number;
  createdAt: string | null;
  breakoutScore: number;
  reasonTags: string[];
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminBearerToken(req.headers.get('authorization'));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured.' },
      { status: 503 }
    );
  }

  try {
    const games = await fetchSupabaseGamesList();

    // Load active Supabase codes count per universe_id (excluding admin_deleted tombstones)
    const activeByUid = new Map<string, Set<string>>();
    const tombstonedByUid = new Map<string, Set<string>>();

    for (let offset = 0; offset < 30000; offset += 1000) {
      const res = await supabaseRest(
        `game_codes?select=universe_id,normalized_code,status,source_reported_status&limit=1000&offset=${offset}`
      );
      if (!res.ok) break;
      const rows = (await res.json()) as Array<{
        universe_id: number;
        normalized_code: string;
        status: string;
        source_reported_status: string | null;
      }>;
      for (const r of rows) {
        const uid = String(r.universe_id);
        if (r.source_reported_status === 'admin_deleted') {
          const set = tombstonedByUid.get(uid) ?? new Set<string>();
          set.add(r.normalized_code);
          tombstonedByUid.set(uid, set);
          continue;
        }
        if (r.status === 'active') {
          const set = activeByUid.get(uid) ?? new Set<string>();
          set.add(r.normalized_code);
          activeByUid.set(uid, set);
        }
      }
      if (rows.length < 1000) break;
    }

    // Merge bundled seed catalog active codes (respecting admin_deleted tombstones)
    for (const seed of getSeedCodesCatalog()) {
      const uid = String(seed.u);
      const tomb = tombstonedByUid.get(uid);
      const set = activeByUid.get(uid) ?? new Set<string>();
      for (const [code] of seed.k) {
        const norm = code.trim().toUpperCase().replace(/\s+/g, '');
        if (!tomb?.has(norm)) {
          set.add(norm);
        }
      }
      activeByUid.set(uid, set);
    }

    const nowMs = Date.now();
    const sixtyDaysMs = 60 * 24 * 3600 * 1000;

    const scored: BreakoutRadarItem[] = [];
    for (const g of games) {
      if (g.currentCcu < 150) continue;
      const activeCount = activeByUid.get(g.universeId)?.size ?? 0;
      const growth = typeof g.growth24h === 'number' ? g.growth24h : null;
      const createdMs = g.robloxCreatedAt ? Date.parse(g.robloxCreatedAt) : NaN;
      const isRecent =
        Number.isFinite(createdMs) && nowMs - createdMs <= sixtyDaysMs;

      // Transparent editorial priority formula:
      // Reward high CCU + 24h surge velocity + huge bonus when 0 active codes exist
      let score = Math.log10(Math.max(10, g.currentCcu)) * 22;
      const reasonTags: string[] = [];

      if (activeCount === 0) {
        score += 36;
        reasonTags.push('0 Active Codes');
      }
      if (growth !== null && growth >= 20) {
        score += Math.min(45, growth * 0.45);
        reasonTags.push(`+${Math.round(growth)}% 24h`);
      }
      if (isRecent) {
        score += 18;
        reasonTags.push('New Release');
      }
      if (g.currentCcu >= 5000) {
        score += 12;
        reasonTags.push('5K+ CCU');
      }

      scored.push({
        universeId: g.universeId,
        rootPlaceId: g.rootPlaceId,
        name: g.name,
        cleanName: cleanSeoGameName(g.name),
        slug: g.slug || g.universeId,
        canonicalCodeSlug:
          buildCanonicalCodeSlug(g) || g.slug || g.universeId,
        gamePath: buildGameUrlPath(g),
        creatorName: g.creatorName,
        genre: g.genre || 'Roblox',
        iconUrl: g.iconUrl,
        currentCcu: g.currentCcu,
        growth24h: growth,
        totalVisits: g.totalVisits,
        activeCodeCount: activeCount,
        createdAt: g.robloxCreatedAt || null,
        breakoutScore: Math.round(score),
        reasonTags,
      });
    }

    scored.sort((a, b) => b.breakoutScore - a.breakoutScore);

    const missingCodes = scored
      .filter((x) => x.activeCodeCount === 0)
      .slice(0, 120);
    const surging24h = scored
      .filter((x) => (x.growth24h ?? 0) >= 15)
      .sort((a, b) => (b.growth24h ?? 0) - (a.growth24h ?? 0))
      .slice(0, 120);
    const allRising = scored.slice(0, 150);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalScanned: games.length,
        missingCodesHighCcu: missingCodes.filter((x) => x.currentCcu >= 500)
          .length,
        surgingMissingCodes: missingCodes.filter(
          (x) => (x.growth24h ?? 0) >= 15
        ).length,
        recentReleasesMissingCodes: missingCodes.filter((x) =>
          x.reasonTags.includes('New Release')
        ).length,
      },
      missingCodes,
      surging24h,
      allRising,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to compute Breakout Radar.',
      },
      { status: 500 }
    );
  }
}
