# Google Calendar Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google Sign-In for user registration/login (Phase 1) and bidirectional Google Calendar sync per professional (Phase 2).

**Architecture:** Phase 1 uses Google Identity Services (OAuth 2.0 Authorization Code flow) to let admins and patients sign in with Google; the backend exchanges the code for tokens, creates/finds users, and issues the existing `aura_session` cookie. Phase 2 adds calendar scopes to the same OAuth flow for professionals, stores access/refresh tokens in the DB, pushes Aura appointments to Google Calendar as events, and receives Google push webhooks to block Aura availability when external events appear.

**Tech Stack:** Google Cloud OAuth 2.0, Google Calendar REST API v3, Prisma migrations, Next.js 15 serverless routes, React + Vite frontend, Vercel Cron (webhook renewal every 6 days).

---

## Prerequisites (Manual — before coding)

1. Go to https://console.cloud.google.com → create project "Aura System"
2. Enable **Google Calendar API** and **Google+ API** (People API)
3. Create **OAuth 2.0 Client ID** (Web application)
   - Authorized redirect URIs: `https://aura-backend-api.vercel.app/api/auth/google/callback` and `http://localhost:3001/api/auth/google/callback`
4. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
5. Add to **both** `.env` files (local) and Vercel environment variables for `aura-backend-api`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://aura-backend-api.vercel.app/api/auth/google/callback
   FRONTEND_URL=https://aura-system-mu.vercel.app
   ```
6. In `next.config.ts` — the CORS header for `https://aura-system-mu.vercel.app` is already configured. No changes needed.

---

## Task 1: Prisma Schema — Add Google Fields

**Files:**
- Modify: `aura-backend/prisma/schema.prisma`

**Step 1: Add Google fields to User model and new GoogleCalendarWatch model**

In `schema.prisma`, add to the `User` model (after `businessHours`):

```prisma
  // Google OAuth
  googleId              String?   @unique
  googleAccessToken     String?
  googleRefreshToken    String?
  googleCalendarId      String?   // Usually 'primary'
  googleCalendarConnected Boolean @default(false)
  googleTokenExpiresAt  DateTime?
```

Add `googleEventId` to the `Appointment` model (after `signatureMetadata`):

```prisma
  googleEventId   String?   // ID do evento no Google Calendar
```

Add the new `GoogleCalendarWatch` model at the end of the file (before the last `}`):

```prisma
// ============================================
// MÓDULO: GOOGLE CALENDAR WEBHOOKS
// ============================================

model GoogleCalendarWatch {
  id              String   @id @default(cuid())
  channelId       String   @unique  // UUID enviado para Google
  resourceId      String?           // Retornado pelo Google
  expiration      DateTime          // Quando o canal expira

  // Relacionamentos
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String   @unique  // Um canal por profissional

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("google_calendar_watches")
}
```

Also add `watches GoogleCalendarWatch?` to the `User` model relations.

**Step 2: Run migration**

```bash
cd aura-backend
npx prisma migrate dev --name add_google_calendar_fields
```

Expected: Migration file created in `prisma/migrations/`, Prisma client regenerated.

**Step 3: Verify Prisma client has new fields**

```bash
npx prisma generate
```

Expected: `@prisma/client` types include `googleId`, `googleCalendarConnected`, `googleEventId`.

**Step 4: Commit**

```bash
git add aura-backend/prisma/schema.prisma aura-backend/prisma/migrations/
git commit -m "feat: add Google OAuth and Calendar fields to Prisma schema"
```

---

## Task 2: Backend — Google OAuth Routes (Phase 1: Sign-In)

**Files:**
- Create: `aura-backend/src/app/api/auth/google/route.ts`
- Create: `aura-backend/src/app/api/auth/google/callback/route.ts`
- Modify: `aura-backend/src/lib/google.ts` (new file — Google OAuth helper)

**Step 1: Create Google OAuth helper**

Create `aura-backend/src/lib/google.ts`:

