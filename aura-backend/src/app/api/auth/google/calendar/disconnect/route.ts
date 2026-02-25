import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Stop the Google webhook channel if one exists
  const watch = await prisma.googleCalendarWatch.findUnique({
    where: { userId: user.id },
  });

  if (watch) {
    // Get current access token for the stop request
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { googleAccessToken: true },
    });

    if (dbUser?.googleAccessToken && watch.resourceId) {
      // Best-effort: stop the Google push channel
      fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${dbUser.googleAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: watch.channelId,
          resourceId: watch.resourceId,
        }),
      }).catch(console.error); // fire-and-forget
    }

    await prisma.googleCalendarWatch.delete({ where: { userId: user.id } });
  }

  // Clear all Google credentials from the user
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
