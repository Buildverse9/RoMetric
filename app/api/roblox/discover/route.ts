import { NextRequest, NextResponse } from 'next/server';
import { discoverLiveRobloxCharts } from '@/lib/roblox-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get('limit') || '500');
    const maxGames = Number.isFinite(limitParam)
      ? Math.max(10, Math.min(1000, Math.floor(limitParam)))
      : 500;
    const fresh = searchParams.get('fresh') === '1';

    const entries = await discoverLiveRobloxCharts(maxGames, fresh);

    return NextResponse.json(
      {
        capturedAt: new Date().toISOString(),
        count: entries.length,
        entries,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': fresh
            ? 'no-store'
            : 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/roblox/discover:', error);
    return NextResponse.json(
      { error: 'Unable to discover live Roblox charts right now.' },
      { status: 502 }
    );
  }
}
