import { NextResponse } from 'next/server';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface ServiceProbeResult {
  id: string;
  name: string;
  endpoint: string;
  status: 'operational' | 'degraded' | 'outage';
  httpStatus: number;
  latencyMs: number;
}

async function probeEndpoint(
  id: string,
  name: string,
  url: string
): Promise<ServiceProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - started;
    const status = res.ok
      ? latencyMs > 2500
        ? 'degraded'
        : 'operational'
      : res.status >= 500
        ? 'outage'
        : 'degraded';
    return {
      id,
      name,
      endpoint: new URL(url).host,
      status,
      httpStatus: res.status,
      latencyMs,
    };
  } catch {
    clearTimeout(timer);
    return {
      id,
      name,
      endpoint: new URL(url).host,
      status: 'outage',
      httpStatus: 0,
      latencyMs: Date.now() - started,
    };
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();

  const [gamesProbe, votesProbe, thumbsProbe, universesProbe] =
    await Promise.all([
      probeEndpoint(
        'roblox_games',
        'Roblox Games API',
        'https://games.roblox.com/v1/games?universeIds=994732206'
      ),
      probeEndpoint(
        'roblox_votes',
        'Roblox Votes API',
        'https://games.roblox.com/v1/games/votes?universeIds=994732206'
      ),
      probeEndpoint(
        'roblox_thumbnails',
        'Roblox Thumbnails CDN',
        'https://thumbnails.roblox.com/v1/games/icons?universeIds=994732206&size=150x150&format=Png&isCircular=false'
      ),
      probeEndpoint(
        'roblox_universes',
        'Roblox Universes Resolver',
        'https://apis.roblox.com/universes/v1/places/2753915549/universe'
      ),
    ]);

  let trackedGames = 0;
  let totalLiveCcu = 0;
  if (isSupabaseConfigured()) {
    try {
      const games = await fetchSupabaseGamesList();
      trackedGames = games.length;
      totalLiveCcu = games.reduce((sum, g) => sum + g.currentCcu, 0);
    } catch {
      // Keep zero fallback if DB unreachable
    }
  }

  const services = [gamesProbe, votesProbe, thumbsProbe, universesProbe];
  const outageCount = services.filter((s) => s.status === 'outage').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;
  const overall =
    outageCount >= 2
      ? 'outage'
      : outageCount > 0 || degradedCount > 0
        ? 'degraded'
        : 'operational';

  return NextResponse.json(
    {
      overall,
      checkedAt,
      trackedGames,
      totalLiveCcu,
      services,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
