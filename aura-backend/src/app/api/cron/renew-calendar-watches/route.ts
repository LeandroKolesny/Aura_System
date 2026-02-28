import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { registerCalendarWatch } from '@/lib/calendarSync';

/**
 * Validates the cron request using the Authorization: Bearer <CRON_SECRET> header.
 * Uses timingSafeEqual to prevent timing-based secret enumeration attacks.
 * Vercel Cron Jobs send this header automatically when CRON_SECRET is set.
 */
function validateCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET environment variable is not set');
    return false;
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return false;

  try {
    const provided = Buffer.from(token);
    const expected = Buffer.from(cronSecret);
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Vercel Cron authenticates with Authorization: Bearer <CRON_SECRET>
  if (!validateCronSecret(request)) {
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
