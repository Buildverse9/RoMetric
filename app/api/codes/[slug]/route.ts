import { NextRequest, NextResponse } from 'next/server';
import { fetchGameCodesBySlugOrId } from '@/lib/codes-server';
import { verifyAdminBearerToken } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const wantFresh = new URL(req.url).searchParams.get('fresh') === '1';

  try {
    const isAdminFresh =
      wantFresh &&
      Boolean(await verifyAdminBearerToken(req.headers.get('authorization')));

    const data = await fetchGameCodesBySlugOrId(slug);
    if (!data.game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': isAdminFresh
          ? 'no-store'
          : 'public, s-maxage=300, stale-while-revalidate=900',
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
