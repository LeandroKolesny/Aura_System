import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/lib/google';
import { generateSessionToken, getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${FRONTEND_URL}/login?error=google_denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${FRONTEND_URL}/login?error=invalid_callback`);
  }

  let state: { mode: string; returnTo: string };
  try {
    const { payload, sig } = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    const expectedSig = createHmac('sha256', process.env.SESSION_SECRET || 'aura-dev-secret')
      .update(payload)
      .digest('hex');
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return NextResponse.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
    }
    state = JSON.parse(payload);
  } catch {
    return NextResponse.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // Prevent account linking with unverified email addresses
    if (!userInfo.email_verified) {
      return NextResponse.redirect(`${FRONTEND_URL}/login?error=email_not_verified`);
    }

    // CALENDAR MODE: user already logged in, just connect calendar
    if (state.mode === 'calendar') {
      const authUser = await getAuthUser(request);
      if (!authUser) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=not_authenticated`);
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token ?? undefined,
          googleCalendarId: 'primary',
          googleCalendarConnected: true,
          googleTokenExpiresAt: expiresAt,
        },
      });

      // registerCalendarWatch will be called here in Task 7/11
      return NextResponse.redirect(`${FRONTEND_URL}/settings?google_calendar=connected`);
    }

    // LOGIN MODE: only authenticate existing users
    if (state.mode === 'login' || state.mode === 'signin') {
      const user = await prisma.user.findFirst({
        where: { OR: [{ googleId: userInfo.sub }, { email: userInfo.email }] },
        include: { company: true },
      });

      if (!user) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=google_no_account`);
      }

      // Link googleId if not already linked
      if (!user.googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { googleId: userInfo.sub, avatar: userInfo.picture ?? undefined },
        });
      }

      if (!user.isActive) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=account_disabled`);
      }

      const token = generateSessionToken(user.id);
      const response = NextResponse.redirect(
        `${FRONTEND_URL}/auth/google-callback?token=${token}&returnTo=${encodeURIComponent(state.returnTo || '/')}`
      );
      response.cookies.set('aura_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    }

    // REGISTER MODE: create new ADMIN user (no company yet — company created in onboarding)
    if (state.mode === 'register') {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ googleId: userInfo.sub }, { email: userInfo.email }] },
      });

      if (existing) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=google_already_registered`);
      }

      const tempPassword = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
      const newUser = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
          password: tempPassword,
          googleId: userInfo.sub,
          avatar: userInfo.picture ?? undefined,
          role: 'ADMIN',
          isActive: true,
          // companyId intentionally null — admin creates company during onboarding
        },
        include: { company: true },
      });

      const token = generateSessionToken(newUser.id);
      const response = NextResponse.redirect(
        `${FRONTEND_URL}/auth/google-callback?token=${token}&newAccount=true`
      );
      response.cookies.set('aura_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    }

    // Unknown mode fallback
    return NextResponse.redirect(`${FRONTEND_URL}/login?error=invalid_mode`);
  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(`${FRONTEND_URL}/login?error=google_error`);
  }
}
