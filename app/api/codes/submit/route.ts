import { NextRequest, NextResponse } from 'next/server';
import { submitCommunityCode } from '@/lib/codes-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const clientIp =
      forwardedFor.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const result = await submitCommunityCode(
      {
        gameInput: typeof body.gameInput === 'string' ? body.gameInput : '',
        code: typeof body.code === 'string' ? body.code : '',
        rewardDescription:
          typeof body.rewardDescription === 'string'
            ? body.rewardDescription
            : undefined,
        sourceUrl:
          typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
        submitterNote:
          typeof body.submitterNote === 'string'
            ? body.submitterNote
            : undefined,
        websiteHoneypot:
          typeof body.website === 'string' ? body.website : undefined,
      },
      clientIp
    );

    return NextResponse.json(result, {
      status: result.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Invalid submission payload.' },
      { status: 400 }
    );
  }
}
