import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!user.companyId) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      plan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      status: company.subscriptionStatus,
      plan: company.plan,
      expiresAt: company.subscriptionExpiresAt,
    },
  });
}
