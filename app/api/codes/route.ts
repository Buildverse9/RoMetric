import { NextRequest, NextResponse } from 'next/server';
import { fetchCodesDirectory } from '@/lib/codes-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const rawStatus = searchParams.get('status') || 'all';
  const rawSort = searchParams.get('sort') || 'popular';
  const onlyWithCodes = searchParams.get('covered') === '1';

  const status =
    rawStatus === 'active' ||
    rawStatus === 'pending_verification' ||
    rawStatus === 'expired' ||
    rawStatus === 'unverified'
      ? rawStatus
      : 'all';

  const sort =
    rawSort === 'recently_updated' || rawSort === 'most_codes'
      ? rawSort
      : 'popular';

  try {
    const data = await fetchCodesDirectory({ q, status, sort, onlyWithCodes });
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=180',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/codes:', error);
    return NextResponse.json(
      { error: 'Unable to load Roblox game codes directory.' },
      { status: 502 }
    );
  }
}
