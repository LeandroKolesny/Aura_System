// Aura System - Clube de Assinaturas: Cancelamento de Assinatura
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Cancela assinatura do paciente
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    const subscription = await prisma.patientSubscription.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    if (subscription.status === "CANCELED") {
      return NextResponse.json({ error: "Assinatura já está cancelada" }, { status: 409 });
    }

    const updated = await prisma.patientSubscription.update({
      where: { id },
      data: { status: "CANCELED" },
      include: {
        patient: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
