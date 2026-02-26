import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { refreshAccessToken } from '@/lib/google';
import prisma from '@/lib/prisma';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const AURA_SOURCE_TAG = 'aura-system';

// GET /api/appointments/check-google-conflicts?professionalId=&startTime=ISO&endTime=ISO
// Checks a professional's Google Calendar for conflicts at the given time range
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const startTimeISO = searchParams.get('startTime');
    const endTimeISO = searchParams.get('endTime');

    if (!professionalId || !startTimeISO || !endTimeISO) {
      return NextResponse.json({ hasConflict: false });
    }

    const professional = await prisma.user.findUnique({
      where: { id: professionalId },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiresAt: true,
        googleCalendarId: true,
        googleCalendarConnected: true,
      },
    });

    // Professional has no calendar connected — no conflict possible
    if (!professional?.googleCalendarConnected || !professional.googleAccessToken) {
      return NextResponse.json({ hasConflict: false });
    }

    // Refresh token if needed
    let token = professional.googleAccessToken;
    if (professional.googleTokenExpiresAt && new Date(professional.googleTokenExpiresAt) < new Date(Date.now() + 60_000)) {
      if (professional.googleRefreshToken) {
        try {
          const refreshed = await refreshAccessToken(professional.googleRefreshToken);
          token = refreshed.access_token;
          await prisma.user.update({
            where: { id: professionalId },
            data: {
              googleAccessToken: refreshed.access_token,
              googleTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
            },
          });
        } catch {
          return NextResponse.json({ hasConflict: false });
        }
      } else {
        return NextResponse.json({ hasConflict: false });
      }
    }

    const calendarId = professional.googleCalendarId ?? 'primary';

    const eventsRes = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(startTimeISO)}&timeMax=${encodeURIComponent(endTimeISO)}&singleEvents=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!eventsRes.ok) {
      // If we can't check, don't block the booking
      return NextResponse.json({ hasConflict: false });
    }

    const eventsData = await eventsRes.json();
    const events: any[] = eventsData.items ?? [];

    const conflict = events.find(event => {
      if (event.extendedProperties?.private?.source === AURA_SOURCE_TAG) return false;
      if (event.status === 'cancelled' || !event.start?.dateTime) return false;
      return true;
    });

    if (conflict) {
      const conflictStart = new Date(conflict.start.dateTime);
      const conflictEnd = new Date(conflict.end.dateTime);
      return NextResponse.json({
        hasConflict: true,
        event: {
          title: conflict.summary || 'Compromisso',
          start: conflictStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          end: conflictEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      });
    }

    return NextResponse.json({ hasConflict: false });
  } catch (error) {
    console.error('Erro ao verificar conflitos Google:', error);
    return NextResponse.json({ hasConflict: false });
  }
}