```typescript
// Google OAuth 2.0 helper
// Scopes for Phase 1 (Sign-In only): openid email profile
// Scopes for Phase 2 (+ Calendar): https://www.googleapis.com/auth/calendar

export const GOOGLE_SCOPES_SIGNIN = [
  'openid',
  'email',
  'profile',
].join(' ');

export const GOOGLE_SCOPES_CALENDAR = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
].join(' ');

export function getGoogleAuthUrl(state: string, includeCalendar = false): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: includeCalendar ? GOOGLE_SCOPES_CALENDAR : GOOGLE_SCOPES_SIGNIN,
    access_type: 'offline',   // Required to get refresh_token
    prompt: 'consent',        // Always show consent to get refresh_token
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token: string;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

export async function getGoogleUserInfo(accessToken: string): Promise<{
  sub: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to get Google user info');
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  return res.json();
}
```

**Step 2: Create OAuth initiation route**

Create `aura-backend/src/app/api/auth/google/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google';
import { randomBytes } from 'crypto';

// GET /api/auth/google?mode=signin|calendar&returnTo=/dashboard
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'signin';
  const returnTo = searchParams.get('returnTo') || '/';

  // State encodes mode + returnTo for callback to read
  const stateObj = { mode, returnTo, nonce: randomBytes(8).toString('hex') };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

  const includeCalendar = mode === 'calendar';
  const url = getGoogleAuthUrl(state, includeCalendar);

  return NextResponse.redirect(url);
}
```

**Step 3: Create OAuth callback route**

Create `aura-backend/src/app/api/auth/google/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/lib/google';
import { generateSessionToken } from '@/lib/auth';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  // User denied access
  if (error) {
    return NextResponse.redirect(`${FRONTEND_URL}/#/login?error=google_denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${FRONTEND_URL}/#/login?error=invalid_callback`);
  }

  // Decode state
  let state: { mode: string; returnTo: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
  } catch {
    return NextResponse.redirect(`${FRONTEND_URL}/#/login?error=invalid_state`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // ---- CALENDAR MODE: user is already logged in, just connect calendar ----
    if (state.mode === 'calendar') {
      const authUser = await getAuthUser(request);
      if (!authUser) {
        return NextResponse.redirect(`${FRONTEND_URL}/#/login?error=not_authenticated`);
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

      return NextResponse.redirect(`${FRONTEND_URL}/#/settings?google_calendar=connected`);
    }

    // ---- SIGNIN MODE: create or find user ----
    // Look up by googleId first, then by email
    let user = await prisma.user.findFirst({
      where: { googleId: userInfo.sub },
      include: { company: true },
    });

    if (!user) {
      // Check if email already exists — link accounts
      user = await prisma.user.findUnique({
        where: { email: userInfo.email },
        include: { company: true },
      });

      if (user) {
        // Link Google to existing account
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: userInfo.sub, avatar: userInfo.picture ?? undefined },
          include: { company: true },
        }) as any;
      } else {
        // New user — create as PATIENT (no company yet)
        // They will be assigned to a company via public booking or admin invitation
        const tempPassword = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
        user = await prisma.user.create({
          data: {
            email: userInfo.email,
            name: userInfo.name,
            password: tempPassword,
            googleId: userInfo.sub,
            avatar: userInfo.picture ?? undefined,
            role: 'PATIENT',
            isActive: true,
          },
          include: { company: true },
        }) as any;
      }
    }

    if (!user!.isActive) {
      return NextResponse.redirect(`${FRONTEND_URL}/#/login?error=account_disabled`);
    }

    // Issue session (same mechanism as password login)
    const token = generateSessionToken(user!.id);

    const response = NextResponse.redirect(
      `${FRONTEND_URL}/#${state.returnTo || '/'}`
    );

    response.cookies.set('aura_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Also pass token in URL fragment so frontend can store to localStorage
    // We redirect to a special handler page
    return NextResponse.redirect(
      `${FRONTEND_URL}/#/auth/google-callback?token=${token}&returnTo=${encodeURIComponent(state.returnTo || '/')}`
    );
  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(`${FRONTEND_URL}/#/login?error=google_error`);
  }
}

function randomBytes(n: number) {
  return require('crypto').randomBytes(n);
}
```

**Step 4: Commit**

```bash
git add aura-backend/src/lib/google.ts \
        aura-backend/src/app/api/auth/google/route.ts \
        aura-backend/src/app/api/auth/google/callback/route.ts
