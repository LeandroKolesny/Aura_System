import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google';
import { randomBytes, createHmac } from 'crypto';

// GET /api/auth/google?mode=signin|calendar&returnTo=/dashboard
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'signin';
  const rawReturnTo = searchParams.get('returnTo') || '/';
  const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/';

  const payload = JSON.stringify({ mode, returnTo, nonce: randomBytes(8).toString('hex') });
  const sig = createHmac('sha256', process.env.SESSION_SECRET || 'aura-dev-secret')
    .update(payload)
    .digest('hex');
  const state = Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');

  const includeCalendar = mode === 'calendar';
  const url = getGoogleAuthUrl(state, includeCalendar);

  return NextResponse.redirect(url);
}
