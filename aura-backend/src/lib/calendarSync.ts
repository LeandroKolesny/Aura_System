// aura-backend/src/lib/calendarSync.ts
// Handles syncing Aura appointments ↔ Google Calendar

import prisma from '@/lib/prisma';
import { refreshAccessToken } from '@/lib/google';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
export const AURA_SOURCE_TAG = 'aura-system';

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
    try {
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
    } catch {
      return null;
    }
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

// Push a new or updated Aura appointment to Google Calendar
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
    await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${appt.googleEventId}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return;
  }

  // Create new event
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

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
      professional: {
        select: { id: true, googleCalendarId: true, googleCalendarConnected: true },
      },
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

  const backendUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://aura-backend-api.vercel.app';
  const webhookUrl = `${backendUrl}/api/webhooks/google-calendar`;

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    }
  );

  if (!res.ok) return;
  const data = await res.json();

  await prisma.googleCalendarWatch.upsert({
    where: { userId },
    update: {
      channelId,
      resourceId: data.resourceId ?? null,
      expiration: new Date(Number(data.expiration)),
    },
    create: {
      channelId,
      resourceId: data.resourceId ?? null,
      expiration: new Date(Number(data.expiration)),
      userId,
    },
  });
}