git commit -m "feat: add Google OAuth sign-in backend routes"
```

---

## Task 3: Frontend — Google Auth Callback Handler Page

The backend redirects to `/#/auth/google-callback?token=...&returnTo=...`. We need a React component to pick up the token, store it, and redirect.

**Files:**
- Create: `pages/GoogleAuthCallback.tsx`
- Modify: `App.tsx` (add route)

**Step 1: Create GoogleAuthCallback page**

Create `pages/GoogleAuthCallback.tsx`:

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const { loginWithToken } = useApp();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const returnTo = params.get('returnTo') || '/';

    if (!token) {
      navigate('/login?error=no_token');
      return;
    }

    // Store token and load user
    loginWithToken(token).then((ok) => {
      if (ok) {
        navigate(decodeURIComponent(returnTo));
      } else {
        navigate('/login?error=invalid_token');
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
        <p className="text-secondary-600 font-sans">Autenticando com Google...</p>
      </div>
    </div>
  );
}
```

**Step 2: Find App.tsx route definitions and add the route**

In `App.tsx`, add:
```tsx
import GoogleAuthCallback from './pages/GoogleAuthCallback';
// Inside <Routes>:
<Route path="/auth/google-callback" element={<GoogleAuthCallback />} />
```

**Step 3: Commit**

```bash
git add pages/GoogleAuthCallback.tsx App.tsx
git commit -m "feat: add Google auth callback handler page"
```

---

## Task 4: AppContext — Add loginWithToken and googleLogin

**Files:**
- Modify: `context/AppContext.tsx`
- Modify: `services/api.ts`

**Step 1: Add `googleLogin` to api.ts**

In `services/api.ts`, inside `authApi`:

```typescript
// Adds to authApi object:
async googleSignIn(mode: 'signin' | 'calendar' = 'signin', returnTo = '/') {
  // Redirects browser to Google OAuth — no fetch needed
  const backendBase = API_BASE_URL;
  const params = new URLSearchParams({ mode, returnTo });
  window.location.href = `${backendBase}/api/auth/google?${params}`;
},
```

**Step 2: Add `loginWithToken` to AppContext**

In `context/AppContext.tsx`, add `loginWithToken` to the context interface and implementation:

```typescript
// Interface addition:
loginWithToken: (token: string) => Promise<boolean>;

// Implementation:
const loginWithToken = async (token: string): Promise<boolean> => {
  try {
    localStorage.setItem('aura_token', token);
    const result = await authApi.me();
    if (result.success && result.data?.user) {
      setUser(result.data.user);
      // Load company data as in regular login
      await loadCompanyData(result.data.user.companyId);
      return true;
    }
    localStorage.removeItem('aura_token');
    return false;
  } catch {
    localStorage.removeItem('aura_token');
    return false;
  }
};
```

Expose `loginWithToken` in the context value object.

**Step 3: Commit**

```bash
git add context/AppContext.tsx services/api.ts
git commit -m "feat: add loginWithToken and googleSignIn to AppContext and api"
```

---

## Task 5: Frontend — Google Sign-In Buttons on Login Page

**Files:**
- Modify: `pages/Login.tsx`

**Step 1: Add the Google sign-in button**

In `pages/Login.tsx`, add a Google button below the existing login form in both the login and register tabs:

```tsx
// Add after the submit button in both login and register forms:
<div className="relative my-4">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-secondary-200" />
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="px-3 bg-white text-secondary-400">ou</span>
  </div>
</div>

<button
  type="button"
  onClick={() => authApi.googleSignIn('signin', '/')}
  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-secondary-300 rounded-xl text-secondary-700 hover:bg-secondary-50 transition-colors font-sans text-sm"
>
  {/* Google SVG icon */}
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
  Continuar com Google
</button>
```

**Step 2: Handle error params from URL**

At the top of `Login.tsx`, add error display if URL has `?error=google_denied` etc.:

```tsx
const urlParams = new URLSearchParams(window.location.search);
const oauthError = urlParams.get('error');
// Show error banner if oauthError is set
```

**Step 3: Commit**

```bash
git add pages/Login.tsx
git commit -m "feat: add Google sign-in button to login page"
```

---

## Task 6: Backend — Google Calendar Connect Route (Phase 2)

This reuses the same `/api/auth/google/callback` route. When `mode=calendar`, the callback stores the calendar tokens on the already-authenticated user.

The initiation is: **Settings page** sends user to `/api/auth/google?mode=calendar&returnTo=/settings`.

**Files:**
- No new files needed (callback route already handles `mode=calendar` from Task 2)
- Modify: `aura-backend/src/app/api/auth/google/calendar/status/route.ts` (new — get connection status)
- Modify: `aura-backend/src/app/api/auth/google/calendar/disconnect/route.ts` (new — disconnect)

**Step 1: Create calendar status route**

Create `aura-backend/src/app/api/auth/google/calendar/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { googleCalendarConnected: true, googleCalendarId: true },
  });

  return NextResponse.json({
    connected: dbUser?.googleCalendarConnected ?? false,
    calendarId: dbUser?.googleCalendarId ?? null,
  });
}
```

**Step 2: Create calendar disconnect route**

Create `aura-backend/src/app/api/auth/google/calendar/disconnect/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Remove the webhook watch if any
  const watch = await prisma.googleCalendarWatch.findUnique({ where: { userId: user.id } });
  if (watch) {
    // Try to stop the Google channel (best effort)
    try {
      await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await prisma.user.findUnique({ where: { id: user.id }, select: { googleAccessToken: true } }))?.googleAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: watch.channelId, resourceId: watch.resourceId }),
      });
    } catch { /* ignore */ }
    await prisma.googleCalendarWatch.delete({ where: { userId: user.id } });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleCalendarId: null,
      googleCalendarConnected: false,
      googleTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
