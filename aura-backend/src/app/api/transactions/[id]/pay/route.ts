// Aura System - Marcar parcela de parcelamento como paga
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { checkWriteAccess } from '@/lib/apiGuards';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    const { id } = await params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 });
    }

    if (transaction.status === 'PAID') {
      return NextResponse.json({ error: 'Transação já está paga' }, { status: 400 });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: { status: 'PAID', date: new Date() },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Erro ao marcar parcela como paga:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
