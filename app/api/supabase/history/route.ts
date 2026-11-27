import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSupabaseGameHistory,
  isSupabaseConfigured,
  isValidNumericId,
  isValidTimeRange,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const universeId = (searchParams.get('universeId') || '').trim();
  const rangeParam = (searchParams.get('range') || '24h').trim();

  if (!isValidNumericId(universeId)) {
    return NextResponse.json(
      { error: 'Invalid numeric universeId parameter.' },
      { status: 400 }
    );
  }

  if (!isValidTimeRange(rangeParam)) {
    return NextResponse.json(
      { error: 'Invalid range parameter.' },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { configured: false, points: [], peakRecord: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const history = await fetchSupabaseGameHistory(universeId, rangeParam);
    return NextResponse.json(
      { configured: true, ...history },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/supabase/history:', error);
    return NextResponse.json(
      { configured: true, error: 'Unable to load game history from Supabase.' },
      { status: 502 }
    );
  }
}