```

**Step 3: Commit**

```bash
git add aura-backend/src/app/api/auth/google/calendar/
git commit -m "feat: add calendar status and disconnect routes"
```

---

## Task 7: Backend — Calendar Sync Service

This is the core sync logic. Split into a reusable module so both appointment creation/update/cancel routes can call it.

**Files:**
- Create: `aura-backend/src/lib/calendarSync.ts`

**Step 1: Create calendarSync.ts**

```typescript
// aura-backend/src/lib/calendarSync.ts
// Handles syncing Aura appointments ↔ Google Calendar

import prisma from '@/lib/prisma';
import { refreshAccessToken } from '@/lib/google';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const AURA_SOURCE_TAG = 'aura-system';

// Ensure token is valid, refresh if needed
async function getValidToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiresAt: true,
      googleCalendarConnected: true,
    },
  });

  if (!user?.googleCalendarConnected || !user.googleAccessToken) return null;

  const isExpired = user.googleTokenExpiresAt
    ? new Date(user.googleTokenExpiresAt) < new Date(Date.now() + 60_000)
    : false;

  if (isExpired && user.googleRefreshToken) {
    const refreshed = await refreshAccessToken(user.googleRefreshToken);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: refreshed.access_token,
        googleTokenExpiresAt: newExpiry,
      },
    });
    return refreshed.access_token;
  }

  return user.googleAccessToken;
}

// Build Google Calendar event body from Aura appointment
function buildEventBody(appointment: {
  date: Date;
  durationMinutes: number;
  patientName: string;
  procedureName: string;
  notes?: string | null;
}) {
  const start = new Date(appointment.date);
  const end = new Date(start.getTime() + appointment.durationMinutes * 60_000);

  return {
    summary: `${appointment.patientName} — ${appointment.procedureName}`,
    description: [
      `Procedimento: ${appointment.procedureName}`,
      appointment.notes ? `Observações: ${appointment.notes}` : null,
      '---',
      'Agendamento via Aura System',
    ].filter(Boolean).join('\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: { source: AURA_SOURCE_TAG },
    },
  };
}

