// Aura System - Clube de Assinaturas: Edição/Desativação de Plano
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Edita plano
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    const existing = await prisma.subscriptionPlan.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    const body = await request.json() as {
      name?: string;
      price?: number;
      description?: string;
      isActive?: boolean;
      items?: { procedureId: string; sessionsPerCycle: number }[];
    };

    const { name, price, description, isActive, items } = body;

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        // Se items foram enviados, recria todos
        ...(items
          ? {
              items: {
                deleteMany: {},
                create: items.map((item) => ({
                  procedureId: item.procedureId,
                  sessionsPerCycle: item.sessionsPerCycle,
                })),
              },
            }
          : {}),
      },
      include: {
        items: {
          include: {
            procedure: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error("Erro ao editar plano de assinatura:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// DELETE - Desativa plano (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    const existing = await prisma.subscriptionPlan.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao desativar plano de assinatura:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
