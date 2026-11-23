import { NextRequest, NextResponse } from 'next/server';
import { resolveRobloxExperience } from '@/lib/roblox-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    const result = await resolveRobloxExperience(query);
    if (!result.game) {
      return NextResponse.json(
        { error: result.error || 'Experience not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        game: result.game,
        resolvedFrom: result.resolvedFrom,
        capturedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/roblox/resolve:', error);
    return NextResponse.json(
      { error: 'Failed to resolve Roblox experience.' },
      { status: 500 }
    );
  }
}