// Push a new Aura appointment to Google Calendar
export async function pushAppointmentToCalendar(appointmentId: string): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { name: true } },
      procedure: { select: { name: true } },
      professional: {
        select: {
          id: true,
          googleCalendarConnected: true,
          googleCalendarId: true,
        },
      },
    },
  });

  if (!appt || !appt.professional.googleCalendarConnected) return;

  const token = await getValidToken(appt.professional.id);
  if (!token) return;

  const calendarId = appt.professional.googleCalendarId ?? 'primary';
  const body = buildEventBody({
    date: appt.date,
    durationMinutes: appt.durationMinutes,
    patientName: appt.patient.name,
    procedureName: appt.procedure.name,
    notes: appt.notes,
  });

  // If already has a Google event, update it
  if (appt.googleEventId) {
    await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${appt.googleEventId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return;
  }

  // Create new event
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const event = await res.json();
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleEventId: event.id },
    });
  }
}

// Delete a Google Calendar event when appointment is canceled
export async function deleteCalendarEvent(appointmentId: string): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      professional: { select: { id: true, googleCalendarId: true, googleCalendarConnected: true } },
    },
  });

  if (!appt?.googleEventId || !appt.professional.googleCalendarConnected) return;

  const token = await getValidToken(appt.professional.id);
  if (!token) return;

  const calendarId = appt.professional.googleCalendarId ?? 'primary';
  await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${appt.googleEventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { googleEventId: null },
  });
}

// Register a push webhook channel for a professional's Google Calendar
export async function registerCalendarWatch(userId: string): Promise<void> {
  const token = await getValidToken(userId);
  if (!token) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleCalendarId: true },
  });

  const calendarId = user?.googleCalendarId ?? 'primary';
  const channelId = crypto.randomUUID();
  const webhookUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://aura-backend-api.vercel.app'}/api/webhooks/google-calendar`;

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        // Expiration: 7 days (max allowed by Google)
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    }
  );

  if (!res.ok) return;
  const data = await res.json();

  // Upsert watch record
  await prisma.googleCalendarWatch.upsert({
    where: { userId },
    update: {
      channelId,
      resourceId: data.resourceId,
      expiration: new Date(Number(data.expiration)),
    },
    create: {
      channelId,
      resourceId: data.resourceId,
      expiration: new Date(Number(data.expiration)),
      userId,
    },
  });
}

export { AURA_SOURCE_TAG };
```

**Step 2: Commit**

```bash
git add aura-backend/src/lib/calendarSync.ts
git commit -m "feat: add Google Calendar sync service (push events, delete, watch)"
```

---

## Task 8: Backend — Hook Calendar Sync into Appointment Routes

**Files:**
- Modify: `aura-backend/src/app/api/appointments/route.ts`
- Modify: `aura-backend/src/app/api/appointments/[id]/route.ts`
- Modify: `aura-backend/src/app/api/appointments/[id]/status/route.ts`

**Step 1: Hook `pushAppointmentToCalendar` on appointment create**

In `aura-backend/src/app/api/appointments/route.ts`, after the `prisma.appointment.create(...)` call, add (non-blocking, best effort):

```typescript
import { pushAppointmentToCalendar } from '@/lib/calendarSync';

// After appointment created:
pushAppointmentToCalendar(appointment.id).catch(console.error);
```

**Step 2: Hook `pushAppointmentToCalendar` on appointment update**

In `aura-backend/src/app/api/appointments/[id]/route.ts`, after `prisma.appointment.update(...)`:

```typescript
import { pushAppointmentToCalendar } from '@/lib/calendarSync';

pushAppointmentToCalendar(appointment.id).catch(console.error);
```

**Step 3: Hook `deleteCalendarEvent` on cancellation**

In `aura-backend/src/app/api/appointments/[id]/status/route.ts`, when status becomes `CANCELED`:

```typescript
import { deleteCalendarEvent } from '@/lib/calendarSync';

