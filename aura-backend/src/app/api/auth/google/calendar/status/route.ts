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
