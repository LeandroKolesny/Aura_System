// aura-backend/src/app/api/billing/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const plans = await prisma.saasPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
    select: {
      id: true,
      name: true,
      displayName: true,
      price: true,
      features: true,
      maxProfessionals: true,
      maxPatients: true,
    },
  });

  // Buscar plano e status atual da empresa
  let currentPlan = null;
  let currentStatus = null;
  let subscriptionExpiresAt = null;

  if (user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        plan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });
    currentPlan = company?.plan ?? null;
    currentStatus = company?.subscriptionStatus ?? null;
    subscriptionExpiresAt = company?.subscriptionExpiresAt ?? null;
  }

  return NextResponse.json({
    success: true,
    data: {
      plans,
      currentPlan,
      currentStatus,
      subscriptionExpiresAt,
    },
  });
}
