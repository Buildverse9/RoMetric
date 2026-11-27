import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSupabaseGameById,
  isSupabaseConfigured,
  isValidNumericId,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ universeId: string }> }
) {
  const { universeId } = await context.params;
  if (!isValidNumericId(universeId)) {
    return NextResponse.json(
      { error: 'Invalid numeric Universe ID.' },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { configured: false, game: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const game = await fetchSupabaseGameById(universeId);
    return NextResponse.json(
      { configured: true, game },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/supabase/games/[universeId]:', error);
    return NextResponse.json(
      { configured: true, error: 'Unable to load experience from Supabase.' },
      { status: 502 }
    );
  }
}
