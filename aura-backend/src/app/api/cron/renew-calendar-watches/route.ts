import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { registerCalendarWatch } from '@/lib/calendarSync';

export async function GET(request: NextRequest) {
  // Vercel Cron authenticates with a Bearer token
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

  return NextResponse.json({ renewed, total: expiringWatches.length });
}
