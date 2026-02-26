import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { refreshAccessToken } from '@/lib/google';
import prisma from '@/lib/prisma';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const AURA_SOURCE_TAG = 'aura-system';

// POST /api/auth/google/calendar/sync
// Fetches existing Google Calendar events (next 60 days) and creates unavailability rules
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        companyId: true,
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiresAt: true,
        googleCalendarId: true,
        googleCalendarConnected: true,
      },
    });

    if (!user?.googleCalendarConnected || !user.googleAccessToken) {
      return NextResponse.json({ success: false, error: 'Google Calendar não conectado' }, { status: 400 });
    }

    if (!user.companyId) {
      return NextResponse.json({ success: false, error: 'Usuário sem empresa' }, { status: 400 });
    }

    // Refresh token if expiring within 60s
    let token = user.googleAccessToken;
    if (user.googleTokenExpiresAt && new Date(user.googleTokenExpiresAt) < new Date(Date.now() + 60_000)) {
      if (user.googleRefreshToken) {
        try {
          const refreshed = await refreshAccessToken(user.googleRefreshToken);
          token = refreshed.access_token;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              googleAccessToken: refreshed.access_token,
              googleTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
            },
          });
        } catch {
          return NextResponse.json({ success: false, error: 'Falha ao renovar token do Google' }, { status: 401 });
        }
      }
    }

    const calendarId = user.googleCalendarId ?? 'primary';
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const eventsRes = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&maxResults=250`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!eventsRes.ok) {
      return NextResponse.json({ success: false, error: 'Falha ao buscar eventos do Google' }, { status: 502 });
    }

    const eventsData = await eventsRes.json();
    const events: any[] = eventsData.items ?? [];

    let synced = 0;

    for (const event of events) {
      if (event.extendedProperties?.private?.source === AURA_SOURCE_TAG) continue;
      if (event.status === 'cancelled' || !event.start?.dateTime) continue;

      // Extract date/time directly from Google's string to preserve the original local timezone
      // e.g. "2026-03-05T10:00:00-03:00" → dateStr="2026-03-05", startTime="10:00"
      const dateStr = event.start.dateTime.slice(0, 10);
      const startTime = event.start.dateTime.slice(11, 16);
      const endTime = event.end.dateTime.slice(11, 16);
      const googleEventRef = `google:${event.id}`;

      const existing = await prisma.unavailabilityRule.findFirst({
        where: { companyId: user.companyId!, description: googleEventRef },
      });

      if (existing) {
        await prisma.unavailabilityRule.update({
          where: { id: existing.id },
          data: { startTime, endTime, dates: [dateStr] },
        });
      } else {
        await prisma.unavailabilityRule.create({
          data: {
            companyId: user.companyId!,
            description: googleEventRef,
            startTime,
            endTime,
            dates: [dateStr],
            professionalIds: [user.id],
          },
        });
        synced++;
      }
    }

    return NextResponse.json({ success: true, synced });
  } catch (error) {
    console.error('Erro ao sincronizar Google Calendar:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
