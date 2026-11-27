import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message:
        'Public manual code submissions are disabled. RoMetric discovers and updates all Roblox game codes automatically.',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