if (newStatus === 'CANCELED') {
  deleteCalendarEvent(id).catch(console.error);
}
```

**Step 4: Commit**

```bash
git add aura-backend/src/app/api/appointments/
git commit -m "feat: push appointments to Google Calendar on create/update/cancel"
```

---

## Task 9: Backend — Google Calendar Webhook Receiver

When Google detects a change in a professional's calendar, it POSTs to our webhook. We fetch the changed events and create UnavailabilityRules for any non-Aura events.

**Files:**
- Create: `aura-backend/src/app/api/webhooks/google-calendar/route.ts`

**Step 1: Create webhook handler**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { refreshAccessToken } from '@/lib/google';
import { AURA_SOURCE_TAG } from '@/lib/calendarSync';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export async function POST(request: NextRequest) {
  // Google sends channel ID in headers
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceState = request.headers.get('x-goog-resource-state');

  // 'sync' is the initial notification — ignore it
  if (resourceState === 'sync' || !channelId) {
    return NextResponse.json({ ok: true });
  }

  // Find which professional this channel belongs to
  const watch = await prisma.googleCalendarWatch.findUnique({
    where: { channelId },
    include: {
      user: {
        select: {
          id: true,
          companyId: true,
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiresAt: true,
          googleCalendarId: true,
        },
      },
    },
  });

  if (!watch || !watch.user.companyId) return NextResponse.json({ ok: true });

  const user = watch.user;

  // Get a valid token
  let token = user.googleAccessToken;
  if (user.googleTokenExpiresAt && new Date(user.googleTokenExpiresAt) < new Date(Date.now() + 60_000)) {
    if (user.googleRefreshToken) {
      const refreshed = await refreshAccessToken(user.googleRefreshToken).catch(() => null);
      if (refreshed) {
        token = refreshed.access_token;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleAccessToken: refreshed.access_token,
            googleTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
          },
        });
      }
    }
  }

  if (!token) return NextResponse.json({ ok: true });

  const calendarId = user.googleCalendarId ?? 'primary';

  // Fetch events updated in the last 15 minutes
  const timeMin = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const eventsRes = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?updatedMin=${timeMin}&singleEvents=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!eventsRes.ok) return NextResponse.json({ ok: true });
  const eventsData = await eventsRes.json();
  const events = eventsData.items ?? [];

  for (const event of events) {
    // Skip events created by Aura itself (prevent echo loop)
    if (event.extendedProperties?.private?.source === AURA_SOURCE_TAG) continue;
    // Skip cancelled events and all-day events
    if (event.status === 'cancelled' || !event.start?.dateTime) continue;

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const dateStr = start.toISOString().split('T')[0]; // YYYY-MM-DD
    const startTime = start.toTimeString().slice(0, 5); // HH:mm
    const endTime = end.toTimeString().slice(0, 5);

    // Upsert unavailability rule for this external event
    // We use description to store the Google event ID for deduplication
    const existingRule = await prisma.unavailabilityRule.findFirst({
      where: {
        companyId: user.companyId!,
        description: `google:${event.id}`,
      },
    });

    if (existingRule) {
      await prisma.unavailabilityRule.update({
        where: { id: existingRule.id },
        data: { startTime, endTime, dates: [dateStr] },
      });
    } else {
      await prisma.unavailabilityRule.create({
        data: {
          companyId: user.companyId!,
          description: `google:${event.id}`,
          startTime,
          endTime,
          dates: [dateStr],
          professionalIds: [user.id],
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
```

**Step 2: Commit**

```bash
git add aura-backend/src/app/api/webhooks/google-calendar/route.ts
git commit -m "feat: add Google Calendar webhook receiver to block external events"
```

---

## Task 10: Backend — Vercel Cron Job (Renew Webhooks)

Google webhook channels expire after 7 days. A Vercel Cron renews them every 6 days.

**Files:**
- Create: `aura-backend/src/app/api/cron/renew-calendar-watches/route.ts`
- Modify: `aura-backend/vercel.json`

**Step 1: Create cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { registerCalendarWatch } from '@/lib/calendarSync';

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find watches expiring within the next 2 days
  const threshold = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const expiringWatches = await prisma.googleCalendarWatch.findMany({
    where: { expiration: { lte: threshold } },
    select: { userId: true },
  });

  let renewed = 0;
  for (const { userId } of expiringWatches) {
    await registerCalendarWatch(userId).catch(console.error);
    renewed++;
  }

  return NextResponse.json({ renewed });
}
```

**Step 2: Add cron config to vercel.json** (create if missing in aura-backend):

Check if `aura-backend/vercel.json` exists. If not, create it:

```json
{
  "crons": [
    {
      "path": "/api/cron/renew-calendar-watches",
      "schedule": "0 6 */6 * *"
    }
  ]
}
```

Also add `CRON_SECRET` to Vercel environment variables (any random string).

**Step 3: Commit**

```bash
git add aura-backend/src/app/api/cron/renew-calendar-watches/route.ts \
        aura-backend/vercel.json
