import { NextRequest, NextResponse } from 'next/server';
import { fetchGameCodesBySlugOrId } from '@/lib/codes-server';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const data = await fetchGameCodesBySlugOrId(slug);
    if (!data.game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/codes/[slug]:', error);
    return NextResponse.json(
      { error: 'Unable to load game codes detail.' },
      { status: 500 }
    );
  }
}
