import { NextResponse } from 'next/server';
import {
  fetchSupabaseGamesList,
  isSupabaseConfigured,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { configured: false, games: [] },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const games = await fetchSupabaseGamesList();
    return NextResponse.json(
      { configured: true, games },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/supabase/games:', error);
    return NextResponse.json(
      { configured: true, error: 'Unable to load games from Supabase.' },
      { status: 502 }
    );
  }
}