git commit -m "feat: add Vercel cron to renew Google Calendar webhook channels"
```

---

## Task 11: Frontend — Connect Google Calendar in Settings

**Files:**
- Modify: `pages/Settings.tsx`
- Modify: `services/api.ts`

**Step 1: Add calendarApi to api.ts**

In `services/api.ts`, add a new export:

```typescript
export const calendarApi = {
  async getStatus() {
    return fetchApi<{ connected: boolean; calendarId: string | null }>(
      '/api/auth/google/calendar/status'
    );
  },

  async connect(returnTo = '/settings') {
    // Redirect to Google OAuth with calendar scope
    window.location.href = `${API_BASE_URL}/api/auth/google?mode=calendar&returnTo=${encodeURIComponent(returnTo)}`;
  },

  async disconnect() {
    return fetchApi('/api/auth/google/calendar/disconnect', { method: 'POST' });
  },
};
```

Also add to the `api` export object: `calendar: calendarApi`.

**Step 2: Add Google Calendar section to Settings.tsx**

Find the accordion section area in Settings.tsx. Add a new section:

```tsx
// Import at top:
import { calendarApi } from '../services/api';

// State additions:
const [calendarConnected, setCalendarConnected] = useState(false);
const [calendarLoading, setCalendarLoading] = useState(false);

// useEffect to check status on mount:
useEffect(() => {
  calendarApi.getStatus().then((res) => {
    if (res.success && res.data) setCalendarConnected(res.data.connected);
  });
}, []);

// Handlers:
const handleConnectCalendar = () => {
  calendarApi.connect('/#/settings');
};
const handleDisconnectCalendar = async () => {
  setCalendarLoading(true);
  await calendarApi.disconnect();
  setCalendarConnected(false);
  setCalendarLoading(false);
};

// Check URL for success param on mount:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('google_calendar') === 'connected') {
    setCalendarConnected(true);
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);
```

**Step 3: Add the Google Calendar card in Settings JSX**

Insert in the integrations/configurações section:

```tsx
<div className="bg-white rounded-2xl border border-secondary-200 p-6">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      {/* Google Calendar icon */}
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
          <path d="M3 9h18" stroke="#4285F4" strokeWidth="1.5"/>
          <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
          <text x="12" y="18" textAnchor="middle" fill="#EA4335" fontSize="7" fontWeight="700">G</text>
        </svg>
      </div>
      <div>
        <h3 className="font-semibold text-secondary-800">Google Calendar</h3>
        <p className="text-sm text-secondary-500">
          {calendarConnected
            ? 'Calendário conectado — agendamentos sincronizam automaticamente'
            : 'Sincronize seus agendamentos com o Google Calendar'}
        </p>
      </div>
    </div>

    {calendarConnected ? (
      <button
        onClick={handleDisconnectCalendar}
        disabled={calendarLoading}
        className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
      >
        {calendarLoading ? 'Desconectando...' : 'Desconectar'}
      </button>
    ) : (
      <button
        onClick={handleConnectCalendar}
        className="px-4 py-2 text-sm bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
      >
        Conectar
      </button>
    )}
  </div>

  {calendarConnected && (
    <div className="mt-4 pt-4 border-t border-secondary-100 flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-green-400" />
      <span className="text-xs text-secondary-500">Sincronização bidirecional ativa</span>
    </div>
  )}
</div>
```

**Step 4: Also trigger `registerCalendarWatch` after calendar connect**

In the callback route (`Task 2, Step 3`), after updating user with calendar tokens (in `mode === 'calendar'` branch), add:

```typescript
import { registerCalendarWatch } from '@/lib/calendarSync';
// After prisma.user.update:
registerCalendarWatch(authUser.id).catch(console.error);
```

**Step 5: Commit**

```bash
git add pages/Settings.tsx services/api.ts \
        aura-backend/src/app/api/auth/google/callback/route.ts
