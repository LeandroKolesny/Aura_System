import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { refreshAccessToken } from '@/lib/google';
import { AURA_SOURCE_TAG } from '@/lib/calendarSync';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export async function POST(request: NextRequest) {
  // Google sends channel info in headers
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceState = request.headers.get('x-goog-resource-state');

  // 'sync' is the initial handshake notification — acknowledge and ignore
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

  if (!watch || !watch.user.companyId) {
    return NextResponse.json({ ok: true });
  }

  const user = watch.user;

  // Ensure we have a valid token (refresh if needed)
  let token = user.googleAccessToken;

  if (
    user.googleTokenExpiresAt &&
    new Date(user.googleTokenExpiresAt) < new Date(Date.now() + 60_000)
  ) {
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
        // If refresh fails, proceed without token (will skip event processing)
      }
    }
  }

  if (!token) {
    return NextResponse.json({ ok: true });
  }

  const calendarId = user.googleCalendarId ?? 'primary';

  // Fetch events updated in the last 15 minutes
  const timeMin = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const eventsRes = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?updatedMin=${timeMin}&singleEvents=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!eventsRes.ok) {
    return NextResponse.json({ ok: true });
  }

  const eventsData = await eventsRes.json();
  const events: any[] = eventsData.items ?? [];

  for (const event of events) {
    // Skip events created by Aura itself (prevent echo loop)
    if (event.extendedProperties?.private?.source === AURA_SOURCE_TAG) continue;

    // Skip cancelled events and all-day events (no dateTime = all-day)
    if (event.status === 'cancelled' || !event.start?.dateTime) continue;

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const dateStr = start.toISOString().split('T')[0]; // YYYY-MM-DD

    // Format HH:mm in local time
    const startTime = start.toTimeString().slice(0, 5);
    const endTime = end.toTimeString().slice(0, 5);

    // Use description field to store Google event ID for deduplication
    const googleEventRef = `google:${event.id}`;

    const existingRule = await prisma.unavailabilityRule.findFirst({
      where: {
        companyId: user.companyId!,
        description: googleEventRef,
      },
    });

    if (existingRule) {
      // Update times if the event was modified
      await prisma.unavailabilityRule.update({
        where: { id: existingRule.id },
        data: { startTime, endTime, dates: [dateStr] },
      });
    } else {
      // Create a new unavailability block for this external event
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
    }
  }

  return NextResponse.json({ ok: true });
}
