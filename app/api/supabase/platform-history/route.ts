import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSupabasePlatformHistory,
  isSupabaseConfigured,
  isValidTimeRange,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rangeParam = (searchParams.get('range') || '24h').trim();

  if (!isValidTimeRange(rangeParam)) {
    return NextResponse.json(
      { error: 'Invalid range parameter.' },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        points: [],
        trackedGames: 0,
        liveTotalCcu: 0,
        sourceTable: 'game_snapshots',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const result = await fetchSupabasePlatformHistory(rangeParam);
    return NextResponse.json(
      { configured: true, ...result },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/supabase/platform-history:', error);
    return NextResponse.json(
      {
        configured: true,
        error: 'Unable to load platform CCU history.',
        points: [],
      },
      { status: 502 }
    );
  }
}
