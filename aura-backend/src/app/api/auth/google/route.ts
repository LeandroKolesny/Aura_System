import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google';
import { randomBytes } from 'crypto';

// GET /api/auth/google?mode=signin|calendar&returnTo=/dashboard
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'signin';
  const returnTo = searchParams.get('returnTo') || '/';

  const stateObj = { mode, returnTo, nonce: randomBytes(8).toString('hex') };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

  const includeCalendar = mode === 'calendar';
  const url = getGoogleAuthUrl(state, includeCalendar);

  return NextResponse.redirect(url);
}
