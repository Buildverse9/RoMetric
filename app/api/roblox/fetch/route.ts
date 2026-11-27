import { NextRequest, NextResponse } from 'next/server';
import {
  discoverLiveRobloxCharts,
  fetchLiveRobloxGames,
  sanitizeUniverseIds,
} from '@/lib/roblox-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    const fresh = searchParams.get('fresh') === '1';

    let rawIds: string[];
    if (idsParam) {
      rawIds = idsParam.split(',');
    } else {
      const discovered = await discoverLiveRobloxCharts(200, fresh);
      rawIds = discovered.map((entry) => entry.universeId);
    }

    const universeIds = sanitizeUniverseIds(rawIds, 600);
    if (universeIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid numeric Universe IDs provided.' },
        { status: 400 }
      );
    }

    const result = await fetchLiveRobloxGames(universeIds, fresh);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': fresh
          ? 'no-store'
          : 'public, s-maxage=300, stale-while-revalidate=900',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/roblox/fetch:', error);
    return NextResponse.json(
      { error: 'Unable to fetch live Roblox data right now. Please try again shortly.' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { universeIds?: unknown; fresh?: boolean };
    if (!Array.isArray(body?.universeIds)) {
      return NextResponse.json(
        { error: 'Request body must include a universeIds array.' },
        { status: 400 }
      );
    }

    const universeIds = sanitizeUniverseIds(
      body.universeIds.map((v) => String(v)),
      600
    );

    if (universeIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid numeric Universe IDs provided.' },
        { status: 400 }
      );
    }

    const result = await fetchLiveRobloxGames(universeIds, Boolean(body.fresh));
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error in POST /api/roblox/fetch:', error);
    return NextResponse.json(
      { error: 'Unable to process Roblox collection batch.' },
      { status: 500 }
    );
  }
}