git commit -m "feat: add Google Calendar connect/disconnect UI in Settings"
```

---

## Task 12: Frontend — Show Google Calendar Blocks in Schedule

External Google events become `UnavailabilityRule` records with `description` starting with `google:`. The existing Schedule.tsx already renders unavailability rules as blocked slots. We just need to show them differently (with a Google icon).

**Files:**
- Modify: `pages/Schedule.tsx`

**Step 1: Detect Google-sourced unavailability rules**

In `Schedule.tsx`, where unavailability rules are rendered, check if `rule.description?.startsWith('google:')` and apply different styling:

```tsx
// When rendering a blocked slot from unavailability rule:
const isGoogleBlock = rule.description?.startsWith('google:');

// Style difference:
<div className={`... ${isGoogleBlock
  ? 'bg-blue-50 border-blue-200 text-blue-600'
  : 'bg-secondary-100 border-secondary-200 text-secondary-500'
}`}>
  {isGoogleBlock ? (
    <span className="flex items-center gap-1 text-xs">
      <svg className="w-3 h-3" viewBox="0 0 24 24">...</svg>
      Bloqueado (Google)
    </span>
  ) : (
    <span className="text-xs">Indisponível</span>
  )}
</div>
```

**Step 2: Commit**

```bash
git add pages/Schedule.tsx
git commit -m "feat: display Google Calendar blocks visually in Schedule"
```

---

## Task 13: Deploy and End-to-End Test

**Step 1: Build and validate locally**

```bash
# Frontend
cd /c/Aura_System
npm run build
# Expected: No TypeScript errors, build succeeds

# Backend
cd aura-backend
npx tsc --noEmit
# Expected: No type errors
```

**Step 2: Run Prisma migration on production**

```bash
cd aura-backend
DATABASE_URL=<production_url> npx prisma migrate deploy
```

**Step 3: Deploy**

```bash
# Frontend
cd /c/Aura_System
vercel --prod --yes

# Backend (push to git, Vercel auto-deploys)
git push origin master
```

**Step 4: Manual E2E checklist**

- [ ] Visit https://aura-system-mu.vercel.app/#/login → click "Continuar com Google" → Google consent → returns to app logged in
- [ ] Visit `/#/settings` → click "Conectar" → Google consent (with calendar scope) → returns to settings with "Conectado" status
- [ ] Create an appointment in Aura → verify event appears in Google Calendar within ~30 seconds
- [ ] Create an external event in Google Calendar (not via Aura) → within a few minutes, verify the time slot appears as blocked (blue) in Aura Schedule
- [ ] Cancel an Aura appointment → verify the Google Calendar event is deleted

---

## Environment Variables Summary

### aura-backend (Vercel)
| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://aura-backend-api.vercel.app/api/auth/google/callback` |
| `FRONTEND_URL` | `https://aura-system-mu.vercel.app` |
| `CRON_SECRET` | any random string (e.g., `openssl rand -hex 32`) |

### aura-system (Vercel frontend)
No new env vars needed — the backend URL is already `VITE_API_URL`.

---

## Notes & Gotchas

1. **`password` field is required** in the Prisma `User` model (`NOT NULL`). For Google-only users, we generate a random bcrypt hash as a placeholder (they can never "log in with password" using it).

2. **Echo loop prevention**: Events created by Aura have `extendedProperties.private.source = 'aura-system'`. The webhook handler skips these events.

3. **Token storage**: We store Google tokens in Prisma DB (server-side only). Never sent to frontend.

4. **Webhook URL for local dev**: Google cannot reach `localhost`. For local testing of Phase 2, use [ngrok](https://ngrok.com) to expose the local backend and update `GOOGLE_REDIRECT_URI` and the webhook URL temporarily.

5. **`auth/google/callback` reads the session cookie** for `mode=calendar`. Ensure the cookie is sent cross-origin (the backend redirect URL is on a different domain than the frontend). The `sameSite: 'lax'` setting allows this for redirects.

6. **commissionType field**: The `User` model in `types.ts` has a `commissionType` field that doesn't exist in `schema.prisma`. Don't add it — it's a frontend-only concern.
