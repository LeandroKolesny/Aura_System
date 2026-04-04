// PATCH /api/subscriptions/patients/[id]/activate
// Admin activates a PENDING subscription and confirms its linked pending_approval appointment
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    if (subscription.status !== "PENDING") {
      return NextResponse.json({ error: "Assinatura não está pendente" }, { status: 400 });
    }

    const updated = await prisma.patientSubscription.update({
      where: { id },
      data: { status: "ACTIVE", startDate: new Date() },
      include: {
        patient: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    // Confirm any linked pending_approval appointments
    await prisma.appointment.updateMany({
      where: {
        subscriptionId: id,
        companyId: user.companyId!,
        status: "PENDING_APPROVAL",
      },
      data: { status: "SCHEDULED" },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao ativar assinatura:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
